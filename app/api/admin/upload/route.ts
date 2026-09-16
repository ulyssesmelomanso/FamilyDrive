import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { importWorkbook } from "@/lib/import-workbook";

export async function POST(request: Request) {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Choose an Excel file to upload." }, { status: 400 });
    }

    const result = await importWorkbook(file);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workbook could not be imported.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
