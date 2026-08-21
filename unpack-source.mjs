import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";

const sourceUrl = "https://at.adobe.com/xXX87wxlkwpxg7XI";
const expectedSha256 = "604f4d12c4750dd783c28484f63dc96f13bd85c2e4f88d048385f7cf750db618";

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`Could not download FamilyDrive source archive: ${response.status} ${response.statusText}`);
}

const archive = Buffer.from(await response.arrayBuffer());
const actualSha256 = createHash("sha256").update(archive).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error(`FamilyDrive source archive integrity check failed. Expected ${expectedSha256}, received ${actualSha256}.`);
}

const files = JSON.parse(brotliDecompressSync(archive).toString("utf8"));

for (const [path, encoded] of Object.entries(files)) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(encoded, "base64"));
}

console.log(`Restored ${Object.keys(files).length} FamilyDrive source files.`);
