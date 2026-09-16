export type VehicleStatus = "active" | "sold" | "repair" | "pending" | "inactive" | "total_loss" | "returned" | "other";

export type MonthlyExpenseItem = {
  label: string;
  amount: number;
};

export type MonthlyBreakdown = {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  monthlyRoi?: number;
  items: MonthlyExpenseItem[];
};

export type VehiclePerformance = {
  id: string;
  name: string;
  displayOrder?: number;
  vin: string;
  plate: string;
  status: VehicleStatus;
  purchasePrice: number;
  repairs: number;
  dmvFees: number;
  dealerFees: number;
  auctionFees: number;
  otherAcquisitionCosts: number;
  totalAllInCost: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netProfit: number;
  roi: number;
  paybackProgress: number;
  cashReturned: number;
  currentEstimatedValue: number;
  depreciationEstimate: number;
  profitAfterDepreciation: number;
  averageMonthlyRoi: number;
  paybackRemainingMonths: number | null;
  monthlyBreakdowns: MonthlyBreakdown[];
  depreciation?: VehicleDepreciation;
  note?: string;
};

export type VehicleDepreciation = {
  miles: number;
  depreciationPurchasePrice: number;
  estimatedRetailToday: number;
  annualDepreciationRate: number;
  valueAfter1Year: number;
  valueAfter2Years: number;
  valueAfter3Years: number;
  equityToday: number;
  equityAfter1Year: number;
  equityAfter2Years: number;
  equityAfter3Years: number;
  note?: string;
};

export type PortfolioDepreciation = {
  carsIncluded: number;
  totalPurchaseCost: number;
  estimatedRetailToday: number;
  currentEquityCushion: number;
  valueAfter1Year: number;
  valueAfter2Years: number;
  valueAfter3Years: number;
  totalThreeYearDepreciation: number;
  equityAfter1Year: number;
  equityAfter2Years: number;
  equityAfter3Years: number;
  blendedThreeYearDepreciationRate: number;
  averageAnnualDepreciationRate: number;
  closedVehicleRealizedRecovery: number;
  curve: Array<{
    period: string;
    projectedValue: number;
    purchaseCost: number;
  }>;
  vehicleEquity: Array<{
    vehicle: string;
    equityAfter3Years: number;
  }>;
};

export type TrendPoint = {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
};

export type DashboardData = {
  generatedAt: string;
  source: "google-sheet" | "database" | "mock";
  overview: VehiclePerformance;
  vehicles: VehiclePerformance[];
  trends: TrendPoint[];
  depreciation?: PortfolioDepreciation;
  warnings: string[];
};

export type DashboardFilters = {
  vehicleId?: string;
  status?: string;
  from?: string;
  to?: string;
};
