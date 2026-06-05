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
    const items = content.items as any[];

    if (items.length === 0) continue;

    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of items) {
      const text = item.str;
      if (text === undefined || text === null) continue;

      const y = item.transform[5];
      const roundedY = Math.round(y);

      if (lastY !== null && Math.abs(roundedY - lastY) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = text;
      } else {
        const gap = item.transform[4] - (currentLine.length > 0 ? 0 : 0);
        currentLine += (currentLine && text ? "  " : "") + text;
      }
      lastY = roundedY;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    textParts.push(`--- Page ${pageNum} ---\n${lines.join("\n")}`);
  }

  return textParts.join("\n\n");
}
