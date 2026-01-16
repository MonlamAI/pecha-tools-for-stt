import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";
import { buildReport } from "@/lib/reportEngine";
import { utcToIst } from "@/lib/istCurrentTime";
import { getCache, setCache } from "@/lib/cache";

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */

function tibetanSyllableCount(text?: string | null) {
  if (!text) return 0;
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");
  return tibetanOnly.split(/[་།]/).filter(Boolean).length;
}

/* ---------------- API ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const groupId = Number(searchParams.get("groupId"));
    let fromStr = searchParams.get("from");
    let toStr = searchParams.get("to");

    if (!groupId || !fromStr || !toStr) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // Cache Check
    const cacheKey = `report:group:${groupId}:${fromStr}:${toStr}`;
    const cached = getCache(cacheKey);
    if (cached) {
      // console.log("Serving cached group report", cacheKey);
      return NextResponse.json(cached);
    }

    let from = new Date(fromStr);
    let to = new Date(toStr);

    // Shift dates to match DB storage (IST stored as UTC)
    from = utcToIst(new Date(from));
    to = utcToIst(new Date(to));

    /* ---------------- DB FETCH (2 QUERIES TOTAL) ---------------- */

    const [users, tasks] = await Promise.all([
      prisma.user.findMany({
        where: { group_id: groupId },
        select: { id: true, name: true, role: true },
      }),

      prisma.task.findMany({
        where: {
          group_id: groupId,
          OR: [
            { submitted_at: { gte: from, lte: to } },
            { reviewed_at: { gte: from, lte: to } },
            { finalised_reviewed_at: { gte: from, lte: to } },
          ],
        },
        select: {
          id: true,
          state: true,
          audio_duration: true,
          transcriber_id: true,
          reviewer_id: true,
          final_reviewer_id: true,
          transcript: true,
          reviewed_transcript: true,
          inference_transcript: true,
          final_transcript: true,
          transcriber_is_correct: true,
          reviewer_is_correct: true,
          submitted_at: true,
          reviewed_at: true,
          finalised_reviewed_at: true,
        },
      }),
    ]);

    /* ---------------- REPORT LOGIC ---------------- */
    const report = buildReport({ users, tasks, from, to });

    const result = {
      users: report.users,
      reviewers: report.reviewers,
      finalReviewers: report.finalReviewers
    };

    // Cache result for 1 minute
    setCache(cacheKey, result, 60000);

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
