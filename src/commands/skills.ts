import chalk from "chalk";
import { loadAllSkills } from "../skills/loader";
import { installSkill, removeSkill, updateSkill, listAvailableSkills } from "../skills/manager";

const c = {
  white:  chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray:   chalk.hex("#8B8B8B"),
  dim:    chalk.hex("#4A4A4A"),
  green:  chalk.hex("#7ACC7A"),
  red:    chalk.hex("#E87B7B"),
};

export async function skillsCommand(args: string[]): Promise<string> {

  // /skills list  — installed skills
  if (args.length === 0 || args[0] === "list") {
    const skills = await loadAllSkills();

    if (skills.length === 0) {
      return [
        "",
        c.silver("No skills installed yet."),
        "",
        c.dim("  Browse available skills:"),
        c.white("  /skills available"),
        "",
        c.dim("  Install from official registry:"),
        c.white("  /skills install react-expert"),
        "",
        c.dim("  Install from any GitHub repo:"),
        c.white("  /skills install username/repo-name"),
        "",
      ].join("\n");
    }

    const lines = [
      "",
      c.white.bold(`Installed Skills (${skills.length})`),
      c.gray("─".repeat(40)),
    ];

    for (const skill of skills) {
      lines.push(`\n  ${c.white.bold(skill.name)} ${c.dim("v" + skill.version)}`);
      lines.push(`  ${c.silver(skill.description)}`);
      if (skill.commands?.length > 0) {
        lines.push(`  ${c.dim("Commands: " + skill.commands.join(", "))}`);
      }
    }
    lines.push("");
    return lines.join("\n");
  }

  // /skills available  — browse registry
  if (args[0] === "available" || args[0] === "browse" || args[0] === "search") {
    return listAvailableSkills();
  }

  // /skills install [name or user/repo]
  if (args[0] === "install") {
    if (!args[1]) {
      return [
        c.red("Usage: /skills install [name]"),
        c.dim("  Official: /skills install react-expert"),
        c.dim("  GitHub:   /skills install username/repo"),
      ].join("\n");
    }
    return installSkill(args[1]);
  }

  // /skills remove [name]
  if (args[0] === "remove" || args[0] === "uninstall") {
    if (!args[1]) return c.red("Usage: /skills remove [name]");
    return removeSkill(args[1]);
  }

  // /skills update [name]
  if (args[0] === "update") {
    if (!args[1]) return c.red("Usage: /skills update [name]");
    return updateSkill(args[1]);
  }

  return [
    c.red(`Unknown subcommand: ${args[0]}`),
    "",
    c.dim("  /skills list              — installed skills"),
    c.dim("  /skills available         — browse registry"),
    c.dim("  /skills install [name]    — install from registry"),
    c.dim("  /skills install user/repo — install from GitHub"),
    c.dim("  /skills update [name]     — update a skill"),
    c.dim("  /skills remove [name]     — remove a skill"),
  ].join("\n");
}
