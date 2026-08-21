import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { importWorkbook } from "@/lib/import-workbook";

export async function POST(request: Request) {
  const session = getCurrentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json() as { filename?: string; base64?: string };
    const filename = body.filename?.trim() || "uploaded-workbook.xlsx";
    const rawBase64 = body.base64?.replace(/^data:.*?;base64,/, "").replace(/\s+/g, "");

    if (!rawBase64) {
      return NextResponse.json({ ok: false, message: "Paste the workbook base64 content first." }, { status: 400 });
    }

    const buffer = Buffer.from(rawBase64, "base64");
    const file = new File([buffer], filename, {
      type: filename.toLowerCase().endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const result = await importWorkbook(file);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workbook could not be imported.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
