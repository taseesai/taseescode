import chalk from "chalk";
import { getConfig, setConfig } from "../utils/config";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface TrustScore {
  overall: number;
  factors: Array<{ name: string; score: number; reason: string }>;
}

let lastResponseInfo: { text: string; usedTools: boolean; toolCount: number; questionLength: number } | null = null;

export function setLastResponse(text: string, usedTools: boolean, toolCount: number, questionLength: number): void {
  lastResponseInfo = { text, usedTools, toolCount, questionLength };
}

export function analyzeConfidence(
  response: string,
  usedTools: boolean,
  toolCount: number,
  questionLength: number
): TrustScore {
  const factors: Array<{ name: string; score: number; reason: string }> = [];

  // Factor 1: Code presence
  const codeBlocks = (response.match(/```/g) || []).length / 2;
  if (codeBlocks > 0) {
    factors.push({ name: "Code provided", score: 85, reason: `${codeBlocks} code block(s) included` });
  } else {
    factors.push({ name: "Code provided", score: 50, reason: "No code blocks in response" });
  }

  // Factor 2: Tool usage (grounded in real data)
  if (usedTools) {
    const toolScore = Math.min(95, 70 + toolCount * 8);
    factors.push({ name: "Grounded in data", score: toolScore, reason: `Used ${toolCount} tool(s) to verify` });
  } else {
    factors.push({ name: "Grounded in data", score: 40, reason: "No tools used \u2014 response from memory only" });
  }

  // Factor 3: Hedging language
  const hedges = ["i think", "might", "probably", "perhaps", "not sure", "may be", "could be", "i believe", "possibly"];
  const hedgeCount = hedges.filter(h => response.toLowerCase().includes(h)).length;
  if (hedgeCount === 0) {
    factors.push({ name: "Certainty", score: 85, reason: "No hedging language detected" });
  } else {
    factors.push({ name: "Certainty", score: Math.max(30, 80 - hedgeCount * 15), reason: `${hedgeCount} uncertain phrase(s)` });
  }

  // Factor 4: Specificity
  const hasFilePaths = /\/[\w\-.\/]+\.\w+/.test(response);
  const hasLineNumbers = /line \d+|:\d+/.test(response);
  const hasCommands = /```(bash|sh|shell|terminal)/i.test(response);
  let specScore = 50;
  if (hasFilePaths) specScore += 15;
  if (hasLineNumbers) specScore += 10;
  if (hasCommands) specScore += 10;
  factors.push({ name: "Specificity", score: Math.min(95, specScore), reason: `${hasFilePaths ? "File paths" : ""} ${hasLineNumbers ? "Line refs" : ""} ${hasCommands ? "Commands" : ""}`.trim() || "Generic response" });

  // Factor 5: Response completeness
  const responseWords = response.split(/\s+/).length;
  const questionWords = questionLength;
  const ratio = responseWords / Math.max(1, questionWords);
  let completeness = 60;
  if (ratio > 3) completeness = 80;
  if (ratio > 8) completeness = 90;
  if (ratio < 1.5 && questionWords > 20) completeness = 40;
  factors.push({ name: "Completeness", score: completeness, reason: `${responseWords} words (${ratio.toFixed(1)}x question length)` });

  // Overall: weighted average
  const weights = [0.2, 0.3, 0.15, 0.2, 0.15]; // tool usage weighted highest
  const overall = Math.round(
    factors.reduce((sum, f, i) => sum + f.score * weights[i], 0)
  );

  return { overall, factors };
}

export function formatTrustScore(score: TrustScore): string {
  const color = score.overall >= 80 ? p.green : score.overall >= 60 ? p.yellow : p.red;
  const badge = score.overall >= 80 ? "HIGH" : score.overall >= 60 ? "MEDIUM" : "LOW";
  const bar = (s: number): string => {
    const filled = Math.round(s / 5);
    const empty = 20 - filled;
    const c = s >= 80 ? p.green : s >= 60 ? p.yellow : p.red;
    return c("\u2588".repeat(filled)) + p.dim("\u2591".repeat(empty));
  };

  const lines = [
    "",
    p.white.bold("Trust Score"),
    p.gray("\u2501".repeat(40)),
    "",
    `  ${color.bold(`${score.overall}%`)} ${badge}  ${bar(score.overall)}`,
    "",
  ];

  for (const f of score.factors) {
    lines.push(`  ${p.gray(f.name.padEnd(18))} ${bar(f.score)} ${p.dim(f.reason)}`);
  }

  lines.push(
    "",
    p.dim("  Tip: Responses that use tools (read files, search) score higher."),
    p.dim("  Toggle auto-verify: /trust auto on|off"),
    "",
  );

  return lines.join("\n");
}

export async function handleTrust(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("Trust \u2014 AI Confidence Scoring"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /trust              Show score for last response",
      "  /trust auto on      Auto-verify low-confidence responses",
      "  /trust auto off     Disable auto-verification",
      "",
      "  Scores are based on:",
      "  - Tool usage (grounded in real data)",
      "  - Code presence",
      "  - Specificity (file paths, line numbers)",
      "  - Hedging language detection",
      "  - Response completeness",
      "",
      p.dim("  When auto-verify is on, responses below 70% are"),
      p.dim("  automatically re-checked with a second model pass."),
      "",
    ].join("\n");
  }

  if (!subCmd) {
    if (!lastResponseInfo) {
      return p.yellow("No response to score yet. Chat with TaseesCode first, then run /trust.").toString();
    }
    const score = analyzeConfidence(
      lastResponseInfo.text,
      lastResponseInfo.usedTools,
      lastResponseInfo.toolCount,
      lastResponseInfo.questionLength,
    );
    return formatTrustScore(score);
  }

  if (subCmd === "auto on") {
    setConfig("trustAutoVerify", true);
    return p.green("Auto-verification enabled. Low-confidence responses will be re-checked.").toString();
  }

  if (subCmd === "auto off") {
    setConfig("trustAutoVerify", false);
    return p.green("Auto-verification disabled.").toString();
  }

  return "Usage: /trust, /trust auto on, /trust auto off";
}
