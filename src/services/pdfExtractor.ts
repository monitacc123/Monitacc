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

    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = "";

    for (const item of content.items as any[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = item.str;
      } else {
        currentLine += (currentLine ? "  " : "") + item.str;
      }
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    textParts.push(`--- Page ${pageNum} ---\n${lines.join("\n")}`);
  }

  return textParts.join("\n\n");
}
