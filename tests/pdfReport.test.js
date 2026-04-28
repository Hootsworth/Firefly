import test from "node:test";
import assert from "node:assert/strict";
import { createReportPdf } from "../src/pdfReport.js";

test("creates a non-empty PDF report", () => {
  const pdf = createReportPdf({
    scenario: {
      fileSize: 10,
      observedSeconds: 12,
      portMbps: 10000,
      sourceReadMBps: 3000,
      destinationWriteMBps: 2500,
      busMBps: 7000,
      memoryCopyMBps: 20000,
      cpuTransformMBps: 15000
    },
    history: [{ title: "RAM", MBps: 5000, seconds: 0.1 }]
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
});
