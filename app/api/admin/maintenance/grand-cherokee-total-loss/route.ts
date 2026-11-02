import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getSql, initializeDatabase } from "@/lib/db";

const PAYOUT = 13416.45;
const NOTE = "Total loss. Insurance payout recorded: $13,416.45.";

export async function GET() {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  await initializeDatabase();
  const sql = getSql();
  const datasets = await sql`
    select id, filename, import_date, is_active
    from datasets
    order by import_date desc nulls last
    limit 8
  `;
  const grandCherokeeRows = await sql`
    select d.id as dataset_id, d.filename, d.import_date, d.is_active,
      v.id as vehicle_id, v.vehicle_key, v.name, v.status, v.cash_returned, v.note
    from datasets d
    join vehicles v on v.dataset_id = d.id
    where lower(v.name) like '%grand cherokee%'
    order by d.import_date desc nulls last
  `;

  return NextResponse.json({ ok: true, datasets, grandCherokeeRows });
}

export async function POST(request: Request) {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { datasetId?: string };
  if (!body.datasetId) {
    return NextResponse.json({ ok: false, message: "A dataset ID is required." }, { status: 400 });
  }

  await initializeDatabase();
  const sql = getSql();
  const datasetRows = await sql`
    select id, filename, is_active
    from datasets
    where id = ${body.datasetId}
    limit 1
  ` as { id: string; filename: string; is_active: boolean }[];
  const dataset = datasetRows[0];

  if (!dataset?.is_active) {
    return NextResponse.json(
      { ok: false, message: "Only the active dataset can be corrected by this maintenance operation." },
      { status: 409 }
    );
  }

  const matches = await sql`
    select id, vehicle_key, name, status, cash_returned, note
    from vehicles
    where dataset_id = ${dataset.id}
      and lower(name) like '%grand cherokee%'
  ` as {
    id: string;
    vehicle_key: string;
    name: string;
    status: string;
    cash_returned: string | number;
    note: string | null;
  }[];

  if (matches.length !== 1) {
    return NextResponse.json(
      { ok: false, message: `Expected one Grand Cherokee in the active dataset; found ${matches.length}.` },
      { status: 409 }
    );
  }

  const before = matches[0];
  const updatedRows = await sql`
    update vehicles
    set status = 'total_loss', cash_returned = ${PAYOUT}, note = ${NOTE}
    where id = ${before.id} and dataset_id = ${dataset.id}
    returning id, vehicle_key, name, status, cash_returned, note
  ` as {
    id: string;
    vehicle_key: string;
    name: string;
    status: string;
    cash_returned: string | number;
    note: string | null;
  }[];

  await sql`
    insert into import_logs (dataset_id, level, message)
    values (
      ${dataset.id},
      'info',
      'Grand Cherokee status corrected to total loss; insurance payout recorded as $13,416.45.'
    )
  `;

  return NextResponse.json({
    ok: true,
    dataset: { id: dataset.id, filename: dataset.filename },
    before,
    after: updatedRows[0]
  });
}
