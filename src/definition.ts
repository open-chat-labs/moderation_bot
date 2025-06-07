import { BotDefinition, Permissions } from "@open-ic/openchat-botclient-ts";
import type { APIGatewayProxyHandler } from "aws-lambda";

export const definition: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(schema()),
  };
};

const emptyPermissions = {
  chat: [],
  community: [],
  message: [],
};

function schema(): BotDefinition {
  return {
    description:
      "This bot will perform automated moderation in your community. It will approximately enforce the OpenChat platform rules and also attempt to account for community and chat rules. If a message is found to violate the rules, you can configure the bot to either delete the message immediately or just add the reaction of your choice to the message. This is useful so that you can get a feel for how the bot behaves before you allow it to start deleting messages. In the future we can add more sophisticated responses. e.g. it will be possible to warn people one or more times before deleting their messages and to ultimately block persistent offenders.\n\nNote that this bot uses OpenAI's moderation and completiong APIs for classification. This means that message data will be sent to OpenAI so you should only trust this bot to the extent that you trust OpenAI.",
    autonomous_config: {
      permissions: Permissions.encodePermissions({
        ...emptyPermissions,
        message: ["Text"],
        chat: [
          "ReactToMessages",
          "ReadMessages",
          "ReadChatDetails",
          "DeleteMessages",
        ],
      }),
    },
    default_subscriptions: {
      community: [],
      chat: ["Message"],
    },
    commands: [
      {
        name: "resume",
        default_role: "Owner",
        description: "Resume automatic moderation of the messages in this chat",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [],
      },
      {
        name: "pause",
        default_role: "Owner",
        description: "Pause automatic moderation of the messages in this chat",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [],
      },
      {
        name: "status",
        default_role: "Owner",
        description:
          "Report whether the bot is current moderating this chat and the policy it is applying",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [],
      },
      {
        name: "configure",
        default_role: "Owner",
        description: "Update the configuration of the automated moderation",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "detection_mode",
            required: true,
            description:
              "The rules to apply to messages moderation in this chat",
            placeholder:
              "Select the rules to apply to message moderation in this chat",
            param_type: {
              StringParam: {
                min_length: 1,
                max_length: 1000,
                choices: [
                  { name: "Platform rules", value: "platform" },
                  {
                    name: "Platform rules and chat rules",
                    value: "platform_and_chat",
                  },
                ],
                multi_line: false,
              },
            },
          },
          {
            name: "consequence_mode",
            required: true,
            description: "What to do with a message that breaks the rules",
            placeholder:
              "Specify what to do with a message that breaks the rules",
            param_type: {
              StringParam: {
                min_length: 1,
                max_length: 1000,
                choices: [
                  {
                    name: "Add a special reaction to the message",
                    value: "reaction",
                  },
                  {
                    name: "Delete the message",
                    value: "deletion",
                  },
                ],
                multi_line: false,
              },
            },
          },
          {
            name: "reaction",
            required: false,
            description:
              "The reaction to add to a message that breaks the rules",
            placeholder:
              "Specify which emoji to react with to a message that breaks the rules",
            param_type: {
              StringParam: {
                min_length: 1,
                max_length: 10,
                choices: [],
                multi_line: false,
              },
            },
          },
        ],
      },
    ],
  };
}
