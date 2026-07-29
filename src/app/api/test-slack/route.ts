import { NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack";

// [Reason] Prevent Next.js from calling Slack during `next build` static generation
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      return NextResponse.json(
        { success: false, error: "SLACK_BOT_TOKEN is not configured" },
        { status: 500 }
      );
    }

    await sendSlackMessage(
      "U0AN39ECNH3",
      "🎉 Hello from the reusable Slack service!"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
