import { NextResponse } from "next/server";
import { getActiveDashboardData } from "@/lib/dashboard-repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getActiveDashboardData({
    vehicleId: searchParams.get("vehicleId") || undefined,
    status: searchParams.get("status") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined
  });

  return NextResponse.json(data);
}
