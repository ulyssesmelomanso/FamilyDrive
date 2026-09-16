import { DashboardData, DashboardFilters, TrendPoint, VehiclePerformance, VehicleStatus } from "./types";
import { mockDashboardData } from "./mock-data";
import { monthlyPerformanceByVin, totalLossPaymentsByVin } from "./monthly-performance";
import { findVehicleDepreciation, portfolioDepreciation } from "./depreciation-data";

type Row = Record<string, string>;

const SHEETS = ["Vehicles", "Transactions", "Monthly Summary", "Expenses"];

const aliases: Record<string, string[]> = {
  id: ["vehicle_id", "vehicle id", "id", "vin", "stock", "stock number"],
  name: ["vehicle", "vehicle name", "name", "model", "year make model", "fleet make/model", "fleet make model"],
  plate: ["plate", "license plate", "tag"],
  status: ["status", "vehicle status"],
  purchasePrice: ["purchase price", "purchase_price", "cost", "vehicle cost", "auction cost"],
  repairs: ["repairs", "repair cost", "reconditioning", "reconditioning cost", "recon cost"],
  dmvFees: ["dmv fees", "dmv", "registration", "registration fees"],
  dealerFees: ["dealer fees", "dealer fee"],
  auctionFees: ["auction fees", "auction fee"],
  otherAcquisitionCosts: ["other acquisition costs", "other costs", "transport", "shipping", "hunt fees", "prep costs"],
  currentEstimatedValue: ["current estimated value", "current value", "estimated value", "market value"],
  depreciationEstimate: ["depreciation estimate", "depreciation", "estimated depreciation"],
  cashReturned: ["cash returned", "returned to investor", "investor distributions", "distributions"],
  date: ["date", "month", "period"],
  type: ["type", "transaction type"],
  category: ["category", "expense category"],
  amount: ["amount", "value", "total"],
  revenue: ["revenue", "monthly revenue", "income"],
  expenses: ["expenses", "monthly expenses", "expense"],
  netProfit: ["net profit", "profit"]
};

export async function getDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  if (process.env.USE_MOCK_DATA === "true") return applyFilters(mockDashboardData, filters);

  const url = process.env.GOOGLE_SHEET_URL;
  if (!url) {
    return {
      ...applyFilters(mockDashboardData, filters),
      source: "mock",
      warnings: ["GOOGLE_SHEET_URL is missing. Showing built-in sample data."]
    };
  }

  try {
    const spreadsheetId = getSpreadsheetId(url);
    const tables = await fetchWorkbook(spreadsheetId);
    const data = buildDashboard(tables, filters);
    return applyFilters(data, filters);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Sheets error.";
    return {
      ...applyFilters(mockDashboardData, filters),
      source: "mock",
      warnings: [`Live sheet could not be loaded: ${message}`, "Showing built-in sample data instead."]
    };
  }
}

function getSpreadsheetId(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match?.[1]) throw new Error("The Google Sheet URL does not look valid.");
  return match[1];
}

async function fetchWorkbook(spreadsheetId: string) {
  const entries = await Promise.all(
    SHEETS.map(async (sheetName) => {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetch(csvUrl, { next: { revalidate: 60 } });
      if (!response.ok) return [sheetName, []] as const;
      const text = await response.text();
      if (text.includes("<!DOCTYPE html") || text.includes("Google Sheets")) return [sheetName, []] as const;
      return [sheetName, csvToRows(text)] as const;
    })
  );

  const workbook = Object.fromEntries(entries) as Record<string, Row[]>;
  for (const sheetName of SHEETS.filter((name) => name !== "Vehicles")) {
    if (looksLikeVehicleSheet(workbook[sheetName])) workbook[sheetName] = [];
  }
  if (!Object.values(workbook).some((rows) => rows.length > 0)) {
    throw new Error("No readable tabs were found. Confirm the sheet is public/view-only or published.");
  }
  return workbook;
}

function buildDashboard(workbook: Record<string, Row[]>, filters: DashboardFilters): DashboardData {
  const vehicleRows = (workbook.Vehicles || []).filter(isVehicleRow);
  const transactionRows = filterRowsByDate(workbook.Transactions || [], filters);
  const monthlyRows = filterRowsByDate(workbook["Monthly Summary"] || [], filters);
  const expenseRows = filterRowsByDate(workbook.Expenses || [], filters);
  const warnings: string[] = [];

  if (vehicleRows.length === 0) warnings.push("Vehicles tab is empty or missing.");

  const vehicles = vehicleRows.map((row, index): VehiclePerformance => {
    const id = text(row, "id") || slug(text(row, "name")) || `vehicle-${index + 1}`;
    const name = text(row, "name") || id;
    const plate = text(row, "plate");
    const relatedTransactions = transactionRows.filter((item) => sameVehicle(item, id, name));
    const relatedMonthly = monthlyRows.filter((item) => sameVehicle(item, id, name));
    const relatedExpenses = expenseRows.filter((item) => sameVehicle(item, id, name));

    const revenue = sum(relatedTransactions.filter((item) => isRevenue(item)).map((item) => money(item, "amount")));
    const transactionExpenses = sum(relatedTransactions.filter((item) => isExpense(item)).map((item) => money(item, "amount")));
    const tabExpenses = sum(relatedExpenses.map((item) => money(item, "amount")));
    const monthlyRevenue = sum(relatedMonthly.map((item) => money(item, "revenue")));
    const monthlyExpenses = sum(relatedMonthly.map((item) => money(item, "expenses")));
    const monthlyNetProfit = sum(relatedMonthly.map((item) => money(item, "netProfit")));

    const purchasePrice = money(row, "purchasePrice");
    const repairs = money(row, "repairs");
    const dmvFees = money(row, "dmvFees");
    const dealerFees = money(row, "dealerFees");
    const auctionFees = money(row, "auctionFees");
    const otherAcquisitionCosts = moneyAll(row, "otherAcquisitionCosts");
    const totalAllInCost = purchasePrice + repairs + dmvFees + dealerFees + auctionFees + otherAcquisitionCosts;
    const monthlyBreakdowns = withMonthlyRoi(filterMonthlyBreakdowns(monthlyPerformanceByVin[id] || [], filters), totalAllInCost);
    const workbookRevenue = sum(monthlyBreakdowns.map((month) => month.revenue));
    const workbookExpenses = sum(monthlyBreakdowns.map((month) => month.expenses));
    const workbookNetProfit = sum(monthlyBreakdowns.map((month) => month.netProfit));
    const calculatedRevenue = revenue + monthlyRevenue + workbookRevenue;
    const calculatedExpenses = transactionExpenses + tabExpenses + monthlyExpenses + workbookExpenses;
    const netProfit = monthlyNetProfit || workbookNetProfit || calculatedRevenue - calculatedExpenses;
    const cashReturned =
      money(row, "cashReturned") +
      sum(relatedTransactions.filter(isCashReturned).map((item) => money(item, "amount"))) +
      (totalLossPaymentsByVin[id] || 0);
    const depreciationEstimate = money(row, "depreciationEstimate");
    const isTotalLoss = Boolean(totalLossPaymentsByVin[id]);
    const reportingStatus = vehicleReportingStatus(id, name, isTotalLoss ? "total_loss" : normalizeStatus(text(row, "status")));
    const averageMonthlyNetProfit = average(monthlyBreakdowns.map((month) => month.netProfit));
    const averageMonthlyRoi = totalAllInCost ? averageMonthlyNetProfit / totalAllInCost : 0;
    const recoveredCapital = Math.max(cashReturned, netProfit);
    const remainingCapital = Math.max(totalAllInCost - recoveredCapital, 0);
    const paybackRemainingMonths = remainingCapital === 0 ? 0 : averageMonthlyNetProfit > 0 ? remainingCapital / averageMonthlyNetProfit : null;

    return {
      id,
      name,
      vin: id,
      plate,
      status: reportingStatus,
      purchasePrice,
      repairs,
      dmvFees,
      dealerFees,
      auctionFees,
      otherAcquisitionCosts,
      totalAllInCost,
      monthlyRevenue: calculatedRevenue,
      monthlyExpenses: calculatedExpenses,
      netProfit,
      roi: totalAllInCost ? netProfit / totalAllInCost : 0,
      paybackProgress: totalAllInCost ? Math.max(cashReturned, netProfit) / totalAllInCost : 0,
      cashReturned,
      currentEstimatedValue: money(row, "currentEstimatedValue"),
      depreciationEstimate,
      profitAfterDepreciation: netProfit - depreciationEstimate,
      averageMonthlyRoi,
      paybackRemainingMonths,
      monthlyBreakdowns,
      depreciation: findVehicleDepreciation(name),
      note: vehicleNote(id, name, isTotalLoss)
    };
  });

  const trends = buildTrends(monthlyRows, transactionRows, expenseRows, vehicles);
  const overview = combineVehicles(vehicles);

  return {
    generatedAt: new Date().toISOString(),
    source: "google-sheet",
    overview,
    vehicles,
    trends,
    depreciation: portfolioDepreciation,
    warnings
  };
}

function buildTrends(monthlyRows: Row[], transactionRows: Row[], expenseRows: Row[], vehicles: VehiclePerformance[]): TrendPoint[] {
  const monthMap = new Map<string, TrendPoint>();
  const ensure = (month: string) => {
    const key = month || "Un dated";
    if (!monthMap.has(key)) monthMap.set(key, { month: key, revenue: 0, expenses: 0, netProfit: 0 });
    return monthMap.get(key)!;
  };

  for (const row of monthlyRows) {
    const point = ensure(monthLabel(text(row, "date")));
    point.revenue += money(row, "revenue");
    point.expenses += money(row, "expenses");
    point.netProfit += money(row, "netProfit") || money(row, "revenue") - money(row, "expenses");
  }

  for (const row of transactionRows) {
    const point = ensure(monthLabel(text(row, "date")));
    if (isRevenue(row)) point.revenue += money(row, "amount");
    if (isExpense(row)) point.expenses += money(row, "amount");
    point.netProfit = point.revenue - point.expenses;
  }

  for (const row of expenseRows) {
    const point = ensure(monthLabel(text(row, "date")));
    point.expenses += money(row, "amount");
    point.netProfit = point.revenue - point.expenses;
  }

  for (const vehicle of vehicles) {
    for (const month of vehicle.monthlyBreakdowns) {
      const point = ensure(month.month);
      point.revenue += month.revenue;
      point.expenses += month.expenses;
      point.netProfit += month.netProfit;
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => monthSortValue(a.month) - monthSortValue(b.month)).slice(-12);
}

function applyFilters(data: DashboardData, filters: DashboardFilters): DashboardData {
  let vehicles = data.vehicles;
  if (filters.vehicleId && filters.vehicleId !== "all") vehicles = vehicles.filter((vehicle) => vehicle.id === filters.vehicleId);
  if (filters.status && filters.status !== "all") vehicles = vehicles.filter((vehicle) => vehicle.status === filters.status);

  return {
    ...data,
    overview: combineVehicles(vehicles),
    vehicles
  };
}

function filterRowsByDate(rows: Row[], filters: DashboardFilters) {
  if (!filters.from && !filters.to) return rows;
  const from = filters.from ? new Date(`${filters.from}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to ? new Date(`${filters.to}T23:59:59Z`).getTime() : Number.POSITIVE_INFINITY;

  return rows.filter((row) => {
    const value = text(row, "date");
    if (!value) return true;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return true;
    return time >= from && time <= to;
  });
}

function filterMonthlyBreakdowns(months: VehiclePerformance["monthlyBreakdowns"], filters: DashboardFilters) {
  const completeMonths = months.filter((month) => !(normalize(month.month).startsWith("jul") && month.revenue <= 0));
  if (!filters.from && !filters.to) return completeMonths;
  const from = filters.from ? new Date(`${filters.from}T00:00:00Z`).getTime() : Number.NEGATIVE_INFINITY;
  const to = filters.to ? new Date(`${filters.to}T23:59:59Z`).getTime() : Number.POSITIVE_INFINITY;

  return completeMonths.filter((month) => {
    const time = monthSortValue(month.month);
    if (!time) return true;
    return time >= from && time <= to;
  });
}

function combineVehicles(vehicles: VehiclePerformance[]): VehiclePerformance {
  const includedVehicles = vehicles.filter(includeInPortfolioTotals);
  const performanceVehicles = includedVehicles.filter(includeInPerformanceCalculations);
  const performanceCost = sum(performanceVehicles.map((vehicle) => vehicle.totalAllInCost));
  const performanceProfit = sum(performanceVehicles.map((vehicle) => vehicle.netProfit));
  const performanceCashReturned = sum(performanceVehicles.map((vehicle) => vehicle.cashReturned));
  const performanceMonthlyBreakdowns = mergeMonthlyBreakdowns(performanceVehicles);
  const totals = {
    purchasePrice: sum(includedVehicles.map((vehicle) => vehicle.purchasePrice)),
    repairs: sum(includedVehicles.map((vehicle) => vehicle.repairs)),
    dmvFees: sum(includedVehicles.map((vehicle) => vehicle.dmvFees)),
    dealerFees: sum(includedVehicles.map((vehicle) => vehicle.dealerFees)),
    auctionFees: sum(includedVehicles.map((vehicle) => vehicle.auctionFees)),
    otherAcquisitionCosts: sum(includedVehicles.map((vehicle) => vehicle.otherAcquisitionCosts)),
    totalAllInCost: sum(includedVehicles.map((vehicle) => vehicle.totalAllInCost)),
    monthlyRevenue: sum(includedVehicles.map((vehicle) => vehicle.monthlyRevenue)),
    monthlyExpenses: sum(includedVehicles.map((vehicle) => vehicle.monthlyExpenses)),
    netProfit: sum(includedVehicles.map((vehicle) => vehicle.netProfit)),
    cashReturned: sum(includedVehicles.map((vehicle) => vehicle.cashReturned)),
    currentEstimatedValue: sum(includedVehicles.map((vehicle) => vehicle.currentEstimatedValue)),
    depreciationEstimate: sum(includedVehicles.map((vehicle) => vehicle.depreciationEstimate)),
    monthlyBreakdowns: mergeMonthlyBreakdowns(includedVehicles)
  };
  const averageMonthlyNetProfit = average(performanceMonthlyBreakdowns.map((month) => month.netProfit));
  const averageMonthlyRoi = average(performanceVehicles.map((vehicle) => vehicle.averageMonthlyRoi));
  const recoveredCapital = Math.max(performanceCashReturned, performanceProfit);
  const remainingCapital = Math.max(performanceCost - recoveredCapital, 0);

  return {
    id: "all",
    name: "General Overview",
    vin: "",
    plate: "",
    status: "active",
    ...totals,
    roi: performanceCost ? performanceProfit / performanceCost : 0,
    paybackProgress: performanceCost ? Math.max(performanceCashReturned, performanceProfit) / performanceCost : 0,
    profitAfterDepreciation: totals.netProfit - totals.depreciationEstimate,
    averageMonthlyRoi,
    paybackRemainingMonths: remainingCapital === 0 ? 0 : averageMonthlyNetProfit > 0 ? remainingCapital / averageMonthlyNetProfit : null,
    monthlyBreakdowns: totals.monthlyBreakdowns
  };
}

function mergeMonthlyBreakdowns(vehicles: VehiclePerformance[]) {
  const months = new Map<string, VehiclePerformance["monthlyBreakdowns"][number]>();
  for (const vehicle of vehicles) {
    for (const breakdown of vehicle.monthlyBreakdowns) {
      if (!months.has(breakdown.month)) months.set(breakdown.month, { month: breakdown.month, revenue: 0, expenses: 0, netProfit: 0, items: [] });
      const month = months.get(breakdown.month)!;
      month.revenue += breakdown.revenue;
      month.expenses += breakdown.expenses;
      month.netProfit += breakdown.netProfit;
      month.monthlyRoi = 0;
    }
  }
  return Array.from(months.values()).sort((a, b) => monthSortValue(a.month) - monthSortValue(b.month));
}

function withMonthlyRoi(months: VehiclePerformance["monthlyBreakdowns"], totalAllInCost: number) {
  return months.map((month) => ({
    ...month,
    monthlyRoi: totalAllInCost ? month.netProfit / totalAllInCost : 0
  }));
}

function csvToRows(csv: string): Row[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  rows.push(row);

  const headers = (rows.shift() || []).map(normalize);
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || ""])));
}

function sameVehicle(row: Row, id: string, name: string) {
  const value = text(row, "id") || text(row, "name");
  return normalize(value) === normalize(id) || normalize(value) === normalize(name);
}

function isVehicleRow(row: Row) {
  const name = text(row, "name");
  const id = text(row, "id");
  if (!name && !id) return false;
  if (normalize(name).startsWith("totais") || normalize(name).startsWith("totals")) return false;
  return true;
}

function text(row: Row, key: keyof typeof aliases) {
  for (const alias of aliases[key]) {
    const value = row[normalize(alias)];
    if (value) return value.trim();
  }
  return "";
}

function money(row: Row, key: keyof typeof aliases) {
  return parseNumber(text(row, key));
}

function moneyAll(row: Row, key: keyof typeof aliases) {
  const values = new Set<string>();
  for (const alias of aliases[key]) {
    const value = row[normalize(alias)];
    if (value) values.add(value);
  }
  return sum(Array.from(values).map(parseNumber));
}

function parseNumber(value: string) {
  let cleaned = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  const isNegative = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed * (isNegative ? -1 : 1) : 0;
}

function normalize(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[_-]/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, "-");
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? sum(usable) / usable.length : 0;
}

function normalizeStatus(value: string): VehicleStatus {
  const status = normalize(value);
  if (!status) return "active";
  if (["active", "sold", "repair", "pending", "inactive", "total loss", "total_loss", "returned"].includes(status)) {
    return status.replace(" ", "_") as VehicleStatus;
  }
  return "other";
}

function vehicleReportingStatus(id: string, name: string, baseStatus: VehicleStatus): VehicleStatus {
  const normalizedName = normalize(name);
  if (id === "5FNRL5H91EB057380" || normalizedName.includes("honda odissey") || normalizedName.includes("honda odyssey")) {
    return "inactive";
  }
  if (normalizedName.includes("compass trailhawk")) return "inactive";
  if (id === "JM3TCACY0G0105098" || normalizedName.includes("mazda cx09") || normalizedName.includes("mazda cx9")) return "active";
  return baseStatus;
}

function vehicleNote(id: string, name: string, isTotalLoss: boolean) {
  const normalizedName = normalize(name);
  if (isTotalLoss) return `Total loss. Investor was paid back ${formatCurrency(totalLossPaymentsByVin[id])}.`;
  if (id === "5FNRL5H91EB057380" || normalizedName.includes("honda odissey") || normalizedName.includes("honda odyssey")) {
    return "Inactive. This vehicle has not hit the road, so it is excluded from portfolio totals and return estimates.";
  }
  if (normalizedName.includes("compass trailhawk")) {
    return "Inactive. This vehicle has not hit the road, so it is excluded from portfolio totals and return estimates.";
  }
  if (id === "JM3TCACY0G0105098" || normalizedName.includes("mazda cx09") || normalizedName.includes("mazda cx9")) {
    return "Active. July is not closed yet, so ROI is marked TBD until monthly results are available.";
  }
  return undefined;
}

function includeInPortfolioTotals(vehicle: VehiclePerformance) {
  return vehicle.status !== "inactive";
}

function includeInPerformanceCalculations(vehicle: VehiclePerformance) {
  return vehicle.status !== "inactive" && vehicle.status !== "total_loss" && !isTbdRoiVehicle(vehicle);
}

function isTbdRoiVehicle(vehicle: VehiclePerformance) {
  const normalizedName = normalize(vehicle.name);
  return vehicle.id === "JM3TCACY0G0105098" || normalizedName.includes("mazda cx09") || normalizedName.includes("mazda cx9");
}

function monthSortValue(month: string) {
  const parsed = new Date(`1 ${month}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function looksLikeVehicleSheet(rows: Row[] = []) {
  if (rows.length === 0) return false;
  const sample = rows[0];
  const hasVehicleIdentity = Boolean(sample[normalize("fleet make/model")] || sample[normalize("vin")]);
  const hasTransactionColumns = Boolean(sample[normalize("amount")] || sample[normalize("type")] || sample[normalize("revenue")]);
  return hasVehicleIdentity && !hasTransactionColumns;
}

function isRevenue(row: Row) {
  const type = normalize(text(row, "type") || text(row, "category"));
  return type.includes("revenue") || type.includes("income") || type.includes("rental");
}

function isExpense(row: Row) {
  const type = normalize(text(row, "type") || text(row, "category"));
  return type.includes("expense") || type.includes("repair") || type.includes("fee") || type.includes("cost");
}

function isCashReturned(row: Row) {
  const type = normalize(text(row, "type") || text(row, "category"));
  return type.includes("cash returned") || type.includes("distribution") || type.includes("investor return");
}

function monthLabel(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
