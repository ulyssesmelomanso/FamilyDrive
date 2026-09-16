"use client";

import {
  AlertTriangle,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { DashboardData, PortfolioDepreciation, VehicleDepreciation, VehiclePerformance } from "@/lib/types";

type VehicleSortOption = "order" | "name" | "status" | "cost" | "profit" | "roi";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [vehicleId, setVehicleId] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (vehicleId !== "all") params.set("vehicleId", vehicleId);
    if (status !== "all") params.set("status", status);

    try {
      const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Dashboard data could not be loaded.");
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 60_000);
    return () => window.clearInterval(timer);
  }, [vehicleId, status]);

  const allVehicles = data?.vehicles ?? [];
  const overview = data?.overview;
  const chartData = useMemo(() => {
    const trendData =
      data?.trends.length || !overview
        ? data?.trends ?? []
        : [{ month: "Current", revenue: overview.monthlyRevenue, expenses: overview.monthlyExpenses, netProfit: overview.netProfit }];

    return trendData.map((point) => {
      const roiValues = allVehicles
        .filter((vehicle) => vehicle.status === "active")
        .flatMap((vehicle) => vehicle.monthlyBreakdowns.filter((month) => month.month === point.month).map((month) => month.monthlyRoi ?? 0))
        .filter((value) => Number.isFinite(value));

      return {
        ...point,
        averageMonthlyRoi: roiValues.length ? roiValues.reduce((total, value) => total + value, 0) / roiValues.length : null
      };
    });
  }, [allVehicles, data?.trends, overview]);
  const statusOptions = useMemo(
    () => Array.from(new Set((data?.vehicles ?? []).map((vehicle) => vehicle.status))).filter(Boolean),
    [data?.vehicles]
  );
  const activeVehicleCount = allVehicles.filter((vehicle) => vehicle.status === "active").length;
  const detailVehicles = useMemo(() => {
    if (vehicleId === "all" && status === "all") {
      return allVehicles.filter((vehicle) => vehicle.status === "active");
    }
    return allVehicles;
  }, [allVehicles, status, vehicleId]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-20 top-0 h-36 w-80 rounded-bl-full rounded-tl-full bg-[#83e2df]" />
      <div className="pointer-events-none absolute -left-28 top-96 h-28 w-80 rounded-br-full rounded-tr-full bg-[#32c1df]" />
      <div className="pointer-events-none absolute -bottom-20 right-10 h-36 w-80 rounded-t-full bg-[#32c1df]" />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-black/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <img src="/familydrive-logo.svg" alt="FamilyDrive" className="mb-4 h-12 w-auto" />
            <h1 className="text-4xl font-black tracking-normal text-[#555] sm:text-6xl">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-xl leading-7 text-[#5c5c5c]">
              A clear view of invested capital, operating performance, recovery progress, and vehicle-level returns.
            </p>
          </div>
          <button
            onClick={loadDashboard}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-ink shadow-sm transition hover:border-marina"
            title="Refresh data"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="mt-8 grid gap-3 rounded-lg bg-[#f8f2ff] p-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Vehicle
            <select
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-marina"
            >
              <option value="all">All vehicles</option>
              {(data?.vehicles ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </label>
        <label className="text-sm font-medium text-slate-700">
          Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-marina"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error ? <Notice tone="error" text={error} /> : null}
        {data?.warnings.map((warning) => <Notice key={warning} tone="warning" text={warning} />)}

        {loading && !overview ? (
          <div className="mt-8 rounded-lg border border-black/10 bg-white p-8 text-center text-slate-600 shadow-sm">
            Loading investor dashboard...
          </div>
        ) : null}

        {overview ? (
          <>
            <section className="mt-6 grid gap-3 md:grid-cols-2">
              <SummaryCard label="Average monthly ROI" value={percent.format(overview.averageMonthlyRoi)} />
              <SummaryCard label="Active vehicles" value={String(activeVehicleCount)} />
            </section>

            <section className="mt-6">
              <Panel title="Revenue vs Net Profit Chart" icon={<CalendarDays size={17} />}>
                <div className="h-[22rem]">
                  <ResponsiveContainer>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="money" tickFormatter={(value) => `$${Number(value) / 1000}k`} width={54} />
                      <YAxis yAxisId="roi" orientation="right" tickFormatter={(value) => percent.format(Number(value))} width={54} />
                      <Tooltip formatter={(value, name) => name === "Average Monthly ROI" ? percent.format(Number(value)) : currency.format(Number(value))} />
                      <Legend />
                      <Bar yAxisId="money" dataKey="revenue" fill="#0797a8" radius={[10, 10, 0, 0]} name="Revenue" />
                      <Bar yAxisId="money" dataKey="netProfit" fill="#83e2df" radius={[10, 10, 0, 0]} name="Net Profit" />
                      <Line
                        yAxisId="roi"
                        type="monotone"
                        dataKey="averageMonthlyRoi"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#ffffff", stroke: "#22c55e", strokeWidth: 2 }}
                        connectNulls
                        name="Average Monthly ROI"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </section>

            {data.depreciation ? (
              <section className="mt-6">
                <DepreciationOverview depreciation={data.depreciation} />
              </section>
            ) : null}

            <section className="mt-6">
              <Panel title="Vehicle Table" icon={<Car size={17} />}>
                <ComparisonTable vehicles={allVehicles} />
              </Panel>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Car size={16} />
                Vehicle Details
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {detailVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function DepreciationOverview({ depreciation }: { depreciation: PortfolioDepreciation }) {
  return (
    <Panel title="3-Year Depreciation Cushion" icon={<Car size={17} />}>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Purchase cost" value={currency.format(depreciation.totalPurchaseCost)} />
            <SummaryTile label="Retail value today" value={currency.format(depreciation.estimatedRetailToday)} />
            <SummaryTile label="Current cushion" value={currency.format(depreciation.currentEquityCushion)} tone="good" />
            <SummaryTile label="Projected 3-year cushion" value={currency.format(depreciation.equityAfter3Years)} tone="good" />
          </div>
          <div className="mt-4 rounded-md border border-[#d5f3f0] bg-[#f5fffd] px-4 py-3 text-sm leading-6 text-[#476066]">
            The active fleet was purchased below estimated retail value, creating a cushion that helps absorb the expected depreciation curve over the next three years.
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-64 rounded-md border border-slate-100 bg-white p-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-500">Portfolio value curve</p>
            <ResponsiveContainer>
              <LineChart data={depreciation.curve} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} width={48} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => currency.format(Number(value))} />
                <Line type="monotone" dataKey="projectedValue" stroke="#27556c" strokeWidth={3} dot={{ r: 4, fill: "#83e2df", stroke: "#27556c", strokeWidth: 2 }} name="Projected retail value" />
                <Line type="monotone" dataKey="purchaseCost" stroke="#6e8b7b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Purchase cost" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64 rounded-md border border-slate-100 bg-white p-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-500">Equity after 3 years</p>
            <ResponsiveContainer>
              <BarChart data={depreciation.vehicleEquity} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `$${Number(value) / 1000}k`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="vehicle" type="category" width={92} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => currency.format(Number(value))} />
                <Bar dataKey="equityAfter3Years" radius={[0, 8, 8, 0]} name="3-year cushion">
                  {depreciation.vehicleEquity.map((item) => (
                    <Cell key={item.vehicle} fill={item.equityAfter3Years >= 0 ? "#83e2df" : "#27556c"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SummaryTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" }) {
  return (
    <div className={`rounded-md px-4 py-3 ${tone === "good" ? "bg-[#e8f8ed]" : "bg-[#f8f2ff]"}`}>
      <p className="text-xs font-bold uppercase text-[#5c5c5c]">{label}</p>
      <p className="mt-1 text-xl font-black text-[#333]">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_18px_45px_rgba(85,85,85,0.08)] ring-1 ring-[#f0eafa]">
      <div className="mb-5 flex items-center gap-2 text-xl font-black text-[#555]">
        <span className="text-[#08a0b4]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f8f2ff] px-4 py-3">
      <p className="text-xs font-bold uppercase text-[#5c5c5c]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#555]">{value}</p>
    </div>
  );
}

function ComparisonTable({ vehicles }: { vehicles: VehiclePerformance[] }) {
  const [sortBy, setSortBy] = useState<VehicleSortOption>("order");
  const sortedVehicles = useMemo(() => sortVehicles(vehicles, sortBy), [vehicles, sortBy]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#333]">Vehicle Summary</p>
          <p className="text-xs text-slate-500">Default order follows the numbered master spreadsheet.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Sort by
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as VehicleSortOption)}
            className="mt-2 h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-marina"
          >
            <option value="order">Vehicle order</option>
            <option value="name">Vehicle name</option>
            <option value="status">Status</option>
            <option value="cost">All-in cost</option>
            <option value="profit">Net profit</option>
            <option value="roi">Average monthly ROI</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-xs uppercase text-[#5c5c5c]">
            <tr>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">All-in cost</th>
              <th className="px-4 py-2">Revenue</th>
              <th className="px-4 py-2">Expenses</th>
              <th className="px-4 py-2">Net profit</th>
              <th className="px-4 py-2">Avg monthly ROI</th>
            </tr>
          </thead>
          <tbody>
            {sortedVehicles.map((vehicle) => (
              <tr key={vehicle.id} className="bg-[#f8f2ff]">
                <td className="rounded-l-lg px-4 py-4 font-bold text-[#333]">
                  <span className="mr-2 inline-flex min-w-8 justify-center rounded-md bg-white px-2 py-1 text-xs font-black text-[#0797a8]">
                    {formatVehicleOrder(vehicle)}
                  </span>
                  {formatVehicleName(vehicle)}
                </td>
                <td className="px-4 py-4"><StatusBadge status={vehicle.status} /></td>
                <td className="px-4 py-4">{currency.format(vehicle.totalAllInCost)}</td>
                <td className="px-4 py-4">{currency.format(vehicle.monthlyRevenue)}</td>
                <td className="px-4 py-4">{currency.format(vehicle.monthlyExpenses)}</td>
                <td className="px-4 py-4 font-bold">{currency.format(vehicle.netProfit)}</td>
                <td className="rounded-r-lg px-4 py-4 font-bold text-[#08a0b4]">{formatVehicleMonthlyRoi(vehicle)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: VehiclePerformance }) {
  return (
    <article className={`rounded-lg bg-white p-5 shadow-[0_18px_45px_rgba(85,85,85,0.08)] ring-1 ${vehicle.status === "total_loss" ? "ring-[#33c4e4]" : "ring-[#f0eafa]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#333]">{vehicle.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>VIN {vehicle.vin || "N/A"}</span>
            <span>Plate {vehicle.plate || "N/A"}</span>
          </div>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricRow label="Purchase price" value={currency.format(vehicle.purchasePrice)} />
        <MetricRow label="Repairs / reconditioning" value={currency.format(vehicle.repairs)} />
        <MetricRow label="DMV / dealer / auction fees" value={currency.format(vehicle.dmvFees + vehicle.dealerFees + vehicle.auctionFees)} />
        <MetricRow label="Total all-in cost" value={currency.format(vehicle.totalAllInCost)} />
        <MetricRow label="Net profit" value={currency.format(vehicle.netProfit)} />
        <MetricRow label="Average monthly ROI" value={formatVehicleMonthlyRoi(vehicle)} />
      </div>
      {vehicle.depreciation ? <DepreciationSnapshot depreciation={vehicle.depreciation} /> : null}
      <div className="mt-5">
        <Progress label="Capital recovered" value={vehicle.paybackProgress} />
      </div>
      {vehicle.note ? (
        <div className="mt-5 flex gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <span>{vehicle.note}</span>
        </div>
      ) : null}
      <MonthlyBreakdownTable vehicle={vehicle} />
    </article>
  );
}

function DepreciationSnapshot({ depreciation }: { depreciation: VehicleDepreciation }) {
  const cushionClass = depreciation.equityAfter3Years >= 0 ? "text-[#1f7a3a]" : "text-[#27556c]";
  const cushionTone = depreciation.equityAfter3Years >= 0 ? "green" : "blue";

  return (
    <div className="mt-5 rounded-md border border-[#bfe9e8] bg-[#f7fffd] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[#27556c]">Depreciation cushion</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
            Bought {currency.format(depreciation.equityToday)} below today's estimated retail value, helping absorb the projected depreciation curve.
          </p>
        </div>
        <span className="rounded-md bg-[#e9faf8] px-2.5 py-1 text-xs font-bold text-[#27556c] ring-1 ring-[#bfe9e8]">
          {percent.format(depreciation.annualDepreciationRate)} annual dep.
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SmallMetric label="Retail today" value={currency.format(depreciation.estimatedRetailToday)} tone="blue" />
        <SmallMetric label="Year 3 value" value={currency.format(depreciation.valueAfter3Years)} tone="aqua" />
        <SmallMetric label="Year 3 cushion" value={currency.format(depreciation.equityAfter3Years)} valueClassName={cushionClass} tone={cushionTone} />
      </div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  valueClassName = "text-[#333]",
  tone = "white"
}: {
  label: string;
  value: string;
  valueClassName?: string;
  tone?: "white" | "blue" | "aqua" | "green";
}) {
  const toneClass =
    tone === "green"
      ? "border-[#c9efd4] bg-[#e8f8ed]"
      : tone === "blue"
        ? "border-[#cfe7ef] bg-[#edf8fb]"
        : tone === "aqua"
          ? "border-[#bfe9e8] bg-[#e9faf8]"
          : "border-transparent bg-white";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase text-[#5c5c5c]">{label}</p>
      <p className={`mt-1 text-sm font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function MonthlyBreakdownTable({ vehicle }: { vehicle: VehiclePerformance }) {
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  if (!vehicle.monthlyBreakdowns.length) {
    return (
      <div className="mt-5 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">
        No monthly gain and expense tab was found for this vehicle in the workbook.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Monthly gains and costs</h3>
      <div className="space-y-3">
        {vehicle.monthlyBreakdowns.map((month) => (
          <div key={month.month} className="rounded-md border border-blue-100 bg-blue-50/40 p-4">
            <button
              type="button"
              onClick={() => setOpenMonths((current) => ({ ...current, [month.month]: !current[month.month] }))}
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 font-bold text-blue-950">
                {openMonths[month.month] ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                {month.month}
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-white px-2.5 py-1 text-blue-900">Revenue {currency.format(month.revenue)}</span>
                <span className="rounded-md bg-white px-2.5 py-1 text-copper">Costs {currency.format(month.expenses)}</span>
                <span className={`rounded-md px-2.5 py-1 ${month.netProfit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  Profit {currency.format(month.netProfit)}
                </span>
                <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-800">
                  ROI {percent.format(month.monthlyRoi ?? 0)}
                </span>
              </div>
            </button>
            {openMonths[month.month] ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {cleanMonthlyItems(month.items).map((item) => (
                  <div key={`${month.month}-${item.label}-${item.amount}`} className="flex justify-between gap-3 rounded bg-white px-3 py-2 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-medium text-ink">{currency.format(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-ink">{value}</p>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  const width = `${Math.max(0, Math.min(value, 1)) * 100}%`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-ink">{percent.format(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sage" style={{ width }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-[#d8f5df] text-[#1f7a3a]"
      : status === "sold"
        ? "bg-marina/15 text-marina"
        : status === "total_loss"
          ? "bg-[#333333] text-white"
        : status === "returned"
          ? "bg-[#ffe89a] text-[#6a5200]"
        : status === "inactive"
          ? "bg-[#555555] text-white"
        : status === "pending"
          ? "bg-[#ffe89a] text-[#6a5200]"
        : status === "repair"
          ? "bg-copper/15 text-copper"
          : "bg-slate-200 text-slate-700";

  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}>{titleCase(status)}</span>;
}

function Notice({ text, tone }: { text: string; tone: "warning" | "error" }) {
  const classes = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return <div className={`mt-4 rounded-md border px-4 py-3 text-sm ${classes}`}>{text}</div>;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortVehicles(vehicles: VehiclePerformance[], sortBy: VehicleSortOption) {
  const ordered = [...vehicles];
  const byOrder = (a: VehiclePerformance, b: VehiclePerformance) =>
    vehicleOrderNumber(a) - vehicleOrderNumber(b) ||
    a.name.localeCompare(b.name);

  if (sortBy === "order") return ordered.sort(byOrder);
  if (sortBy === "name") return ordered.sort((a, b) => a.name.localeCompare(b.name) || byOrder(a, b));
  if (sortBy === "status") return ordered.sort((a, b) => titleCase(a.status).localeCompare(titleCase(b.status)) || byOrder(a, b));
  if (sortBy === "cost") return ordered.sort((a, b) => b.totalAllInCost - a.totalAllInCost || byOrder(a, b));
  if (sortBy === "profit") return ordered.sort((a, b) => b.netProfit - a.netProfit || byOrder(a, b));
  if (sortBy === "roi") return ordered.sort((a, b) => b.averageMonthlyRoi - a.averageMonthlyRoi || byOrder(a, b));
  return ordered.sort(byOrder);
}

function formatVehicleOrder(vehicle: VehiclePerformance) {
  const order = vehicleOrderNumber(vehicle);
  return Number.isFinite(order) ? String(order).padStart(2, "0") : "--";
}

function vehicleOrderNumber(vehicle: VehiclePerformance) {
  if (vehicle.displayOrder) return vehicle.displayOrder;
  const order = vehicle.name.match(/^\s*(\d{1,2})\s*-/)?.[1];
  return order ? Number(order) : Number.MAX_SAFE_INTEGER;
}

function formatVehicleName(vehicle: VehiclePerformance) {
  return vehicle.name.replace(/^\s*\d{1,2}\s*-\s*/, "");
}

function cleanMonthlyItems(items: VehiclePerformance["monthlyBreakdowns"][number]["items"]) {
  return items.filter((item) => {
    const label = String(item.label || "").trim();
    const amount = Number(item.amount || 0);
    return !(amount === 0 && ["description", "descricao", "descrição"].includes(label.toLowerCase()));
  });
}

function formatRemainingMonths(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (value <= 0) return "Paid back";
  if (value < 1) return "<1 mo.";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} mo.`;
}

function formatVehicleMonthlyRoi(vehicle: VehiclePerformance) {
  if (vehicle.status === "inactive") return "Excluded";
  if (vehicle.status === "total_loss") return "-";
  return percent.format(vehicle.averageMonthlyRoi);
}
