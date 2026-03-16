import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
};

interface CodebaseDNA {
  analyzedAt: string;
  projectName: string;
  language: string;
  framework: string;
  styleGuide: {
    indentation: string;
    quotes: string;
    semicolons: boolean;
    namingConvention: string;
    fileNaming: string;
  };
  stack: string[];
  patterns: string[];
  fileStructure: string;
  testFramework: string | null;
  packageManager: string;
  summary: string;
}

const DNA_FILE = ".taseescode/dna.json";

async function detectStack(cwd: string): Promise<Partial<CodebaseDNA>> {
  const dna: Partial<CodebaseDNA> = {
    stack: [],
    patterns: [],
  };

  // Check package.json
  const pkgPath = path.join(cwd, "package.json");
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJSON(pkgPath);
    dna.projectName = pkg.name || path.basename(cwd);
    dna.packageManager = (await fs.pathExists(path.join(cwd, "pnpm-lock.yaml"))) ? "pnpm"
      : (await fs.pathExists(path.join(cwd, "yarn.lock"))) ? "yarn" : "npm";

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect framework
    if (allDeps["next"]) { dna.framework = "Next.js"; dna.stack!.push("Next.js"); }
    else if (allDeps["nuxt"]) { dna.framework = "Nuxt"; dna.stack!.push("Nuxt"); }
    else if (allDeps["react"]) { dna.framework = "React"; dna.stack!.push("React"); }
    else if (allDeps["vue"]) { dna.framework = "Vue"; dna.stack!.push("Vue"); }
    else if (allDeps["svelte"]) { dna.framework = "Svelte"; dna.stack!.push("Svelte"); }
    else if (allDeps["express"]) { dna.framework = "Express"; dna.stack!.push("Express"); }
    else if (allDeps["fastify"]) { dna.framework = "Fastify"; dna.stack!.push("Fastify"); }

    // Detect language
    if (allDeps["typescript"] || await fs.pathExists(path.join(cwd, "tsconfig.json"))) {
      dna.language = "TypeScript";
      dna.stack!.push("TypeScript");
    } else {
      dna.language = "JavaScript";
    }

    // Detect common libraries
    if (allDeps["tailwindcss"]) dna.stack!.push("Tailwind CSS");
    if (allDeps["prisma"] || allDeps["@prisma/client"]) dna.stack!.push("Prisma");
    if (allDeps["drizzle-orm"]) dna.stack!.push("Drizzle ORM");
    if (allDeps["mongoose"]) dna.stack!.push("Mongoose");
    if (allDeps["@supabase/supabase-js"]) dna.stack!.push("Supabase");
    if (allDeps["firebase"]) dna.stack!.push("Firebase");
    if (allDeps["zod"]) dna.stack!.push("Zod");
    if (allDeps["trpc"] || allDeps["@trpc/server"]) dna.stack!.push("tRPC");
    if (allDeps["shadcn-ui"] || allDeps["@radix-ui/react-dialog"]) dna.stack!.push("shadcn/ui");
    if (allDeps["framer-motion"]) dna.stack!.push("Framer Motion");
    if (allDeps["axios"]) dna.stack!.push("Axios");

    // Detect test framework
    if (allDeps["jest"]) dna.testFramework = "Jest";
    else if (allDeps["vitest"]) dna.testFramework = "Vitest";
    else if (allDeps["mocha"]) dna.testFramework = "Mocha";
    else if (allDeps["@playwright/test"]) dna.testFramework = "Playwright";
    else dna.testFramework = null;
  }

  // Python project
  if (await fs.pathExists(path.join(cwd, "requirements.txt")) || await fs.pathExists(path.join(cwd, "pyproject.toml"))) {
    dna.language = dna.language || "Python";
    dna.packageManager = (await fs.pathExists(path.join(cwd, "poetry.lock"))) ? "poetry" : "pip";
    dna.stack!.push("Python");
  }

  // Go project
  if (await fs.pathExists(path.join(cwd, "go.mod"))) {
    dna.language = "Go";
    dna.stack!.push("Go");
  }

  return dna;
}

async function detectStyle(cwd: string): Promise<CodebaseDNA["styleGuide"]> {
  const style: CodebaseDNA["styleGuide"] = {
    indentation: "spaces (2)",
    quotes: "double",
    semicolons: true,
    namingConvention: "camelCase",
    fileNaming: "kebab-case",
  };

  // Sample a few source files
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  let sampleContent = "";

  for (const ext of extensions) {
    try {
      const files = execSync(`find . -maxdepth 3 -name "*${ext}" -not -path "*/node_modules/*" -not -path "*/dist/*" | head -5`, {
        cwd, encoding: "utf-8", timeout: 5000,
      }).trim().split("\n").filter(Boolean);

      for (const file of files.slice(0, 3)) {
        try {
          const content = await fs.readFile(path.join(cwd, file), "utf-8");
          sampleContent += content.slice(0, 2000) + "\n";
        } catch {
          // Skip unreadable files
        }
      }
      if (sampleContent.length > 1000) break;
    } catch {
      // Skip if find fails
    }
  }

  if (sampleContent) {
    // Detect indentation
    const tabLines = (sampleContent.match(/^\t/gm) || []).length;
    const space4Lines = (sampleContent.match(/^    \S/gm) || []).length;
    const space2Lines = (sampleContent.match(/^  \S/gm) || []).length;
    if (tabLines > space2Lines && tabLines > space4Lines) style.indentation = "tabs";
    else if (space4Lines > space2Lines) style.indentation = "spaces (4)";
    else style.indentation = "spaces (2)";

    // Detect quotes
    const singleQuotes = (sampleContent.match(/'/g) || []).length;
    const doubleQuotes = (sampleContent.match(/"/g) || []).length;
    style.quotes = singleQuotes > doubleQuotes ? "single" : "double";

    // Detect semicolons
    const withSemicolons = (sampleContent.match(/;\s*$/gm) || []).length;
    const withoutSemicolons = (sampleContent.match(/[^;{}\s]\s*$/gm) || []).length;
    style.semicolons = withSemicolons > withoutSemicolons * 0.5;

    // Detect naming
    const camelCase = (sampleContent.match(/\b[a-z]+[A-Z][a-zA-Z]*/g) || []).length;
    const snakeCase = (sampleContent.match(/\b[a-z]+_[a-z]+/g) || []).length;
    const pascalCase = (sampleContent.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]*/g) || []).length;
    if (snakeCase > camelCase) style.namingConvention = "snake_case";
    else if (pascalCase > camelCase) style.namingConvention = "PascalCase";
    else style.namingConvention = "camelCase";
  }

  // Detect file naming
  try {
    const srcFiles = execSync(`find . -maxdepth 3 -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -20`, {
      cwd, encoding: "utf-8", timeout: 5000,
    }).trim().split("\n").filter(Boolean).map(f => path.basename(f, path.extname(f)));

    const kebab = srcFiles.filter(f => f.includes("-")).length;
    const camel = srcFiles.filter(f => /^[a-z].*[A-Z]/.test(f)).length;
    const pascal = srcFiles.filter(f => /^[A-Z]/.test(f)).length;

    if (pascal > kebab && pascal > camel) style.fileNaming = "PascalCase";
    else if (camel > kebab) style.fileNaming = "camelCase";
    else style.fileNaming = "kebab-case";
  } catch {
    // Keep default
  }

  return style;
}

async function detectFileStructure(cwd: string): Promise<string> {
  try {
    const output = execSync(
      `find . -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" | sort | head -30`,
      { cwd, encoding: "utf-8", timeout: 5000 }
    );
    return output.trim();
  } catch {
    return "(unable to detect)";
  }
}

export async function analyzeDNA(cwd: string): Promise<CodebaseDNA> {
  const stack = await detectStack(cwd);
  const style = await detectStyle(cwd);
  const structure = await detectFileStructure(cwd);

  const dna: CodebaseDNA = {
    analyzedAt: new Date().toISOString(),
    projectName: stack.projectName || path.basename(cwd),
    language: stack.language || "unknown",
    framework: stack.framework || "none",
    styleGuide: style,
    stack: stack.stack || [],
    patterns: stack.patterns || [],
    fileStructure: structure,
    testFramework: stack.testFramework || null,
    packageManager: stack.packageManager || "npm",
    summary: "",
  };

  // Generate summary for system prompt
  dna.summary = [
    `Project: ${dna.projectName} (${dna.language}${dna.framework !== "none" ? ` + ${dna.framework}` : ""})`,
    `Stack: ${dna.stack.join(", ")}`,
    `Style: ${dna.styleGuide.indentation}, ${dna.styleGuide.quotes} quotes, ${dna.styleGuide.semicolons ? "with" : "no"} semicolons`,
    `Naming: ${dna.styleGuide.namingConvention} (variables), ${dna.styleGuide.fileNaming} (files)`,
    dna.testFramework ? `Tests: ${dna.testFramework}` : "Tests: none detected",
    `Package manager: ${dna.packageManager}`,
  ].join("\n");

  // Save to project
  const dnaPath = path.join(cwd, DNA_FILE);
  await fs.ensureDir(path.dirname(dnaPath));
  await fs.writeJSON(dnaPath, dna, { spaces: 2 });

  return dna;
}

export async function loadDNA(cwd: string): Promise<CodebaseDNA | null> {
  const dnaPath = path.join(cwd, DNA_FILE);
  if (await fs.pathExists(dnaPath)) {
    return fs.readJSON(dnaPath);
  }
  return null;
}

export async function handleLearn(args: string): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("  Learn — Codebase DNA"),
      p.gray("  " + "━".repeat(40)),
      "",
      "  /learn              Analyze project and learn your coding style",
      "  /learn show         Show current DNA profile",
      "  /learn reset        Delete learned profile",
      "",
      "  Detects:",
      "  - Language, framework, tech stack",
      "  - Naming conventions (camelCase, snake_case, etc.)",
      "  - Indentation, quotes, semicolons",
      "  - File structure and organization",
      "  - Test framework and package manager",
      "",
      p.dim("  DNA is loaded into the AI's context so it matches your style."),
      "",
    ].join("\n");
  }

  if (subCmd === "reset") {
    const dnaPath = path.join(cwd, DNA_FILE);
    if (await fs.pathExists(dnaPath)) {
      await fs.remove(dnaPath);
      return p.green("Codebase DNA profile deleted.").toString();
    }
    return "No DNA profile found.";
  }

  if (subCmd === "show") {
    const dna = await loadDNA(cwd);
    if (!dna) return "No DNA profile found. Run /learn to analyze your codebase.";

    return [
      "",
      p.white.bold("  Codebase DNA Profile"),
      p.gray("  " + "━".repeat(45)),
      "",
      `  ${p.gray("Project:")}      ${p.white(dna.projectName)}`,
      `  ${p.gray("Language:")}     ${p.white(dna.language)}`,
      `  ${p.gray("Framework:")}    ${p.white(dna.framework || "none")}`,
      `  ${p.gray("Stack:")}        ${p.white(dna.stack.join(", ") || "none detected")}`,
      "",
      `  ${p.gray("Indentation:")} ${p.white(dna.styleGuide.indentation)}`,
      `  ${p.gray("Quotes:")}      ${p.white(dna.styleGuide.quotes)}`,
      `  ${p.gray("Semicolons:")}  ${p.white(dna.styleGuide.semicolons ? "yes" : "no")}`,
      `  ${p.gray("Naming:")}      ${p.white(dna.styleGuide.namingConvention)}`,
      `  ${p.gray("File naming:")} ${p.white(dna.styleGuide.fileNaming)}`,
      `  ${p.gray("Tests:")}       ${p.white(dna.testFramework || "none detected")}`,
      `  ${p.gray("Pkg manager:")} ${p.white(dna.packageManager)}`,
      "",
      `  ${p.dim("Analyzed:")} ${new Date(dna.analyzedAt).toLocaleString()}`,
      "",
    ].join("\n");
  }

  // Default: analyze
  const dna = await analyzeDNA(cwd);

  return [
    "",
    p.green.bold("  Codebase DNA Learned!"),
    p.gray("  " + "━".repeat(45)),
    "",
    `  ${p.gray("Project:")}      ${p.white(dna.projectName)}`,
    `  ${p.gray("Language:")}     ${p.white(dna.language)}`,
    `  ${p.gray("Framework:")}    ${p.white(dna.framework || "none")}`,
    `  ${p.gray("Stack:")}        ${p.white(dna.stack.join(", "))}`,
    `  ${p.gray("Style:")}        ${p.white(`${dna.styleGuide.indentation}, ${dna.styleGuide.quotes} quotes, ${dna.styleGuide.semicolons ? "semicolons" : "no semicolons"}`)}`,
    `  ${p.gray("Naming:")}       ${p.white(`${dna.styleGuide.namingConvention} (vars), ${dna.styleGuide.fileNaming} (files)`)}`,
    `  ${p.gray("Tests:")}        ${p.white(dna.testFramework || "none detected")}`,
    "",
    p.dim("  AI will now match your coding style in all responses."),
    p.dim("  Run /learn show to view full profile, /learn reset to clear."),
    "",
  ].join("\n");
}
