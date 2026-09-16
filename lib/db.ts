import { neon } from "@neondatabase/serverless";

export type SqlClient = ReturnType<typeof neon>;

export function hasDatabase() {
  return Boolean(databaseUrl());
}

export function getSql(): SqlClient {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured. Add your Neon connection string in Vercel environment variables.");
  }

  return neon(url);
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.FamilyDrive_DATABASE_URL ||
    process.env.FamilyDrive_POSTGRES_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

export async function initializeDatabase() {
  const sql = getSql();

  await sql`
    create table if not exists datasets (
      id uuid primary key default gen_random_uuid(),
      filename text not null,
      upload_date timestamptz not null default now(),
      import_date timestamptz,
      imported_by text,
      vehicle_count integer not null default 0,
      transaction_count integer not null default 0,
      monthly_metric_count integer not null default 0,
      import_status text not null default 'pending',
      is_active boolean not null default false,
      notes text,
      blob_url text
    )
  `;

  await sql`
    create table if not exists vehicles (
      id uuid primary key default gen_random_uuid(),
      dataset_id uuid not null references datasets(id) on delete cascade,
      vehicle_key text not null,
      name text not null,
      display_order integer,
      vin text,
      plate text,
      status text not null default 'active',
      purchase_price numeric not null default 0,
      repairs numeric not null default 0,
      dmv_fees numeric not null default 0,
      dealer_fees numeric not null default 0,
      auction_fees numeric not null default 0,
      other_acquisition_costs numeric not null default 0,
      current_estimated_value numeric not null default 0,
      depreciation_estimate numeric not null default 0,
      cash_returned numeric not null default 0,
      note text
    )
  `;

  await sql`alter table vehicles add column if not exists display_order integer`;

  await sql`
    create table if not exists monthly_metrics (
      id uuid primary key default gen_random_uuid(),
      dataset_id uuid not null references datasets(id) on delete cascade,
      vehicle_key text not null,
      month_label text not null,
      revenue numeric not null default 0,
      expenses numeric not null default 0,
      net_profit numeric not null default 0,
      items jsonb not null default '[]'::jsonb
    )
  `;

  await sql`
    create table if not exists transactions (
      id uuid primary key default gen_random_uuid(),
      dataset_id uuid not null references datasets(id) on delete cascade,
      vehicle_key text,
      transaction_date date,
      type text,
      category text,
      amount numeric not null default 0,
      notes text
    )
  `;

  await sql`
    create table if not exists import_logs (
      id uuid primary key default gen_random_uuid(),
      dataset_id uuid references datasets(id) on delete cascade,
      created_at timestamptz not null default now(),
      level text not null default 'info',
      message text not null
    )
  `;
}
