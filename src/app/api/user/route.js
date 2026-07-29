export const runtime = "nodejs";

import prisma from "@/service/db";
import { NextResponse } from "next/server";
import { requireFinalReviewerApi } from "@/lib/auth/requireUser";
import { withAccessLog } from "@/lib/logger/with-access-log";

export const GET = withAccessLog(async () => {
  // [Reason] Listing all users is admin-only (FINAL_REVIEWER).
  const auth = await requireFinalReviewerApi();
  if ("response" in auth) return auth.response;
  // get all user
  try {
    const users = await prisma.user.findMany({});
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error creating post:", error);
  }
});

export const PUT = withAccessLog(async (request) => {
  // [Reason] Updating a user is admin-only (FINAL_REVIEWER).
  const auth = await requireFinalReviewerApi();
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json();
    const { id, name, email, group_id, role, slack_user_id: slackRaw } = body;
    // [Reason] Optional Slack Member ID for queue notifications; blank clears to NULL
    const slack_user_id =
      typeof slackRaw === "string" && slackRaw.trim() ? slackRaw.trim() : null;

    // Validate required fields
    if (!id || !name || !email || !group_id || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if username and email already exists (excluding current user)
    const userByName = await prisma.user.findFirst({
      where: {
        name: name,
        NOT: { id: parseInt(id) }
      }
    });

    const userByEmail = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: { id: parseInt(id) }
      }
    });

    if (userByName && userByEmail) {
      return NextResponse.json(
        { error: "User already exists with the same username and email" },
        { status: 400 }
      );
    } else if (userByName) {
      return NextResponse.json(
        { error: "User already exists with the same username" },
        { status: 400 }
      );
    } else if (userByEmail) {
      return NextResponse.json(
        { error: "User already exists with the same email" },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        email: email.trim(),
        group_id: parseInt(group_id),
        role: role,
        slack_user_id,
      }
    });

    return NextResponse.json({
      success: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
