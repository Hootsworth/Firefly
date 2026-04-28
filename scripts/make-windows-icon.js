import { readFile, writeFile } from "node:fs/promises";

const entries = [
  { width: 32, height: 32, path: "src-tauri/icons/32x32.png" },
  { width: 128, height: 128, path: "src-tauri/icons/128x128.png" },
  { width: 256, height: 256, path: "src-tauri/icons/128x128@2x.png" }
];

const images = await Promise.all(entries.map(async (entry) => ({
  ...entry,
  bytes: await readFile(entry.path)
})));

const headerSize = 6;
const directorySize = images.length * 16;
let offset = headerSize + directorySize;
const chunks = [];

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
chunks.push(header);

for (const image of images) {
  const directory = Buffer.alloc(16);
  directory.writeUInt8(image.width === 256 ? 0 : image.width, 0);
  directory.writeUInt8(image.height === 256 ? 0 : image.height, 1);
  directory.writeUInt8(0, 2);
  directory.writeUInt8(0, 3);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(32, 6);
  directory.writeUInt32LE(image.bytes.length, 8);
  directory.writeUInt32LE(offset, 12);
  chunks.push(directory);
  offset += image.bytes.length;
}

chunks.push(...images.map((image) => image.bytes));
await writeFile("src-tauri/icons/icon.ico", Buffer.concat(chunks));
console.log("Built Windows icon at src-tauri/icons/icon.ico");
