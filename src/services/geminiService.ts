import { ALL_CATEGORIES } from "../constants/categories";
import { extractTextFromPdf } from "./pdfExtractor";
import { apiLogAiUsage, apiGetUserTokenUsage } from "./api";

const insightsCache = new Map<string, { data: DashboardInsight[], timestamp: number }>();
const analysisCache = new Map<string, { data: string, timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 15;

const KIE_BASE = "https://api.kie.ai";
const KIE_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";

// Models for analysis tasks (quality priority)
const ANALYSIS_MODELS = [
  { model: "gemini-2.5-pro",   url: `${KIE_BASE}/gemini-2.5-pro/v1/chat/completions` },
  { model: "gemini-2.5-flash", url: `${KIE_BASE}/gemini-2.5-flash/v1/chat/completions` },
  { model: "gemini-2.0-flash", url: `${KIE_BASE}/gemini-2.0-flash/v1/chat/completions` },
];

// Models for scan/OCR tasks (speed priority)
const SCAN_MODELS = [
  { model: "gemini-2.5-flash", url: `${KIE_BASE}/gemini-2.5-flash/v1/chat/completions` },
  { model: "gemini-2.0-flash", url: `${KIE_BASE}/gemini-2.0-flash/v1/chat/completions` },
  { model: "gemini-2.5-pro",   url: `${KIE_BASE}/gemini-2.5-pro/v1/chat/completions` },
];

function getConfig() {
  if (!KIE_API_KEY) throw new Error("GEMINI_API_KEY tidak dikonfigurasi.");
  return { apiKey: KIE_API_KEY };
}

interface ChatResult {
  content: string;
  tokensUsed: number;
}

async function trySingleModel(
  modelEntry: { model: string; url: string },
  messages: { role: string; content: any }[],
  jsonMode: boolean,
  maxTokens: number = 8192,
): Promise<ChatResult> {
  const { apiKey } = getConfig();
  const hasImage = messages.some(m =>
    Array.isArray(m.content) && m.content.some((c: any) => c.type === "image_url")
  );

  const body: any = {
    model: modelEntry.model,
    messages,
    max_tokens: maxTokens,
  };

  if (jsonMode && !hasImage) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(modelEntry.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.code && data.code >= 400) {
    throw new Error(`Model error ${data.code}: ${data.msg}`);
  }

  const content = data.choices?.[0]?.message?.content || "";
  const tokensUsed = data.usage
    ? (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0)
    : estimateTokens(messages, content);

  return { content, tokensUsed };
}

async function chatCompletion(
  messages: { role: string; content: any }[],
  jsonMode = false,
  models = ANALYSIS_MODELS,
  maxTokens = 8192,
): Promise<ChatResult> {
  let lastError: any;
  for (const modelEntry of models) {
    try {
      const result = await trySingleModel(modelEntry, messages, jsonMode, maxTokens);
      if (result.content) return result;
    } catch (err: any) {
      console.warn(`Model ${modelEntry.model} failed:`, err?.message);
      lastError = err;
    }
  }
  throw lastError || new Error("Semua model AI tidak tersedia.");
}

function estimateTokens(messages: { role: string; content: any }[], output: string): number {
  let inputText = "";
  for (const m of messages) {
    if (typeof m.content === "string") {
      inputText += m.content;
    } else if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === "text") inputText += c.text || "";
        if (c.type === "image_url") inputText += "[IMAGE]";
      }
    }
  }
  return Math.ceil((inputText.length + output.length) / 4);
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
}

async function checkTokenLimit(userId: string, plan: string): Promise<void> {
  const usage = await apiGetUserTokenUsage(userId, plan);
  if (usage.remaining <= 0) {
    throw new Error(`KUOTA_HABIS:Had imbasan untuk pakej ${plan} telah habis. Sila naik taraf pelan atau hubungi admin untuk dapatkan bantuan.`);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes("429") || error?.status === 429;
      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export interface ExtractedData {
  type: "income" | "expense";
  docType: string;
  docNumber?: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  payment_method?: "cash" | "bank";
}

async function compressImage(base64Data: string, maxWidth = 1024, quality = 0.6): Promise<string> {
  const MAX_SIZE = 1_500_000;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(base64Data); return; }
      ctx.drawImage(img, 0, 0, width, height);
      let compressed = canvas.toDataURL("image/jpeg", quality);
      if (compressed.length > MAX_SIZE) {
        const ratio = Math.sqrt(MAX_SIZE / compressed.length);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        compressed = canvas.toDataURL("image/jpeg", 0.5);
      }
      resolve(compressed.length < base64Data.length * 1.1 ? compressed : base64Data);
    };
    img.onerror = () => resolve(base64Data);
    img.src = base64Data.startsWith("data:") ? base64Data : `data:image/jpeg;base64,${base64Data}`;
  });
}

export async function analyzeDocument(base64Data: string, mimeType: string = "image/jpeg", userId?: string, plan?: string): Promise<ExtractedData[] | null> {
  try {
    if (userId && plan) {
      await checkTokenLimit(userId, plan);
    }
    const isPdf = mimeType === "application/pdf" || base64Data.includes("data:application/pdf");

    const currentYear = new Date().getFullYear();
    const prompt = `You are an expert OCR and accounting data extraction assistant. Your job is to extract transaction data from receipts, invoices, and financial documents.

CRITICAL RULES:
1. You MUST respond with ONLY a valid JSON array — no explanation, no markdown, no preamble
2. Even if the image is blurry or partial, extract whatever data you can see
3. If you can see ANY amount, date, or store name — create an entry for it
4. NEVER refuse to extract — always attempt extraction
5. If truly nothing can be read, return exactly: []

Transaction rules:
- Receipt/Resit from shop, restaurant, petrol = expense (type: "expense")
- Payment received, sales, top-up received = income (type: "income")
- payment_method: "cash" if paid by cash/tunai/wang; "bank" if card/online/transfer
- date format: YYYY-MM-DD; if year missing use ${currentYear}; if date unclear use ${currentYear}-01-01
- amount: use the TOTAL amount (Jumlah/Total/Grand Total), as a positive number
- category must be exactly one of: ${ALL_CATEGORIES.join(", ")}
- docType: "Resit" for receipt, "Invoice" for invoice, "Bil" for bill, "Lain-lain" for others

Required JSON fields per item:
{ "type": "income"|"expense", "docType": string, "docNumber": string, "category": string, "amount": number, "date": "YYYY-MM-DD", "description": string, "payment_method": "cash"|"bank" }

Example output:
[{"type":"expense","docType":"Resit","docNumber":"INV-001","category":"PETROL, PARKING AND TOLL","amount":50.00,"date":"${currentYear}-01-15","description":"Shell Petrol Station","payment_method":"cash"}]

Extract from the document now:`;

    let messages: { role: string; content: any }[];
    let isBankStatement = false;

    if (isPdf) {
      let pdfText = "";
      try {
        pdfText = await extractTextFromPdf(base64Data);
      } catch (pdfErr) {
        console.error("PDF extraction failed:", pdfErr);
        pdfText = "[PDF content could not be extracted - please try an image format]";
      }

      // Detect if this is a bank statement
      isBankStatement = /Statement of Account|Penyata Akaun|OPENING BALANCE|CLOSING BALANCE|No of Withdrawal/i.test(pdfText);

      if (isBankStatement) {
        // Process bank statement page by page for accuracy
        const pages = pdfText.split(/--- Page \d+ ---/).filter(p => p.trim());
        const allResults: ExtractedData[] = [];
        let totalTokens = 0;

        const bankPrompt = (pageInfo: string) => `Extract ALL transactions from this page of a CIMB Islamic Bank statement into JSON.

CRITICAL RULES:
1. Respond with ONLY a valid JSON array
2. Extract EVERY transaction line — do NOT skip or merge any
3. Each transaction has a UNIQUE reference number — use it as docNumber
4. Two transactions with same amount/date are DIFFERENT if they have different reference numbers
5. NEVER merge transactions. Every date line = one transaction.

Transaction type rules:
- Withdrawal (money OUT) = "expense": DUITNOW TO ACCOUNT/MOBILE/ID when sending money, MYDEBIT PURCHASE, POS DEBIT, JOMPAY
- Deposit (money IN) = "income": AUTOPAY CR, IBG CREDIT, CDM CASH DEPOSIT, HSE CHQ DEPOSIT, I-FUNDS TR FROM SA, DUITNOW TO ACCOUNT when receiving
- Balance column: increases = income; decreases = expense
- payment_method: always "bank"
- category: "SALES" for income, "Lain-lain" for expense
- date: YYYY-MM-DD (year 2025)
- docNumber: the Cheque/Ref No shown
- docType: "Penyata Bank"
- description: transaction description

${pageInfo}
Return ONLY JSON: [{"type":"income"|"expense","docType":"Penyata Bank","docNumber":"...","category":"SALES"|"Lain-lain","amount":number,"date":"YYYY-MM-DD","description":"...","payment_method":"bank"}]`;

        for (let i = 0; i < pages.length; i++) {
          const pageContent = pages[i].trim();
          if (!pageContent || pageContent.length < 30) continue;
          // Skip pages that don't have transaction data
          if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(pageContent)) continue;

          const pageMessages = [{
            role: "user",
            content: `${bankPrompt(`Page ${i + 1} of ${pages.length}.`)}\n\nPAGE CONTENT:\n${pageContent}`,
          }];

          try {
            const { content: pageResult, tokensUsed: pgTokens } = await withRetry(
              () => chatCompletion(pageMessages, false, SCAN_MODELS, 16384), 3, 1000
            );
            totalTokens += pgTokens;

            if (pageResult && pageResult.trim()) {
              const jsonStr = extractJson(pageResult);
              let parsed = JSON.parse(jsonStr);
              if (!Array.isArray(parsed)) parsed = parsed.transactions || parsed.data || [parsed];
              const valid = parsed.filter((item: any) => item && Number(item.amount) > 0);
              allResults.push(...valid);
            }
          } catch (pageErr: any) {
            console.warn(`[BankScan] Page ${i + 1} failed:`, pageErr?.message);
          }
        }

        if (userId && totalTokens > 0) {
          apiLogAiUsage(userId, totalTokens, "scan").catch(() => {});
        }

        if (allResults.length > 0) {
          // Deduplicate using docNumber
          const seen = new Set<string>();
          const deduped = allResults.filter(item => {
            const key = `${item.date}|${item.amount}|${item.docNumber || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Check expected count from summary
          const summaryMatch = pdfText.match(/No of Withdrawal[^\d]*(\d+)[\s\S]*?No of Deposits?[^\d]*(\d+)/i);
          if (summaryMatch) {
            const expectedTotal = parseInt(summaryMatch[1], 10) + parseInt(summaryMatch[2], 10);
            if (deduped.length < expectedTotal) {
              const missing = expectedTotal - deduped.length;
              for (let m = 0; m < missing; m++) {
                deduped.push({
                  type: "income",
                  docType: "Penyata Bank",
                  docNumber: `MANUAL-CHECK-${m + 1}`,
                  category: "Lain-lain",
                  amount: 0,
                  date: "2025-01-01",
                  description: `Transaksi tidak dapat dikesan (#${m + 1}) - sila semak manual`,
                  payment_method: "bank",
                });
              }
            }
          }

          return deduped;
        }
        return null;
      } else {
        messages = [{
          role: "user",
          content: `${prompt}\n\nDOCUMENT CONTENT (extracted from PDF):\n\n${pdfText}`,
        }];
      }
    } else {
      const isUrl = base64Data.startsWith("http");
      let imageUrl: string;
      if (isUrl) {
        imageUrl = base64Data;
      } else {
        const dataWithPrefix = base64Data.startsWith("data:")
          ? base64Data
          : `data:${mimeType};base64,${base64Data}`;
        const compressed = await compressImage(dataWithPrefix);
        imageUrl = compressed;
      }

      messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          { type: "text", text: prompt },
        ],
      }];
    }

    let result: ChatResult;
    try {
      result = await withRetry(() => chatCompletion(messages, false, SCAN_MODELS, 4096), 3, 1000);
    } catch (apiErr: any) {
      console.error("AI API call failed:", apiErr?.message);
      throw new Error("AI tidak dapat memproses imej. Sila cuba lagi.");
    }
    let { content: text, tokensUsed } = result;

    if (userId && tokensUsed > 0) {
      apiLogAiUsage(userId, tokensUsed, "scan").catch(() => {});
    }

    if (!text || text.trim() === "") {
      console.error("Empty response from AI");
      throw new Error("AI tidak dapat membaca dokumen ini. Sila cuba imej yang lebih jelas.");
    }

    const jsonStr = extractJson(text);
    let parsed: any[];
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const fallbackMessages = isPdf ? messages : [{
        role: "user" as const,
        content: [
          ...(Array.isArray(messages[0].content) ? messages[0].content.filter((c: any) => c.type === "image_url") : []),
          {
            type: "text",
            text: `Look at this document image. Tell me: what is the total amount, the date, and the store/vendor name? Reply ONLY as JSON: [{"type":"expense","docType":"Resit","docNumber":"","category":"Lain-lain","amount":0,"date":"${new Date().getFullYear()}-01-01","description":"","payment_method":"cash"}] — fill in the values you can read.`,
          },
        ],
      }];
      try {
        const retry = await chatCompletion(fallbackMessages, false, SCAN_MODELS, 4096);
        parsed = JSON.parse(extractJson(retry.content));
        if (userId && retry.tokensUsed > 0) {
          apiLogAiUsage(userId, retry.tokensUsed, "scan").catch(() => {});
        }
      } catch {
        throw new Error("AI tidak dapat membaca resit ini. Sila cuba gambar yang lebih jelas atau terang.");
      }
    }

    if (!Array.isArray(parsed)) {
      parsed = (parsed as any).transactions || (parsed as any).data || [parsed];
    }

    const filtered = parsed.filter((item: any) =>
      item && item.type && item.amount && item.date && item.category
    );

    if (filtered.length > 0) return filtered;

    // If filtered is empty but we got items with partial data, relax the filter
    if (parsed.length > 0) {
      const relaxed = parsed.filter((item: any) => item && Number(item.amount) > 0).map((item: any) => ({
        type: item.type || "expense",
        docType: item.docType || "Lain-lain",
        docNumber: item.docNumber || "",
        category: item.category || "Lain-lain",
        amount: Number(item.amount) || 0,
        date: item.date || `${new Date().getFullYear()}-01-01`,
        description: item.description || "Transaksi",
        payment_method: item.payment_method || "cash",
      }));
      if (relaxed.length > 0) return relaxed;
    }

    throw new Error("AI tidak dapat mengekstrak data dari dokumen ini. Sila pastikan gambar jelas dan cuba lagi.");
  } catch (error: any) {
    console.error("Error analyzing document:", error?.message || error);
    if (error?.message?.startsWith("KUOTA_HABIS:")) throw error;
    throw new Error(error?.message || "AI tidak dapat memproses dokumen ini. Sila cuba lagi.");
  }
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reference?: string;
  remark?: string;
}

function localParseFallback(pdfText: string, existing: BankTransaction[]): BankTransaction[] {
  const recovered: BankTransaction[] = [];
  const existingKeys = new Set(
    existing.map(t => `${t.date}|${t.amount}|${t.type}|${t.reference || ""}`)
  );

  // Pattern: date line followed by content, then amounts and balance
  // Each transaction has: date, description lines, reference, withdrawal OR deposit, balance
  const TX_KEYWORDS = "DUITNOW|AUTOPAY|MYDEBIT|POS DEBIT|CDM CASH|HSE CHQ|I-FUNDS|IBG CREDIT|JOMPAY";
  const lines = pdfText.split("\n");

  const datePattern = new RegExp(`^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s*(?:${TX_KEYWORDS})`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    const year = dateMatch[3];
    const date = `${year}-${month}-${day}`;

    // Collect the transaction block (up to 8 lines after the date line)
    const block = [line];
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (datePattern.test(nextLine)) break;
      block.push(nextLine);
    }

    const blockText = block.join(" ");
    // Extract amounts - look for decimal numbers like 100.00, 1,810.00
    const amounts = blockText.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g);
    if (!amounts || amounts.length === 0) continue;

    // The last number is typically the balance; amounts before it are withdrawal/deposit
    // For a simple fallback, take the first or second-to-last amount as the transaction amount
    const balanceStr = amounts[amounts.length - 1];
    const amountStr = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    const amount = parseFloat(amountStr.replace(/,/g, ""));
    if (isNaN(amount) || amount === 0) continue;

    // Determine type from keywords
    const isDebit = /DUITNOW TO MOBILE|MYDEBIT PURCHASE|POS DEBIT|JOMPAY/i.test(blockText);
    const isExplicitCredit = /AUTOPAY CR|IBG CREDIT|CDM CASH|HSE CHQ|I-FUNDS TR FROM SA/i.test(blockText);

    let type: "credit" | "debit" = isDebit ? "debit" : (isExplicitCredit ? "credit" : "credit");

    // If it's a DUITNOW TO ACCOUNT with withdrawal-related desc
    if (/DUITNOW TO ACCOUNT/i.test(blockText)) {
      // Check if it's outgoing (payment, restok, komisen, salery, sewa)
      if (/Restok|Komisen|Saler|Sewa|Payment|Print|Refund|Insurance|Bill|Advance/i.test(blockText)) {
        type = "debit";
      }
    }

    // Extract reference
    const refMatch = blockText.match(/(\d{9,})/);
    const reference = refMatch ? refMatch[1] : "";

    const key = `${date}|${amount}|${type}|${reference}`;
    if (existingKeys.has(key)) continue;

    // Description
    const descMatch = line.match(new RegExp(`\\d{4}\\s+(.*)`));
    const description = descMatch ? descMatch[1].trim() : "Transaksi Bank";

    recovered.push({
      date,
      description,
      amount,
      type,
      reference,
      remark: "Diekstrak secara tempatan - sila semak semula",
    });
    existingKeys.add(key);
  }

  return recovered;
}

export async function extractBankTransactions(base64Data: string, mimeType: string = "application/pdf", userId?: string, plan?: string): Promise<BankTransaction[] | null> {
  try {
    if (userId && plan) {
      await checkTokenLimit(userId, plan);
    }
    const isPdf = mimeType === "application/pdf" || base64Data.includes("data:application/pdf");

    const normalizeType = (type: any): "credit" | "debit" | null => {
      if (!type) return null;
      const t = String(type).toLowerCase().trim();
      if (t === "credit" || t === "cr" || t === "deposit" || t === "in") return "credit";
      if (t === "debit" || t === "dr" || t === "withdrawal" || t === "out") return "debit";
      return null;
    };

    const parseAmount = (val: any): number => {
      if (val === undefined || val === null) return NaN;
      if (typeof val === "number") return Math.abs(val);
      const cleaned = String(val).replace(/[,\s]/g, "");
      return Math.abs(Number(cleaned));
    };

    const buildPrompt = (txCount: number, partInfo?: string) => `Extract ALL ${txCount} transactions from this CIMB bank statement section into JSON.

There are EXACTLY ${txCount} transactions below, each marked with [TX n]. Return EXACTLY ${txCount} items — one per [TX] marker.

Rules:
- Each [TX] block represents ONE transaction. The amount appears at the end of the first line or in subsequent lines as a number with optional comma separators (e.g. "1,810.00" or "100.00").
- debit (money OUT) = Withdrawal column: DUITNOW TO ACCOUNT/MOBILE/ID with withdrawal amount, MYDEBIT PURCHASE, POS DEBIT, JOMPAY, and any transaction where money leaves the account
- credit (money IN) = Deposits column: AUTOPAY CR, IBG CREDIT, CDM CASH DEPOSIT, HSE CHQ DEPOSIT, I-FUNDS TR FROM SA, and DUITNOW TO ACCOUNT with deposit amount (incoming transfers from other people/merchants)
- IMPORTANT: Most DUITNOW TO ACCOUNT entries in this statement are DEPOSITS (money IN/credit) unless they have a withdrawal amount. Look at the Balance column — if balance increases, it's credit; if it decreases, it's debit.
- amount = positive number, no comma separators
- date = YYYY-MM-DD (year 2025)
- description = transaction description text (the main description line, e.g. "DUITNOW TO ACCOUNT Yuran Tusyen SYAMSINAR BINTI MBB")
- reference = the reference/cheque number shown (e.g. "202501010265576915", "157410042", "1248401903")
- CRITICAL: Two transactions with the SAME amount and description but DIFFERENT reference numbers are SEPARATE entries. Never merge them.
- Every [TX] block is a separate transaction — return one JSON item for each
${partInfo || ""}
Return ONLY JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":number,"type":"credit"|"debit","reference":"..."}]`;

    let allTransactions: BankTransaction[] = [];

    if (isPdf) {
      let pdfText = "";
      try {
        pdfText = await extractTextFromPdf(base64Data);
      } catch (pdfErr) {
        console.error("PDF extraction failed:", pdfErr);
        return null;
      }

      if (!pdfText || pdfText.trim().length < 50) {
        return null;
      }

      const pages = pdfText.split(/--- Page \d+ ---/).filter(p => p.trim());
      const firstPageLines = pages[0]?.split("\n") || [];
      const headerContext = firstPageLines.slice(0, 12).join("\n");

      // Transaction start detection:
      // A real transaction line starts with DD/MM/YYYY followed by:
      //   - A transaction keyword (DUITNOW, AUTOPAY, MYDEBIT, POS DEBIT, etc.)
      //   - A long reference number (6+ digits)
      //   - End of line (date alone, description on next line)
      // FALSE positives to avoid:
      //   - "05/01/2025 5542" inside POS DEBIT (date + 4-digit card number)
      //   - "PSS PANDAN J MELAKA" continuation lines
      //   - "OPENING BALANCE", "CLOSING BALANCE" lines
      const TX_KEYWORDS = "DUITNOW|AUTOPAY|MYDEBIT|POS DEBIT|CDM CASH|HSE CHQ|I-FUNDS|IBG CREDIT|JOMPAY";
      const txStartPattern = new RegExp(
        `^\\d{1,2}\\/\\d{1,2}\\/\\d{4}` +
        `(?:\\s*(?:${TX_KEYWORDS})|\\s+\\d{6,}|\\s*$)`
      );

      // Also detect mid-line dates followed by keywords or long reference numbers
      const txMidPattern = new RegExp(`(.+?)(\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*(?:${TX_KEYWORDS}|\\d{6,}).*)`);

      // Lines that should NOT be treated as transactions even if they match
      const ignoredLinePattern = /OPENING BALANCE|CLOSING BALANCE|CONTINUE NEXT PAGE|BAKI PENUTUP|Statement Date|No of Withdrawal|No of Deposits|Total Withdrawal|Total Deposits/i;

      // Pre-process: split merged lines that have a transaction start mid-line
      const preprocessLines = (lines: string[]): string[] => {
        const result: string[] = [];
        for (const line of lines) {
          if (ignoredLinePattern.test(line)) {
            result.push(line);
            continue;
          }
          if (txStartPattern.test(line)) {
            result.push(line);
            continue;
          }
          const midMatch = line.match(txMidPattern);
          if (midMatch && !ignoredLinePattern.test(midMatch[2])) {
            if (midMatch[1].trim()) result.push(midMatch[1].trim());
            result.push(midMatch[2].trim());
          } else {
            result.push(line);
          }
        }
        return result;
      };

      // Collect all transaction groups across all pages
      const MAX_TX_PER_BATCH = 15;
      const batches: { text: string; txCount: number; pageNum: number }[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const rawLines = page.split("\n").filter(l => l.trim());
        if (rawLines.length < 2) continue;

        const pageLines = preprocessLines(rawLines);

        // Group lines into transactions (each starts with date + uppercase)
        const transactions: string[][] = [];
        let currentTx: string[] | null = null;

        for (const line of pageLines) {
          if (ignoredLinePattern.test(line)) continue;
          if (txStartPattern.test(line)) {
            if (currentTx !== null) {
              transactions.push(currentTx);
            }
            currentTx = [line];
          } else if (currentTx !== null) {
            currentTx.push(line);
          }
        }
        if (currentTx !== null && currentTx.length > 0) {
          transactions.push(currentTx);
        }

        if (transactions.length === 0) continue;

        for (let start = 0; start < transactions.length; start += MAX_TX_PER_BATCH) {
          const batchTxs = transactions.slice(start, start + MAX_TX_PER_BATCH);
          const batchText = batchTxs.map((tx, idx) => `[TX ${idx + 1}]\n${tx.join("\n")}`).join("\n\n");
          batches.push({
            text: batchText,
            txCount: batchTxs.length,
            pageNum: i + 1,
          });
        }
      }

      let totalTokensUsed = 0;
      const expectedTotalTx = batches.reduce((a, b) => a + b.txCount, 0);
      console.log(`[BankExtract] Total batches: ${batches.length}, total expected tx: ${expectedTotalTx}`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const partInfo = `\nBatch ${i + 1}/${batches.length} (page ${batch.pageNum}).${i > 0 ? `\n\nCOLUMN REFERENCE:\n${headerContext}` : ""}`;
        const prompt = buildPrompt(batch.txCount, partInfo);

        const messages = [{
          role: "user",
          content: `${prompt}\n\nDATA:\n${batch.text}`,
        }];

        const { content: text, tokensUsed } = await withRetry(() => chatCompletion(messages, false, ANALYSIS_MODELS, 32000), 3, 1000);
        totalTokensUsed += tokensUsed;

        if (text && text.trim()) {
          const jsonStr = extractJson(text);
          try {
            let parsed = JSON.parse(jsonStr);
            if (!Array.isArray(parsed)) {
              parsed = parsed.transactions || parsed.data || [parsed];
            }
            const valid = parsed.filter((item: any) => {
              if (!item || !item.date) return false;
              const amt = parseAmount(item.amount);
              if (isNaN(amt)) return false;
              const type = normalizeType(item.type);
              if (!type) return false;
              return true;
            }).map((item: any) => ({
              date: item.date,
              description: (item.description || "Transaksi Bank").trim(),
              amount: parseAmount(item.amount),
              type: normalizeType(item.type)! as "credit" | "debit",
              reference: (item.reference || "").trim(),
            }));

            console.log(`[BankExtract] Batch ${i + 1}: expected ${batch.txCount}, got ${valid.length}`);

            // Retry if fewer results than expected (even 1 missing matters)
            if (valid.length < batch.txCount) {
              const retryMessages = [{
                role: "user",
                content: `${prompt}\n\nIMPORTANT: I counted EXACTLY ${batch.txCount} transactions in the data below (each starting with a DD/MM/YYYY date). You returned only ${valid.length}. You MUST return EXACTLY ${batch.txCount} items. Two transactions may have the same description and amount but different reference numbers — they are SEPARATE transactions. Do NOT merge them.\n\nDATA:\n${batch.text}`,
              }];
              const { content: retryText, tokensUsed: retryTokens } = await withRetry(() => chatCompletion(retryMessages, false, ANALYSIS_MODELS, 32000), 2, 1000);
              totalTokensUsed += retryTokens;

              if (retryText && retryText.trim()) {
                const retryJson = extractJson(retryText);
                try {
                  let retryParsed = JSON.parse(retryJson);
                  if (!Array.isArray(retryParsed)) {
                    retryParsed = retryParsed.transactions || retryParsed.data || [retryParsed];
                  }
                  const retryValid = retryParsed.filter((item: any) => {
                    if (!item || !item.date) return false;
                    const amt = parseAmount(item.amount);
                    if (isNaN(amt)) return false;
                    const type = normalizeType(item.type);
                    if (!type) return false;
                    return true;
                  }).map((item: any) => ({
                    date: item.date,
                    description: (item.description || "Transaksi Bank").trim(),
                    amount: parseAmount(item.amount),
                    type: normalizeType(item.type)! as "credit" | "debit",
                    reference: (item.reference || "").trim(),
                  }));

                  if (retryValid.length > valid.length) {
                    console.log(`[BankExtract] Batch ${i + 1} retry improved: ${valid.length} -> ${retryValid.length}`);
                    allTransactions.push(...retryValid);
                    continue;
                  }
                } catch {}
              }
            }

            allTransactions.push(...valid);
          } catch {}
        }
      }

      // Deduplicate only true duplicates (same date + reference + amount + type).
      // Some transactions share a reference number (e.g. AUTOPAY CR uses the same
      // merchant ref 1248401903 for every payment) but differ in date or amount.
      // For transactions without a reference, use date + description + amount + type.
      const seen = new Set<string>();
      const deduped: BankTransaction[] = [];
      for (const tx of allTransactions) {
        const key = tx.reference
          ? `${tx.date}|${tx.reference}|${tx.amount}|${tx.type}`
          : `${tx.date}|${tx.description}|${tx.amount}|${tx.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(tx);
      }
      const beforeDedup = allTransactions.length;
      allTransactions = deduped;

      console.log(`[BankExtract] Final total: ${allTransactions.length} (removed ${beforeDedup - allTransactions.length} duplicates)`);

      // Try to detect expected count from statement summary
      const summaryMatch = pdfText.match(/No of Withdrawal[^\d]*(\d+)[\s\S]*?No of Deposits?[^\d]*(\d+)/i);
      if (summaryMatch) {
        const expectedWithdrawals = parseInt(summaryMatch[1], 10);
        const expectedDeposits = parseInt(summaryMatch[2], 10);
        const expectedTotal = expectedWithdrawals + expectedDeposits;
        const actualCredits = allTransactions.filter(t => t.type === "credit").length;
        const actualDebits = allTransactions.filter(t => t.type === "debit").length;

        console.log(`[BankExtract] Expected: ${expectedTotal} (${expectedWithdrawals}W + ${expectedDeposits}D), Got: ${allTransactions.length} (${actualDebits}W + ${actualCredits}D)`);

        if (allTransactions.length < expectedTotal) {
          const missing = expectedTotal - allTransactions.length;
          // Try to find missing transactions from the raw text using a direct local parse
          const locallyParsed = localParseFallback(pdfText, allTransactions);
          if (locallyParsed.length > 0) {
            allTransactions.push(...locallyParsed);
            console.log(`[BankExtract] Recovered ${locallyParsed.length} missing transactions via local parse`);
          }

          // If still missing, add stubs with remark for manual check
          const stillMissing = expectedTotal - allTransactions.length;
          if (stillMissing > 0) {
            for (let i = 0; i < stillMissing; i++) {
              allTransactions.push({
                date: "2025-01-01",
                description: `Transaksi tidak dapat dikesan (#${i + 1})`,
                amount: 0,
                type: "credit",
                remark: "Sila semak penyata bank secara manual - transaksi ini tidak dapat diekstrak oleh AI",
              });
            }
            console.log(`[BankExtract] Added ${stillMissing} stub entries for manual review`);
          }
        }
      }

      if (userId && totalTokensUsed > 0) {
        apiLogAiUsage(userId, totalTokensUsed, "bank_statement").catch(() => {});
      }
    } else {
      const isUrl = base64Data.startsWith("http");
      let imageUrl: string;
      if (isUrl) {
        imageUrl = base64Data;
      } else {
        const dataWithPrefix = base64Data.startsWith("data:")
          ? base64Data
          : `data:${mimeType};base64,${base64Data}`;
        const compressed = await compressImage(dataWithPrefix);
        imageUrl = compressed;
      }

      const prompt = buildPrompt(50);
      const messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          { type: "text", text: prompt },
        ],
      }];

      const { content: text, tokensUsed } = await withRetry(() => chatCompletion(messages, false, ANALYSIS_MODELS, 32000), 3, 1000);

      if (userId && tokensUsed > 0) {
        apiLogAiUsage(userId, tokensUsed, "bank_statement").catch(() => {});
      }

      if (!text || text.trim() === "") return null;

      const jsonStr = extractJson(text);
      let parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        parsed = parsed.transactions || parsed.data || [parsed];
      }

      allTransactions = parsed.filter((item: any) => {
        if (!item || !item.date) return false;
        const amt = parseAmount(item.amount);
        if (isNaN(amt)) return false;
        const type = normalizeType(item.type);
        if (!type) return false;
        return true;
      }).map((item: any) => ({
        date: item.date,
        description: (item.description || "Transaksi Bank").trim(),
        amount: parseAmount(item.amount),
        type: normalizeType(item.type)! as "credit" | "debit",
        reference: (item.reference || "").trim(),
      }));
    }

    return allTransactions.length > 0 ? allTransactions : null;
  } catch (error) {
    console.error("Error extracting bank transactions:", error);
    if ((error as any)?.message?.startsWith("KUOTA_HABIS:")) throw error;
    return null;
  }
}

export async function analyzeFinancials(records: any[], sales: any[], isConcise: boolean = false, userId?: string, plan?: string): Promise<string> {
  const latestRecordDate = records.length > 0 ? records[0].date : "";
  const latestSaleDate = sales.length > 0 ? sales[0].date : "";
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}-${isConcise}`;

  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (userId && plan) {
      await checkTokenLimit(userId, plan);
    }
    const prompt = `Analisa data kewangan berikut untuk perniagaan kecil.
${isConcise
  ? "Berikan ringkasan yang sangat padat dan ringkas (bullet points sahaja) tentang prestasi dan 1 cadangan utama."
  : "Berikan ringkasan prestasi perniagaan, kenal pasti trend, dan berikan 3 cadangan tindakan yang boleh diambil."}
Sila berikan jawapan dalam Bahasa Melayu. Format maklum balas dalam Markdown.

Data Transaksi:
${JSON.stringify(records.map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description })))}

Data Jualan:
${JSON.stringify(sales.map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}`;

    const { content: result, tokensUsed } = await withRetry(() => chatCompletion([{ role: "user", content: prompt }]));

    if (userId && tokensUsed > 0) {
      apiLogAiUsage(userId, tokensUsed, "analysis").catch(() => {});
    }

    if (result) {
      analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result || "Tiada analisis tersedia.";
  } catch (error: any) {
    console.error("Error analyzing financials:", error);
    if (error?.message?.startsWith("KUOTA_HABIS:")) {
      return `## Had Token Habis\n\nKuota AI anda telah habis. Sila naik taraf pelan atau hubungi admin untuk top up token tambahan.`;
    }
    if (error?.message?.includes("429")) {
      return "Had kuota dicapai. Sila cuba lagi dalam beberapa minit.";
    }
    return "Ralat menjana analisis.";
  }
}

export interface DashboardInsight {
  type: "improvement" | "attention" | "positive";
  title: string;
  description: string;
}

export async function getDashboardInsights(records: any[], sales: any[], userId?: string, plan?: string): Promise<DashboardInsight[]> {
  const latestRecordDate = records.length > 0 ? records[0].date : "";
  const latestSaleDate = sales.length > 0 ? sales[0].date : "";
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}`;

  const cached = insightsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (userId && plan) {
      await checkTokenLimit(userId, plan);
    }
    const prompt = `Analisa data kewangan berikut dan berikan 3-4 cadangan ringkas (insights) untuk papan pemuka (dashboard).
Setiap cadangan mesti mempunyai jenis: 'improvement', 'attention', atau 'positive'.
Berikan jawapan dalam Bahasa Melayu.

Data Transaksi:
${JSON.stringify(records.slice(0, 20).map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date })))}

Data Jualan:
${JSON.stringify(sales.slice(0, 20).map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}

Return a JSON array. Each item must have: type (improvement/attention/positive), title, description.`;

    const { content: text, tokensUsed } = await withRetry(() => chatCompletion([{ role: "user", content: prompt }], true));

    if (userId && tokensUsed > 0) {
      apiLogAiUsage(userId, tokensUsed, "insights").catch(() => {});
    }

    const result = JSON.parse(extractJson(text));

    if (Array.isArray(result) && result.length > 0) {
      insightsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return Array.isArray(result) ? result : [];
  } catch (error: any) {
    console.error("Error getting dashboard insights:", error);
    if (error?.message?.startsWith("KUOTA_HABIS:")) {
      return [{
        type: "attention",
        title: "Had Token Habis",
        description: "Kuota AI anda telah habis. Sila naik taraf pelan atau hubungi admin untuk top up.",
      }];
    }
    if (error?.message?.includes("429")) {
      return [{
        type: "attention",
        title: "Had Quota Dicapai",
        description: "Analisis AI sedang berehat sebentar. Sila cuba lagi dalam beberapa minit.",
      }];
    }
    return [];
  }
}
