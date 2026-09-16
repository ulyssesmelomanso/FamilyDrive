"use client";

import { CheckCircle2, Database, FileSpreadsheet, LogOut, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Dataset = {
  id: string;
  filename: string;
  upload_date: string;
  import_date: string;
  imported_by: string;
  vehicle_count: number;
  transaction_count: number;
  monthly_metric_count: number;
  import_status: string;
  is_active: boolean;
  notes: string;
};

export default function AdminPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function loadDatasets() {
    const response = await fetch("/api/admin/datasets", { cache: "no-store" });
    const payload = await response.json();
    setDatasets(payload.datasets || []);
    if (payload.warning) setMessage(payload.warning);
  }

  useEffect(() => {
    loadDatasets();
  }, []);

  async function uploadWorkbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const payload = await response.json();
    setIsUploading(false);

    if (!response.ok) {
      setMessage(payload.message || "Upload failed.");
      return;
    }

    setFile(null);
    setMessage(`Import complete: ${payload.result.vehicleCount} vehicles and ${payload.result.monthlyMetricCount} monthly reports were imported.`);
    await loadDatasets();
  }

  async function activateDataset(datasetId: string) {
    await fetch("/api/admin/datasets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, action: "activate" })
    });
    setMessage("Active dataset updated. The investor dashboard now reads from this version.");
    await loadDatasets();
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  const activeDataset = datasets.find((dataset) => dataset.is_active);
  const latestDataset = datasets[0];

  return (
    <main className="min-h-screen bg-[#f8fbfd] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <img src="/familydrive-logo.svg" alt="FamilyDrive" className="mb-4 h-10 w-auto" />
            <p className="text-sm font-bold uppercase tracking-wide text-[#0797a8]">Admin Portal</p>
            <h1 className="mt-2 text-4xl font-black text-[#333] sm:text-5xl">Dataset Control Center</h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Upload monthly Excel files, preserve the original workbook, import clean data, and choose which dataset investors see.
            </p>
          </div>
          <button onClick={logout} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#333] px-4 text-sm font-semibold text-white">
            <LogOut size={16} />
            Logout
          </button>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <AdminCard label="Active Dataset" value={activeDataset?.filename || "None"} icon={<CheckCircle2 size={18} />} />
          <AdminCard label="Vehicles" value={String(activeDataset?.vehicle_count || 0)} icon={<Database size={18} />} />
          <AdminCard label="Monthly Reports" value={String(activeDataset?.monthly_metric_count || 0)} icon={<FileSpreadsheet size={18} />} />
          <AdminCard label="Last Import" value={latestDataset?.import_date ? new Date(latestDataset.import_date).toLocaleDateString() : "None"} icon={<UploadCloud size={18} />} />
        </section>

        {message ? <div className="mt-5 rounded-md border border-[#83e2df] bg-white px-4 py-3 text-sm font-medium text-[#075b65]">{message}</div> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
          <form onSubmit={uploadWorkbook} className="rounded-lg bg-white p-5 shadow-[0_18px_45px_rgba(85,85,85,0.08)] ring-1 ring-slate-200">
            <div className="mb-5 flex items-center gap-2 text-xl font-black text-[#333]">
              <UploadCloud className="text-[#0797a8]" size={20} />
              Upload Spreadsheet
            </div>
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#83e2df] bg-[#f8fbfd] px-5 py-8 text-center">
              <FileSpreadsheet className="mb-3 text-[#0797a8]" size={34} />
              <span className="font-bold text-[#333]">{file?.name || "Choose an Excel workbook"}</span>
              <span className="mt-1 text-sm text-slate-500">Accepted files: .xlsx or .xls</span>
              <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="mt-5 h-11 w-full rounded-md bg-[#0797a8] font-bold text-white transition hover:bg-[#067d8c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? "Importing..." : "Upload and Import"}
            </button>
          </form>

          <section className="rounded-lg bg-white p-5 shadow-[0_18px_45px_rgba(85,85,85,0.08)] ring-1 ring-slate-200">
            <div className="mb-5 flex items-center gap-2 text-xl font-black text-[#333]">
              <Database className="text-[#0797a8]" size={20} />
              Datasets
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-separate border-spacing-y-2 text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Imported</th>
                    <th className="px-3 py-2">Vehicles</th>
                    <th className="px-3 py-2">Monthly</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((dataset) => (
                    <tr key={dataset.id} className="bg-[#f8fbfd]">
                      <td className="rounded-l-lg px-3 py-3 font-bold text-[#333]">{dataset.filename}</td>
                      <td className="px-3 py-3">{dataset.import_date ? new Date(dataset.import_date).toLocaleString() : "-"}</td>
                      <td className="px-3 py-3">{dataset.vehicle_count}</td>
                      <td className="px-3 py-3">{dataset.monthly_metric_count}</td>
                      <td className="px-3 py-3">{dataset.is_active ? <span className="rounded-md bg-[#d8f5df] px-2 py-1 text-xs font-bold text-[#1f7a3a]">Active</span> : dataset.import_status}</td>
                      <td className="rounded-r-lg px-3 py-3">
                        <button
                          onClick={() => activateDataset(dataset.id)}
                          disabled={dataset.is_active}
                          className="rounded-md border border-[#0797a8] px-3 py-1.5 text-xs font-bold text-[#0797a8] disabled:border-slate-300 disabled:text-slate-400"
                        >
                          Activate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!datasets.length ? (
                    <tr>
                      <td className="rounded-lg bg-[#f8fbfd] px-3 py-8 text-center text-slate-500" colSpan={6}>
                        No imported datasets yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function AdminCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-[0_18px_45px_rgba(85,85,85,0.08)] ring-1 ring-slate-200">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#e9fbfb] text-[#0797a8]">{icon}</div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-black text-[#333]">{value}</p>
    </div>
  );
}
