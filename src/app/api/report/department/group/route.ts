import { NextRequest, NextResponse } from "next/server";
import {
  generateUserReportByGroup,
  generateReviewerReportbyGroup,
  generateFinalReviewerReportbyGroup,
} from "@/model/user";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    const [users, reviewers, finalReviewers] = await Promise.all([
      generateUserReportByGroup(groupId, { from, to }),
      generateReviewerReportbyGroup(groupId, { from, to }),
      generateFinalReviewerReportbyGroup(groupId, { from, to }),
    ]);

    return NextResponse.json({ users, reviewers, finalReviewers }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}


