import {
  ImageContent,
  InstallationRegistry,
  MessageEvent,
  TextContent,
} from "@open-ic/openchat-botclient-ts";

export type ModeratableContent =
  | MessageEvent<TextContent>
  | MessageEvent<ImageContent>;

export type State = {
  installs: InstallationRegistry;
};
