import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export async function extractTextFromPdf(base64Data: string): Promise<string> {
  const base64 = base64Data.split(",")[1] || base64Data;
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPages = pdf.numPages;
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
  }

  return textParts.join("\n\n");
}
