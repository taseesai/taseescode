import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { Theme } from "../utils/theme";

interface MessageProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolSuccess?: boolean;
  isStreaming?: boolean;
  theme?: Theme;
}

export const Message: React.FC<MessageProps> = ({
  role,
  content,
  toolName,
  toolSuccess,
  isStreaming,
  theme,
}) => {
  const t = theme || {
    primary: '#E8E8E8',
    secondary: '#8B8B8B',
    dim: '#4A4A4A',
    success: '#5A9E6F',
    error: '#C75050',
    warning: '#C9A962',
    border: '#707070',
    userLabel: '#8B8B8B',
    assistantLabel: '#E8E8E8',
  };

  if (role === "tool") {
    const icon = toolSuccess ? "✓" : "✗";
    const color = toolSuccess ? t.success : t.error;
    const displayContent = content.length > 300 ? content.slice(0, 300) + "..." : content;
    return (
      <Box marginLeft={2} marginBottom={0}>
        <Text>
          {chalk.hex(color)(`  ${icon} ${toolName}: `)}
          {chalk.hex(t.dim)(displayContent)}
        </Text>
      </Box>
    );
  }

  if (role === "user") {
    return (
      <Box marginBottom={1} marginTop={1}>
        <Text>
          {chalk.hex(t.userLabel).bold("❯ ")}
          {content}
        </Text>
      </Box>
    );
  }

  if (role === "assistant") {
    const cursor = isStreaming ? chalk.hex(t.primary)("▊") : "";
    return (
      <Box marginBottom={1} flexDirection="column">
        <Text>
          {chalk.hex(t.assistantLabel).bold("◆ ")}
          {content}{cursor}
        </Text>
      </Box>
    );
  }

  // System messages
  return (
    <Box marginBottom={1}>
      <Text color="gray">{content}</Text>
    </Box>
  );
};
