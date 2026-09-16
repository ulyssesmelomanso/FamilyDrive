import * as XLSX from "xlsx";
import { put } from "@vercel/blob";
import { createCipheriv, randomBytes, randomUUID, scryptSync } from "crypto";
import { initializeDatabase, getSql } from "./db";
import { getCurrentSession } from "./auth";

type WorkbookVehicle = {
  vehicle_key: string;
  name: string;
  display_order: number;
  vin: string;
  plate: string;
  status: string;
  purchase_price: number;
  repairs: number;
  dmv_fees: number;
  dealer_fees: number;
  auction_fees: number;
  other_acquisition_costs: number;
  current_estimated_value: number;
  depreciation_estimate: number;
  cash_returned: number;
  note: string;
};

type WorkbookMonth = {
  vehicle_key: string;
  month_label: string;
  revenue: number;
  expenses: number;
  net_profit: number;
  items: { label: string; amount: number }[];
};

export type ImportResult = {
  datasetId: string;
  vehicleCount: number;
  monthlyMetricCount: number;
  transactionCount: number;
  blobUrl?: string;
};

export async function importWorkbook(file: File): Promise<ImportResult> {
  validateFile(file);
  await initializeDatabase();

  const session = getCurrentSession();
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const vehicles = parseVehicles(workbook);
  const monthlyMetrics = parseMonthlyMetrics(workbook, vehicles);

  if (!vehicles.length) {
    throw new Error("No vehicle rows were found. Add a Vehicles tab or vehicle tabs with recognizable names.");
  }

  const blobUrl = await archiveWorkbook(file.name, buffer);
  const sql = getSql();
  const datasetRows = await sql`
    insert into datasets (
      filename,
      import_date,
      imported_by,
      vehicle_count,
      transaction_count,
      monthly_metric_count,
      import_status,
      is_active,
      notes,
      blob_url
    )
    values (
      ${file.name},
      now(),
      ${session?.username || "admin"},
      ${vehicles.length},
      0,
      ${monthlyMetrics.length},
      'imported',
      false,
      'Imported from admin Excel upload.',
      ${blobUrl || null}
    )
    returning id
  ` as { id: string }[];
  const datasetId = datasetRows[0].id;

  for (const vehicle of vehicles) {
    await sql`
      insert into vehicles (
        dataset_id, vehicle_key, name, display_order, vin, plate, status, purchase_price, repairs, dmv_fees,
        dealer_fees, auction_fees, other_acquisition_costs, current_estimated_value,
        depreciation_estimate, cash_returned, note
      )
      values (
        ${datasetId}, ${vehicle.vehicle_key}, ${vehicle.name}, ${vehicle.display_order}, ${vehicle.vin}, ${vehicle.plate},
        ${vehicle.status}, ${vehicle.purchase_price}, ${vehicle.repairs}, ${vehicle.dmv_fees},
        ${vehicle.dealer_fees}, ${vehicle.auction_fees}, ${vehicle.other_acquisition_costs},
        ${vehicle.current_estimated_value}, ${vehicle.depreciation_estimate}, ${vehicle.cash_returned},
        ${vehicle.note}
      )
    `;
  }

  for (const month of monthlyMetrics) {
    await sql`
      insert into monthly_metrics (dataset_id, vehicle_key, month_label, revenue, expenses, net_profit, items)
      values (
        ${datasetId}, ${month.vehicle_key}, ${month.month_label}, ${month.revenue},
        ${month.expenses}, ${month.net_profit}, ${JSON.stringify(month.items)}
      )
    `;
  }

  await sql`
    insert into import_logs (dataset_id, level, message)
    values (${datasetId}, 'success', ${`Imported ${vehicles.length} vehicles and ${monthlyMetrics.length} monthly summaries.`})
  `;

  return {
    datasetId,
    vehicleCount: vehicles.length,
    monthlyMetricCount: monthlyMetrics.length,
    transactionCount: 0,
    blobUrl
  };
}

function validateFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    throw new Error("Please upload an Excel workbook ending in .xlsx or .xls.");
  }
}

async function archiveWorkbook(filename: string, buffer: Buffer) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;
  if (!process.env.ARCHIVE_ENCRYPTION_KEY) {
    throw new Error("ARCHIVE_ENCRYPTION_KEY is required before uploaded spreadsheets can be archived in Vercel Blob.");
  }

  const safeName = filename.replace(/[^a-z0-9._-]/gi, "-");
  const encrypted = encryptWorkbook(buffer, process.env.ARCHIVE_ENCRYPTION_KEY);
  const result = await put(`familydrive-uploads/${randomUUID()}-${safeName}.enc`, encrypted, {
    access: "public",
    contentType: "application/octet-stream"
  });
  return result.url;
}

function encryptWorkbook(buffer: Buffer, password: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("FDENC1"), salt, iv, tag, encrypted]);
}

function parseVehicles(workbook: XLSX.WorkBook): WorkbookVehicle[] {
  const masterSheetName = workbook.SheetNames.find((name) => normalize(name) === "master");
  if (masterSheetName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[masterSheetName], { header: 1, defval: "" });
    const vehicles = parseMasterVehicles(rows);
    if (vehicles.length) return vehicles;
  }

  const vehiclesSheetName = workbook.SheetNames.find((name) => normalize(name) === "vehicles");
  if (vehiclesSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[vehiclesSheetName], { defval: "" });
    return rows.map((row, index) => vehicleFromRow(row, index)).filter((vehicle) => vehicle.name || vehicle.vin);
  }

  return workbook.SheetNames
    .filter((name) => !["master", "summary", "totals", "expenses", "transactions"].includes(normalize(name)))
    .map((sheetName, index) => ({
      vehicle_key: slug(sheetName),
      name: sheetName,
      display_order: index + 1,
      vin: "",
      plate: "",
      status: "active",
      purchase_price: 0,
      repairs: 0,
      dmv_fees: 0,
      dealer_fees: 0,
      auction_fees: 0,
      other_acquisition_costs: 0,
      current_estimated_value: 0,
      depreciation_estimate: 0,
      cash_returned: 0,
      note: index === -1 ? "" : ""
    }));
}

function parseMasterVehicles(rows: unknown[][]): WorkbookVehicle[] {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => normalize(String(cell || "")));
    return headers.includes("makemodel") && headers.includes("vin");
  });
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((cell) => normalize(String(cell || "")));
  const column = (name: string) => headers.indexOf(normalize(name));
  const value = (row: unknown[], name: string) => {
    const index = column(name);
    return index >= 0 ? row[index] : "";
  };
  const returnedByName = findReturnedRows(rows.slice(headerIndex + 1), value);

  return rows.slice(headerIndex + 1).map((row, index) => {
    const rawName = String(value(row, "MAKE/MODEL") || "").trim();
    const vin = String(value(row, "VIN") || "").trim();
    if (!rawName && !vin) return null;

    const orderMatch = rawName.match(/^\s*(\d+)/);
    const name = rawName.replace(/^\d+\s*-\s*/, "").trim();
    const normalizedName = normalize(name);
    if (!name || normalizedName.includes("total") || normalizedName.includes("totais")) return null;
    if (normalizedName.includes("returned")) return null;

    const noteText = String(row.find((cell) => normalize(String(cell || "")).includes("received")) || "");
    const status = statusForMasterVehicle(name, vin, noteText);
    const returnedAmount = returnedAmountForVehicle(name, returnedByName);
    const cashReturned =
      status === "total_loss"
        ? parseMoney(noteText) || 14855.89
        : status === "returned"
          ? returnedAmount
          : 0;

    return {
      vehicle_key: vin || slug(name) || `vehicle-${index + 1}`,
      name,
      display_order: orderMatch ? Number(orderMatch[1]) : index + 1,
      vin,
      plate: String(value(row, "PLATE") || "").trim(),
      status,
      purchase_price: parseMoney(String(value(row, "AUCTION COST") || "")),
      repairs: parseMoney(String(value(row, "REPAIRS") || "")),
      dmv_fees: parseMoney(String(value(row, "DMV") || "")),
      dealer_fees: parseMoney(String(value(row, "DEALER FEE") || "")),
      auction_fees: 0,
      other_acquisition_costs:
        parseMoney(String(value(row, "HUNT FEES") || "")) +
        parseMoney(String(value(row, "PREP COSTS") || "")),
      current_estimated_value: 0,
      depreciation_estimate: 0,
      cash_returned: cashReturned,
      note: noteForMasterVehicle(name, status, cashReturned)
    };
  }).filter(Boolean) as WorkbookVehicle[];
}

function findReturnedRows(rows: unknown[][], value: (row: unknown[], name: string) => unknown) {
  const returned = new Map<string, number>();
  for (const row of rows) {
    const rawName = String(value(row, "MAKE/MODEL") || "").trim();
    const normalizedName = normalize(rawName);
    if (!normalizedName.includes("returned")) continue;
    const baseName = normalizedName.replace(/\breturned\b/g, "").trim();
    const amount =
      parseMoney(String(value(row, "REMAINING") || "")) ||
      parseMoney(String(value(row, "BUDGET") || "")) ||
      parseMoney(String(value(row, "TOTAL SPENT") || ""));
    if (baseName && amount) returned.set(baseName, amount);
  }
  return returned;
}

function returnedAmountForVehicle(name: string, returnedByName: Map<string, number>) {
  const normalizedName = normalize(name);
  for (const [returnedName, amount] of Array.from(returnedByName.entries())) {
    if (normalizedName.includes(returnedName) || returnedName.includes(normalizedName.split(" ")[0])) return amount;
  }
  return 0;
}

function statusForMasterVehicle(name: string, vin: string, note = "") {
  const normalized = normalize(`${name} ${vin}`);
  if (normalized.includes("cherokee latitude")) return "total_loss";
  if (normalized.includes("honda odissey") || normalized.includes("honda odyssey")) return "inactive";
  if (normalized.includes("compass trailhawk") || normalize(note).includes("returned")) return "returned";
  return "active";
}

function noteForMasterVehicle(name: string, status: string, cashReturned: number) {
  if (status === "total_loss") return `Total loss. Investor was paid back ${formatCurrency(cashReturned)}.`;
  if (status === "returned") return `Returned. Investor recovery recorded from the master sheet: ${formatCurrency(cashReturned)}.`;
  if (status === "inactive") return "Inactive. This vehicle has not hit the road, so it is excluded from portfolio totals and return estimates.";
  return "";
}

function vehicleFromRow(row: Record<string, unknown>, index: number): WorkbookVehicle {
  const vin = text(row, ["vin", "vehicle id", "vehicle_id", "id"]);
  const name = text(row, ["vehicle", "vehicle name", "name", "model", "year make model"]);
  return {
    vehicle_key: vin || slug(name) || `vehicle-${index + 1}`,
    name: name || vin || `Vehicle ${index + 1}`,
    display_order: index + 1,
    vin,
    plate: text(row, ["plate", "license plate", "tag"]),
    status: normalize(text(row, ["status", "vehicle status"])) || "active",
    purchase_price: money(row, ["purchase price", "cost", "vehicle cost", "auction cost"]),
    repairs: money(row, ["repairs", "repair cost", "reconditioning", "reconditioning cost", "recon cost"]),
    dmv_fees: money(row, ["dmv fees", "dmv", "registration"]),
    dealer_fees: money(row, ["dealer fees", "dealer fee"]),
    auction_fees: money(row, ["auction fees", "auction fee"]),
    other_acquisition_costs: money(row, ["other acquisition costs", "other costs", "transport", "shipping"]),
    current_estimated_value: money(row, ["current estimated value", "current value", "market value"]),
    depreciation_estimate: money(row, ["depreciation estimate", "depreciation"]),
    cash_returned: money(row, ["cash returned", "returned to investor", "distributions"]),
    note: text(row, ["notes", "note"])
  };
}

function parseMonthlyMetrics(workbook: XLSX.WorkBook, vehicles: WorkbookVehicle[]): WorkbookMonth[] {
  const monthlySheetName = workbook.SheetNames.find((name) => normalize(name) === "monthly summary");
  if (monthlySheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[monthlySheetName], { defval: "" });
    return rows.map((row) => {
      const revenue = money(row, ["revenue", "income", "monthly revenue"]);
      const expenses = money(row, ["expenses", "costs", "monthly expenses"]);
      return {
        vehicle_key: text(row, ["vehicle id", "vin", "vehicle", "name"]),
        month_label: text(row, ["month", "date", "period"]),
        revenue,
        expenses,
        net_profit: money(row, ["net profit", "profit"]) || revenue - expenses,
        items: []
      };
    }).filter((row) => row.vehicle_key && row.month_label);
  }

  const vehicleByNumber = new Map<string, WorkbookVehicle>();
  vehicles.forEach((vehicle, index) => vehicleByNumber.set(String(index + 1).padStart(2, "0"), vehicle));
  const vehicleBySheet = new Map(vehicles.map((vehicle) => [normalize(vehicle.name), vehicle]));
  const months: WorkbookMonth[] = [];

  for (const sheetName of workbook.SheetNames) {
    const numberPrefix = sheetName.match(/^\s*(\d{1,2})/)?.[1]?.padStart(2, "0");
    const vehicle = (numberPrefix ? vehicleByNumber.get(numberPrefix) : undefined) || vehicleBySheet.get(normalize(sheetName));
    if (!vehicle) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
    months.push(...parseMonthlyBlocks(rows, vehicle.vehicle_key));
  }

  return months;
}

function parseMonthlyBlocks(rows: unknown[][], vehicleKey: string): WorkbookMonth[] {
  const months: WorkbookMonth[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < (rows[rowIndex]?.length || 0); colIndex += 1) {
      const label = monthLabel(rows[rowIndex][colIndex]);
      if (!label) continue;
      const items: { label: string; amount: number }[] = [];
      let revenue = 0;
      let expenses = 0;
      let netProfit = 0;

      for (let offset = 1; offset <= 12; offset += 1) {
        const itemLabel = String(rows[rowIndex + offset]?.[colIndex] || "").trim();
        const amount = parseMoney(String(rows[rowIndex + offset]?.[colIndex + 1] || ""));
        if (!itemLabel && !amount) continue;
        if (!isMeaningfulMonthlyItem(itemLabel, amount)) continue;
        if (normalize(itemLabel).includes("gross") || normalize(itemLabel).includes("income") || normalize(itemLabel).includes("revenue")) {
          revenue += amount;
        } else if (normalize(itemLabel).includes("profit")) {
          netProfit = amount;
          break;
        } else {
          expenses += Math.abs(amount);
          items.push({ label: itemLabel || "Expense", amount: Math.abs(amount) });
        }
      }

      if (revenue <= 0) continue;
      months.push({
        vehicle_key: vehicleKey,
        month_label: label,
        revenue,
        expenses,
        net_profit: netProfit || revenue - expenses,
        items
      });
    }
  }
  return months;
}

function isMeaningfulMonthlyItem(label: string, amount: number) {
  const normalized = normalize(label);
  if (!amount && ["description", "descrição", "descricao"].includes(normalized)) return false;
  return Boolean(normalized || amount);
}

function text(row: Record<string, unknown>, aliases: string[]) {
  const normalized = normalizedRow(row);
  for (const alias of aliases) {
    const value = normalized.get(normalize(alias));
    if (value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function money(row: Record<string, unknown>, aliases: string[]) {
  return parseMoney(text(row, aliases));
}

function normalizedRow(row: Record<string, unknown>) {
  return new Map(Object.entries(row).map(([key, value]) => [normalize(key), value]));
}

function parseMoney(value: string) {
  const cleaned = String(value || "").replace(/[^\d,.-]/g, "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function looksLikeMonth(value: string) {
  return Boolean(parseMonthText(value));
}

function monthLabel(value: unknown) {
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return formatMonthLabel(parsed.m - 1, parsed.y);
  }

  const textValue = String(value || "").trim();
  if (!looksLikeMonth(textValue)) return "";
  const parsed = parseMonthText(textValue);
  return parsed ? formatMonthLabel(parsed.month, parsed.year) : textValue;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatMonthLabel(month: number, year: number) {
  const labels = ["Jan", "Fev", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${labels[month]} ${year}`;
}

function parseMonthText(value: string) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\./g, "");
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;

  const numericMonthMatch = normalized.match(/\b(1[0-2]|0?[1-9])\s*[/-]\s*20\d{2}\b/);
  if (numericMonthMatch) return { month: Number(numericMonthMatch[1]) - 1, year: Number(yearMatch[1]) };

  const monthNames: Array<[RegExp, number]> = [
    [/jan|january|janeiro/, 0],
    [/fev|feb|february|fevereiro/, 1],
    [/mar|march|marc|marco|março/, 2],
    [/apr|apri|april|abr|abril/, 3],
    [/may|maio/, 4],
    [/jun|june|junho/, 5],
    [/jul|july|julho/, 6],
    [/aug|ago|august|agosto/, 7],
    [/sep|sept|september|setembro/, 8],
    [/oct|out|october|outubro/, 9],
    [/nov|november|novembro/, 10],
    [/dec|dez|december|dezembro/, 11]
  ];
  const month = monthNames.find(([pattern]) => pattern.test(normalized))?.[1];
  return month === undefined ? null : { month, year: Number(yearMatch[1]) };
}

function normalize(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[_-]/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, "-");
}
