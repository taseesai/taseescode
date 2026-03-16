import chalk from "chalk";
import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import { ensureInstalled } from "../utils/auto-install";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

function detectFramework(cwd: string): { name: string; buildCmd: string; outDir: string } | null {
  try {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = fs.readJSONSync(pkgPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps["next"]) return { name: "Next.js", buildCmd: "npm run build", outDir: ".next" };
    if (deps["vite"]) return { name: "Vite", buildCmd: "npm run build", outDir: "dist" };
    if (deps["react-scripts"]) return { name: "Create React App", buildCmd: "npm run build", outDir: "build" };
    if (deps["nuxt"]) return { name: "Nuxt", buildCmd: "npm run build", outDir: ".nuxt" };
    if (deps["svelte"]) return { name: "SvelteKit", buildCmd: "npm run build", outDir: "build" };
    if (deps["express"] || deps["fastify"]) return { name: "Node.js API", buildCmd: "", outDir: "" };
    if (deps["astro"]) return { name: "Astro", buildCmd: "npm run build", outDir: "dist" };
    return { name: "Node.js", buildCmd: pkg.scripts?.build ? "npm run build" : "", outDir: "dist" };
  } catch { return null; }
}

function detectDeployTool(_cwd: string): string | null {
  try { execSync("vercel --version", { stdio: "ignore", timeout: 5000 }); return "vercel"; } catch {}
  try { execSync("netlify --version", { stdio: "ignore", timeout: 5000 }); return "netlify"; } catch {}
  try { execSync("railway --version", { stdio: "ignore", timeout: 5000 }); return "railway"; } catch {}
  return null;
}

function generateTextQR(url: string): string {
  const short = url.length > 40 ? url.slice(0, 40) + "..." : url;
  return [
    "  +---------------------------------+",
    "  |                                 |",
    "  |   Scan or visit:                |",
    `  |   ${short.padEnd(31)}|`,
    "  |                                 |",
    "  +---------------------------------+",
  ].join("\n");
}

export async function handleDeploy(args: string): Promise<string> {
  const cwd = process.cwd();
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help" || subCmd === "-h") {
    return [
      "",
      p.white.bold("Deploy -- One-Command Deployment"),
      p.gray("-".repeat(40)),
      "",
      "  /deploy              Auto-detect platform and deploy",
      "  /deploy vercel       Deploy to Vercel",
      "  /deploy netlify      Deploy to Netlify",
      "  /deploy railway      Deploy to Railway",
      "  /deploy status       Check deployment status",
      "",
      "  Prerequisites:",
      "  - Vercel:   npm i -g vercel && vercel login",
      "  - Netlify:  npm i -g netlify-cli && netlify login",
      "  - Railway:  npm i -g @railway/cli && railway login",
      "",
      p.dim("  Auto-detects framework, builds, and deploys."),
      p.dim("  Returns a live preview URL you can share."),
      "",
    ].join("\n");
  }

  // Detect framework
  const framework = detectFramework(cwd);
  if (!framework) {
    return p.red("No project detected. Make sure you're in a project directory with package.json.").toString();
  }

  // Detect or use specified platform
  let platform = subCmd || detectDeployTool(cwd);

  if (subCmd === "status") {
    try {
      const output = execSync("vercel ls --limit 3 2>/dev/null || echo 'No deployments found'", {
        cwd, encoding: "utf-8", timeout: 15000,
      });
      return [
        "",
        p.white.bold("Recent Deployments"),
        p.gray("-".repeat(40)),
        "",
        output.trim(),
        "",
      ].join("\n");
    } catch (e: any) {
      return `Could not check status: ${e.message}`;
    }
  }

  if (!platform) {
    return [
      "",
      p.gray("No deployment tool found. Installing Vercel CLI..."),
    ].join("\n");

    // Auto-install vercel
    const result = ensureInstalled("vercel", { npm: "vercel" });
    if (result.success) {
      platform = "vercel";
    } else {
      return [
        p.red("Could not auto-install Vercel CLI."),
        "",
        "  Manual install:",
        p.white("  npm i -g vercel"),
        "",
      ].join("\n");
    }
  }

  const lines: string[] = [
    "",
    p.white.bold("Deploying..."),
    p.gray("-".repeat(40)),
    `  Framework:  ${p.white(framework.name)}`,
    `  Platform:   ${p.white(platform)}`,
    `  Directory:  ${p.dim(cwd)}`,
    "",
  ];

  try {
    let deployOutput = "";
    let deployUrl = "";

    if (platform === "vercel") {
      lines.push(p.gray("  Running: vercel --yes ..."));
      deployOutput = execSync("vercel --yes 2>&1", {
        cwd, encoding: "utf-8", timeout: 120000,
      });
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.vercel\.app/);
      deployUrl = urlMatch ? urlMatch[0] : "";
    } else if (platform === "netlify") {
      if (framework.buildCmd) {
        lines.push(p.gray(`  Building: ${framework.buildCmd} ...`));
        execSync(framework.buildCmd, { cwd, encoding: "utf-8", timeout: 120000, stdio: "pipe" });
      }
      lines.push(p.gray("  Running: netlify deploy --prod ..."));
      deployOutput = execSync(`netlify deploy --prod --dir=${framework.outDir || "dist"} 2>&1`, {
        cwd, encoding: "utf-8", timeout: 120000,
      });
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.netlify\.app/);
      deployUrl = urlMatch ? urlMatch[0] : "";
    } else if (platform === "railway") {
      lines.push(p.gray("  Running: railway up ..."));
      deployOutput = execSync("railway up 2>&1", {
        cwd, encoding: "utf-8", timeout: 120000,
      });
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+\.railway\.app/);
      deployUrl = urlMatch ? urlMatch[0] : "";
    }

    if (deployUrl) {
      lines.push(
        "",
        p.green.bold("  Deployed successfully!"),
        "",
        p.white(`  ${deployUrl}`),
        "",
        generateTextQR(deployUrl),
        "",
        p.dim("  Share this URL with anyone to preview."),
      );
    } else {
      lines.push(
        "",
        p.green("  Deploy command completed."),
        "",
        p.dim("  Output:"),
        p.dim("  " + (deployOutput || "").trim().split("\n").slice(-5).join("\n  ")),
      );
    }
  } catch (err: any) {
    const stderr = err.stderr || err.stdout || err.message;
    lines.push(
      "",
      p.red("  Deployment failed"),
      "",
      p.dim("  " + String(stderr).trim().split("\n").slice(-5).join("\n  ")),
      "",
      p.dim("  Make sure you're logged in: " + platform + " login"),
    );
  }

  lines.push("");
  return lines.join("\n");
}
