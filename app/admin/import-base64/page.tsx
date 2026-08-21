"use client";

import { useState } from "react";

export default function ImportBase64Page() {
  const [filename, setFilename] = useState("WES + FMLYDRIVE  (1).xlsx");
  const [base64, setBase64] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitImport() {
    setBusy(true);
    setStatus("Importing spreadsheet...");
    try {
      const response = await fetch("/api/admin/import-base64", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename, base64 })
      });
      const payload = await response.json();
      setStatus(JSON.stringify(payload, null, 2));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Admin Utility</p>
          <h1 className="mt-2 text-3xl font-semibold">Import Spreadsheet</h1>
          <p className="mt-2 text-sm text-slate-500">Admin-only helper for importing an Excel workbook through the live dashboard session.</p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Filename
          <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500" value={filename} onChange={(event) => setFilename(event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Workbook base64
          <textarea className="mt-2 h-72 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-sky-500" value={base64} onChange={(event) => setBase64(event.target.value)} />
        </label>
        <button className="rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !base64.trim()} onClick={submitImport}>
          {busy ? "Importing..." : "Import Spreadsheet"}
        </button>
        {status ? <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">{status}</pre> : null}
      </div>
    </main>
  );
}
