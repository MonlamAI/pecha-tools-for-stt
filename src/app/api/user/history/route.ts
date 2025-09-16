import { NextResponse } from "next/server";
import { getUserHistory } from "@/service/user-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("userId"));
    const groupId = Number(searchParams.get("groupId"));
    const role = searchParams.get("role") as any;

    if (!userId || !groupId || !role) {
      return NextResponse.json(
        { error: "Missing userId, groupId or role" },
        { status: 400 }
      );
    }

    const result = await getUserHistory({ userId, groupId, role });
    return NextResponse.json(result ?? []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}


