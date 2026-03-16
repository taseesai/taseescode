/**
 * Auto-Install — silently installs missing system dependencies.
 *
 * TaseesCode never asks the user to "go install X manually".
 * If something is missing, it installs it automatically.
 */

import { execSync } from "child_process";

export interface InstallResult {
  success: boolean;
  message: string;
}

function getPackageManager(onStatus?: (msg: string) => void): "brew" | "apt" | "yum" | "choco" | null {
  const platform = process.platform;
  if (platform === "darwin") {
    try { execSync("which brew", { stdio: "pipe", timeout: 3000 }); return "brew"; } catch {}

    // Auto-install Homebrew on macOS if missing
    onStatus?.("Installing Homebrew (macOS package manager)...");
    try {
      execSync(
        '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        { stdio: "pipe", timeout: 300000, encoding: "utf-8", env: { ...process.env, NONINTERACTIVE: "1" } }
      );
      // Add brew to PATH for this session
      try {
        const brewPath = execSync("find /opt/homebrew/bin/brew /usr/local/bin/brew 2>/dev/null | head -1", {
          stdio: "pipe", encoding: "utf-8", timeout: 3000,
        }).trim();
        if (brewPath) {
          process.env.PATH = `${require("path").dirname(brewPath)}:${process.env.PATH}`;
        }
      } catch {}
      try { execSync("which brew", { stdio: "pipe", timeout: 3000 }); return "brew"; } catch {}
    } catch {}
  }
  if (platform === "linux") {
    try { execSync("which apt-get", { stdio: "pipe", timeout: 3000 }); return "apt"; } catch {}
    try { execSync("which yum", { stdio: "pipe", timeout: 3000 }); return "yum"; } catch {}
  }
  if (platform === "win32") {
    try { execSync("choco --version", { stdio: "pipe", timeout: 3000 }); return "choco"; } catch {}
  }
  return null;
}

function isInstalled(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a system package is installed. Installs automatically if missing.
 */
export function ensureInstalled(
  command: string,
  packages: { brew?: string; apt?: string; yum?: string; choco?: string; npm?: string },
  onStatus?: (msg: string) => void
): InstallResult {
  // Already installed
  if (isInstalled(command)) {
    return { success: true, message: `${command} is available` };
  }

  // Try npm global install first (cross-platform)
  if (packages.npm) {
    onStatus?.(`Installing ${command} via npm...`);
    try {
      execSync(`npm install -g ${packages.npm}`, {
        stdio: "pipe",
        timeout: 60000,
        encoding: "utf-8",
      });
      if (isInstalled(command)) {
        return { success: true, message: `Installed ${command} via npm` };
      }
    } catch {}
  }

  // Try system package manager (auto-installs brew on macOS if needed)
  const pm = getPackageManager(onStatus);
  if (!pm) {
    return {
      success: false,
      message: `Cannot install ${command}: no package manager found (brew/apt/yum/choco)`,
    };
  }

  const pkgName = packages[pm];
  if (!pkgName) {
    return {
      success: false,
      message: `Cannot install ${command}: no package defined for ${pm}`,
    };
  }

  onStatus?.(`Installing ${command} via ${pm}...`);

  try {
    const cmds: Record<string, string> = {
      brew: `brew install ${pkgName}`,
      apt: `sudo apt-get install -y ${pkgName}`,
      yum: `sudo yum install -y ${pkgName}`,
      choco: `choco install ${pkgName} -y`,
    };

    execSync(cmds[pm], {
      stdio: "pipe",
      timeout: 120000, // 2 min timeout for installs
      encoding: "utf-8",
    });

    if (isInstalled(command)) {
      return { success: true, message: `Installed ${command} via ${pm}` };
    }

    return { success: false, message: `Installed ${pkgName} but ${command} not found in PATH` };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to install ${command}: ${err.message?.slice(0, 100)}`,
    };
  }
}

/**
 * Ensure an npm package is available (local or global).
 */
export function ensureNpmPackage(
  packageName: string,
  onStatus?: (msg: string) => void
): InstallResult {
  // Check if already available
  try {
    require.resolve(packageName);
    return { success: true, message: `${packageName} is available` };
  } catch {}

  // Try to install globally
  onStatus?.(`Installing ${packageName}...`);
  try {
    execSync(`npm install -g ${packageName}`, {
      stdio: "pipe",
      timeout: 60000,
      encoding: "utf-8",
    });
    return { success: true, message: `Installed ${packageName}` };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to install ${packageName}: ${err.message?.slice(0, 100)}`,
    };
  }
}
