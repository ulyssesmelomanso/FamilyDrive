import { PortfolioDepreciation, VehicleDepreciation } from "./types";

type DepreciationRow = VehicleDepreciation & {
  vehicle: string;
  aliases: string[];
};

const depreciationRows: DepreciationRow[] = [
  {
    vehicle: "Chevrolet Equinox Premier 2018",
    aliases: ["equinox"],
    miles: 110000,
    depreciationPurchasePrice: 8595,
    estimatedRetailToday: 11500,
    annualDepreciationRate: 0.075,
    valueAfter1Year: 10637.5,
    valueAfter2Years: 9839.6875,
    valueAfter3Years: 9101.7109375,
    equityToday: 2905,
    equityAfter1Year: 2042.5,
    equityAfter2Years: 1244.6875,
    equityAfter3Years: 506.7109375,
    note: "Mileage provided by owner"
  },
  {
    vehicle: "Chrysler Voyager 2021",
    aliases: ["voyager"],
    miles: 130000,
    depreciationPurchasePrice: 11050,
    estimatedRetailToday: 14500,
    annualDepreciationRate: 0.1,
    valueAfter1Year: 13050,
    valueAfter2Years: 11745,
    valueAfter3Years: 10570.5,
    equityToday: 3450,
    equityAfter1Year: 2000,
    equityAfter2Years: 695,
    equityAfter3Years: -479.5
  },
  {
    vehicle: "Mitsubishi Outlander 2020",
    aliases: ["outlander"],
    miles: 105000,
    depreciationPurchasePrice: 9155,
    estimatedRetailToday: 12800,
    annualDepreciationRate: 0.085,
    valueAfter1Year: 11712,
    valueAfter2Years: 10716.48,
    valueAfter3Years: 9805.5792,
    equityToday: 3645,
    equityAfter1Year: 2557,
    equityAfter2Years: 1561.48,
    equityAfter3Years: 650.5792
  },
  {
    vehicle: "Jeep Grand Cherokee 2019",
    aliases: ["grand cherokee"],
    miles: 110000,
    depreciationPurchasePrice: 10680,
    estimatedRetailToday: 16500,
    annualDepreciationRate: 0.08,
    valueAfter1Year: 15180,
    valueAfter2Years: 13965.6,
    valueAfter3Years: 12848.352,
    equityToday: 5820,
    equityAfter1Year: 4500,
    equityAfter2Years: 3285.6,
    equityAfter3Years: 2168.352
  },
  {
    vehicle: "Jeep Compass Latitude 2019",
    aliases: ["compass latitude"],
    miles: 90000,
    depreciationPurchasePrice: 9870,
    estimatedRetailToday: 12300,
    annualDepreciationRate: 0.09,
    valueAfter1Year: 11193,
    valueAfter2Years: 10185.63,
    valueAfter3Years: 9268.9233,
    equityToday: 2430,
    equityAfter1Year: 1323,
    equityAfter2Years: 315.63,
    equityAfter3Years: -601.0767
  },
  {
    vehicle: "Chevrolet Trax 2018",
    aliases: ["trax"],
    miles: 90000,
    depreciationPurchasePrice: 7020,
    estimatedRetailToday: 9700,
    annualDepreciationRate: 0.085,
    valueAfter1Year: 8875.5,
    valueAfter2Years: 8121.0825,
    valueAfter3Years: 7430.7904875,
    equityToday: 2680,
    equityAfter1Year: 1855.5,
    equityAfter2Years: 1101.0825,
    equityAfter3Years: 410.7904875
  },
  {
    vehicle: "Mazda CX-9 2016",
    aliases: ["mazda cx09", "mazda cx9", "cx09", "cx-9"],
    miles: 92000,
    depreciationPurchasePrice: 10850,
    estimatedRetailToday: 14300,
    annualDepreciationRate: 0.065,
    valueAfter1Year: 13370.5,
    valueAfter2Years: 12501.4175,
    valueAfter3Years: 11688.8253625,
    equityToday: 3450,
    equityAfter1Year: 2520.5,
    equityAfter2Years: 1651.4175,
    equityAfter3Years: 838.8253625
  }
];

export const portfolioDepreciation: PortfolioDepreciation = {
  carsIncluded: 7,
  totalPurchaseCost: 67220,
  estimatedRetailToday: 91600,
  currentEquityCushion: 24380,
  valueAfter1Year: 84018.5,
  valueAfter2Years: 77074.8975,
  valueAfter3Years: 70714.6812875,
  totalThreeYearDepreciation: 20885.3187125,
  equityAfter1Year: 16798.5,
  equityAfter2Years: 9854.8975,
  equityAfter3Years: 3494.6812875,
  blendedThreeYearDepreciationRate: 0.2280056628002183,
  averageAnnualDepreciationRate: 0.08264372033414591,
  closedVehicleRealizedRecovery: 7190,
  curve: [
    { period: "Today", projectedValue: 91600, purchaseCost: 67220 },
    { period: "Year 1", projectedValue: 84018.5, purchaseCost: 67220 },
    { period: "Year 2", projectedValue: 77074.8975, purchaseCost: 67220 },
    { period: "Year 3", projectedValue: 70714.6812875, purchaseCost: 67220 }
  ],
  vehicleEquity: depreciationRows.map((row) => ({
    vehicle: shortVehicleName(row.vehicle),
    equityAfter3Years: row.equityAfter3Years
  }))
};

export function findVehicleDepreciation(vehicleName: string): VehicleDepreciation | undefined {
  const normalized = normalizeVehicleName(vehicleName);
  const match = depreciationRows.find((row) =>
    row.aliases.some((alias) => normalized.includes(normalizeVehicleName(alias)))
  );
  if (!match) return undefined;

  const { vehicle, aliases, ...depreciation } = match;
  return depreciation;
}

function normalizeVehicleName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function shortVehicleName(value: string) {
  if (value.includes("Equinox")) return "Equinox";
  if (value.includes("Voyager")) return "Voyager";
  if (value.includes("Outlander")) return "Outlander";
  if (value.includes("Grand Cherokee")) return "Grand Cherokee";
  if (value.includes("Compass Latitude")) return "Compass";
  if (value.includes("Trax")) return "Trax";
  if (value.includes("Mazda")) return "Mazda";
  return value;
}
