import { BotClient } from "@open-ic/openchat-botclient-ts";
import { APIGatewayProxyResultV2 } from "aws-lambda";
import { ephemeralResponse } from "./helpers";

export async function help(
  client: BotClient
): Promise<APIGatewayProxyResultV2> {
  const msg = await client.createTextMessage("what the hell is going on");
  await client.sendMessage(msg).then((resp) => {
    if (resp.kind !== "success") {
      console.log("Error: ", resp);
    }
  });
  return ephemeralResponse(client, buildHelpText(), true);
}

function buildHelpText() {
  const lines: string[] = [];
  lines.push("`/help`: Display this summary of commands");
  lines.push("`/pause`: Pauses moderation in this chat");
  lines.push("`/resume`: Resumes moderation in this chat");
  lines.push("`/status`: Display current configuration in this chat");
  lines.push("`/rules`: Configure rules applied");
  lines.push("`/action`: Configure action taken when rules are broken");
  lines.push("`/explanation`: Configure if and how the bot explains decisions");
  lines.push("`/threshold`: Configure to threshold for general rules");
  lines.push(
    "`/explain`: Explain the reason for moderation on a single message"
  );
  return lines.join("\n");
}
