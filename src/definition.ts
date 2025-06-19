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
      "This bot will perform automated moderation in your community. \n\nIt can be configured to apply general purpose moderation according to [OpenAI's standard content classifications](https://platform.openai.com/docs/guides/moderation#content-classifications) and also to account for the specific rules in your groups and communities. \n\nIf a message is found to violate the rules, you can configure the bot to either delete the message immediately or just add the reaction of your choice to the message. This is useful so that you can get a feel for how the bot behaves before you allow it to start deleting messages. In the future we can add more sophisticated responses. e.g. it will be possible to warn people one or more times before deleting their messages and to ultimately block persistent offenders.\n\nNote that this bot uses OpenAI's moderation and completiong APIs for classification. This means that message data will be sent to OpenAI so you should only trust this bot to the extent that you trust OpenAI.",
    autonomous_config: {
      permissions: Permissions.encodePermissions({
        ...emptyPermissions,
        message: ["Text"],
        chat: [
          "ReactToMessages",
          "ReadMessages",
          "ReadChatSummary",
          "DeleteMessages",
        ],
        community: ["ReadCommunitySummary"],
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
        name: "rules",
        default_role: "Owner",
        description: "Update the rules used for moderating messages.",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "rules",
            required: true,
            description: "The rules used to moderate messages",
            placeholder:
              "Select the rules to use to moderate messages in this chat",
            param_type: {
              IntegerParam: {
                min_value: 0n,
                max_value: 2n,
                choices: [
                  { name: "General rules", value: 0n },
                  { name: "Chat rules", value: 1n },
                  {
                    name: "General rules and chat rules",
                    value: 2n,
                  },
                ],
              },
            },
          },
        ],
      },
      {
        name: "explanation",
        default_role: "Owner",
        description: "Define if and how the bot explains its decisions",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "explanation",
            required: true,
            description:
              "Define if and how the the bot should explain its decisions",
            placeholder:
              "What action should the bot take to explain its decisions",
            param_type: {
              IntegerParam: {
                min_value: 0n,
                max_value: 2n,
                choices: [
                  {
                    name: "No explanation",
                    value: 0n,
                  },
                  {
                    name: "Quote reply to the moderated message",
                    value: 1n,
                  },
                  {
                    name: "Thread reply to the moderated message",
                    value: 2n,
                  },
                ],
              },
            },
          },
        ],
      },
      {
        name: "action",
        default_role: "Owner",
        description:
          "Update the action the bot takes when a message violates the rules",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "action",
            required: true,
            description: "What action to take when a message breaks the rules",
            placeholder:
              "Specify what action to take when a message breaks the rules",
            param_type: {
              IntegerParam: {
                min_value: 0n,
                max_value: 1n,
                choices: [
                  {
                    name: "Add a special reaction to the message",
                    value: 0n,
                  },
                  {
                    name: "Delete the message",
                    value: 1n,
                  },
                ],
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
                max_length: 500,
                choices: [],
                multi_line: false,
              },
            },
          },
        ],
      },
      {
        name: "threshold",
        default_role: "Owner",
        description: "Set the thresholds used when applying general rules",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "threshold",
            required: true,
            description:
              "This is the category threshold above which a message will be considered unacceptable. It should be a value between 0 and 1 with 0 being the most strict and 1 being the most permissive.",
            placeholder:
              "Enter a threshold value. 0.8 is probably a good default.",
            param_type: {
              DecimalParam: {
                min_value: 0,
                max_value: 1,
                choices: [],
              },
            },
          },
        ],
      },
      {
        name: "explain",
        default_role: "Participant",
        description:
          "Provide a message ID and get an explanation of why the bot moderated the message",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [
          {
            name: "message_id",
            required: true,
            description: "The message ID of the message that was moderated",
            placeholder:
              "Enter the message ID of the message that was moderated",
            param_type: {
              StringParam: {
                min_length: 0,
                max_length: 100,
                choices: [],
                multi_line: false,
              },
            },
          },
        ],
      },
      {
        name: "help",
        default_role: "Participant",
        description:
          "Provide an overview of all the available commands that this bot supports",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [],
      },
      {
        name: "top_offenders",
        default_role: "Participant",
        description:
          "List the top 10 worst offenders in this scope by messages moderated",
        permissions: Permissions.encodePermissions(emptyPermissions),
        params: [],
      },
    ],
  };
}
