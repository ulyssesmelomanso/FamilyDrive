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

  page = page.replace(
      '  if (vehicle.id === "JM3TCACY0G0105098") return "TBD";\n',
      ""
    );
  
    const importerPath = "lib/import-workbook.ts";
    let importer = readFileSync(importerPath, "utf8");
  
    importer = importer.replace(
      'const LAST_INCLUDED_REPORTING_MONTH = { month: 6, year: 2026 };\n\n',
      ""
    );
  
    importer = importer.replace(
  `  if (normalize(name).includes("mazda cx09") || normalize(name).includes("mazda cx9")) {
      return "Active. July is not closed yet, so ROI is marked TBD until monthly results are available.";
    }
  `,
      ""
    );
  
    importer = importer.replace(
  `      const parsedMonth = parseMonthText(label);
        if (parsedMonth && monthSortValue(parsedMonth) > monthSortValue(LAST_INCLUDED_REPORTING_MONTH)) continue;
  `,
      ""
    );
  
    importer = importer.replace(
  `        } else if (normalize(itemLabel).includes("profit")) {
            netProfit = amount;
          } else {`,
  `        } else if (normalize(itemLabel).includes("profit")) {
            netProfit = amount;
            break;
          } else {`
    );
  
    importer = importer.replace(
  `      if (normalize(label).startsWith("jul") && revenue <= 0) continue;
        if (revenue || expenses || netProfit) {
          months.push({
            vehicle_key: vehicleKey,
            month_label: label,
            revenue,
            expenses,
            net_profit: netProfit || revenue - expenses,
            items
          });
        }`,
  `      if (revenue <= 0) continue;
        months.push({
          vehicle_key: vehicleKey,
          month_label: label,
          revenue,
          expenses,
          net_profit: netProfit || revenue - expenses,
          items
        });`
    );
  
    importer = importer.replace(
  `function monthSortValue(value: { month: number; year: number }) {
    return value.year * 12 + value.month;
  }
  
  `,
      ""
    );
  
    if (
      importer.includes("LAST_INCLUDED_REPORTING_MONTH") ||
      importer.includes('normalize(label).startsWith("jul")') ||
      importer.includes("July is not closed yet")
    ) {
      throw new Error("Could not apply the FamilyDrive monthly import patch.");
    }
    writeFileSync(importerPath, importer);
  
    const repositoryPath = "lib/dashboard-repository.ts";
    let repository = readFileSync(repositoryPath, "utf8");
  
    repository = repository.replace(
      'const LAST_INCLUDED_REPORTING_MONTH = { month: 6, year: 2026 };\n\n',
      ""
    );
  
    repository = repository.replace(
      "  const monthlyBreakdowns = monthRows.filter((month) => isIncludedReportingMonth(month.month_label)).map((month): MonthlyBreakdown => {",
      "  const monthlyBreakdowns = monthRows.map((month): MonthlyBreakdown => {"
    );
  
    repository = repository.replace(
      '  const performance = included.filter((vehicle) => vehicle.status !== "total_loss" && vehicle.averageMonthlyRoi > 0);',
      '  const performance = vehicles.filter((vehicle) => vehicle.status === "active" && vehicle.monthlyBreakdowns.length > 0);'
    );
  
    repository = repository.replace(
  `function isIncludedReportingMonth(value: string) {
    const parsed = parseMonth(value);
    if (!parsed) return true;
    return monthSortValue(\`\${parsed.month + 1}/\${parsed.year}\`) <= monthSortValue(\`\${LAST_INCLUDED_REPORTING_MONTH.month + 1}/\${LAST_INCLUDED_REPORTING_MONTH.year}\`);
  }
  `,
      ""
    );
  
    if (
      repository.includes("LAST_INCLUDED_REPORTING_MONTH") ||
      repository.includes("isIncludedReportingMonth")
    ) {
      throw new Error("Could not apply the FamilyDrive dashboard reporting patch.");
    }
    writeFileSync(repositoryPath, repository);

  writeFileSync(pagePath, page);
}
