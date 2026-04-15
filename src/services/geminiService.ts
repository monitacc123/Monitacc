import { ALL_CATEGORIES } from "../constants/categories";

const insightsCache = new Map<string, { data: DashboardInsight[], timestamp: number }>();
const analysisCache = new Map<string, { data: string, timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 15;

function getConfig() {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  const baseUrl = (import.meta as any).env?.VITE_GEMINI_BASE_URL || "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions";
  if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi.");
  return { apiKey, baseUrl };
}

async function chatCompletion(messages: { role: string; content: any }[], jsonMode = false): Promise<string> {
  const { apiKey, baseUrl } = getConfig();

  const body: any = {
    model: "gemini-3.1-pro",
    messages,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
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

export async function analyzeDocument(base64Data: string, mimeType: string = "image/jpeg"): Promise<ExtractedData[] | null> {
  try {
    const imageData = base64Data.split(",")[1] || base64Data;
    const isUrl = base64Data.startsWith("http");

    const imageContent = isUrl
      ? { type: "image_url", image_url: { url: base64Data } }
      : { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } };

    const prompt = `Extract accounting data from this document (receipt, invoice, or bank statement).

If it is a single receipt or invoice:
- Identify if it is an income (money in/Duit Masuk) or expense (money out/Duit Keluar).
- IMPORTANT: Receipts (Resit) from shops, restaurants, or suppliers are ALWAYS expenses.
- Identify the document type (e.g., Invoice, Resit, Bil, Lain-lain).
- Extract the document number. If not found, leave it empty.
- Select the most appropriate category from: ${ALL_CATEGORIES.join(", ")}.
- Identify the payment method: 'cash' or 'bank'. Default to 'bank' if unsure.
- Provide the amount, date (YYYY-MM-DD), and a brief description.

If it is a bank statement:
- Extract ALL individual transactions listed.
- For each transaction, determine if it is income or expense.
- Categorize each transaction using: ${ALL_CATEGORIES.join(", ")}.

Return a JSON array of transactions. Each item must have: type, docType, docNumber, category, amount, date, description, payment_method.`;

    const text = await withRetry(() =>
      chatCompletion([
        {
          role: "user",
          content: [
            imageContent,
            { type: "text", text: prompt },
          ],
        },
      ], true)
    );

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Error analyzing document:", error);
    return null;
  }
}

export async function analyzeFinancials(records: any[], sales: any[], isConcise: boolean = false): Promise<string> {
  const latestRecordDate = records.length > 0 ? records[0].date : "";
  const latestSaleDate = sales.length > 0 ? sales[0].date : "";
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}-${isConcise}`;

  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const prompt = `Analisa data kewangan berikut untuk perniagaan kecil.
${isConcise
  ? "Berikan ringkasan yang sangat padat dan ringkas (bullet points sahaja) tentang prestasi dan 1 cadangan utama."
  : "Berikan ringkasan prestasi perniagaan, kenal pasti trend, dan berikan 3 cadangan tindakan yang boleh diambil."}
Sila berikan jawapan dalam Bahasa Melayu. Format maklum balas dalam Markdown.

Data Transaksi:
${JSON.stringify(records.map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description })))}

Data Jualan:
${JSON.stringify(sales.map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}`;

    const result = await withRetry(() => chatCompletion([{ role: "user", content: prompt }]));

    if (result) {
      analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result || "Tiada analisis tersedia.";
  } catch (error: any) {
    console.error("Error analyzing financials:", error);
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

export async function getDashboardInsights(records: any[], sales: any[]): Promise<DashboardInsight[]> {
  const latestRecordDate = records.length > 0 ? records[0].date : "";
  const latestSaleDate = sales.length > 0 ? sales[0].date : "";
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}`;

  const cached = insightsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const prompt = `Analisa data kewangan berikut dan berikan 3-4 cadangan ringkas (insights) untuk papan pemuka (dashboard).
Setiap cadangan mesti mempunyai jenis: 'improvement', 'attention', atau 'positive'.
Berikan jawapan dalam Bahasa Melayu.

Data Transaksi:
${JSON.stringify(records.slice(0, 20).map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date })))}

Data Jualan:
${JSON.stringify(sales.slice(0, 20).map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}

Return a JSON array. Each item must have: type (improvement/attention/positive), title, description.`;

    const text = await withRetry(() => chatCompletion([{ role: "user", content: prompt }], true));

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    if (Array.isArray(result) && result.length > 0) {
      insightsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return Array.isArray(result) ? result : [];
  } catch (error: any) {
    console.error("Error getting dashboard insights:", error);
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
