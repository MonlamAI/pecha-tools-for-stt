import { NextRequest, NextResponse } from "next/server";
import { getUserSpecificTasksCount } from "@/model/task";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const data = await getUserSpecificTasksCount(id, { from, to });
    if ((data as any)?.error) {
      return NextResponse.json(data, { status: 500 });
    }
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}


