import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getSql, hasDatabase, initializeDatabase } from "@/lib/db";

export async function GET() {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  if (!hasDatabase()) {
    return NextResponse.json({ ok: true, datasets: [], warning: "DATABASE_URL is not configured yet." });
  }

  await initializeDatabase();
  const sql = getSql();
  const datasets = await sql`
    select id, filename, upload_date, import_date, imported_by, vehicle_count, transaction_count,
      monthly_metric_count, import_status, is_active, notes
    from datasets
    order by upload_date desc
  `;

  return NextResponse.json({ ok: true, datasets });
}

export async function PATCH(request: Request) {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { datasetId?: string; action?: string };
  if (!body.datasetId) {
    return NextResponse.json({ ok: false, message: "Choose a dataset." }, { status: 400 });
  }

  await initializeDatabase();
  const sql = getSql();

  if (body.action === "delete") {
    const activeRows = await sql`select is_active from datasets where id = ${body.datasetId}` as { is_active: boolean }[];
    if (activeRows[0]?.is_active) {
      return NextResponse.json({ ok: false, message: "The active dataset cannot be deleted." }, { status: 400 });
    }
    await sql`delete from datasets where id = ${body.datasetId}`;
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "activate") {
    return NextResponse.json({ ok: false, message: "Choose a supported dataset action." }, { status: 400 });
  }

  await sql`update datasets set is_active = false`;
  await sql`update datasets set is_active = true where id = ${body.datasetId}`;
  await sql`insert into import_logs (dataset_id, level, message) values (${body.datasetId}, 'info', 'Dataset activated from admin panel.')`;

  return NextResponse.json({ ok: true });
}
