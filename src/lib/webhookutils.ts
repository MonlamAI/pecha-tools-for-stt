"use server";
import webhook from "webhook-discord";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendDiscordAlert({
  groupName,
  taskCount,
  threshold,
}: {
  groupName: string;
  taskCount: number;
  threshold: number;
}) {
  console.log('sendDiscordAlert', { groupName, taskCount, threshold })
  if (!DISCORD_WEBHOOK_URL) {
    return { error: "Discord webhook URL not configured" };
  }
  const message = {
    content: `⚠️The group "${groupName}" currently has only ${taskCount} tasks in progress for transcription, which falls below the defined threshold of ${threshold}. It's time to add more data to maintain the workflow.`,
  };

  // console.log('Debug - Sending Discord message:', JSON.stringify(message, null, 2));

  try {
    const Hook = new webhook.Webhook(DISCORD_WEBHOOK_URL);
    Hook.warn("PechaTool STT Bot", message.content);
    // console.log('Discord message sent successfully');
  } catch (error) {
    console.error("Error sending Discord message:", error);
  }
}
