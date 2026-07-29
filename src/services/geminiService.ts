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

  const controller = new AbortController();
  const timeoutMs = hasImage ? 90000 : 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(modelEntry.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: Model ${modelEntry.model} tidak bertindak balas dalam ${timeoutMs / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

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
6. If the document contains MULTIPLE receipts, invoices, or transactions, extract ALL of them as separate items in the array
7. Each distinct receipt/invoice/transaction = one separate JSON object in the array

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

Extract ALL transactions from the document now:`;

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
          content: `${prompt}\n\nIMPORTANT: This is a PDF document that may contain MULTIPLE receipts, invoices, or transactions across multiple pages. Extract EVERY transaction found — do NOT merge them into one. Each page may have a separate receipt/invoice.\n\nDOCUMENT CONTENT (extracted from PDF):\n\n${pdfText}`,
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
      result = await withRetry(() => chatCompletion(messages, false, SCAN_MODELS, isPdf ? 16384 : 4096), 3, 1000);
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

  const lines = pdfText.split("\n");

  // Extract statement year
  let fallbackYear = new Date().getFullYear().toString();
  const yrMatch = pdfText.match(/STATEMENT DATE[^:]*:\s*\d{1,2}\/\d{1,2}\/(\d{2,4})/i);
  if (yrMatch) {
    fallbackYear = yrMatch[1].length === 2 ? `20${yrMatch[1]}` : yrMatch[1];
  }

  // Support both DD/MM/YYYY and DD/MM (Maybank) date formats
  const datePattern = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+\S/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/OPENING BALANCE|CLOSING BALANCE|BEGINNING BALANCE|ENDING BALANCE|BAKI DIBAWA|BAKI AKHIR|B\/F BALANCE|TOTAL DEBIT|TOTAL CREDIT/i.test(line)) continue;
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    const rawYear = dateMatch[3];
    const year = rawYear ? (rawYear.length === 2 ? `20${rawYear}` : rawYear) : fallbackYear;
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

    // Determine type: Maybank uses amount suffixes (- for debit, + for credit)
    // and keywords TRANSFER FR A/C (debit) vs TRANSFER TO A/C (credit)
    let type: "credit" | "debit" = "debit";
    if (/\d+\.\d{2}\+/.test(blockText) || /TRANSFER TO A\/C|INTER-BANK PAYMENT INTO/i.test(blockText)) {
      type = "credit";
    } else if (/\d+\.\d{2}-/.test(blockText) || /TRANSFER FR A\/C|PAYMENT FR A\/C/i.test(blockText)) {
      type = "debit";
    } else {
      const isDebit = /DUITNOW TO MOBILE|MYDEBIT PURCHASE|POS DEBIT|JOMPAY|IBK PAYMENT/i.test(blockText);
      const isCredit = /AUTOPAY CR|IBG CREDIT|CDM CASH|HSE CHQ|I-FUNDS TR FROM SA/i.test(blockText);
      type = isDebit ? "debit" : (isCredit ? "credit" : "debit");
    }

    // Extract reference
    const refMatch = blockText.match(/(?:IN\d{5,}|In\d{5,}|\d{9,}|[A-Z]{2,}\d{5,})/);
    const reference = refMatch ? refMatch[0] : "";

    const key = `${date}|${amount}|${type}|${reference}`;
    if (existingKeys.has(key)) continue;

    // Description - extract everything after the date
    const descMatch = line.match(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(.*)/);

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

    let statementYear = new Date().getFullYear().toString();

    const buildPrompt = (txCount: number, partInfo?: string) => `Extract ALL ${txCount} transactions from this bank statement section into JSON.

There are EXACTLY ${txCount} transactions below, each marked with [TX n]. Return EXACTLY ${txCount} items — one per [TX] marker.

Rules:
- Each [TX] block represents ONE transaction. The amount appears with +/- sign or in withdrawal/deposit columns (e.g. "1,900.00-" is debit, "3,000.00+" is credit).
- debit (money OUT) = amount has "-" suffix, or keywords: TRANSFER FR A/C, PAYMENT FR A/C
- credit (money IN) = amount has "+" suffix, or keywords: TRANSFER TO A/C, INTER-BANK PAYMENT INTO A/C
- amount = positive number, no comma separators
- date = YYYY-MM-DD (use year ${statementYear} if only DD/MM is shown)
- description = transaction description text (e.g. "TRANSFER FR A/C" + recipient name)
- reference = any reference/invoice number shown (e.g. "IN2601063", "20260101M0007275861", "QR81917339"), empty string if none
- CRITICAL: Two transactions with the SAME amount and description are SEPARATE entries if they appear as separate [TX] blocks. Never merge them.
- Every [TX] block is a separate transaction — return one JSON item for each
${partInfo || ""}
Return ONLY JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":number,"type":"credit"|"debit","reference":"..."}]`;

    let allTransactions: BankTransaction[] = [];

    if (isPdf) {
      let pdfText = "";
      try {
        pdfText = await extractTextFromPdf(base64Data);
      } catch (pdfErr) {
        console.error("PDF extraction failed, will try image-based approach:", pdfErr);
        pdfText = "";
      }

      if (!pdfText || pdfText.trim().length < 50) {
        // No usable text - fall through to image-based extraction below
        console.log("[BankExtract] PDF has no extractable text, using image-based approach");
        const dataWithPrefix = base64Data.startsWith("data:")
          ? base64Data
          : `data:application/pdf;base64,${base64Data.split(",")[1] || base64Data}`;

        const genericPrompt = `Extract ALL bank transactions from this bank statement into JSON.

Rules:
- debit (money OUT) = payments, purchases, withdrawals, transfers out
- credit (money IN) = deposits, incoming transfers, sales proceeds
- amount = positive number (no commas)
- date = YYYY-MM-DD format
- description = transaction description
- reference = reference number if available, empty string otherwise
- type = "credit" or "debit"

Return ONLY a JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":number,"type":"credit"|"debit","reference":"..."}]`;

        const messages = [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataWithPrefix, detail: "high" } },
            { type: "text", text: genericPrompt },
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

        return allTransactions.length > 0 ? allTransactions : null;
      }

      // --- PRIMARY PATH: send full text directly to AI ---
      const primaryPrompt = `Extract ALL bank transactions from this bank statement text into JSON.

Rules:
- debit (money OUT) = payments, purchases, withdrawals, transfers out. Keywords: TRANSFER FR A/C, PAYMENT FR A/C, MYDEBIT, JOMPAY, POS DEBIT
- credit (money IN) = deposits, incoming transfers. Keywords: TRANSFER TO A/C, INTER-BANK PAYMENT INTO, AUTOPAY CR, IBG CREDIT, CDM CASH
- amount = positive number (no commas)
- date = YYYY-MM-DD format (if only DD/MM shown, use year ${statementYear})
- description = full transaction description text
- reference = reference/cheque number if shown, empty string otherwise
- type = "credit" or "debit"

Return ONLY a JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":number,"type":"credit"|"debit","reference":"..."}]

BANK STATEMENT TEXT:
${pdfText.slice(0, 20000)}`;

      let totalTokensUsed = 0;
      try {
        const { content: primaryText, tokensUsed: primaryTokens } = await withRetry(
          () => chatCompletion([{ role: "user", content: primaryPrompt }], false, ANALYSIS_MODELS, 32000), 3, 1000
        );
        totalTokensUsed += primaryTokens;
        if (primaryText && primaryText.trim()) {
          const jsonStr = extractJson(primaryText);
          let parsed = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) parsed = parsed.transactions || parsed.data || [parsed];
          allTransactions = parsed.filter((item: any) => {
            if (!item || !item.date) return false;
            const amt = parseAmount(item.amount);
            if (isNaN(amt)) return false;
            return normalizeType(item.type) !== null;
          }).map((item: any) => ({
            date: item.date,
            description: (item.description || "Transaksi Bank").trim(),
            amount: parseAmount(item.amount),
            type: normalizeType(item.type)! as "credit" | "debit",
            reference: (item.reference || "").trim(),
          }));
          console.log(`[BankExtract] Primary AI extraction: ${allTransactions.length} transactions`);
        }
      } catch (e) {
        console.error("[BankExtract] Primary AI extraction failed:", e);
      }

      // If text was truncated (>20000 chars), process remaining pages
      if (pdfText.length > 20000) {
        const remainingText = pdfText.slice(20000);
        try {
          const { content: extraText, tokensUsed: extraTokens } = await withRetry(
            () => chatCompletion([{ role: "user", content: primaryPrompt.replace(pdfText.slice(0, 20000), remainingText.slice(0, 20000)) }], false, ANALYSIS_MODELS, 32000), 2, 1000
          );
          totalTokensUsed += extraTokens;
          if (extraText && extraText.trim()) {
            const jsonStr = extractJson(extraText);
            let parsed = JSON.parse(jsonStr);
            if (!Array.isArray(parsed)) parsed = parsed.transactions || parsed.data || [parsed];
            const extra = parsed.filter((item: any) => {
              if (!item || !item.date) return false;
              const amt = parseAmount(item.amount);
              if (isNaN(amt)) return false;
              return normalizeType(item.type) !== null;
            }).map((item: any) => ({
              date: item.date,
              description: (item.description || "Transaksi Bank").trim(),
              amount: parseAmount(item.amount),
              type: normalizeType(item.type)! as "credit" | "debit",
              reference: (item.reference || "").trim(),
            }));
            allTransactions.push(...extra);
            console.log(`[BankExtract] Extra page extraction: +${extra.length} transactions`);
          }
        } catch (e) {
          console.error("[BankExtract] Extra page extraction failed:", e);
        }
      }

      if (userId && totalTokensUsed > 0) {
        apiLogAiUsage(userId, totalTokensUsed, "bank_statement").catch(() => {});
      }

      // Augment with local fallback to catch any missed transactions
      const locallyParsed = localParseFallback(pdfText, allTransactions);
      if (locallyParsed.length > 0) {
        allTransactions.push(...locallyParsed);
        console.log(`[BankExtract] Local fallback recovered ${locallyParsed.length} additional transactions`);
      }

      return allTransactions.length > 0 ? allTransactions : null;
    } else {
      // Image file
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

      const imagePrompt = `Extract ALL bank transactions from this bank statement image into JSON.
Rules:
- debit (money OUT) = payments, withdrawals, transfers out
- credit (money IN) = deposits, incoming transfers
- amount = positive number (no commas)
- date = YYYY-MM-DD format
- description = transaction description
- reference = reference number if shown, empty string otherwise
- type = "credit" or "debit"
Return ONLY a JSON array: [{"date":"YYYY-MM-DD","description":"...","amount":number,"type":"credit"|"debit","reference":"..."}]`;

      const messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          { type: "text", text: imagePrompt },
        ],
      }];

      const { content: text, tokensUsed } = await withRetry(() => chatCompletion(messages, false, ANALYSIS_MODELS, 32000), 3, 1000);

      if (userId && tokensUsed > 0) {
        apiLogAiUsage(userId, tokensUsed, "bank_statement").catch(() => {});
      }

      if (!text || text.trim() === "") return null;

      const jsonStr = extractJson(text);
      let parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) parsed = parsed.transactions || parsed.data || [parsed];

      allTransactions = parsed.filter((item: any) => {
        if (!item || !item.date) return false;
        const amt = parseAmount(item.amount);
        if (isNaN(amt)) return false;
        return normalizeType(item.type) !== null;
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
