import fs from "fs-extra";
import path from "path";
import { getConfigDir } from "../utils/config";

export interface SkillConfig {
  name: string;
  version: string;
  description: string;
  commands: string[];
  systemPromptAddition: string;
  author: string;
}

export async function loadAllSkills(): Promise<SkillConfig[]> {
  const skillsDir = path.join(getConfigDir(), "skills");
  if (!(await fs.pathExists(skillsDir))) {
    return [];
  }

  const skills: SkillConfig[] = [];
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillJsonPath = path.join(skillsDir, entry.name, "skill.json");
    if (await fs.pathExists(skillJsonPath)) {
      try {
        const content = await fs.readFile(skillJsonPath, "utf-8");
        const skill = JSON.parse(content) as SkillConfig;
        skills.push(skill);
      } catch {
        // Skip invalid skill files
      }
    }
  }

  return skills;
}

export async function loadSkill(name: string): Promise<SkillConfig | null> {
  const skillJsonPath = path.join(getConfigDir(), "skills", name, "skill.json");
  if (!(await fs.pathExists(skillJsonPath))) {
    return null;
  }
  const content = await fs.readFile(skillJsonPath, "utf-8");
  return JSON.parse(content) as SkillConfig;
}
