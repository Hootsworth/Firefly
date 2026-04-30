import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { probeHardware } from "./src/hardwareProbe.js";
import { listBenchmarks, runBenchmark } from "./src/benchmarkEngine.js";
import { appendHistory, readHistory } from "./src/historyStore.js";
import { createReportPdf } from "./src/pdfReport.js";
import { summarizeGeneratedCatalog } from "./src/catalogAdapters.js";
import { GENERATED_HARDWARE_CATALOG } from "./src/hardwareCatalog.generated.js";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname === "/api/probe") {
      await sendJson(res, await probeHardware());
      return;
    }

    if (url.pathname === "/api/benchmarks") {
      await sendJson(res, { benchmarks: listBenchmarks() });
      return;
    }

    if (url.pathname === "/api/catalog") {
      await sendJson(res, {
        summary: summarizeGeneratedCatalog(GENERATED_HARDWARE_CATALOG),
        sources: GENERATED_HARDWARE_CATALOG.sources,
        pciDevices: GENERATED_HARDWARE_CATALOG.pciDevices,
        usbDevices: GENERATED_HARDWARE_CATALOG.usbDevices,
        wikidataComponents: GENERATED_HARDWARE_CATALOG.wikidataComponents
      });
      return;
    }

    if (url.pathname === "/api/history") {
      await sendJson(res, { runs: await readHistory() });
      return;
    }

    if (url.pathname === "/api/report") {
      await sendJson(res, {
        generatedAt: new Date().toISOString(),
        history: await readHistory(),
        note: "Sanitized local Firefly report. Probe data is only included when requested through the UI."
      });
      return;
    }

    if (url.pathname === "/api/report.pdf" && req.method === "POST") {
      const body = await readJson(req);
      const pdf = createReportPdf({
        scenario: body.scenario || {},
        history: await readHistory()
      });
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="firefly-report-${new Date().toISOString().slice(0, 10)}.pdf"`
      });
      res.end(pdf);
      return;
    }

    const benchmarkMatch = url.pathname.match(/^\/api\/benchmarks\/([^/]+)\/run$/);
    if (benchmarkMatch && req.method === "POST") {
      const body = await readJson(req);
      const result = await runBenchmark(benchmarkMatch[1], body);
      if (result.status === "complete") await appendHistory(result);
      await sendJson(res, result);
      return;
    }

    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(root, path));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end("Not found");
  }
});

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

server.listen(port, host, () => {
  console.log(`Firefly running at http://${host}:${port}`);
});
