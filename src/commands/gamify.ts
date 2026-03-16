import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { getConfigDir } from "../utils/config";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
  cyan: chalk.hex("#7AC8C8"),
  gold: chalk.hex("#FFD700"),
};

interface PlayerStats {
  xp: number;
  level: number;
  streak: number; // consecutive days coding
  lastActiveDate: string;
  totalMessages: number;
  totalToolCalls: number;
  filesCreated: number;
  filesEdited: number;
  bugsFixed: number;
  testsGenerated: number;
  deploysShipped: number;
  codeReviews: number;
  achievements: string[];
}

interface Achievement {
  id: string;
  name: string;
  nameAr: string;
  desc: string;
  icon: string;
  xpReward: number;
  condition: (stats: PlayerStats) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_message", name: "Hello World", nameAr: "مرحبا بالعالم", desc: "Send your first message", icon: "🌟", xpReward: 10, condition: s => s.totalMessages >= 1 },
  { id: "ten_messages", name: "Getting Started", nameAr: "البداية", desc: "Send 10 messages", icon: "💬", xpReward: 25, condition: s => s.totalMessages >= 10 },
  { id: "hundred_messages", name: "Power User", nameAr: "مستخدم متقدم", desc: "Send 100 messages", icon: "⚡", xpReward: 100, condition: s => s.totalMessages >= 100 },
  { id: "first_file", name: "Creator", nameAr: "المبدع", desc: "Create your first file", icon: "📄", xpReward: 15, condition: s => s.filesCreated >= 1 },
  { id: "ten_files", name: "Architect", nameAr: "المهندس", desc: "Create 10 files", icon: "🏗️", xpReward: 50, condition: s => s.filesCreated >= 10 },
  { id: "first_fix", name: "Bug Squasher", nameAr: "صائد الأخطاء", desc: "Fix your first bug with /fix", icon: "🐛", xpReward: 20, condition: s => s.bugsFixed >= 1 },
  { id: "ten_fixes", name: "Exterminator", nameAr: "المبيد", desc: "Fix 10 bugs", icon: "🔫", xpReward: 75, condition: s => s.bugsFixed >= 10 },
  { id: "first_deploy", name: "Shipped It!", nameAr: "تم الإطلاق!", desc: "Deploy your first project", icon: "🚀", xpReward: 50, condition: s => s.deploysShipped >= 1 },
  { id: "first_review", name: "Reviewer", nameAr: "المراجع", desc: "Review code with /review", icon: "🔍", xpReward: 20, condition: s => s.codeReviews >= 1 },
  { id: "first_test", name: "Tester", nameAr: "المختبر", desc: "Generate tests with /test-gen", icon: "🧪", xpReward: 25, condition: s => s.testsGenerated >= 1 },
  { id: "streak_3", name: "On a Roll", nameAr: "في سلسلة", desc: "3-day coding streak", icon: "🔥", xpReward: 30, condition: s => s.streak >= 3 },
  { id: "streak_7", name: "Weekly Warrior", nameAr: "محارب الأسبوع", desc: "7-day coding streak", icon: "⚔️", xpReward: 75, condition: s => s.streak >= 7 },
  { id: "streak_30", name: "Monthly Legend", nameAr: "أسطورة الشهر", desc: "30-day coding streak", icon: "👑", xpReward: 200, condition: s => s.streak >= 30 },
  { id: "tools_50", name: "Tool Master", nameAr: "سيد الأدوات", desc: "Use 50 tool calls", icon: "🛠️", xpReward: 50, condition: s => s.totalToolCalls >= 50 },
  { id: "level_5", name: "Intermediate", nameAr: "متوسط", desc: "Reach level 5", icon: "📈", xpReward: 0, condition: s => s.level >= 5 },
  { id: "level_10", name: "Advanced", nameAr: "متقدم", desc: "Reach level 10", icon: "🎯", xpReward: 0, condition: s => s.level >= 10 },
  { id: "level_25", name: "Expert", nameAr: "خبير", desc: "Reach level 25", icon: "💎", xpReward: 0, condition: s => s.level >= 25 },
  { id: "level_50", name: "Master", nameAr: "أستاذ", desc: "Reach level 50", icon: "🏆", xpReward: 0, condition: s => s.level >= 50 },
];

function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

function getLevelTitle(level: number): { en: string; ar: string } {
  if (level >= 50) return { en: "Master", ar: "أستاذ" };
  if (level >= 25) return { en: "Expert", ar: "خبير" };
  if (level >= 15) return { en: "Senior", ar: "كبير" };
  if (level >= 10) return { en: "Advanced", ar: "متقدم" };
  if (level >= 5) return { en: "Intermediate", ar: "متوسط" };
  return { en: "Beginner", ar: "مبتدئ" };
}

function getStatsPath(): string {
  return path.join(getConfigDir(), "gamify.json");
}

async function loadStats(): Promise<PlayerStats> {
  const statsPath = getStatsPath();
  if (await fs.pathExists(statsPath)) {
    return fs.readJSON(statsPath);
  }
  return {
    xp: 0, level: 1, streak: 0, lastActiveDate: "",
    totalMessages: 0, totalToolCalls: 0, filesCreated: 0,
    filesEdited: 0, bugsFixed: 0, testsGenerated: 0,
    deploysShipped: 0, codeReviews: 0, achievements: [],
  };
}

async function saveStats(stats: PlayerStats): Promise<void> {
  await fs.writeJSON(getStatsPath(), stats, { spaces: 2 });
}

function addXP(stats: PlayerStats, amount: number): string[] {
  stats.xp += amount;
  const newAchievements: string[] = [];

  // Level up check
  while (stats.xp >= getXPForLevel(stats.level + 1)) {
    stats.level++;
  }

  // Streak check
  const today = new Date().toISOString().split("T")[0];
  if (stats.lastActiveDate) {
    const lastDate = new Date(stats.lastActiveDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 1) {
      stats.streak++;
    } else if (diffDays > 1) {
      stats.streak = 1;
    }
  } else {
    stats.streak = 1;
  }
  stats.lastActiveDate = today;

  // Check achievements
  for (const ach of ACHIEVEMENTS) {
    if (!stats.achievements.includes(ach.id) && ach.condition(stats)) {
      stats.achievements.push(ach.id);
      stats.xp += ach.xpReward;
      newAchievements.push(`${ach.icon} ${ach.name} — ${ach.desc} (+${ach.xpReward} XP)`);
    }
  }

  return newAchievements;
}

// Called by other commands to track activity
export async function trackEvent(event: "message" | "tool_call" | "file_created" | "file_edited" | "bug_fixed" | "test_generated" | "deployed" | "code_review"): Promise<string[]> {
  const stats = await loadStats();

  switch (event) {
    case "message": stats.totalMessages++; break;
    case "tool_call": stats.totalToolCalls++; break;
    case "file_created": stats.filesCreated++; break;
    case "file_edited": stats.filesEdited++; break;
    case "bug_fixed": stats.bugsFixed++; break;
    case "test_generated": stats.testsGenerated++; break;
    case "deployed": stats.deploysShipped++; break;
    case "code_review": stats.codeReviews++; break;
  }

  const xpAmounts: Record<string, number> = {
    message: 2, tool_call: 3, file_created: 10, file_edited: 5,
    bug_fixed: 15, test_generated: 20, deployed: 25, code_review: 10,
  };

  const newAchievements = addXP(stats, xpAmounts[event] || 1);
  await saveStats(stats);
  return newAchievements;
}

export async function handleGamify(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();
  const stats = await loadStats();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("🎮 Gamify — Developer XP & Achievements"),
      p.gray("━".repeat(40)),
      "",
      "  /gamify              Show your stats & level",
      "  /gamify achievements List all achievements",
      "  /gamify leaderboard  View leaderboard (coming soon)",
      "  /gamify reset        Reset all stats",
      "",
      p.white("  How XP works:"),
      "  • Send messages:     +2 XP each",
      "  • Use tools:         +3 XP each",
      "  • Create files:      +10 XP each",
      "  • Fix bugs:          +15 XP each",
      "  • Generate tests:    +20 XP each",
      "  • Deploy:            +25 XP each",
      "",
      p.dim("  XP is tracked automatically. Just keep coding!"),
      "",
    ].join("\n");
  }

  if (subCmd === "reset") {
    const statsPath = getStatsPath();
    if (await fs.pathExists(statsPath)) {
      await fs.remove(statsPath);
      return p.green("✅ Stats reset. Starting fresh!").toString();
    }
    return "No stats to reset.";
  }

  if (subCmd === "achievements" || subCmd === "ach") {
    const lines = [
      "",
      p.white.bold("🏆 Achievements"),
      p.gray("━".repeat(40)),
      "",
    ];
    for (const ach of ACHIEVEMENTS) {
      const unlocked = stats.achievements.includes(ach.id);
      const icon = unlocked ? ach.icon : "🔒";
      const name = unlocked ? p.white(ach.name) : p.dim(ach.name);
      const reward = ach.xpReward > 0 ? p.dim(` +${ach.xpReward} XP`) : "";
      lines.push(`  ${icon} ${name} — ${p.dim(ach.desc)}${reward}`);
    }
    lines.push(
      "",
      `  ${p.gray("Unlocked:")} ${stats.achievements.length}/${ACHIEVEMENTS.length}`,
      "",
    );
    return lines.join("\n");
  }

  // Default: show stats
  const title = getLevelTitle(stats.level);
  const nextLevelXP = getXPForLevel(stats.level + 1);
  const progress = Math.min(100, Math.round((stats.xp / nextLevelXP) * 100));
  const barFilled = Math.round(progress / 5);
  const barEmpty = 20 - barFilled;
  const progressBar = p.green("█".repeat(barFilled)) + p.dim("░".repeat(barEmpty));

  return [
    "",
    p.white.bold(`🎮 Level ${stats.level} — ${title.en} (${title.ar})`),
    p.gray("━".repeat(40)),
    "",
    `  XP: ${p.white(String(stats.xp))} / ${p.dim(String(nextLevelXP))}  ${progressBar} ${p.dim(progress + "%")}`,
    "",
    `  🔥 Streak: ${stats.streak > 0 ? p.yellow(stats.streak + " days") : p.dim("0 days")}`,
    "",
    p.gray("  Activity:"),
    `    ${p.dim("Messages:")}     ${p.white(String(stats.totalMessages))}`,
    `    ${p.dim("Tool calls:")}   ${p.white(String(stats.totalToolCalls))}`,
    `    ${p.dim("Files created:")} ${p.white(String(stats.filesCreated))}`,
    `    ${p.dim("Bugs fixed:")}   ${p.white(String(stats.bugsFixed))}`,
    `    ${p.dim("Tests gen:")}    ${p.white(String(stats.testsGenerated))}`,
    `    ${p.dim("Deploys:")}      ${p.white(String(stats.deploysShipped))}`,
    `    ${p.dim("Reviews:")}      ${p.white(String(stats.codeReviews))}`,
    "",
    `  🏆 Achievements: ${stats.achievements.length}/${ACHIEVEMENTS.length}`,
    `     ${stats.achievements.slice(-3).map(id => ACHIEVEMENTS.find(a => a.id === id)?.icon || "").join(" ")}`,
    "",
    p.dim("  /gamify achievements — view all"),
    "",
  ].join("\n");
}
