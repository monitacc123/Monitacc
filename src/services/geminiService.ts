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

  const hasImage = messages.some(m =>
    Array.isArray(m.content) && m.content.some((c: any) => c.type === "image_url")
  );

  const body: any = {
    model: "gemini-3.1-pro",
    messages,
    max_tokens: 4096,
  };

  if (jsonMode && !hasImage) {
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

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
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
    const isPdf = mimeType === "application/pdf" || base64Data.includes("data:application/pdf");

    const prompt = `You are an OCR and accounting data extraction assistant. Extract ALL accounting transactions from this document.

IMPORTANT: You MUST respond with ONLY a valid JSON array. No explanation, no markdown, just the raw JSON array.

Rules:
- Receipts/Resit from shops or restaurants = expense (type: "expense")
- Payment received, sales = income (type: "income")
- payment_method: "cash" if paid by cash/tunai, otherwise "bank"
- date format: YYYY-MM-DD (if year missing, use current year)
- category must be one of: ${ALL_CATEGORIES.join(", ")}
- docType examples: "Resit", "Invoice", "Bil", "Penyata Bank", "Lain-lain"

Each item in the JSON array must have exactly these fields:
{ "type": "income"|"expense", "docType": string, "docNumber": string, "category": string, "amount": number, "date": "YYYY-MM-DD", "description": string, "payment_method": "cash"|"bank" }

Example response format:
[{"type":"expense","docType":"Resit","docNumber":"001","category":"PETROL, PARKING AND TOLL","amount":50.00,"date":"2024-01-15","description":"Shell Petrol","payment_method":"cash"}]

Now extract from the document:`;

    let messages: { role: string; content: any }[];

    if (isPdf) {
      messages = [{
        role: "user",
        content: `${prompt}\n\n[This is a PDF document - extract all visible transactions from the bank statement or financial document]`,
      }];
    } else {
      const imageData = base64Data.split(",")[1] || base64Data;
      const isUrl = base64Data.startsWith("http");
      const imageUrl = isUrl ? base64Data : `data:${mimeType};base64,${imageData}`;

      messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: prompt },
        ],
      }];
    }

    const text = await withRetry(() => chatCompletion(messages, false));

    if (!text || text.trim() === "") {
      console.error("Empty response from AI");
      return null;
    }

    const jsonStr = extractJson(text);
    let parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      parsed = parsed.transactions || parsed.data || [parsed];
    }

    return parsed.filter((item: any) =>
      item && item.type && item.amount && item.date && item.category
    );
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

    const result = JSON.parse(extractJson(text));

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
