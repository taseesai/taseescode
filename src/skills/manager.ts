import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import axios from "axios";
import { getConfigDir } from "../utils/config";

const c = {
  white:  chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray:   chalk.hex("#8B8B8B"),
  dim:    chalk.hex("#4A4A4A"),
  green:  chalk.hex("#7ACC7A"),
  red:    chalk.hex("#E87B7B"),
  yellow: chalk.hex("#E8C56B"),
};

// Official TaseesCode skills registry on GitHub
// Skills live at: github.com/taseesai/taseescode-skills/tree/main/skills/<name>/
const REGISTRY_BASE = "https://raw.githubusercontent.com/taseesai/taseescode-skills/main/skills";
const REGISTRY_INDEX = "https://raw.githubusercontent.com/taseesai/taseescode-skills/main/index.json";

// Parse any of these formats:
//   react-expert                         → official registry
//   username/repo                        → github shorthand (root of repo)
//   username/repo/path/to/skill          → github shorthand (subfolder)
//   https://github.com/user/repo         → full github URL (root)
//   https://github.com/user/repo/tree/main/path  → full github URL (subfolder)
//   https://raw.githubusercontent.com/... → raw URL (direct)
function parseSkillSource(input: string): { type: "registry" | "github"; rawBase: string; name: string } {

  // Full raw.githubusercontent.com URL — use directly
  if (input.startsWith("https://raw.githubusercontent.com/")) {
    const name = input.split("/").filter(Boolean).pop() || "skill";
    return { type: "github", rawBase: input.replace(/\/$/, ""), name };
  }

  // Full github.com URL
  if (input.startsWith("https://github.com/") || input.startsWith("http://github.com/")) {
    // https://github.com/user/repo  →  raw: https://raw.githubusercontent.com/user/repo/main
    // https://github.com/user/repo/tree/main/path  →  raw: .../user/repo/main/path
    const withoutProtocol = input.replace(/^https?:\/\/github\.com\//, "");
    const parts = withoutProtocol.split("/");
    const user = parts[0];
    const repo = parts[1];
    // parts[2] = "tree", parts[3] = branch, parts[4+] = subpath
    const hasBranch = parts[2] === "tree";
    const branch = hasBranch ? parts[3] : "main";
    const subpath = hasBranch ? parts.slice(4).join("/") : parts.slice(2).join("/");
    const name = subpath ? subpath.split("/").pop() || repo : repo;
    const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}${subpath ? "/" + subpath : ""}`;
    return { type: "github", rawBase: rawBase.replace(/\/$/, ""), name };
  }

  // Shorthand: user/repo or user/repo/path
  if (input.includes("/")) {
    const parts = input.split("/");
    const user = parts[0];
    const repo = parts[1];
    const subpath = parts.slice(2).join("/");
    const name = subpath ? subpath.split("/").pop() || repo : repo;
    const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/main${subpath ? "/" + subpath : ""}`;
    return { type: "github", rawBase: rawBase.replace(/\/$/, ""), name };
  }

  // Official registry name
  return {
    type: "registry",
    rawBase: `${REGISTRY_BASE}/${input}`,
    name: input,
  };
}

export async function installSkill(input: string): Promise<string> {
  const source = parseSkillSource(input);
  const skillsDir = path.join(getConfigDir(), "skills");
  const skillDir = path.join(skillsDir, source.name);

  // Check if already installed
  if (await fs.pathExists(path.join(skillDir, "skill.json"))) {
    return [
      c.yellow(`⚠️  Skill "${source.name}" is already installed.`),
      c.dim(`   To update it: /skills update ${source.name}`),
      c.dim(`   To remove it: /skills remove ${source.name}`),
    ].join("\n");
  }

  const lines: string[] = [];
  lines.push(`\n${c.silver("◆")} Installing ${c.white.bold(source.name)}...`);
  lines.push(c.dim(`  Source: ${input}`));

  // 1. Fetch skill.json
  const skillJsonUrl = `${source.rawBase}/skill.json`;
  let skillJson: Record<string, unknown>;

  try {
    lines.push(c.dim(`  Fetching: ${skillJsonUrl}`));
    const resp = await axios.get(skillJsonUrl, { timeout: 10000 });
    skillJson = resp.data;
  } catch (err: unknown) {
    const is404 = axios.isAxiosError(err) && err.response?.status === 404;
    if (is404) {
      return [
        c.red(`❌ Skill "${source.name}" not found.`),
        "",
        c.dim("  If this is an official skill, it may not exist yet."),
        c.dim("  Browse available skills at:"),
        c.white("  github.com/taseesai/taseescode-skills"),
        "",
        c.dim("  To install from a custom GitHub repo:"),
        c.white("  /skills install username/repo-name"),
        "",
      ].join("\n");
    }
    const msg = err instanceof Error ? err.message : String(err);
    return c.red(`❌ Failed to fetch skill: ${msg}`);
  }

  // Validate skill.json has required fields
  const required = ["name", "version", "description"];
  for (const field of required) {
    if (!skillJson[field]) {
      return c.red(`❌ Invalid skill.json — missing field: ${field}`);
    }
  }

  // 2. Create skill directory
  await fs.ensureDir(skillDir);

  // 3. Save skill.json
  await fs.writeJson(path.join(skillDir, "skill.json"), skillJson, { spaces: 2 });

  // 4. Fetch optional files listed in skill.json
  const extraFiles = (skillJson.files as string[]) || [];
  for (const file of extraFiles) {
    try {
      const fileUrl = `${source.rawBase}/${file}`;
      const resp = await axios.get(fileUrl, { timeout: 10000 });
      const destPath = path.join(skillDir, file);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data));
      lines.push(c.dim(`  Downloaded: ${file}`));
    } catch {
      lines.push(c.yellow(`  ⚠️ Could not fetch optional file: ${file}`));
    }
  }

  lines.push(`\n${c.green("✅")} Installed ${c.white.bold(String(skillJson.name))} v${String(skillJson.version)}`);
  lines.push(c.silver(`   ${String(skillJson.description)}`));

  const commands = (skillJson.commands as string[]) || [];
  if (commands.length > 0) {
    lines.push(c.dim(`   New commands: ${commands.join(", ")}`));
  }

  lines.push("");
  lines.push(c.dim("   Restart taseescode to activate the skill."));
  lines.push("");

  return lines.join("\n");
}

export async function updateSkill(name: string): Promise<string> {
  const skillDir = path.join(getConfigDir(), "skills", name);
  if (!(await fs.pathExists(skillDir))) {
    return c.red(`Skill "${name}" is not installed. Use /skills install ${name}`);
  }
  // Remove and reinstall
  await fs.remove(skillDir);
  return installSkill(name);
}

export async function removeSkill(name: string): Promise<string> {
  const skillDir = path.join(getConfigDir(), "skills", name);
  if (!(await fs.pathExists(skillDir))) {
    return c.red(`Skill "${name}" not found.`);
  }
  await fs.remove(skillDir);
  return `${c.green("✅")} Skill ${c.white.bold(name)} removed.`;
}

export async function listAvailableSkills(): Promise<string> {
  try {
    const resp = await axios.get(REGISTRY_INDEX, { timeout: 8000 });
    const index = resp.data as Array<{ name: string; description: string; version: string; free: boolean }>;

    const lines = [
      "",
      c.white.bold("Available Skills — skills.taseescode.com"),
      c.gray("─".repeat(50)),
      "",
    ];

    for (const skill of index) {
      lines.push(`  ${c.white.bold(skill.name.padEnd(22))} v${skill.version}`);
      lines.push(`  ${c.dim(skill.description)}`);
      lines.push("");
    }

    lines.push(c.dim("  Install: /skills install [name]"));
    lines.push("");
    return lines.join("\n");

  } catch {
    // Registry not live yet — show hardcoded list
    return [
      "",
      c.white.bold("Coming Soon — skills.taseescode.com"),
      c.gray("─".repeat(50)),
      "",
      `  ${c.white.bold("react-expert".padEnd(22))} Deep React 19 + Next.js expertise`,
      `  ${c.white.bold("nafath".padEnd(22))} Saudi NAFATH auth integration`,
      `  ${c.white.bold("hyperpay".padEnd(22))} HyperPay + Moyasar payment gateways`,
      `  ${c.white.bold("pdpl-scanner".padEnd(22))} Saudi PDPL compliance checker`,
      `  ${c.white.bold("supabase".padEnd(22))} Supabase schema, RLS, migrations`,
      `  ${c.white.bold("n8n-pro".padEnd(22))} Advanced n8n workflow generation`,
      `  ${c.white.bold("docker".padEnd(22))} Dockerfile + compose generation`,
      `  ${c.white.bold("arabic-ui".padEnd(22))} RTL-aware Arabic UI components`,
      "",
      c.dim("  Install from GitHub: /skills install username/repo"),
      c.dim("  Example: /skills install taseesai/taseescode-react-expert"),
      "",
    ].join("\n");
  }
}
