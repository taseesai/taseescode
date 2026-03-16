import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { Agent } from "../core/agent";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  red: chalk.hex("#C75050"),
};

function detectProjectStack(cwd: string): { framework: string; language: string; packageManager: string; hasTests: boolean; hasDeploy: boolean } {
  const result = { framework: "unknown", language: "unknown", packageManager: "npm", hasTests: false, hasDeploy: false };

  try {
    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = fs.readJSONSync(pkgPath);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      result.language = deps["typescript"] ? "TypeScript" : "JavaScript";
      result.packageManager = fs.existsSync(path.join(cwd, "pnpm-lock.yaml")) ? "pnpm"
        : fs.existsSync(path.join(cwd, "yarn.lock")) ? "yarn" : "npm";

      if (deps["next"]) result.framework = "Next.js";
      else if (deps["vite"]) result.framework = "Vite";
      else if (deps["react"]) result.framework = "React";
      else if (deps["express"]) result.framework = "Express";
      else if (deps["nuxt"]) result.framework = "Nuxt";
      else if (deps["astro"]) result.framework = "Astro";

      result.hasTests = !!(deps["jest"] || deps["vitest"] || deps["mocha"] || deps["@playwright/test"]);

      if (pkg.scripts) {
        result.hasDeploy = !!pkg.scripts.deploy;
      }
    }

    if (fs.existsSync(path.join(cwd, "requirements.txt")) || fs.existsSync(path.join(cwd, "pyproject.toml"))) {
      result.language = "Python";
      result.framework = fs.existsSync(path.join(cwd, "manage.py")) ? "Django"
        : fs.existsSync(path.join(cwd, "app.py")) ? "Flask" : "Python";
    }

    if (fs.existsSync(path.join(cwd, "go.mod"))) {
      result.language = "Go";
      result.framework = "Go";
    }
  } catch {}

  return result;
}

export async function handlePipeline(args: string, agent: Agent | null): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help" || !subCmd) {
    const stack = detectProjectStack(cwd);
    return [
      "",
      p.white.bold("⚙️ Pipeline — AI-Generated CI/CD"),
      p.gray("━".repeat(40)),
      "",
      "  /pipeline github      Generate GitHub Actions workflow",
      "  /pipeline gitlab      Generate GitLab CI config",
      "  /pipeline docker      Generate Dockerfile",
      "  /pipeline all         Generate all of the above",
      "",
      p.white("  Detected Project:"),
      `  Framework:  ${p.white(stack.framework)}`,
      `  Language:   ${p.white(stack.language)}`,
      `  Package:    ${p.white(stack.packageManager)}`,
      `  Tests:      ${stack.hasTests ? p.green("Found") : p.dim("None detected")}`,
      "",
      p.dim("  AI analyzes your project and generates production-ready"),
      p.dim("  CI/CD configs with: build, test, lint, deploy steps."),
      "",
    ].join("\n");
  }

  if (!agent) {
    return p.red("Pipeline generation requires an active AI session.").toString();
  }

  const stack = detectProjectStack(cwd);

  if (subCmd === "github" || subCmd === "gh" || subCmd === "actions") {
    await agent.processMessage(
      `Generate a complete GitHub Actions CI/CD workflow for this project.\n\n` +
      `Project: ${stack.framework} (${stack.language})\n` +
      `Package manager: ${stack.packageManager}\n` +
      `Has tests: ${stack.hasTests}\n` +
      `Working directory: ${cwd}\n\n` +
      `Create the file at .github/workflows/ci.yml with:\n` +
      `1. Trigger on push to main and pull requests\n` +
      `2. Install dependencies with ${stack.packageManager}\n` +
      `3. Run lint (if configured)\n` +
      `4. Run tests (if available)\n` +
      `5. Build the project\n` +
      `6. Deploy step (commented out, with instructions)\n\n` +
      `Use the create_file tool to save the workflow file.`
    );
    return "";
  }

  if (subCmd === "gitlab" || subCmd === "gl") {
    await agent.processMessage(
      `Generate a complete GitLab CI config for this ${stack.framework} (${stack.language}) project.\n` +
      `Package manager: ${stack.packageManager}. Has tests: ${stack.hasTests}.\n` +
      `Create the file at .gitlab-ci.yml with build, test, and deploy stages.\n` +
      `Use the create_file tool to save it.`
    );
    return "";
  }

  if (subCmd === "docker" || subCmd === "dockerfile") {
    await agent.processMessage(
      `Generate a production-ready Dockerfile for this ${stack.framework} (${stack.language}) project.\n` +
      `Use multi-stage build, minimize image size, follow security best practices.\n` +
      `Also generate a .dockerignore file.\n` +
      `Use the create_file tool to save both files.`
    );
    return "";
  }

  if (subCmd === "all") {
    await agent.processMessage(
      `Generate ALL CI/CD configs for this ${stack.framework} (${stack.language}) project:\n` +
      `1. .github/workflows/ci.yml (GitHub Actions)\n` +
      `2. Dockerfile (multi-stage, production-ready)\n` +
      `3. .dockerignore\n\n` +
      `Package manager: ${stack.packageManager}. Has tests: ${stack.hasTests}.\n` +
      `Use the create_file tool to save each file.`
    );
    return "";
  }

  return "Usage: /pipeline github | gitlab | docker | all";
}
