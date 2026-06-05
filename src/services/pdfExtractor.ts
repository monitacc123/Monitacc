import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

function extractLinesFromItems(items: any[]): string[] {
  if (items.length === 0) return [];

  const textItems: TextItem[] = [];
  for (const item of items) {
    if (item.str === undefined || item.str === null) continue;
    textItems.push({
      str: item.str,
      x: item.transform[4],
      y: Math.round(item.transform[5] * 10) / 10,
      width: item.width || 0,
    });
  }

  if (textItems.length === 0) return [];

  // Group items by Y position (same row)
  const rows = new Map<number, TextItem[]>();
  for (const item of textItems) {
    let foundRow = false;
    for (const [key] of rows) {
      if (Math.abs(item.y - key) <= 2) {
        rows.get(key)!.push(item);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.set(item.y, [item]);
    }
  }

  // Sort rows by Y position descending (PDF Y goes bottom-up)
  const sortedRows = [...rows.entries()]
    .sort((a, b) => b[0] - a[0]);

  const lines: string[] = [];
  for (const [, rowItems] of sortedRows) {
    // Sort items in row by X position (left to right)
    rowItems.sort((a, b) => a.x - b.x);

    let line = "";
    let lastX = 0;
    for (const item of rowItems) {
      if (!item.str) continue;
      // Add spacing based on X gap
      if (line && item.x - lastX > 15) {
        line += "  ";
      } else if (line && item.x - lastX > 3) {
        line += " ";
      }
      line += item.str;
      lastX = item.x + item.width;
    }
    if (line.trim()) lines.push(line.trim());
  }

  return lines;
}

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
    const lines = extractLinesFromItems(content.items);
    if (lines.length > 0) {
      textParts.push(`--- Page ${pageNum} ---\n${lines.join("\n")}`);
    }
  }

  return textParts.join("\n\n");
}
