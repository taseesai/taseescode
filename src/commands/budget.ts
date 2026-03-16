import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { getSessionCost, formatCostSAR } from "../utils/cost";
import { getConfigDir } from "../utils/config";
import { MODEL_REGISTRY } from "../models";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface BudgetData {
  dailyLimitSAR: number | null;
  weeklyLimitSAR: number | null;
  monthlyLimitSAR: number | null;
  history: Array<{ date: string; costSAR: number; model: string; tokens: number }>;
}

function getBudgetPath(): string {
  return path.join(getConfigDir(), "budget.json");
}

async function loadBudget(): Promise<BudgetData> {
  const budgetPath = getBudgetPath();
  if (await fs.pathExists(budgetPath)) {
    return fs.readJSON(budgetPath);
  }
  return { dailyLimitSAR: null, weeklyLimitSAR: null, monthlyLimitSAR: null, history: [] };
}

async function saveBudget(data: BudgetData): Promise<void> {
  await fs.writeJSON(getBudgetPath(), data, { spaces: 2 });
}

export async function recordSpend(costSAR: number, model: string, tokens: number): Promise<void> {
  const budget = await loadBudget();
  budget.history.push({
    date: new Date().toISOString(),
    costSAR,
    model,
    tokens,
  });
  // Keep last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  budget.history = budget.history.filter(h => new Date(h.date) > cutoff);
  await saveBudget(budget);
}

export function checkBudgetWarning(): string | null {
  // This is called after each API call to warn about limits
  // Returns warning message or null
  // Implementation needs to be sync for performance, so we cache budget data
  return null; // Placeholder - async version below
}

export async function checkBudgetWarningAsync(): Promise<string | null> {
  const budget = await loadBudget();
  const session = getSessionCost();

  const today = new Date().toISOString().split("T")[0];
  const todaySpend = budget.history
    .filter(h => h.date.startsWith(today))
    .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSpend = budget.history
    .filter(h => new Date(h.date) > weekAgo)
    .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthSpend = budget.history
    .filter(h => new Date(h.date) > monthStart)
    .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

  const warnings: string[] = [];

  if (budget.dailyLimitSAR && todaySpend > budget.dailyLimitSAR * 0.8) {
    const pct = (todaySpend / budget.dailyLimitSAR * 100).toFixed(0);
    warnings.push(`Daily budget ${pct}% used (${formatCostSAR(todaySpend)}/${formatCostSAR(budget.dailyLimitSAR)})`);
  }
  if (budget.weeklyLimitSAR && weekSpend > budget.weeklyLimitSAR * 0.8) {
    const pct = (weekSpend / budget.weeklyLimitSAR * 100).toFixed(0);
    warnings.push(`Weekly budget ${pct}% used (${formatCostSAR(weekSpend)}/${formatCostSAR(budget.weeklyLimitSAR)})`);
  }
  if (budget.monthlyLimitSAR && monthSpend > budget.monthlyLimitSAR * 0.8) {
    const pct = (monthSpend / budget.monthlyLimitSAR * 100).toFixed(0);
    warnings.push(`Monthly budget ${pct}% used (${formatCostSAR(monthSpend)}/${formatCostSAR(budget.monthlyLimitSAR)})`);
  }

  if (warnings.length > 0) {
    const suggestion = "Consider switching to a cheaper model: /model deepseek-v3 or /model llama-3.3-70b (free)";
    return p.yellow(`⚠ ${warnings.join(" | ")}\n  ${suggestion}`).toString();
  }

  return null;
}

export async function handleBudget(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const subCmd = parts[0]?.toLowerCase() || "";
  const budget = await loadBudget();

  // /budget — show current status
  if (!subCmd || subCmd === "show") {
    const session = getSessionCost();
    const today = new Date().toISOString().split("T")[0];
    const todaySpend = budget.history
      .filter(h => h.date.startsWith(today))
      .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekSpend = budget.history
      .filter(h => new Date(h.date) > weekAgo)
      .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthSpend = budget.history
      .filter(h => new Date(h.date) > monthStart)
      .reduce((sum, h) => sum + h.costSAR, 0) + session.totalCostSAR;

    // Spend by model
    const modelSpend: Record<string, number> = {};
    for (const h of budget.history) {
      modelSpend[h.model] = (modelSpend[h.model] || 0) + h.costSAR;
    }

    // Predict monthly
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const predictedMonthly = dayOfMonth > 0 ? (monthSpend / dayOfMonth) * daysInMonth : 0;

    const bar = (spent: number, limit: number | null): string => {
      if (!limit) return p.dim("no limit set").toString();
      const pct = Math.min(100, (spent / limit) * 100);
      const filled = Math.round(pct / 5);
      const empty = 20 - filled;
      const color = pct > 90 ? p.red : pct > 70 ? p.yellow : p.green;
      return color("\u2588".repeat(filled)).toString() + p.dim("\u2591".repeat(empty)).toString() + ` ${pct.toFixed(0)}%`;
    };

    const lines = [
      "",
      p.white.bold("Budget & Cost Dashboard"),
      p.gray("\u2501".repeat(45)),
      "",
      p.gray("  Today:      ") + p.white(formatCostSAR(todaySpend)) + "  " + bar(todaySpend, budget.dailyLimitSAR),
      p.gray("  This Week:  ") + p.white(formatCostSAR(weekSpend)) + "  " + bar(weekSpend, budget.weeklyLimitSAR),
      p.gray("  This Month: ") + p.white(formatCostSAR(monthSpend)) + "  " + bar(monthSpend, budget.monthlyLimitSAR),
      "",
      p.gray("  Predicted Monthly: ") + p.white(formatCostSAR(predictedMonthly)),
      p.gray("  Session Cost:      ") + p.white(formatCostSAR(session.totalCostSAR)),
    ];

    if (Object.keys(modelSpend).length > 0) {
      lines.push("", p.gray("  Spend by Model:"));
      const sorted = Object.entries(modelSpend).sort((a, b) => b[1] - a[1]);
      for (const [model, cost] of sorted.slice(0, 5)) {
        const name = MODEL_REGISTRY[model]?.name || model;
        lines.push(`    ${p.dim("\u2022")} ${p.gray(name.padEnd(20))} ${p.white(formatCostSAR(cost))}`);
      }
    }

    lines.push(
      "",
      p.dim("  Set limits:"),
      p.dim("    /budget daily 5       Set daily limit to 5 SAR"),
      p.dim("    /budget weekly 20     Set weekly limit to 20 SAR"),
      p.dim("    /budget monthly 50    Set monthly limit to 50 SAR"),
      p.dim("    /budget clear         Remove all limits"),
      "",
    );

    return lines.join("\n");
  }

  // /budget daily|weekly|monthly <amount>
  if (["daily", "weekly", "monthly"].includes(subCmd)) {
    const amount = parseFloat(parts[1]);
    if (isNaN(amount) || amount <= 0) {
      return p.red(`Invalid amount. Usage: /budget ${subCmd} <amount in SAR>`).toString();
    }
    if (subCmd === "daily") budget.dailyLimitSAR = amount;
    if (subCmd === "weekly") budget.weeklyLimitSAR = amount;
    if (subCmd === "monthly") budget.monthlyLimitSAR = amount;
    await saveBudget(budget);
    return p.green(`${subCmd.charAt(0).toUpperCase() + subCmd.slice(1)} limit set to ${amount} SAR`).toString();
  }

  // /budget clear
  if (subCmd === "clear") {
    budget.dailyLimitSAR = null;
    budget.weeklyLimitSAR = null;
    budget.monthlyLimitSAR = null;
    await saveBudget(budget);
    return p.green("All budget limits cleared").toString();
  }

  return `Unknown budget command: ${subCmd}\nUse /budget for usage info.`;
}
