import { ThemeDialogContent } from "../dialogs";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "agents",
    description: "Manage and switch AI agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select mode!",
        children: <text>Agent Selection comming soon...</text>,
      });
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.toast.show({
        message: "Closing application...",
        variant: "info",
      });

      setTimeout(() => {
        ctx.exit();
      }, 500);
    },
  },
  {
    name: "login",
    description: "Sign in to your account",
    value: "/login",
    action: (ctx) => {
      ctx.toast.show({
        message: "Opening login flow...",
        variant: "success",
      });
    },
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) => {
      ctx.toast.show({
        message: "Logging out...",
        variant: "info",
      });
    },
  },
  {
    name: "models",
    description: "View and switch AI models",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Opening model selector...",
        children: <text>Model Selection coming soon...</text>,
      });
    },
  },
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.toast.show({
        message: "Starting new conversation...",
        variant: "success",
      });
    },
  },
  {
    name: "sessions",
    description: "View and manage sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.toast.show({
        message: "Loading sessions...",
        variant: "info",
      });
    },
  },
  {
    name: "theme",
    description: "Change application theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select theme",
        children: <ThemeDialogContent />,
      });
    },
  },
  {
    name: "upgrade",
    description: "Upgrade your subscription plan",
    value: "/upgrade",
    action: (ctx) => {
      ctx.toast.show({
        message: "Opening upgrade options...",
        variant: "success",
      });
    },
  },
  {
    name: "usage",
    description: "View current usage and limits",
    value: "/usage",
    action: (ctx) => {
      ctx.toast.show({
        message: "Fetching usage statistics...",
        variant: "info",
      });
    },
  },
];
