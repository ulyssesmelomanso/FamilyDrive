import { DashboardData, DashboardFilters, MonthlyBreakdown, TrendPoint, VehiclePerformance } from "./types";
import { getSql, hasDatabase } from "./db";
import { findVehicleDepreciation, portfolioDepreciation } from "./depreciation-data";

type VehicleRow = {
  vehicle_key: string;
  name: string;
  display_order: string | number | null;
  vin: string | null;
  plate: string | null;
  status: string;
  purchase_price: string | number;
  repairs: string | number;
  dmv_fees: string | number;
  dealer_fees: string | number;
  auction_fees: string | number;
  other_acquisition_costs: string | number;
  current_estimated_value: string | number;
  depreciation_estimate: string | number;
  cash_returned: string | number;
  note: string | null;
};

type MonthRow = {
  vehicle_key: string;
  month_label: string;
  revenue: string | number;
  expenses: string | number;
  net_profit: string | number;
  items: unknown;
};

export async function getActiveDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  if (!hasDatabase()) return emptyDashboard("Database is not connected yet. Add DATABASE_URL in Vercel, then upload and activate a spreadsheet.");

  try {
    const sql = getSql();
    const active = await sql`select id from datasets where is_active = true order by import_date desc nulls last limit 1` as { id: string }[];
    const datasetId = active[0]?.id;
    if (!datasetId) {
      return emptyDashboard("No active dataset was found. Log in as admin, upload the latest spreadsheet, and activate it.");
    }

    const vehicleRows = await sql`
      select * from vehicles
      where dataset_id = ${datasetId}
      order by display_order asc nulls last, name asc
    ` as VehicleRow[];

    const monthRows = await sql`
      select vehicle_key, month_label, revenue, expenses, net_profit, items
      from monthly_metrics
      where dataset_id = ${datasetId}
    ` as MonthRow[];

    const vehicles = vehicleRows.map((vehicle) => buildVehicle(vehicle, monthRows.filter((month) => month.vehicle_key === vehicle.vehicle_key)));
    const filtered = applyFilters(vehicles, filters);

    return {
      generatedAt: new Date().toISOString(),
      source: "database",
      overview: combineVehicles(filtered),
      vehicles: filtered,
      trends: buildTrends(filtered),
      depreciation: portfolioDepreciation,
      warnings: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error.";
    return emptyDashboard(`Neon dashboard data could not be loaded: ${message}`);
  }
}

function emptyDashboard(warning: string): DashboardData {
  return {
    generatedAt: new Date().toISOString(),
    source: "mock",
    overview: {
      id: "all",
      name: "General Overview",
      displayOrder: 0,
      vin: "",
      plate: "",
      status: "active",
      purchasePrice: 0,
      repairs: 0,
      dmvFees: 0,
      dealerFees: 0,
      auctionFees: 0,
      otherAcquisitionCosts: 0,
      totalAllInCost: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      netProfit: 0,
      roi: 0,
      paybackProgress: 0,
      cashReturned: 0,
      currentEstimatedValue: 0,
      depreciationEstimate: 0,
      profitAfterDepreciation: 0,
      averageMonthlyRoi: 0,
      paybackRemainingMonths: null,
      monthlyBreakdowns: []
    },
    vehicles: [],
    trends: [],
    depreciation: portfolioDepreciation,
    warnings: [warning]
  };
}

function buildVehicle(row: VehicleRow, monthRows: MonthRow[]): VehiclePerformance {
  const purchasePrice = number(row.purchase_price);
  const repairs = number(row.repairs);
  const dmvFees = number(row.dmv_fees);
  const dealerFees = number(row.dealer_fees);
  const auctionFees = number(row.auction_fees);
  const otherAcquisitionCosts = number(row.other_acquisition_costs);
  const totalAllInCost = purchasePrice + repairs + dmvFees + dealerFees + auctionFees + otherAcquisitionCosts;
  const monthlyBreakdowns = monthRows.map((month): MonthlyBreakdown => {
    const revenue = number(month.revenue);
    const expenses = number(month.expenses);
    const netProfit = number(month.net_profit) || revenue - expenses;
    return {
      month: formatMonthLabel(month.month_label),
      revenue,
      expenses,
      netProfit,
      monthlyRoi: totalAllInCost ? netProfit / totalAllInCost : 0,
      items: cleanMonthlyItems(Array.isArray(month.items) ? month.items as MonthlyBreakdown["items"] : [])
    };
  }).sort((a, b) => monthSortValue(a.month) - monthSortValue(b.month));
  const monthlyRevenue = sum(monthlyBreakdowns.map((month) => month.revenue));
  const monthlyExpenses = sum(monthlyBreakdowns.map((month) => month.expenses));
  const cashReturned = number(row.cash_returned);
  const operatingNetProfit = sum(monthlyBreakdowns.map((month) => month.netProfit));
  const netProfit = row.status === "returned" && !operatingNetProfit ? cashReturned : operatingNetProfit;
  const averageMonthlyRoi = average(monthlyBreakdowns.map((month) => month.monthlyRoi ?? 0));
  const depreciationEstimate = number(row.depreciation_estimate);

  return {
    id: row.vehicle_key,
    name: row.name,
    displayOrder: number(row.display_order),
    vin: row.vin || row.vehicle_key,
    plate: row.plate || "",
    status: row.status as VehiclePerformance["status"],
    purchasePrice,
    repairs,
    dmvFees,
    dealerFees,
    auctionFees,
    otherAcquisitionCosts,
    totalAllInCost,
    monthlyRevenue,
    monthlyExpenses,
    netProfit,
    roi: totalAllInCost ? netProfit / totalAllInCost : 0,
    paybackProgress: totalAllInCost ? Math.max(cashReturned, netProfit) / totalAllInCost : 0,
    cashReturned,
    currentEstimatedValue: number(row.current_estimated_value),
    depreciationEstimate,
    profitAfterDepreciation: netProfit - depreciationEstimate,
    averageMonthlyRoi,
    paybackRemainingMonths: null,
    monthlyBreakdowns,
    depreciation: findVehicleDepreciation(row.name),
    note: row.note || undefined
  };
}

function applyFilters(vehicles: VehiclePerformance[], filters: DashboardFilters) {
  return vehicles.filter((vehicle) => {
    if (filters.vehicleId && filters.vehicleId !== "all" && vehicle.id !== filters.vehicleId) return false;
    if (filters.status && filters.status !== "all" && vehicle.status !== filters.status) return false;
    return true;
  });
}

function combineVehicles(vehicles: VehiclePerformance[]): VehiclePerformance {
  const included = vehicles.filter((vehicle) => vehicle.status !== "inactive");
  const performance = vehicles.filter((vehicle) => vehicle.status === "active" && vehicle.monthlyBreakdowns.length > 0);
  const totalAllInCost = sum(included.map((vehicle) => vehicle.totalAllInCost));
  const netProfit = sum(included.map((vehicle) => vehicle.netProfit));

  return {
    id: "all",
    name: "General Overview",
    displayOrder: 0,
    vin: "",
    plate: "",
    status: "active",
    purchasePrice: sum(included.map((vehicle) => vehicle.purchasePrice)),
    repairs: sum(included.map((vehicle) => vehicle.repairs)),
    dmvFees: sum(included.map((vehicle) => vehicle.dmvFees)),
    dealerFees: sum(included.map((vehicle) => vehicle.dealerFees)),
    auctionFees: sum(included.map((vehicle) => vehicle.auctionFees)),
    otherAcquisitionCosts: sum(included.map((vehicle) => vehicle.otherAcquisitionCosts)),
    totalAllInCost,
    monthlyRevenue: sum(included.map((vehicle) => vehicle.monthlyRevenue)),
    monthlyExpenses: sum(included.map((vehicle) => vehicle.monthlyExpenses)),
    netProfit,
    roi: totalAllInCost ? netProfit / totalAllInCost : 0,
    paybackProgress: totalAllInCost ? netProfit / totalAllInCost : 0,
    cashReturned: sum(included.map((vehicle) => vehicle.cashReturned)),
    currentEstimatedValue: sum(included.map((vehicle) => vehicle.currentEstimatedValue)),
    depreciationEstimate: sum(included.map((vehicle) => vehicle.depreciationEstimate)),
    profitAfterDepreciation: netProfit - sum(included.map((vehicle) => vehicle.depreciationEstimate)),
    averageMonthlyRoi: average(performance.map((vehicle) => vehicle.averageMonthlyRoi)),
    paybackRemainingMonths: null,
    monthlyBreakdowns: []
  };
}

function buildTrends(vehicles: VehiclePerformance[]): TrendPoint[] {
  const months = new Map<string, TrendPoint>();
  for (const vehicle of vehicles) {
    for (const breakdown of vehicle.monthlyBreakdowns) {
      if (!months.has(breakdown.month)) months.set(breakdown.month, { month: breakdown.month, revenue: 0, expenses: 0, netProfit: 0 });
      const month = months.get(breakdown.month)!;
      month.revenue += breakdown.revenue;
      month.expenses += breakdown.expenses;
      month.netProfit += breakdown.netProfit;
    }
  }
  return Array.from(months.values()).sort((a, b) => monthSortValue(a.month) - monthSortValue(b.month));
}

function number(value: string | number | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? sum(usable) / usable.length : 0;
}

function cleanMonthlyItems(items: MonthlyBreakdown["items"]) {
  return items.filter((item) => {
    const label = String(item.label || "").trim();
    const amount = number(item.amount);
    if (!amount && ["description", "descrição", "descricao"].includes(normalize(label))) return false;
    return Boolean(label || amount);
  });
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function formatMonthLabel(value: string) {
  const parsed = parseMonth(value);
  if (!parsed) return value;
  const labels = ["Jan", "Fev", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${labels[parsed.month]} ${parsed.year}`;
}

function monthSortValue(value: string) {
  const parsed = parseMonth(value);
  return parsed ? parsed.year * 12 + parsed.month : Number.MAX_SAFE_INTEGER;
}

function parseMonth(value: string) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\./g, "");
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;

  const numericMonthMatch = normalized.match(/\b(1[0-2]|0?[1-9])\s*[/-]\s*20\d{2}\b/);
  if (numericMonthMatch) return { month: Number(numericMonthMatch[1]) - 1, year: Number(yearMatch[1]) };

  const monthNames: Array<[RegExp, number]> = [
    [/jan|january|janeiro/, 0],
    [/fev|feb|february|fevereiro/, 1],
    [/mar|march|marco|março/, 2],
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
  if (month === undefined) return null;

  return { month, year: Number(yearMatch[1]) };
}
