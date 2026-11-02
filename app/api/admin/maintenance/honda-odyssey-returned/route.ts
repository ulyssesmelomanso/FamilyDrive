import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getSql, initializeDatabase } from "@/lib/db";

export async function POST() {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  await initializeDatabase();
  const sql = getSql();
  const activeRows = await sql`
    select id, filename
    from datasets
    where is_active = true
    order by import_date desc nulls last
    limit 1
  ` as { id: string; filename: string }[];
  const dataset = activeRows[0];

  if (!dataset) {
    return NextResponse.json({ ok: false, message: "No active dataset was found." }, { status: 404 });
  }

  const matches = await sql`
    select id, vehicle_key, name, status, cash_returned, note,
      purchase_price, repairs, dmv_fees, dealer_fees, auction_fees, other_acquisition_costs
    from vehicles
    where dataset_id = ${dataset.id}
      and (lower(name) like '%honda odissey%' or lower(name) like '%honda odyssey%')
  ` as {
    id: string;
    vehicle_key: string;
    name: string;
    status: string;
    cash_returned: string | number;
    note: string | null;
    purchase_price: string | number;
    repairs: string | number;
    dmv_fees: string | number;
    dealer_fees: string | number;
    auction_fees: string | number;
    other_acquisition_costs: string | number;
  }[];

  if (matches.length !== 1) {
    return NextResponse.json(
      { ok: false, message: `Expected one Honda Odyssey in the active dataset; found ${matches.length}.` },
      { status: 409 }
    );
  }

  const before = matches[0];
  const updatedRows = await sql`
    update vehicles
    set status = 'returned', note = 'Returned.'
    where id = ${before.id} and dataset_id = ${dataset.id}
    returning id, vehicle_key, name, status, cash_returned, note,
      purchase_price, repairs, dmv_fees, dealer_fees, auction_fees, other_acquisition_costs
  ` as typeof matches;

  await sql`
    insert into import_logs (dataset_id, level, message)
    values (${dataset.id}, 'info', 'Honda Odyssey status corrected from inactive to returned; financial values preserved.')
  `;

  return NextResponse.json({
    ok: true,
    dataset: { id: dataset.id, filename: dataset.filename },
    before,
    after: updatedRows[0]
  });
}
