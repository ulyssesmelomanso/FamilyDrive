import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

patchInvestorDashboard();

console.log(`Restored ${Object.keys(files).length} FamilyDrive source files.`);

function patchInvestorDashboard() {
  const pagePath = "app/page.tsx";
  let page = readFileSync(pagePath, "utf8");

  page = page.replace(
    "  const activeVehicleCount = allVehicles.filter((vehicle) => vehicle.status === \"active\").length;\n\n  return (",
    "  const activeVehicleCount = allVehicles.filter((vehicle) => vehicle.status === \"active\").length;\n  const detailVehicles = useMemo(() => {\n    if (vehicleId === \"all\" && status === \"all\") {\n      return allVehicles.filter((vehicle) => vehicle.status === \"active\");\n    }\n    return allVehicles;\n  }, [allVehicles, status, vehicleId]);\n\n  return ("
  );

  page = page.replace(
    "                {allVehicles.map((vehicle) => (\n                  <VehicleCard key={vehicle.id} vehicle={vehicle} />\n                ))}",
    "                {detailVehicles.map((vehicle) => (\n                  <VehicleCard key={vehicle.id} vehicle={vehicle} />\n                ))}"
  );

  page = page.replace(
    "        : status === \"returned\"\n          ? \"bg-[#d8f5df] text-[#165f2f]\"",
    "        : status === \"returned\"\n          ? \"bg-[#ffe89a] text-[#6a5200]\""
  );

  writeFileSync(pagePath, page);
}
