import { useCallback, useRef, useState } from "react";
import { type InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useDialog } from "../../providers/dialogs";
import { useToast } from "../../providers/toast";
import { loadPermissions, allowCommand, savePermissions } from "../../lib/permissions";

export function AllowDialogContent() {
  const dialog = useDialog();
  const toast = useToast();
  const inputRef = useRef<InputRenderable>(null);
  const [permissions, setPermissions] = useState(() => loadPermissions());

  const handleAdd = useCallback(() => {
    const text = inputRef.current?.value?.trim() ?? "";
    if (!text) {
      toast.show({ variant: "error", message: "Command pattern cannot be empty" });
      return;
    }

    try {
      allowCommand(text);
      setPermissions(loadPermissions());
      if (inputRef.current) {
        // Clear input value
        inputRef.current.value = "";
      }
      toast.show({ variant: "success", message: `Allowed command prefix: "${text}"` });
    } catch (err) {
      toast.show({ variant: "error", message: `Failed to add command: ${(err as Error).message}` });
    }
  }, [toast]);

  const handleDelete = useCallback((indexToDelete: number) => {
    try {
      const updated = {
        allowedCommands: permissions.allowedCommands.filter((_, idx) => idx !== indexToDelete),
      };
      savePermissions(updated);
      setPermissions(updated);
      toast.show({ variant: "success", message: "Removed command from allowlist" });
    } catch (err) {
      toast.show({ variant: "error", message: "Failed to remove command" });
    }
  }, [permissions, toast]);

  useKeyboard((key) => {
    if (key.name === "enter" || key.name === "return") {
      key.preventDefault();
      handleAdd();
    }
  });

  return (
    <box flexDirection="column" gap={1} width="100%">
      <text>Allowed Command prefixes (will skip prompt):</text>
      
      {permissions.allowedCommands.length === 0 ? (
        <text fg="gray">  No allowed commands yet.</text>
      ) : (
        <box flexDirection="column" gap={0} marginY={1}>
          {permissions.allowedCommands.map((cmd, idx) => (
            <box key={idx} flexDirection="row" gap={2}>
              <text fg="green">• {cmd}</text>
              <text fg="red" onMouseDown={() => handleDelete(idx)}>
                [Remove]
              </text>
            </box>
          ))}
        </box>
      )}

      <text>Type a new command prefix to allow (e.g. "bun test"):</text>
      <input
        ref={inputRef}
        placeholder="e.g. bun test"
        focused
      />
      <box flexDirection="row" gap={2} marginTop={1}>
        <text fg="green">[Enter] Add</text>
        <text fg="gray">[Esc] Close</text>
      </box>
    </box>
  );
}
