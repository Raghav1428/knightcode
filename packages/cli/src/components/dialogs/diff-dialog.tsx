import { exec } from "child_process";
import { useEffect, useState } from "react";
import { useTheme } from "../../providers/theme";

export function DiffDialogContent() {
  const { colors } = useTheme();
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    exec("git diff", { cwd: process.cwd() }, (error, stdout, stderr) => {
      setDiff(stdout || stderr || "");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <box padding={1}>
        <text fg="gray">Loading diff...</text>
      </box>
    );
  }

  if (!diff || !diff.trim()) {
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
