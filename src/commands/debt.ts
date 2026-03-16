import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface DebtItem {
  type: string;
  file: string;
  line?: number;
  message: string;
  severity: "high" | "medium" | "low";
}

const DEBT_PATTERNS = [
  { name: "TODO/FIXME", pattern: /\b(TODO|FIXME|HACK|XXX|TEMP)\b/g, severity: "medium" as const },
  { name: "Any type", pattern: /:\s*any\b/g, severity: "low" as const },
  { name: "Type assertion (as any)", pattern: /as\s+any\b/g, severity: "medium" as const },
  { name: "Console.log", pattern: /console\.(log|debug|info)\s*\(/g, severity: "low" as const },
  { name: "Disabled lint", pattern: /eslint-disable|@ts-ignore|@ts-nocheck|noinspection/g, severity: "medium" as const },
  { name: "Magic number", pattern: /(?<![a-zA-Z0-9_])(?:(?:timeout|delay|interval|max|min|limit|size|count|width|height)\s*[:=]\s*)\d{3,}/g, severity: "low" as const },
  { name: "Empty catch", pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g, severity: "high" as const },
  { name: "Nested callbacks (>3)", pattern: /\)\s*=>\s*\{[^}]*\)\s*=>\s*\{[^}]*\)\s*=>\s*\{/g, severity: "high" as const },
  { name: "Long function (heuristic)", pattern: /(?:function|const\s+\w+\s*=\s*(?:async\s*)?\()/g, severity: "low" as const },
  { name: "Duplicate string literal", pattern: /(['"])[^'"]{10,}\1(?=.*\1[^'"]{10,}\1)/g, severity: "low" as const },
];

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go"];
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", ".next", "__pycache__"];

async function scanForDebt(cwd: string, _maxFiles: number = 300): Promise<DebtItem[]> {
  const items: DebtItem[] = [];

  async function walk(dir: string, depth: number = 0) {
    if (depth > 5 || items.length > 500) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const relativePath = path.relative(cwd, fullPath);
            const lines = content.split("\n");

            for (const debtPattern of DEBT_PATTERNS) {
              for (let i = 0; i < lines.length; i++) {
                if (debtPattern.pattern.test(lines[i])) {
                  debtPattern.pattern.lastIndex = 0;
                  items.push({
                    type: debtPattern.name,
                    file: relativePath,
                    line: i + 1,
                    message: lines[i].trim().slice(0, 80),
                    severity: debtPattern.severity,
                  });
                }
                debtPattern.pattern.lastIndex = 0;
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  await walk(cwd);
  return items;
}

function calculateDebtScore(items: DebtItem[], fileCount: number): number {
  // Score 0-100 (100 = no debt)
  const weights = { high: 5, medium: 2, low: 1 };
  const totalPenalty = items.reduce((sum, item) => sum + weights[item.severity], 0);
  const normalized = Math.max(0, 100 - (totalPenalty / Math.max(1, fileCount)) * 10);
  return Math.round(normalized);
}

export async function handleDebt(args: string): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("📊 Debt — Technical Debt Tracker"),
      p.gray("━".repeat(40)),
      "",
      "  /debt               Full debt scan with score",
      "  /debt report        Detailed report by category",
      "  /debt score         Quick score only (0-100)",
      "",
      "  Tracks:",
      "  • TODO/FIXME/HACK comments",
      "  • `any` type usage in TypeScript",
      "  • Disabled linting rules (@ts-ignore, eslint-disable)",
      "  • Empty catch blocks",
      "  • Deeply nested callbacks",
      "  • Console.log in production code",
      "  • Magic numbers",
      "",
      p.dim("  Lower debt = cleaner, more maintainable code."),
      "",
    ].join("\n");
  }

  const items = await scanForDebt(cwd);

  // Count files scanned
  let fileCount = 0;
  try {
    const output = execSync(
      `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.git/*" | wc -l`,
      { cwd, encoding: "utf-8", timeout: 5000 }
    );
    fileCount = parseInt(output.trim()) || 1;
  } catch { fileCount = 1; }

  const score = calculateDebtScore(items, fileCount);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const item of items) counts[item.severity]++;

  // Category breakdown
  const byType: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }

  const scoreColor = score >= 80 ? p.green : score >= 60 ? p.yellow : p.red;
  const scoreEmoji = score >= 80 ? "🟢" : score >= 60 ? "🟡" : "🔴";
  const bar = (s: number) => {
    const filled = Math.round(s / 5);
    const empty = 20 - filled;
    const c = s >= 80 ? p.green : s >= 60 ? p.yellow : p.red;
    return c("█".repeat(filled)) + p.dim("░".repeat(empty));
  };

  if (subCmd === "score") {
    return `\n  ${scoreEmoji} Debt Score: ${scoreColor.bold(score + "/100")}  ${bar(score)}\n  ${p.dim(`${items.length} issues across ${fileCount} files`)}\n`;
  }

  const lines = [
    "",
    p.white.bold("📊 Technical Debt Report"),
    p.gray("━".repeat(45)),
    "",
    `  ${scoreEmoji} Debt Score: ${scoreColor.bold(score + "/100")}  ${bar(score)}`,
    "",
    `  ${p.red(`High: ${counts.high}`)}  ${p.yellow(`Medium: ${counts.medium}`)}  ${p.dim(`Low: ${counts.low}`)}  ${p.gray(`Total: ${items.length}`)}`,
    `  ${p.dim(`Files scanned: ${fileCount}`)}`,
    "",
  ];

  // Category breakdown
  if (Object.keys(byType).length > 0) {
    lines.push(p.gray("  By Category:"));
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted) {
      const barWidth = Math.min(20, Math.round((count / Math.max(...Object.values(byType))) * 20));
      lines.push(`    ${p.dim("•")} ${p.gray(type.padEnd(22))} ${p.yellow("█".repeat(barWidth))} ${p.white(String(count))}`);
    }
    lines.push("");
  }

  // Show top issues (for /debt report show more)
  const showCount = subCmd === "report" ? 30 : 10;
  if (items.length > 0) {
    lines.push(p.gray("  Top Issues:"));
    const sorted = items.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
    for (const item of sorted.slice(0, showCount)) {
      const icon = item.severity === "high" ? p.red("🔴") : item.severity === "medium" ? p.yellow("🟡") : p.dim("⚪");
      lines.push(`    ${icon} ${p.gray(item.file)}:${p.dim(String(item.line || ""))}`);
      lines.push(`       ${p.dim(item.message)}`);
    }
    if (items.length > showCount) {
      lines.push(`\n    ${p.dim(`... and ${items.length - showCount} more. Use /debt report for full list.`)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
