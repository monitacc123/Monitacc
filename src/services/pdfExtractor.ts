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
      y: item.transform[5],
      width: item.width || 0,
    });
  }

  if (textItems.length === 0) return [];

  // Sort all items by Y descending (top to bottom in PDF), then X ascending
  textItems.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 0.5) return yDiff;
    return a.x - b.x;
  });

  // Group items into rows using adaptive Y threshold
  // Compare each item to the MEAN Y of the current row to prevent drift
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [textItems[0]];
  let currentRowYSum = textItems[0].y;

  for (let i = 1; i < textItems.length; i++) {
    const item = textItems[i];
    const meanY = currentRowYSum / currentRow.length;
    if (Math.abs(item.y - meanY) <= 2) {
      currentRow.push(item);
      currentRowYSum += item.y;
    } else {
      rows.push(currentRow);
      currentRow = [item];
      currentRowYSum = item.y;
    }
  }
  rows.push(currentRow);

  const lines: string[] = [];
  for (const rowItems of rows) {
    // Sort items in row by X position (left to right)
    rowItems.sort((a, b) => a.x - b.x);

    let line = "";
    let lastEndX = 0;
    for (const item of rowItems) {
      if (!item.str) continue;
      const gap = item.x - lastEndX;
      if (line && gap > 20) {
        line += "  ";
      } else if (line && gap > 5) {
        line += " ";
      }
      line += item.str;
      lastEndX = item.x + item.width;
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
