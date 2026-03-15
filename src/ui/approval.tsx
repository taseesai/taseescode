import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";

interface ApprovalProps {
  toolName: string;
  args: Record<string, unknown>;
  onDecision: (approved: boolean) => void;
}

export const Approval: React.FC<ApprovalProps> = ({
  toolName,
  args,
  onDecision,
}) => {
  const [decided, setDecided] = useState(false);

  useInput((input) => {
    if (decided) return;
    if (input === "y" || input === "Y") {
      setDecided(true);
      onDecision(true);
    } else if (input === "n" || input === "N") {
      setDecided(true);
      onDecision(false);
    }
  }, { isActive: !decided });

  const argsDisplay = Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "..." : String(v);
      return `    ${k}: ${val}`;
    })
    .join("\n");

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        {chalk.hex("#E8E8E8").bold(`⚡ ${toolName}`)}
      </Text>
      <Text>{chalk.hex("#707070")(argsDisplay)}</Text>
      <Text>
        {chalk.hex("#ABABAB")("  Allow? ")}
        {chalk.hex("#4A9")("[y]")}
        {chalk.hex("#707070")("/")}
        {chalk.hex("#E44")("[n]")}
      </Text>
    </Box>
  );
};
