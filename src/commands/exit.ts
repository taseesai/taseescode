import chalk from "chalk";
import { getSessionCost, formatCostSAR } from "../utils/cost";

export function exitCommand(): string {
  const cost = getSessionCost();
  return `\n${chalk.hex("#8B8B8B")("Session cost:")} ${formatCostSAR(cost.totalCostSAR)}\n${chalk.hex("#707070")("مع السلامة! 👋")}\n`;
}
