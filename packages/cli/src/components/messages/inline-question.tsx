import { useCallback, useRef, useState } from "react";
import { type InputRenderable, TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useTheme } from "../../providers/theme";

type Props = {
  toolCallId: string;
  question: string;
  options: string[];
  isMultiSelect?: boolean;
  onAnswer: (toolCallId: string, answer: string | string[]) => void;
};

export function InlineQuestion({
  toolCallId,
  question,
  options,
  isMultiSelect = false,
  onAnswer,
}: Props) {
  const { colors } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [isWritingCustom, setIsWritingCustom] = useState(false);
  const customInputRef = useRef<InputRenderable>(null);

  // We append "Write custom answer..." to options list automatically
  const CUSTOM_OPTION = "Write custom answer...";
  const allOptions = [...options, CUSTOM_OPTION];

  const handleSubmittingSelections = useCallback(() => {
    if (isMultiSelect) {
      const selected = allOptions.filter((_, idx) => selectedIndices.has(idx));
      // If CUSTOM_OPTION is selected and not writing custom, we ignore it
      onAnswer(
        toolCallId,
        selected.filter((s) => s !== CUSTOM_OPTION),
      );
    } else {
      const selected = allOptions[selectedIndex];
      if (selected && selected !== CUSTOM_OPTION) {
        onAnswer(toolCallId, selected);
      }
    }
  }, [
    selectedIndex,
    selectedIndices,
    allOptions,
    isMultiSelect,
    onAnswer,
    toolCallId,
  ]);

  useKeyboard((key) => {
    if (isWritingCustom) {
      if (key.name === "escape") {
        key.preventDefault();
        setIsWritingCustom(false);
      } else if (key.name === "enter" || key.name === "return") {
        key.preventDefault();
        const customValue = customInputRef.current?.value?.trim() ?? "";
        if (customValue) {
          if (isMultiSelect) {
            // Add custom value to multi-select answers
            const currentSelected = allOptions.filter(
              (_, idx) =>
                selectedIndices.has(idx) && idx !== allOptions.length - 1,
            );
            onAnswer(toolCallId, [...currentSelected, customValue]);
          } else {
            onAnswer(toolCallId, customValue);
          }
        }
      }
      return;
    }

    if (key.name === "down" || key.name === "j") {
      key.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allOptions.length);
    } else if (key.name === "up" || key.name === "k") {
      key.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + allOptions.length) % allOptions.length,
      );
    } else if (key.name === "space") {
      key.preventDefault();
      if (isMultiSelect) {
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          if (next.has(selectedIndex)) {
            next.delete(selectedIndex);
          } else {
            next.add(selectedIndex);
          }
          return next;
        });
      }
    } else if (key.name === "enter" || key.name === "return") {
      key.preventDefault();
      const currentSelected = allOptions[selectedIndex];
      if (currentSelected === CUSTOM_OPTION) {
        setIsWritingCustom(true);
      } else {
        handleSubmittingSelections();
      }
    }
  });

  return (
    <box
      border={["top", "bottom", "left", "right"]}
      borderColor="yellow"
      padding={1}
      flexDirection="column"
      width="100%"
      gap={0}
      marginY={1}
    >
      {/* Header */}
      <box flexDirection="column" gap={0} marginBottom={1}>
        <text fg="yellow" attributes={TextAttributes.BOLD}>
          Question
        </text>
        <text fg="white" attributes={TextAttributes.BOLD}>
          {question}
        </text>
      </box>

      {/* Options List */}
      {!isWritingCustom ? (
        <box flexDirection="column" gap={0} marginY={1}>
          {allOptions.map((opt, idx) => {
            const isHighlighted = idx === selectedIndex;
            const isSelected = selectedIndices.has(idx);
            let prefix = "  ";

            if (isMultiSelect) {
              prefix = isSelected ? "[x] " : "[ ] ";
            } else {
              prefix = isHighlighted ? "● " : "○ ";
            }

            return (
              <box key={idx} flexDirection="row" gap={1}>
                <text fg={isHighlighted ? "green" : "gray"}>
                  {isHighlighted ? "> " : "  "}
                  {prefix}
                </text>
                <text
                  fg={isHighlighted ? "green" : isSelected ? "yellow" : "white"}
                  attributes={isHighlighted ? TextAttributes.BOLD : undefined}
                >
                  {opt}
                </text>
              </box>
            );
          })}
        </box>
      ) : (
        <box flexDirection="column" gap={1} marginY={1}>
          <text fg="green">Custom Answer:</text>
          <input
            ref={customInputRef}
            placeholder="Type your custom answer and press Enter..."
            focused
          />
        </box>
      )}

      {/* Help / Instructions bar */}
      <box flexDirection="row" gap={2} marginTop={1}>
        {isWritingCustom ? (
          <>
            <text fg="green">[Enter] Submit</text>
            <text fg="gray">[Esc] Cancel</text>
          </>
        ) : (
          <>
            <text fg="gray">▲▼/jk Navigate</text>
            {isMultiSelect && <text fg="gray">[Space] Select</text>}
            <text fg="green">[Enter] Confirm</text>
          </>
        )}
      </box>
    </box>
  );
}
