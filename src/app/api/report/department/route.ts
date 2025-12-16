import { NextRequest, NextResponse } from "next/server";
import prisma from "@/service/db";

export async function POST(req: NextRequest) {
  try {
    const { groupIds, dates } = (await req.json()) as {
      groupIds: string[];
      dates: { from: string; to: string };
    };

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return NextResponse.json(
        { error: "groupIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!dates?.from || !dates?.to) {
      return NextResponse.json(
        { error: "dates must include from and to" },
        { status: 400 }
      );
    }

    const fromDate = new Date(dates.from);
    const toDate = new Date(dates.to);
    toDate.setHours(23, 59, 59, 999);

    /**
     * 🔥 SINGLE DB QUERY
     */
    const tasks = await prisma.task.findMany({
      where: {
        submitted_at: {
          gte: fromDate,
          lte: toDate,
        },
        OR: [
          { transcriber: { group_id: { in: groupIds } } },
          { reviewer: { group_id: { in: groupIds } } },
          { final_reviewer: { group_id: { in: groupIds } } },
        ],
      },
      select: {
        duration_minutes: true,
        ai_minutes: true,
        is_trashed: true,

        transcriber_id: true,
        reviewer_id: true,
        final_reviewer_id: true,

        transcriber: {
          select: { id: true, name: true, group_id: true },
        },
        reviewer: {
          select: { id: true, name: true, group_id: true },
        },
        final_reviewer: {
          select: { id: true, name: true, group_id: true },
        },
      },
    });

    /**
     * 🧱 INITIALIZE RESPONSE SHAPE
     */
    const users: Record<string, any> = {};
    const reviewers: Record<string, any> = {};
    const finalReviewers: Record<string, any> = {};

    groupIds.forEach((gid) => {
      users[gid] = {};
      reviewers[gid] = {};
      finalReviewers[gid] = {};
    });

    /**
     * ⚡ IN-MEMORY AGGREGATION
     */
    for (const task of tasks) {
      const minutes = task.duration_minutes ?? 0;
      const aiMinutes = task.ai_minutes ?? 0;

      /* ================= TRANSCIBER ================= */
      if (task.transcriber) {
        const g = task.transcriber.group_id;
        const u = task.transcriber_id;

        users[g][u] ??= {
          id: u,
          name: task.transcriber.name,
          submitted: 0,
          reviewed: 0,
          submitted_minutes: 0,
          reviewed_minutes: 0,
          trashed_minutes: 0,
          total_ai_minutes: 0,
        };

        users[g][u].submitted++;
        users[g][u].submitted_minutes += minutes;
        users[g][u].total_ai_minutes += aiMinutes;

        if (task.is_trashed) {
          users[g][u].trashed_minutes += minutes;
        }
      }

      /* ✅ ADDITION: REVIEWED TASK FOR TRANSCRIBER (NO DELETION) */
      if (task.transcriber && task.reviewer_id) {
        const g = task.transcriber.group_id;
        const u = task.transcriber_id;

        users[g][u].reviewed++;
        users[g][u].reviewed_minutes += minutes;
      }

      /* ================= REVIEWER ================= */
      if (task.reviewer) {
        const g = task.reviewer.group_id;
        const u = task.reviewer_id;

        reviewers[g][u] ??= {
          id: u,
          name: task.reviewer.name,
          reviewed: 0,
          accepted: 0,
          finalised: 0,
          reviewed_minutes: 0,
        };

        reviewers[g][u].reviewed++;
        reviewers[g][u].reviewed_minutes += minutes;
      }

      /* ================= FINAL REVIEWER ================= */
      if (task.final_reviewer) {
        const g = task.final_reviewer.group_id;
        const u = task.final_reviewer_id;

        finalReviewers[g][u] ??= {
          id: u,
          name: task.final_reviewer.name,
          finalised: 0,
          finalised_minutes: 0,
        };

        finalReviewers[g][u].finalised++;
        finalReviewers[g][u].finalised_minutes += minutes;
      }
    }

    return NextResponse.json({
      users,
      reviewers,
      finalReviewers,
    });
  } catch (error) {
    console.error("Department report error:", error);
    return NextResponse.json(
      { error: "Failed to generate department report" },
      { status: 500 }
    );
  }
}
