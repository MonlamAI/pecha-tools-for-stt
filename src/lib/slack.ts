import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSlackMessage(
  slackUserId: string,
  message: string
) {
  return slack.chat.postMessage({
    channel: slackUserId,
    text: message,
  });
}
