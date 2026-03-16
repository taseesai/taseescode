import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface Finding {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  file: string;
  line?: number;
  message: string;
  fix?: string;
}

// Secret patterns
const SECRET_PATTERNS = [
  { name: "AWS Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "API Key (generic)", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
  { name: "JWT Token", pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
  { name: "Slack Token", pattern: /xox[bpsa]-[a-zA-Z0-9-]{20,}/g },
  { name: "GitHub Token", pattern: /ghp_[a-zA-Z0-9]{20,}/g },
  { name: "Password in string", pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi },
  { name: "Bearer Token", pattern: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/g },
  { name: "Database URL", pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi },
  { name: "Anthropic Key", pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  { name: "OpenAI Key", pattern: /sk-[a-zA-Z0-9]{20,}/g },
];

// Vulnerability patterns
const VULN_PATTERNS = [
  { name: "SQL Injection", pattern: /(?:query|execute|raw)\s*\(\s*[`'"].*\$\{/g, category: "injection", severity: "critical" as const },
  { name: "eval() usage", pattern: /\beval\s*\(/g, category: "injection", severity: "critical" as const },
  { name: "innerHTML assignment", pattern: /\.innerHTML\s*=/g, category: "xss", severity: "high" as const },
  { name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/g, category: "xss", severity: "medium" as const },
  { name: "document.write", pattern: /document\.write\s*\(/g, category: "xss", severity: "high" as const },
  { name: "Hardcoded IP", pattern: /(?:https?:\/\/)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, category: "config", severity: "low" as const },
  { name: "TODO/FIXME security", pattern: /(?:TODO|FIXME|HACK|XXX).*(?:security|auth|password|token|key|secret)/gi, category: "todo", severity: "medium" as const },
  { name: "console.log in prod", pattern: /console\.log\s*\(/g, category: "info-leak", severity: "low" as const },
  { name: "Disabled SSL verify", pattern: /rejectUnauthorized\s*:\s*false/g, category: "ssl", severity: "high" as const },
  { name: "Weak crypto", pattern: /createHash\s*\(\s*['"]md5['"]\)/g, category: "crypto", severity: "medium" as const },
];

const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".java", ".php", ".env", ".yml", ".yaml", ".json", ".toml"];
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "venv", ".venv"];

async function getProjectFiles(cwd: string, maxFiles: number = 500): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string, depth: number = 0): Promise<void> {
    if (depth > 6 || files.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;
        if (IGNORE_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(cwd);
  return files;
}

async function scanFile(filePath: string, cwd: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const relativePath = path.relative(cwd, filePath);
    const lines = content.split("\n");

    // Check for secrets
    for (const secret of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (secret.pattern.test(lines[i])) {
          // Reset regex
          secret.pattern.lastIndex = 0;
          findings.push({
            severity: "critical",
            category: "secrets",
            file: relativePath,
            line: i + 1,
            message: `Potential ${secret.name} found`,
            fix: `Move to environment variable or .env file (add .env to .gitignore)`,
          });
        }
        secret.pattern.lastIndex = 0;
      }
    }

    // Check for vulnerabilities
    for (const vuln of VULN_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (vuln.pattern.test(lines[i])) {
          vuln.pattern.lastIndex = 0;
          findings.push({
            severity: vuln.severity,
            category: vuln.category,
            file: relativePath,
            line: i + 1,
            message: vuln.name,
          });
        }
        vuln.pattern.lastIndex = 0;
      }
    }

    // Check .env files aren't in git
    if (relativePath === ".env" || relativePath.endsWith("/.env")) {
      try {
        const gitignore = await fs.readFile(path.join(cwd, ".gitignore"), "utf-8");
        if (!gitignore.includes(".env")) {
          findings.push({
            severity: "critical",
            category: "secrets",
            file: relativePath,
            message: ".env file exists but not in .gitignore",
            fix: "Add .env to .gitignore immediately",
          });
        }
      } catch {
        findings.push({
          severity: "high",
          category: "secrets",
          file: relativePath,
          message: ".env file exists but no .gitignore found",
          fix: "Create .gitignore and add .env",
        });
      }
    }
  } catch {
    // Skip unreadable files
  }

  return findings;
}

export async function handleAudit(args: string): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("Security Audit"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /audit              Full security scan of current project",
      "  /audit secrets      Scan for hardcoded secrets only",
      "  /audit deps         Check dependency vulnerabilities (npm audit)",
      "  /audit quick        Fast scan (top-level files only)",
      "",
      "  Detects:",
      "  - Hardcoded API keys, passwords, tokens, private keys",
      "  - SQL injection, XSS, eval() usage",
      "  - Disabled SSL verification, weak crypto",
      "  - .env files not in .gitignore",
      "  - Dependency vulnerabilities",
      "",
    ].join("\n");
  }

  const lines: string[] = [
    "",
    p.white.bold("Security Audit Report"),
    p.gray("\u2501".repeat(45)),
    "",
  ];

  // Scan project files
  lines.push(p.gray("  Scanning project files..."));
  const files = await getProjectFiles(cwd, subCmd === "quick" ? 50 : 500);
  let allFindings: Finding[] = [];

  if (subCmd === "deps") {
    // Only run dependency audit
  } else {
    for (const file of files) {
      if (subCmd === "secrets") {
        const findings = await scanFile(file, cwd);
        allFindings.push(...findings.filter(f => f.category === "secrets"));
      } else {
        allFindings.push(...await scanFile(file, cwd));
      }
    }
  }

  // Run npm audit if applicable
  if (subCmd !== "secrets" && await fs.pathExists(path.join(cwd, "package.json"))) {
    try {
      const auditOutput = execSync("npm audit --json 2>/dev/null", { cwd, encoding: "utf-8", timeout: 15000 });
      const audit = JSON.parse(auditOutput);
      const vulns = audit.metadata?.vulnerabilities || {};
      if (vulns.critical > 0) allFindings.push({ severity: "critical", category: "deps", file: "package.json", message: `${vulns.critical} critical dependency vulnerabilities`, fix: "Run: npm audit fix" });
      if (vulns.high > 0) allFindings.push({ severity: "high", category: "deps", file: "package.json", message: `${vulns.high} high dependency vulnerabilities`, fix: "Run: npm audit fix" });
      if (vulns.moderate > 0) allFindings.push({ severity: "medium", category: "deps", file: "package.json", message: `${vulns.moderate} moderate dependency vulnerabilities` });
    } catch {
      // npm audit may fail or return non-zero — that's OK
    }
  }

  // Sort by severity
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => order[a.severity] - order[b.severity]);

  // Summary
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of allFindings) counts[f.severity]++;

  const total = allFindings.length;
  lines.push(`  ${p.gray("Files scanned:")} ${files.length}`);
  lines.push(`  ${p.gray("Issues found:")}  ${total}`);
  lines.push("");

  if (total === 0) {
    lines.push(p.green("  No security issues detected! Your project looks clean."));
  } else {
    lines.push(
      `  ${p.red(`Critical: ${counts.critical}`)}  ${p.yellow(`High: ${counts.high}`)}  ${p.gray(`Medium: ${counts.medium}`)}  ${p.dim(`Low: ${counts.low}`)}`
    );
    lines.push("");

    // Show findings
    for (const f of allFindings.slice(0, 20)) {
      const icon = f.severity === "critical" ? p.red("!!") : f.severity === "high" ? p.yellow("! ") : f.severity === "medium" ? p.gray("* ") : p.dim("- ");
      const loc = f.line ? `:${f.line}` : "";
      lines.push(`  ${icon} ${p.white(f.message)}`);
      lines.push(`     ${p.dim(f.file + loc)}`);
      if (f.fix) lines.push(`     ${p.green("Fix: " + f.fix)}`);
      lines.push("");
    }

    if (allFindings.length > 20) {
      lines.push(p.dim(`  ... and ${allFindings.length - 20} more issues`));
    }
  }

  lines.push("");
  return lines.join("\n");
}
