import { NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/slack";

export async function GET() {
  try {
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
