import React from "react";
import { Text, Box } from "ink";
import boxen from "boxen";
import chalk from "chalk";
import { MODEL_REGISTRY } from "../models";

const VERSION = "1.6.5";

export function getBannerText(modelId?: string): string {
  const title = chalk.hex("#E8E8E8").bold("◆  TaseesCode  ◆");
  const arabic = chalk.hex("#ABABAB")("تأسيس كود");

  let modelLine = "";
  if (modelId && MODEL_REGISTRY[modelId]) {
    const m = MODEL_REGISTRY[modelId];
    const isFree = m.inputCostSARPerMToken === 0 && m.outputCostSARPerMToken === 0;
    const costTag = isFree ? " (Free)" : m.inputCostSARPerMToken < 0.1 ? " (Low cost)" : "";
    modelLine = `\nv${VERSION}  •  ${m.name}${costTag}`;
  } else {
    modelLine = `\nv${VERSION}`;
  }

  const version = chalk.hex("#4A4A4A")(modelLine);

  return boxen(`${title}\n${arabic}\n${version}`, {
    borderStyle: "double" as any,
    borderColor: "#8B8B8B",
    padding: 1,
    textAlignment: "center" as any,
  });
}

export const Banner: React.FC<{ modelId?: string }> = ({ modelId }) => {
  return (
    <Box flexDirection="column">
      <Text>{getBannerText(modelId)}</Text>
    </Box>
  );
};
