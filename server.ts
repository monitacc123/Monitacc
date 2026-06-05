import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/debug-pdf-count", async (req, res) => {
    try {
      const { extractTextFromPdf } = await import("./src/services/pdfExtractor.ts");
      const { base64Data } = req.body;
      const pdfText = await extractTextFromPdf(base64Data);
      const pages = pdfText.split(/--- Page \d+ ---/).filter((p: string) => p.trim());

      const txStartPattern = /^\d{1,2}\/\d{1,2}\/\d{4}(\s*[A-Za-z]|\s*$)/;
      let totalTx = 0;
      const perPage: { page: number; count: number; firstLines: string[] }[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageLines = pages[i].split("\n").filter((l: string) => l.trim());
        const matches = pageLines.filter((l: string) => txStartPattern.test(l));
        totalTx += matches.length;
        perPage.push({
          page: i + 1,
          count: matches.length,
          firstLines: matches.slice(0, 3).map((l: string) => l.substring(0, 60)),
        });
      }

      res.json({ totalTx, pages: pages.length, perPage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
