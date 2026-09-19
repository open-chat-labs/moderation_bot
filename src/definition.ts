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

export function schema(): BotDefinition {
    return {
        description:
            "This bot checks messages in public groups and channels against your chat's own rules. In a channel it checks the community rules and the channel rules. Each line of your rules text counts as one rule.\n\nIf a message breaks a rule, the bot can either add a reaction of your choice or delete the message. Start with reactions to see how the bot behaves before you let it delete. A message can try to talk the bot out of flagging it, so deletion is not foolproof.\n\nThe bot uses TypeSafe's Jev model to score each message against each rule. Message content from public chats with rules enabled is sent to TypeSafe, so only install this bot if you are happy with that. Private chats and chats with no rules are never sent anywhere.",
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
                description: "Resume moderation in this chat",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [],
            },
            {
                name: "pause",
                default_role: "Owner",
                description: "Pause moderation in this chat",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [],
            },
            {
                name: "status",
                default_role: "Owner",
                description:
                    "Display current configuration and the rules being checked in this chat",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [],
            },
            {
                name: "explanation",
                default_role: "Owner",
                description: "Configure if and how the bot explains decisions",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
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
                description: "Configure action taken when rules are broken",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [
                    {
                        name: "action",
                        required: true,
                        description:
                            "What action to take when a message breaks the rules",
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
                description: "Configure how strictly the chat rules are applied",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [
                    {
                        name: "threshold",
                        required: true,
                        description:
                            "A message is flagged when its score against any rule is at or above this value. It should be between 0 and 1, with 0 the most strict and 1 the most permissive.",
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
                name: "report",
                default_role: "Participant",
                description: "Report a single message for automatic moderation",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    message: ["Text"],
                    chat: ["ReadMessages", "ReactToMessages", "DeleteMessages"],
                }),
                params: [
                    {
                        name: "message_url",
                        required: true,
                        description:
                            "The url of the message you are reporting. You can obtain this from the message context menu.",
                        placeholder:
                            "Enter the url of the message you are reporting",
                        param_type: {
                            StringParam: {
                                min_length: 0,
                                max_length: 1000,
                                choices: [],
                                multi_line: false,
                            },
                        },
                    },
                ],
            },
            {
                name: "explain",
                default_role: "Participant",
                description:
                    "Explain the reason for moderation on a single message",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [
                    {
                        name: "message_id",
                        required: true,
                        description:
                            "The message ID of the message that was moderated",
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
                description: "Display a summary of commands",
                permissions: Permissions.encodePermissions(emptyPermissions),
                params: [],
            },
            {
                name: "top_offenders",
                default_role: "Participant",
                description:
                    "Find out who the persistent offenders are in your chat",
                permissions: Permissions.encodePermissions({
                    ...emptyPermissions,
                    chat: ["ReadChatSummary"],
                }),
                params: [],
            },
        ],
    };
}
