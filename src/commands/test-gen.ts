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
  yellow: chalk.hex("#D4A843"),
};

function detectTestFramework(cwd: string): { framework: string; cmd: string; ext: string } | null {
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = fs.readJSONSync(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps["vitest"]) return { framework: "Vitest", cmd: "npx vitest run", ext: ".test.ts" };
    if (deps["jest"]) {
      const isTs = deps["typescript"] || deps["ts-jest"];
      return { framework: "Jest", cmd: "npx jest", ext: isTs ? ".test.ts" : ".test.js" };
    }
    if (deps["mocha"]) return { framework: "Mocha", cmd: "npx mocha", ext: ".test.js" };
    if (deps["@playwright/test"]) return { framework: "Playwright", cmd: "npx playwright test", ext: ".spec.ts" };

    // Default to vitest for TypeScript, jest for JavaScript
    if (deps["typescript"]) return { framework: "Vitest (suggested)", cmd: "npx vitest run", ext: ".test.ts" };
    return { framework: "Jest (suggested)", cmd: "npx jest", ext: ".test.js" };
  } catch { return null; }
}

export async function handleTestGen(args: string, agent: Agent): Promise<string> {
  const cwd = process.cwd();
  const filePath = args.trim();

  if (!filePath || filePath === "help") {
    return [
      "",
      p.white.bold("🧪 Test-Gen — Intelligent Test Generation"),
      p.gray("━".repeat(40)),
      "",
      "  /test-gen <file>          Generate tests for a file",
      "  /test-gen <file> --run    Generate and run tests immediately",
      "",
      "  Examples:",
      "  /test-gen src/utils/auth.ts",
      "  /test-gen src/api/users.ts --run",
      "",
      "  Auto-detects your test framework (Jest, Vitest, Mocha, Playwright).",
      "  Generates unit tests covering: happy path, edge cases, error handling.",
      "  Tests match your project's existing patterns and conventions.",
      "",
      p.dim("  Tip: Run /learn first so tests match your coding style."),
      "",
    ].join("\n");
  }

  const shouldRun = filePath.includes("--run");
  const cleanPath = filePath.replace("--run", "").trim();
  const fullPath = path.resolve(cwd, cleanPath);

  if (!(await fs.pathExists(fullPath))) {
    return p.red(`❌ File not found: ${cleanPath}`).toString();
  }

  const content = await fs.readFile(fullPath, "utf-8");
  if (content.length > 10000) {
    return p.yellow("⚠️ File is very large. Consider testing individual functions.").toString();
  }

  const testInfo = detectTestFramework(cwd);
  const framework = testInfo?.framework || "Jest";
  const testExt = testInfo?.ext || ".test.ts";

  // Generate test file path
  const parsed = path.parse(cleanPath);
  const testFileName = `${parsed.name}${testExt}`;
  const testDir = parsed.dir.includes("src") ? parsed.dir.replace("src", "__tests__") : parsed.dir;
  const testPath = path.join(testDir || "__tests__", testFileName);

  // Send to AI
  const prompt = `Generate comprehensive tests for this file using ${framework}.

File: ${cleanPath}
\`\`\`
${content.slice(0, 8000)}
\`\`\`

Requirements:
- Use ${framework} syntax and best practices
- Cover: happy path, edge cases, error handling, boundary values
- Include descriptive test names
- Mock external dependencies if needed
- The test file should be saved to: ${testPath}

Generate the complete test file. Use the create_file tool to save it.`;

  await agent.processMessage(prompt);

  const lines = [
    "",
    p.green(`✅ Tests generated for ${cleanPath}`),
    p.dim(`   Framework: ${framework}`),
    p.dim(`   Test file: ${testPath}`),
  ];

  if (shouldRun && testInfo) {
    lines.push("", p.gray(`   Running: ${testInfo.cmd} ${testPath}...`));
    lines.push(p.dim("   (AI will execute the test command)"));

    // Ask AI to run the tests
    await agent.processMessage(`Run the tests: ${testInfo.cmd} ${testPath}`);
  }

  lines.push("");
  return lines.join("\n");
}
