import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";

type Props = {
  model: string;
  credits: number;
  originalMessageCount: number;
  summary: string;
};

export function CompactionMessage({
  model,
  credits,
  originalMessageCount,
  summary,
}: Props) {
  const { colors } = useTheme();

  return (
    <box width="100%" flexDirection="column" marginY={1}>
      <box
        border={["top", "bottom", "left", "right"]}
        borderColor={colors.primary}
        width="100%"
        padding={1}
        flexDirection="column"
        gap={0}
      >
        <box flexDirection="row" justifyContent="space-between" width="100%">
          <box flexDirection="row" gap={1}>
            <text fg={colors.primary} attributes={TextAttributes.BOLD}>
              ⚡ CONTEXT COMPACTED
            </text>
            <text fg={colors.dimSeparator}>•</text>
            <text fg="white">{model.replace(/:free$/, "")}</text>
          </box>
          <text fg={colors.success} attributes={TextAttributes.BOLD}>
            {credits > 0 ? `-${credits} credits` : "Free"}
          </text>
        </box>

        <box flexDirection="row" gap={1} marginTop={1}>
          <text fg={colors.dimSeparator}>Consolidated:</text>
          <text fg="white" attributes={TextAttributes.BOLD}>
            {originalMessageCount} messages
          </text>
          <text fg={colors.dimSeparator}>➔</text>
          <text fg="white" attributes={TextAttributes.BOLD}>
            5 messages (1 summary + 4 preserved)
          </text>
        </box>

        <box
          border={["top"]}
          borderColor={colors.thinkingBorder}
          marginTop={1}
          paddingTop={1}
          flexDirection="column"
          width="100%"
          gap={0}
        >
          <text fg={colors.dimSeparator} attributes={TextAttributes.BOLD} marginBottom={1}>
            ENGINEERING SUMMARY:
          </text>
          {summary.split("\n").map((line, index) => {
            const isHeader = line.startsWith("#");
            const fgColor = isHeader ? colors.primary : "white";
            const attributes = isHeader ? [TextAttributes.BOLD] : [];
            return (
              <text key={index} fg={fgColor} attributes={attributes as any}>
                {line}
              </text>
            );
          })}
        </box>
      </box>
    </box>
  );
}
