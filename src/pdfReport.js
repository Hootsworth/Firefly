import { analyzeScenario, formatRate, formatSeconds } from "./model.js";

const PAGE_W = 612;
const PAGE_H = 792;
const INK = [0.102, 0.094, 0.078];
const INK_3 = [0.478, 0.463, 0.439];
const PAPER = [0.98, 0.973, 0.953];
const PAPER_2 = [0.929, 0.914, 0.878];
const RED = [0.757, 0.239, 0.18];
const ORANGE = [0.941, 0.353, 0.133];
const TEAL = [0.165, 0.42, 0.369];
const AMBER = [0.769, 0.49, 0.102];

export function createReportPdf({ scenario, history = [] }) {
  const result = analyzeScenario(scenario || {});
  const doc = new PdfDoc();

  drawSummaryPage(doc, result);
  drawDetailPage(doc, result, history);

  return doc.render();
}

function drawSummaryPage(doc, result) {
  const page = doc.page();
  background(page, "FIREFLY REPORT");
  wordmark(page, 78, 674, 84);
  page.text("DIAGNOSTIC RESULT", 82, 640, { size: 9, font: "mono", color: RED, tracking: 2.2 });
  page.text(result.verdict.title, 82, 594, { size: 28, font: "serifItalic", color: INK });
  page.text(result.verdict.detail, 82, 560, { size: 11, color: INK_3, maxWidth: 410, leading: 15 });

  const metrics = [
    ["Expected t", formatSeconds(result.expectedSeconds)],
    ["Observed t'", formatSeconds(result.observedSeconds)],
    ["Delta", `${result.deltaSeconds >= 0 ? "+" : ""}${formatSeconds(result.deltaSeconds)}`],
    ["Observed rate", formatRate(result.observedRateMBps)]
  ];
  metrics.forEach((metric, index) => {
    const x = 82 + (index % 2) * 218;
    const y = 448 - Math.floor(index / 2) * 105;
    card(page, x, y, 194, 78, index === 2 ? RED : TEAL);
    page.text(metric[0].toUpperCase(), x + 14, y + 50, { size: 8, font: "mono", color: INK_3, tracking: 1.5 });
    page.text(metric[1], x + 14, y + 20, { size: 25, font: "display", color: INK });
  });

  page.text("PRIMARY CONSTRAINT", 82, 226, { size: 9, font: "mono", color: RED, tracking: 2 });
  const primary = result.stages[0];
  page.text(primary?.name || "Unknown", 82, 190, { size: 34, font: "display", color: INK });
  page.text(primary ? `${formatRate(primary.effectiveRateMBps)}. ${primary.explanation}` : "No valid stage data.", 82, 162, {
    size: 12,
    font: "serifItalic",
    color: INK_3,
    maxWidth: 430,
    leading: 15
  });

  page.text(`Confidence band: +/-${result.tolerancePct.toFixed(0)}%`, 82, 96, { size: 10, font: "mono", color: INK_3 });
  page.text(new Date().toLocaleString(), 82, 76, { size: 8, font: "mono", color: INK_3 });
}

function drawDetailPage(doc, result, history) {
  const page = doc.page();
  background(page, "DETAILS");

  section(page, "CONSTRAINT STACK", 72, 704);
  let y = 672;
  result.stages.slice(0, 7).forEach((stage) => {
    const width = Math.max(16, Math.min(220, stage.pressure * 220));
    page.text(stage.name, 82, y, { size: 11, font: "bold", color: INK });
    page.text(`${formatRate(stage.effectiveRateMBps)} / ${stage.headline}`, 332, y, { size: 8, font: "mono", color: INK_3 });
    page.rect(82, y - 15, 220, 5, { fill: PAPER_2 });
    page.rect(82, y - 15, width, 5, { fill: stage.headline === "primary constraint" ? RED : TEAL });
    y -= 38;
  });

  section(page, "NEXT CHECKS", 72, y - 10);
  y -= 42;
  result.recommendations.slice(0, 5).forEach((item, index) => {
    page.text(String(index + 1).padStart(2, "0"), 82, y, { size: 18, font: "display", color: RED });
    page.text(item, 122, y + 2, { size: 10, color: INK, maxWidth: 390, leading: 13 });
    y -= 44;
  });

  section(page, "CONFIDENCE LEDGER", 72, y - 6);
  y -= 38;
  [
    ["Measured", result.confidence.measured],
    ["Derived", result.confidence.derived],
    ["Assumed", result.confidence.assumed],
    ["Blocked", result.confidence.blocked]
  ].forEach(([label, items]) => {
    page.text(label.toUpperCase(), 82, y, { size: 8, font: "mono", color: TEAL, tracking: 1.5 });
    page.text((items.length ? items : ["No entries for this run."]).join("; "), 172, y, { size: 9, color: INK_3, maxWidth: 330, leading: 12 });
    y -= 38;
  });

  section(page, "RECENT BENCHMARKS", 72, y - 8);
  y -= 40;
  (history || []).slice(0, 5).forEach((run) => {
    page.text(run.title || run.id, 82, y, { size: 10, font: "bold", color: INK });
    page.text(`${formatRate(run.MBps)} / ${formatSeconds(run.seconds)}`, 310, y, { size: 8, font: "mono", color: INK_3 });
    y -= 24;
  });
}

function background(page, label) {
  page.rect(0, 0, PAGE_W, PAGE_H, { fill: PAPER });
  page.rect(0, 0, 44, PAGE_H, { fill: INK });
  page.text(label, 15, 724, { size: 8, font: "mono", color: PAPER, rotate: 90, tracking: 2 });
  for (let x = 72; x < PAGE_W; x += 48) page.line(x, 0, x, PAGE_H, { color: [0.9, 0.88, 0.84], width: 0.4 });
  for (let y = 0; y < PAGE_H; y += 48) page.line(44, y, PAGE_W, y, { color: [0.9, 0.88, 0.84], width: 0.4 });
}

function wordmark(page, x, y, size) {
  page.text("Fire", x, y, { size, font: "display", color: INK });
  page.text("fly", x + size * 1.08, y, { size, font: "display", color: ORANGE });
}

function section(page, label, x, y) {
  page.line(x, y + 3, x + 40, y + 3, { color: RED, width: 1 });
  page.text(label, x + 52, y, { size: 8, font: "mono", color: RED, tracking: 2 });
}

function card(page, x, y, w, h, accent) {
  page.rect(x, y, w, h, { fill: PAPER, stroke: [0.82, 0.8, 0.75], width: 0.8 });
  page.rect(x, y, 3, h, { fill: accent });
}

class PdfDoc {
  constructor() {
    this.pages = [];
  }

  page() {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  render() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
    add("<< /Type /Pages /Kids [] /Count 0 >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

    const pageRefs = [];
    this.pages.forEach((page) => {
      const stream = page.commands.join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
      const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageRefs.push(`${pageId} 0 R`);
    });

    objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${this.pages.length} >>`;
    const remapped = objects.map((body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`);
    const header = "%PDF-1.4\n";
    const offsets = [];
    let cursor = Buffer.byteLength(header);
    remapped.forEach((object) => {
      offsets.push(cursor);
      cursor += Buffer.byteLength(object);
    });
    const xrefOffset = cursor;
    const xref = `xref\n0 ${remapped.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\n`;
    const trailer = `trailer\n<< /Size ${remapped.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(header + remapped.join("") + xref + trailer);
  }
}

class PdfPage {
  constructor() {
    this.commands = [];
  }

  text(text, x, y, options = {}) {
    const size = options.size || 10;
    const font = { regular: "F1", bold: "F2", display: "F2", serifItalic: "F3", mono: "F4" }[options.font || "regular"];
    const lines = wrap(String(text), options.maxWidth || 9999, size);
    lines.forEach((line, index) => {
      const yy = y - index * (options.leading || size * 1.25);
      this.commands.push("BT");
      this.commands.push(color(options.color || INK, "rg"));
      this.commands.push(`/${font} ${size} Tf`);
      if (options.tracking) this.commands.push(`${options.tracking} Tc`);
      if (options.rotate === 90) this.commands.push(`0 1 -1 0 ${x} ${yy} Tm`);
      else this.commands.push(`1 0 0 1 ${x} ${yy} Tm`);
      this.commands.push(`(${escapeText(line)}) Tj`);
      this.commands.push("ET");
    });
  }

  rect(x, y, w, h, options = {}) {
    if (options.fill) this.commands.push(color(options.fill, "rg"));
    if (options.stroke) this.commands.push(color(options.stroke, "RG"));
    if (options.width) this.commands.push(`${options.width} w`);
    this.commands.push(`${x} ${y} ${w} ${h} re`);
    this.commands.push(options.fill && options.stroke ? "B" : options.fill ? "f" : "S");
  }

  line(x1, y1, x2, y2, options = {}) {
    this.commands.push(color(options.color || INK, "RG"));
    this.commands.push(`${options.width || 1} w`);
    this.commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }
}

function wrap(text, maxWidth, size) {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function color(values, op) {
  return `${values.map((value) => value.toFixed(3)).join(" ")} ${op}`;
}

function escapeText(text) {
  return text.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "");
}
