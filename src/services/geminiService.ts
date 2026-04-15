import { GoogleGenAI, Type } from "@google/genai";
import { ALL_CATEGORIES } from "../constants/categories";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi.");
    }
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// Simple in-memory cache
const insightsCache = new Map<string, { data: DashboardInsight[], timestamp: number }>();
const analysisCache = new Map<string, { data: string, timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 15; // 15 minutes

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export interface ExtractedData {
  type: 'income' | 'expense';
  docType: string; // 'Invoice', 'Resit', 'Bil', 'Lain-lain'
  docNumber?: string; // Invoice number, Receipt number, etc.
  category: string;
  amount: number;
  date: string;
  description: string;
  payment_method?: 'cash' | 'bank';
}

export async function analyzeDocument(base64Data: string, mimeType: string = "image/jpeg"): Promise<ExtractedData[] | null> {
  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data.split(',')[1] || base64Data,
              },
            },
            {
              text: `Extract accounting data from this document (receipt, invoice, or bank statement). 
              
              If it is a single receipt or invoice:
              - Identify if it is an income (money in/Duit Masuk) or expense (money out/Duit Keluar). 
              - IMPORTANT: Receipts (Resit) from shops, restaurants, or suppliers are ALWAYS expenses (money out/Duit Keluar).
              - Identify the document type (e.g., Invoice, Resit, Bil, Lain-lain). 
              - Extract the document number (e.g., Invoice No, Receipt No, Bill No). If not found, leave it empty.
              - Select the most appropriate category from this list: ${ALL_CATEGORIES.join(', ')}.
              - Identify the payment method (payment_method): 'cash' (if paid by Tunai di Tangan) or 'bank' (if paid by card, transfer, or bank statement). Default to 'bank' if unsure.
              - Provide the amount, date (YYYY-MM-DD), and a brief description.
              
              If it is a bank statement:
              - Extract ALL individual transactions listed.
              - For each transaction, determine if it is an income (money in/credit/Duit Masuk) or expense (money out/debit/Duit Keluar).
              - Categorize each transaction accurately using the list: ${ALL_CATEGORIES.join(', ')}.
              - GUIDELINES FOR CATEGORIZATION:
                * "TRANSFER TO A/C" to a person: Use "SALARIES, BONUS AND ALLOWANCES", "WAGES", or "AMOUNT DUE FROM DIRECTOR". NEVER use "SALES" for these.
                * "TRANSFER TO A/C" to a company: Use "PURCHASES", "TRADE CREDITORS", or specific expense categories like "RENTAL OF OFFICE". NEVER use "SALES" for these.
                * "SALES", "CASH SALES", "CREDIT": Use "SALES" or "CASH SALES".
                * "INTEREST", "HIBAH": Use "HIBAH/DIVIDEND" for income, or "BANK CHARGES" for expense.
                * "PETROL", "SHELL", "PETRONAS": Use "PETROL, PARKING AND TOLL".
                * "TNB", "SYABAS", "UNIFI": Use "WATER AND ELECTRICITY" or "TELECOMMUNICATION EXPENSES".
              - Provide the amount, date (YYYY-MM-DD), and the FULL transaction description including any reference numbers, recipient names, or codes as they appear in the document.
              
              Return an array of extracted transactions.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["income", "expense"] },
              docType: { type: Type.STRING },
              docNumber: { type: Type.STRING },
              category: { type: Type.STRING, enum: ALL_CATEGORIES },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              payment_method: { type: Type.STRING, enum: ["cash", "bank"] },
            },
            required: ["type", "docType", "category", "amount", "date", "description", "payment_method"],
          },
        },
      },
    }));

    const parsed = JSON.parse(response.text || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Error analyzing document:", error);
    return null;
  }
}

export async function analyzeFinancials(records: any[], sales: any[], isConcise: boolean = false): Promise<string> {
  // Create a cache key based on data counts, latest timestamps and concise flag
  const latestRecordDate = records.length > 0 ? records[0].date : '';
  const latestSaleDate = sales.length > 0 ? sales[0].date : '';
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}-${isConcise}`;
  
  const cached = analysisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Analisa data kewangan berikut untuk perniagaan kecil. 
              ${isConcise 
                ? "Berikan ringkasan yang sangat padat dan ringkas (bullet points sahaja) tentang prestasi dan 1 cadangan utama." 
                : "Berikan ringkasan prestasi perniagaan, kenal pasti trend, dan berikan 3 cadangan tindakan yang boleh diambil."}
              Sila berikan jawapan dalam Bahasa Melayu.
              Format maklum balas dalam Markdown.
              
              Data Transaksi (Pendapatan & Perbelanjaan):
              ${JSON.stringify(records.map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date, description: r.description })))}
              
              Data Jualan:
              ${JSON.stringify(sales.map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}`,
            },
          ],
        },
      ],
    }));

    const result = response.text || "Tiada analisis tersedia.";
    if (result !== "Tiada analisis tersedia.") {
      analysisCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (error: any) {
    console.error("Error analyzing financials:", error);
    if (error?.message?.includes('429') || error?.status === 429 || error?.code === 429) {
      return "Had kuota Gemini dicapai. Sila cuba lagi dalam beberapa minit.";
    }
    return "Ralat menjana analisis.";
  }
}

export interface DashboardInsight {
  type: 'improvement' | 'attention' | 'positive';
  title: string;
  description: string;
}

export async function getDashboardInsights(records: any[], sales: any[]): Promise<DashboardInsight[]> {
  // Create a cache key based on data counts and latest record/sale timestamps
  const latestRecordDate = records.length > 0 ? records[0].date : '';
  const latestSaleDate = sales.length > 0 ? sales[0].date : '';
  const cacheKey = `${records.length}-${sales.length}-${latestRecordDate}-${latestSaleDate}`;
  
  const cached = insightsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  try {
    const response = await withRetry(() => getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          parts: [
            {
              text: `Analisa data kewangan berikut dan berikan 3-4 cadangan ringkas (insights) untuk papan pemuka (dashboard).
              Setiap cadangan mesti mempunyai jenis: 'improvement' (apa yang perlu diperbaiki), 'attention' (apa yang perlu diperhatikan), atau 'positive' (pencapaian baik).
              Berikan jawapan dalam Bahasa Melayu.
              
              Data Transaksi:
              ${JSON.stringify(records.slice(0, 20).map(r => ({ type: r.type, category: r.category, amount: r.amount, date: r.date })))}
              
              Data Jualan:
              ${JSON.stringify(sales.slice(0, 20).map(s => ({ product: s.product_name, quantity: s.quantity, total: s.total, date: s.date })))}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["improvement", "attention", "positive"] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["type", "title", "description"],
          },
        },
      },
    }));

    const result = JSON.parse(response.text || "[]");
    if (result.length > 0) {
      insightsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (error: any) {
    console.error("Error getting dashboard insights:", error);
    if (error?.message?.includes('429') || error?.status === 429 || error?.code === 429) {
      return [{
        type: 'attention',
        title: 'Had Quota Dicapai',
        description: 'Analisis AI sedang berehat sebentar (had kuota dicapai). Sila cuba lagi dalam beberapa minit.'
      }];
    }
    return [];
  }
}
