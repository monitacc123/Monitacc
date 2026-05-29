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

    if (isPdf) {
      let pdfText = "";
      try {
        pdfText = await extractTextFromPdf(base64Data);
      } catch (pdfErr) {
        console.error("PDF extraction failed:", pdfErr);
        pdfText = "[PDF content could not be extracted - please try an image format]";
      }

      messages = [{
        role: "user",
        content: `${prompt}\n\nDOCUMENT CONTENT (extracted from PDF):\n\n${pdfText}`,
      }];
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
}

export async function extractBankTransactions(base64Data: string, mimeType: string = "application/pdf", userId?: string, plan?: string): Promise<BankTransaction[] | null> {
  try {
    if (userId && plan) {
      await checkTokenLimit(userId, plan);
    }
    const isPdf = mimeType === "application/pdf" || base64Data.includes("data:application/pdf");

    const prompt = `You are a bank statement parser. Extract ALL transactions from this bank statement document.

IMPORTANT: You MUST respond with ONLY a valid JSON array. No explanation, no markdown, just the raw JSON array.

Rules:
- "credit" = money coming IN to the account (deposits, transfers in, sales receipts)
- "debit" = money going OUT of the account (payments, withdrawals, charges)
- amount must be a positive number regardless of credit/debit
- date format: YYYY-MM-DD
- description: use the original transaction description from the statement

Each item in the JSON array must have exactly these fields:
{ "date": "YYYY-MM-DD", "description": string, "amount": number, "type": "credit"|"debit" }

Example response:
[{"date":"2024-01-15","description":"PETRONAS FUEL STATION","amount":85.50,"type":"debit"},{"date":"2024-01-16","description":"TRANSFER FROM ABU BAKAR","amount":500.00,"type":"credit"}]

Extract ALL transactions from the document:`;

    let messages: { role: string; content: any }[];

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

      messages = [{
        role: "user",
        content: `${prompt}\n\nBANK STATEMENT CONTENT:\n\n${pdfText}`,
      }];
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

    const { content: text, tokensUsed } = await withRetry(() => chatCompletion(messages, false, SCAN_MODELS, 4096), 3, 1000);

    if (userId && tokensUsed > 0) {
      apiLogAiUsage(userId, tokensUsed, "bank_statement").catch(() => {});
    }

    if (!text || text.trim() === "") return null;

    const jsonStr = extractJson(text);
    let parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      parsed = parsed.transactions || parsed.data || [parsed];
    }

    return parsed.filter((item: any) =>
      item && item.date && item.amount && (item.type === "credit" || item.type === "debit")
    ).map((item: any) => ({
      date: item.date,
      description: item.description || "Transaksi Bank",
      amount: Math.abs(Number(item.amount)),
      type: item.type as "credit" | "debit",
    }));
  } catch (error) {
    console.error("Error extracting bank transactions:", error);
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
