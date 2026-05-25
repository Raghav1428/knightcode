import { spawnSync } from "child_process";
import { useTheme } from "../../providers/theme";

export function DiffDialogContent() {
  const { colors } = useTheme();

  // Run git diff
  const res = spawnSync("git", ["diff"], {
    cwd: process.cwd(),
    encoding: "utf-8",
  });

  const diff = res.stdout || res.stderr || "";

  if (!diff.trim()) {
    return (
      <box padding={1}>
        <text fg="gray">No changes found in the repository.</text>
      </box>
    );
  }

  const lines = diff.split("\n");

  return (
    <box flexDirection="column" width="100%">
      <scrollbox height={15} width="100%">
        <box flexDirection="column" gap={0} width="100%">
          {lines.map((line, idx) => {
            let fg = "white";
            if (line.startsWith("+") && !line.startsWith("+++")) {
              fg = "green";
            } else if (line.startsWith("-") && !line.startsWith("---")) {
              fg = "red";
            } else if (
              line.startsWith("@@") ||
              line.startsWith("diff") ||
              line.startsWith("index") ||
              line.startsWith("---") ||
              line.startsWith("+++")
            ) {
              fg = "yellow";
            } else {
              fg = "gray";
            }
            return (
              <text key={idx} fg={fg}>
                {line}
              </text>
            );
          })}
        </box>
      </scrollbox>
    </box>
  );
}
