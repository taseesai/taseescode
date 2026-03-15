import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

interface MessageProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolSuccess?: boolean;
}

export const Message: React.FC<MessageProps> = ({
  role,
  content,
  toolName,
  toolSuccess,
}) => {
  if (role === "tool") {
    const icon = toolSuccess ? "✓" : "✗";
    const color = toolSuccess ? "#4A9" : "#E44";
    return (
      <Box marginLeft={2} marginBottom={1}>
        <Text>
          {chalk.hex(color)(`  ${icon} ${toolName}: `)}
          {chalk.hex("#707070")(
            content.length > 200 ? content.slice(0, 200) + "..." : content
          )}
        </Text>
      </Box>
    );
  }

  if (role === "user") {
    return (
      <Box marginBottom={1}>
        <Text>
          {chalk.hex("#8B8B8B")("You: ")}
          {content}
        </Text>
      </Box>
    );
  }

  if (role === "assistant") {
    return (
      <Box marginBottom={1} flexDirection="column">
        <Text>
          {chalk.hex("#E8E8E8").bold("TaseesCode: ")}
          {content}
        </Text>
      </Box>
    );
  }

  return (
    <Box marginBottom={1}>
      <Text color="gray">{content}</Text>
    </Box>
  );
};
