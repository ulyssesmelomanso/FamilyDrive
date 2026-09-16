# FamilyDrive Investor Portal

Professional investor dashboard for vehicle investment performance. The investor view preserves the FamilyDrive dashboard design already built in preview, while the backend is now prepared for Vercel, Neon Postgres, and encrypted Vercel Blob spreadsheet archives.

## Architecture

The dashboard should not use Excel as the live data source after upload.

1. Admin uploads an Excel workbook.
2. The app validates the file type.
3. The original workbook is encrypted and archived in Vercel Blob.
4. Vehicle and monthly performance data are imported into Neon Postgres.
5. Each upload creates a new dataset version.
6. Admin activates one dataset.
7. The investor dashboard reads only the active dataset.

If `DATABASE_URL` is not configured yet, the app falls back to the current preview data so the dashboard remains usable during setup.

## Environment Variables

Add these values in `.env.local` for local development and in Vercel Project Settings for production:

```bash
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
ARCHIVE_ENCRYPTION_KEY=
AUTH_SECRET=

ADMIN_USERNAME=familydrive
ADMIN_PASSWORD=familydrive

INVESTOR_USERNAME=wessiemens
INVESTOR_PASSWORD=12345
```

Use strong private values for `ARCHIVE_ENCRYPTION_KEY`, `AUTH_SECRET`, and all production passwords.

## Login

Admin:

```text
Username: familydrive
Password: familydrive
```

Investor:

```text
Username: wessiemens
Password: 12345
```

Passwords are checked server-side and should be stored only as environment variables.

## Admin Workflow

Open `/admin` after logging in as admin.

Admin can:

- Upload `.xlsx` or `.xls` files
- Import vehicles and monthly reports into Neon
- View dataset history
- Activate a dataset
- See current database status

Only one dataset should be active at a time. Activating a dataset instantly changes what the investor dashboard displays.

## Spreadsheet Requirements

Best supported format:

### `Vehicles` tab

Recommended columns:

| Column | Purpose |
| --- | --- |
| Vehicle ID or VIN | Stable vehicle identifier |
| Vehicle or Name | Display name |
| Plate or License Plate | License plate |
| Status | active, inactive, pending, total_loss, repair, sold |
| Purchase Price | Acquisition price |
| Repairs | Repairs or reconditioning |
| DMV Fees | DMV or registration |
| Dealer Fees | Dealer fee |
| Auction Fees | Auction fee |
| Other Acquisition Costs | Transport, shipping, prep, other costs |
| Current Estimated Value | Estimated market value |
| Depreciation Estimate | Estimated depreciation |
| Cash Returned | Money already returned to investor |
| Note | Optional vehicle note |

### `Monthly Summary` tab

Recommended columns:

| Column | Purpose |
| --- | --- |
| Vehicle ID, VIN, Vehicle, or Name | Links to a vehicle |
| Month, Date, or Period | Month label |
| Revenue or Income | Monthly gross income |
| Expenses or Costs | Monthly costs |
| Net Profit or Profit | Optional. If blank, calculated as revenue minus expenses |

The importer also has early support for one tab per vehicle with month blocks. A clean `Vehicles` tab plus `Monthly Summary` tab is the easiest format to maintain.

## Calculations

- Total spent = purchase price + repairs + DMV fees + dealer fees + auction fees + other acquisition costs
- Net profit = revenue - expenses, unless net profit is supplied
- ROI = net profit / total spent
- Average monthly ROI = average of vehicle monthly ROI values
- Projected yearly ROI = average monthly ROI x 12
- Profit after depreciation = net profit - depreciation estimate
- Capital recovered = higher of cash returned or net profit divided by total spent

Inactive vehicles are excluded from portfolio performance totals. Total loss vehicles can remain visible while being excluded from average ROI.

## Run Locally

Use the bundled or local Node package manager:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Push this project to GitHub.
2. Create a Vercel project from the repository.
3. Create a Neon database. The app reads `DATABASE_URL`, Vercel's `POSTGRES_URL`, or the prefixed Neon integration variables such as `FamilyDrive_DATABASE_URL`.
4. Enable Vercel Blob and add `BLOB_READ_WRITE_TOKEN`.
5. Add `ARCHIVE_ENCRYPTION_KEY`, `AUTH_SECRET`, admin credentials, and investor credentials.
6. Deploy.
7. Login at `/admin`.
8. Upload the first Excel workbook.
9. Activate the imported dataset.
10. Give the investor the main dashboard URL.

## Vercel Blob Security Note

Vercel Blob URLs are not treated as the private source of truth. Uploaded workbooks are encrypted before archival with `ARCHIVE_ENCRYPTION_KEY`, and the dashboard reads from Neon, not from the archived workbook.

For stricter private file storage, replace Blob with Supabase Storage, S3, or another provider with private buckets and signed download URLs.

## Future PostgreSQL Growth

The app already uses Neon Postgres. Future improvements can add:

- Multiple investors
- Per-investor permissions
- Dataset comparison screens
- Import error reports by row
- More transaction-level tabs
- PostgreSQL migrations with Drizzle or Prisma
