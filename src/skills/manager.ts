import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { getConfigDir } from "../utils/config";

export function installSkill(name: string): string {
  // Registry is not yet available — stub
  return `${chalk.hex("#707070")(`Registry coming soon. To install "${name}" manually, place skill.json in:`)}
  ${chalk.hex("#E8E8E8")(`~/.taseescode/skills/${name}/skill.json`)}`;
}

export async function removeSkill(name: string): Promise<string> {
  const skillDir = path.join(getConfigDir(), "skills", name);
  if (!(await fs.pathExists(skillDir))) {
    return `Skill "${name}" not found.`;
  }
  await fs.remove(skillDir);
  return `Skill "${name}" removed.`;
}
