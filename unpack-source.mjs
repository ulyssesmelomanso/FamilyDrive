import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const chunkCount = 8;
const archive = Array.from({ length: chunkCount }, (_, index) =>
  readFileSync(`source.part${String(index + 1).padStart(2, "0")}.txt`, "utf8").trim()
).join("");

const files = JSON.parse(brotliDecompressSync(Buffer.from(archive, "base64")).toString("utf8"));

for (const [path, encoded] of Object.entries(files)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(encoded, "base64"));
}

console.log(`Restored ${Object.keys(files).length} FamilyDrive source files.`);
