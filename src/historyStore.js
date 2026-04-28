import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HISTORY_PATH = join(process.cwd(), ".firefly-history.json");

export async function readHistory() {
  try {
    const text = await readFile(HISTORY_PATH, "utf8");
    const data = JSON.parse(text);
    return Array.isArray(data.runs) ? data.runs : [];
  } catch {
    return [];
  }
}

export async function appendHistory(entry) {
  const runs = await readHistory();
  const next = [{ ...entry, recordedAt: new Date().toISOString() }, ...runs].slice(0, 50);
  await writeFile(HISTORY_PATH, JSON.stringify({ runs: next }, null, 2));
  return next;
}
