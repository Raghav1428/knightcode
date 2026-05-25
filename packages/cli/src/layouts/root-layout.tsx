import { Outlet } from "react-router";
import { DialogProvider } from "../providers/dialogs";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { PromptConfigProvider } from "../providers/prompt-config";
import { ThemeProvider } from "../providers/theme";
import { ToastProvider } from "../providers/toast";
import { TodoProvider } from "../providers/todo";
import { ThemedRoot } from "./themed-root";

export function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <KeyboardLayerProvider>
          <DialogProvider>
            <PromptConfigProvider>
              <TodoProvider>
                <ThemedRoot>
                  <Outlet />
                </ThemedRoot>
              </TodoProvider>
            </PromptConfigProvider>
          </DialogProvider>
        </KeyboardLayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
