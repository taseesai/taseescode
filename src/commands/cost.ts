import chalk from "chalk";
import { getSessionCost, formatCostSAR } from "../utils/cost";

export function costCommand(): string {
  const cost = getSessionCost();
  let output = `\n${chalk.hex("#E8E8E8").bold("Session Cost")}\n${chalk.hex("#8B8B8B")("─".repeat(35))}\n`;
  output += `  Input tokens:  ${cost.inputTokens.toLocaleString()}\n`;
  output += `  Output tokens: ${cost.outputTokens.toLocaleString()}\n`;
  output += `  ${chalk.hex("#E8E8E8").bold(`Total: ${formatCostSAR(cost.totalCostSAR)}`)}\n`;

  if (cost.breakdown.length > 0) {
    output += `\n  ${chalk.hex("#707070")("Breakdown:")}\n`;
    for (const entry of cost.breakdown) {
      output += `    ${entry.model}: ${formatCostSAR(entry.costSAR)}\n`;
    }
  }

  return output;
}
