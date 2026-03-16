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

interface ComplianceCheck {
  category: string;
  name: string;
  nameAr: string;
  status: "pass" | "warn" | "fail" | "info";
  message: string;
  fix?: string;
}

// PDPL (Personal Data Protection Law) checks
function checkPDPL(cwd: string): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Check for privacy policy
  const privacyFiles = ["PRIVACY.md", "privacy-policy.md", "privacy.html", "privacy.txt"];
  const hasPrivacy = privacyFiles.some(f => fs.existsSync(path.join(cwd, f)) || fs.existsSync(path.join(cwd, "public", f)));
  checks.push({
    category: "PDPL", name: "Privacy Policy", nameAr: "سياسة الخصوصية",
    status: hasPrivacy ? "pass" : "warn",
    message: hasPrivacy ? "Privacy policy found" : "No privacy policy found",
    fix: hasPrivacy ? undefined : "Create a PRIVACY.md with your data handling practices",
  });

  // Check for data collection patterns
  try {
    const srcDir = fs.existsSync(path.join(cwd, "src")) ? path.join(cwd, "src") : cwd;
    const files = getAllFiles(srcDir, [".ts", ".tsx", ".js", ".jsx"], 100);

    let hasConsent = false;
    let hasDataCollection = false;
    let hasEncryption = false;
    let hasDataDeletion = false;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        if (/consent|رضا|موافقة/i.test(content)) hasConsent = true;
        if (/collect.*(?:email|phone|name|data)|localStorage|sessionStorage|cookie/i.test(content)) hasDataCollection = true;
        if (/encrypt|bcrypt|argon|hash|crypto/i.test(content)) hasEncryption = true;
        if (/delete.*(?:account|user|data)|purge|gdpr|right.*(?:forget|erasure)/i.test(content)) hasDataDeletion = true;
      } catch {}
    }

    if (hasDataCollection) {
      checks.push({
        category: "PDPL", name: "Data Collection", nameAr: "جمع البيانات",
        status: "info",
        message: "Data collection detected (forms, cookies, localStorage)",
        fix: "Ensure user consent before collecting personal data per PDPL Article 10",
      });
    }

    checks.push({
      category: "PDPL", name: "User Consent", nameAr: "موافقة المستخدم",
      status: hasConsent ? "pass" : hasDataCollection ? "fail" : "info",
      message: hasConsent ? "Consent mechanism found" : hasDataCollection ? "Data collected without consent mechanism" : "No data collection detected",
      fix: hasConsent ? undefined : "Implement consent banner/dialog before collecting user data",
    });

    checks.push({
      category: "PDPL", name: "Data Encryption", nameAr: "تشفير البيانات",
      status: hasEncryption ? "pass" : hasDataCollection ? "warn" : "info",
      message: hasEncryption ? "Encryption/hashing found" : "No encryption detected",
      fix: hasEncryption ? undefined : "Encrypt personal data at rest and in transit per PDPL Article 23",
    });

    checks.push({
      category: "PDPL", name: "Right to Delete", nameAr: "حق الحذف",
      status: hasDataDeletion ? "pass" : hasDataCollection ? "warn" : "info",
      message: hasDataDeletion ? "Data deletion mechanism found" : "No data deletion capability detected",
      fix: hasDataDeletion ? undefined : "Implement data deletion per PDPL Article 20 (right to erasure)",
    });
  } catch {}

  return checks;
}

// NCA (National Cybersecurity Authority) checks
function checkNCA(cwd: string): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Check for HTTPS
  try {
    const srcDir = fs.existsSync(path.join(cwd, "src")) ? path.join(cwd, "src") : cwd;
    const files = getAllFiles(srcDir, [".ts", ".tsx", ".js", ".jsx", ".env"], 100);

    let hasHttp = false;
    let hasHardcodedSecrets = false;
    let hasCSP = false;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        if (/http:\/\/(?!localhost|127\.0\.0\.1)/.test(content)) hasHttp = true;
        if (/(?:password|secret|token)\s*[:=]\s*['"][a-zA-Z0-9]{8,}/i.test(content) && !file.endsWith(".env")) hasHardcodedSecrets = true;
        if (/Content-Security-Policy|CSP|helmet/i.test(content)) hasCSP = true;
      } catch {}
    }

    checks.push({
      category: "NCA", name: "HTTPS Only", nameAr: "HTTPS فقط",
      status: hasHttp ? "fail" : "pass",
      message: hasHttp ? "Non-localhost HTTP URLs found" : "No insecure HTTP URLs",
      fix: hasHttp ? "Replace all HTTP URLs with HTTPS per NCA guidelines" : undefined,
    });

    checks.push({
      category: "NCA", name: "Secrets Management", nameAr: "إدارة الأسرار",
      status: hasHardcodedSecrets ? "fail" : "pass",
      message: hasHardcodedSecrets ? "Hardcoded secrets found in source code" : "No hardcoded secrets detected",
      fix: hasHardcodedSecrets ? "Move secrets to environment variables (.env) per NCA requirement" : undefined,
    });

    checks.push({
      category: "NCA", name: "Content Security Policy", nameAr: "سياسة أمان المحتوى",
      status: hasCSP ? "pass" : "warn",
      message: hasCSP ? "CSP or Helmet.js found" : "No Content Security Policy configured",
      fix: hasCSP ? undefined : "Add CSP headers (use helmet.js for Express or meta tags)",
    });
  } catch {}

  // Check for security headers config
  const hasVercelConfig = fs.existsSync(path.join(cwd, "vercel.json"));
  const hasNextConfig = fs.existsSync(path.join(cwd, "next.config.js")) || fs.existsSync(path.join(cwd, "next.config.mjs"));

  checks.push({
    category: "NCA", name: "Security Headers", nameAr: "رؤوس الأمان",
    status: hasVercelConfig || hasNextConfig ? "info" : "warn",
    message: hasVercelConfig ? "vercel.json found (check headers config)" : hasNextConfig ? "next.config found (add security headers)" : "No security headers configuration found",
    fix: "Add X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security headers",
  });

  return checks;
}

// Data sovereignty checks
function checkDataSovereignty(cwd: string): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  try {
    const srcDir = fs.existsSync(path.join(cwd, "src")) ? path.join(cwd, "src") : cwd;
    const files = getAllFiles(srcDir, [".ts", ".tsx", ".js", ".jsx", ".env", ".env.local"], 50);

    let usesExternalAPIs = false;
    let usesSaudiCloud = false;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        if (/amazonaws\.com|googleapis\.com|azure\.com|firebaseio\.com/i.test(content)) usesExternalAPIs = true;
        if (/stc\.com\.sa|saudi\.cloud|ntis\.gov\.sa/i.test(content)) usesSaudiCloud = true;
      } catch {}
    }

    checks.push({
      category: "Data Sovereignty", name: "Cloud Provider", nameAr: "مزود السحابة",
      status: usesExternalAPIs ? "warn" : "pass",
      message: usesExternalAPIs ? "External cloud APIs detected (AWS/GCP/Azure)" : "No external cloud dependencies detected",
      fix: usesExternalAPIs ? "Consider Saudi-based cloud providers for sensitive data (NDMO requirements)" : undefined,
    });

    checks.push({
      category: "Data Sovereignty", name: "Saudi Cloud", nameAr: "السحابة السعودية",
      status: usesSaudiCloud ? "pass" : "info",
      message: usesSaudiCloud ? "Saudi cloud provider integration found" : "No Saudi cloud provider detected",
    });
  } catch {}

  return checks;
}

function getAllFiles(dir: string, extensions: string[], maxFiles: number): string[] {
  const files: string[] = [];
  const ignore = ["node_modules", ".git", "dist", "build", ".next"];

  function walk(d: string, depth: number) {
    if (depth > 4 || files.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (ignore.includes(entry.name)) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (extensions.some(ext => entry.name.endsWith(ext))) files.push(full);
      }
    } catch {}
  }

  walk(dir, 0);
  return files;
}

export async function handleGov(args: string): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("\u{1F3DB}\uFE0F Gov \u2014 Saudi Compliance Mode"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /gov                Full compliance scan",
      "  /gov pdpl           PDPL (data protection) checks only",
      "  /gov nca            NCA (cybersecurity) checks only",
      "  /gov data           Data sovereignty checks only",
      "  /gov report         Generate compliance report file",
      "",
      p.white("  Checks against:"),
      "  \u2022 PDPL \u2014 Personal Data Protection Law (\u0646\u0638\u0627\u0645 \u062D\u0645\u0627\u064A\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u062E\u0635\u064A\u0629)",
      "  \u2022 NCA \u2014 National Cybersecurity Authority standards (\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0648\u0637\u0646\u064A\u0629 \u0644\u0644\u0623\u0645\u0646 \u0627\u0644\u0633\u064A\u0628\u0631\u0627\u0646\u064A)",
      "  \u2022 NDMO \u2014 Data sovereignty requirements (\u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0648\u0637\u0646\u064A \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A)",
      "",
      p.dim("  Essential for Saudi government contracts & enterprise compliance."),
      "",
    ].join("\n");
  }

  // Run checks
  let allChecks: ComplianceCheck[] = [];

  if (!subCmd || subCmd === "all" || subCmd === "pdpl") {
    allChecks.push(...checkPDPL(cwd));
  }
  if (!subCmd || subCmd === "all" || subCmd === "nca") {
    allChecks.push(...checkNCA(cwd));
  }
  if (!subCmd || subCmd === "all" || subCmd === "data") {
    allChecks.push(...checkDataSovereignty(cwd));
  }

  // Count results
  const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const check of allChecks) counts[check.status]++;

  const overallScore = allChecks.length > 0
    ? Math.round(((counts.pass + counts.info * 0.5) / allChecks.length) * 100)
    : 100;

  const scoreColor = overallScore >= 80 ? p.green : overallScore >= 60 ? p.yellow : p.red;
  const scoreEmoji = overallScore >= 80 ? "\uD83D\uDFE2" : overallScore >= 60 ? "\uD83D\uDFE1" : "\uD83D\uDD34";

  const lines = [
    "",
    p.white.bold("\u{1F3DB}\uFE0F Saudi Compliance Report"),
    p.gray("\u2501".repeat(45)),
    "",
    `  ${scoreEmoji} Compliance Score: ${scoreColor.bold(overallScore + "%")}`,
    `  ${p.green("\u2705 " + counts.pass)}  ${p.yellow("\u26A0\uFE0F " + counts.warn)}  ${p.red("\u274C " + counts.fail)}  ${p.dim("\u2139\uFE0F " + counts.info)}`,
    "",
  ];

  // Group by category
  const categories = [...new Set(allChecks.map(c => c.category))];
  for (const cat of categories) {
    lines.push(p.gray(`  ${cat}`));
    const catChecks = allChecks.filter(c => c.category === cat);
    for (const check of catChecks) {
      const icon = check.status === "pass" ? p.green("\u2705") : check.status === "warn" ? p.yellow("\u26A0\uFE0F") : check.status === "fail" ? p.red("\u274C") : p.dim("\u2139\uFE0F");
      lines.push(`    ${icon} ${p.white(check.name)} ${p.dim(`(${check.nameAr})`)}`);
      lines.push(`       ${p.dim(check.message)}`);
      if (check.fix) lines.push(`       ${p.green("Fix: " + check.fix)}`);
    }
    lines.push("");
  }

  // Save report if requested
  if (subCmd === "report") {
    const report = [
      "# Saudi Compliance Report",
      `> Generated by TaseesCode on ${new Date().toLocaleString()}`,
      `> Score: ${overallScore}%`,
      "",
      ...allChecks.map(c => {
        const icon = c.status === "pass" ? "\u2705" : c.status === "warn" ? "\u26A0\uFE0F" : c.status === "fail" ? "\u274C" : "\u2139\uFE0F";
        return `${icon} **${c.name}** (${c.nameAr})\n   ${c.message}${c.fix ? `\n   Fix: ${c.fix}` : ""}`;
      }),
    ].join("\n");

    const reportPath = path.resolve(cwd, "COMPLIANCE_REPORT.md");
    await fs.writeFile(reportPath, report, "utf-8");
    lines.push(p.green(`  \uD83D\uDCC4 Report saved: ${reportPath}`));
  }

  lines.push("");
  return lines.join("\n");
}
