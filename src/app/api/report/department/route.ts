import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";
import { buildReport, parseLiteralUTC } from "@/lib/reportEngine";

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */

function tibetanSyllableCount(text?: string | null) {
  if (!text) return 0;
  const tibetanOnly = text.replace(/[^\u0F00-\u0FFF]+/g, "");
  return tibetanOnly.split(/[་།]/).filter(Boolean).length;
}

function inRange(dt: Date | null, from?: Date, to?: Date) {
  if (!dt) return false;
  if (from && dt < from) return false;
  if (to && dt > to) return false;
  return true;
}

/* ---------------- API ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const departmentId = Number(searchParams.get("departmentId"));
    const from = parseLiteralUTC(searchParams.get("from"));
    const to = parseLiteralUTC(searchParams.get("to"), true);

    if (!departmentId) {
      return NextResponse.json(
        { error: "Invalid departmentId" },
        { status: 400 }
      );
    }

    /* -------- groups -------- */

    const groups = await prisma.group.findMany({
      where: { department_id: departmentId },
      select: { id: true },
    });

    const groupIds = groups.map(g => g.id);
    if (!groupIds.length) {
      return NextResponse.json(
        { users: {}, reviewers: {}, finalReviewers: {} },
        { status: 200 }
      );
    }

    /* -------- users + tasks -------- */

    const [users, tasks] = await Promise.all([
      prisma.user.findMany({
        where: { group_id: { in: groupIds } },
        select: { id: true, name: true, role: true, group_id: true },
      }),
      prisma.task.findMany({
        where: {
          group_id: { in: groupIds },
          OR: [
            { submitted_at: { gte: from, lte: to } },
            { reviewed_at: { gte: from, lte: to } },
            { finalised_reviewed_at: { gte: from, lte: to } },
          ],
        },
        select: {
          id: true,
          group_id: true,
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

    /* -------- users by group -------- */
    const usersOut: Record<number, any[]> = {};
    const reviewersOut: Record<number, any[]> = {};
    const finalReviewersOut: Record<number, any[]> = {};

    for (const gid of groupIds) {
      usersOut[gid] = [];
      reviewersOut[gid] = [];
      finalReviewersOut[gid] = [];
    }

    /* ---------------- REPORT LOGIC ---------------- */
    const report = buildReport({ users, tasks, from, to });

    /* ---------------- GROUPING ---------------- */
    // Map user id to group id for quick lookup during grouping
    const userToGroup = new Map<number, number>();
    for (const u of users) {
      userToGroup.set(u.id, u.group_id);
    }

    for (const stat of report.users) {
      const gid = userToGroup.get(stat.id);
      if (gid !== undefined && usersOut[gid]) {
        usersOut[gid].push(stat);
      }
    }

    for (const stat of report.reviewers) {
      const gid = userToGroup.get(stat.id);
      if (gid !== undefined && reviewersOut[gid]) {
        reviewersOut[gid].push(stat);
      }
    }

    for (const stat of report.finalReviewers) {
      const gid = userToGroup.get(stat.id);
      if (gid !== undefined && finalReviewersOut[gid]) {
        finalReviewersOut[gid].push(stat);
      }
    }

    return NextResponse.json(
      { users: usersOut, reviewers: reviewersOut, finalReviewers: finalReviewersOut },
      { status: 200 }
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
