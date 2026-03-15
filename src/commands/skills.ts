import chalk from "chalk";
import { loadAllSkills } from "../skills/loader";
import { installSkill, removeSkill } from "../skills/manager";

const d = chalk.hex("#4A4A4A");
const g = chalk.hex("#8B8B8B");
const w = chalk.hex("#E8E8E8");
const c = chalk.hex("#7AC8C8");

export async function skillsCommand(args: string[]): Promise<string> {
  if (args.length === 0 || args[0] === "list") {
    const skills = await loadAllSkills();
    if (skills.length === 0) {
      return [
        "",
        g("No skills installed yet."),
        "",
        w.bold("Coming soon to skills.taseescode.com:"),
        `  ${c("◆ react-expert")}     — Deep React/Next.js expertise`,
        `  ${c("◆ nafath")}           — Saudi NAFATH auth integration`,
        `  ${c("◆ hyperpay")}         — Saudi payment gateway (HyperPay/Moyasar)`,
        `  ${c("◆ pdpl-scanner")}     — Saudi PDPL compliance checker`,
        `  ${c("◆ supabase")}         — Supabase schema & migrations`,
        `  ${c("◆ n8n-pro")}          — n8n workflow generation`,
        "",
        d("Install when available: /skills install react-expert"),
        "",
      ].join("\n");
    }

    let output = `\n${w.bold("Installed Skills")}\n${g("─".repeat(35))}\n`;
    for (const skill of skills) {
      output += `  ${w.bold(skill.name)} v${skill.version}\n`;
      output += `    ${chalk.hex("#707070")(skill.description)}\n`;
      if (skill.commands.length > 0) {
        output += `    Commands: ${skill.commands.join(", ")}\n`;
      }
      output += "\n";
    }
    return output;
  }

  if (args[0] === "install") {
    if (!args[1]) return "Usage: /skills install [name]";
    return installSkill(args[1]);
  }

  if (args[0] === "remove") {
    if (!args[1]) return "Usage: /skills remove [name]";
    return await removeSkill(args[1]);
  }

  return "Usage: /skills list | /skills install [name] | /skills remove [name]";
}
