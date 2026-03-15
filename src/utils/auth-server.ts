import http from "http";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

// Hosted auth page URL — served via GitHub Pages
const HOSTED_AUTH_URL = "https://taseesai.github.io/taseescode/auth";

/**
 * Local OAuth-like authentication server.
 *
 * 1. Starts a local HTTP server
 * 2. Opens browser to a beautiful auth page
 * 3. User pastes their API key in the browser (or logs into provider)
 * 4. Browser sends key to local server
 * 5. Server validates and returns key to CLI
 * 6. Browser shows "Connected!" — CLI auto-continues
 *
 * Feels exactly like OAuth — no terminal pasting needed.
 */

const AUTH_PAGE_HTML = (provider: string, providerUrl: string, port: number) => `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TaseesCode — Connect ${provider}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e8e8e8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #e8e8e8; }
    .logo span { color: #707070; }
    .subtitle { color: #707070; font-size: 14px; margin-bottom: 32px; }
    .step-label { color: #8b8b8b; font-size: 13px; text-align: left; margin-bottom: 8px; }
    .provider-btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: #e8e8e8;
      font-size: 15px;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 16px;
      transition: all 0.2s;
    }
    .provider-btn:hover { border-color: #555; background: #222; }
    .divider { color: #444; font-size: 12px; margin: 20px 0; text-transform: uppercase; letter-spacing: 2px; }
    .key-input {
      width: 100%;
      padding: 14px 16px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 10px;
      color: #e8e8e8;
      font-size: 14px;
      font-family: monospace;
      outline: none;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }
    .key-input:focus { border-color: #707070; }
    .key-input::placeholder { color: #444; }
    .connect-btn {
      width: 100%;
      padding: 14px 20px;
      background: linear-gradient(135deg, #6b6b6b, #9a9a9a);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .connect-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .connect-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .status { margin-top: 16px; font-size: 14px; min-height: 20px; }
    .status.error { color: #c75050; }
    .status.success { color: #5a9e6f; }
    .status.loading { color: #8b8b8b; }
    .success-card {
      display: none;
      text-align: center;
    }
    .success-card .check {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .success-card h2 { color: #5a9e6f; margin-bottom: 8px; }
    .success-card p { color: #707070; font-size: 14px; }
    .footer { color: #333; font-size: 11px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="card" id="auth-card">
    <div class="logo">◆ TaseesCode <span>× ${provider}</span></div>
    <div class="subtitle">Connect your ${provider} account to TaseesCode</div>

    <div class="step-label">Step 1: Get your API key</div>
    <a href="${providerUrl}" target="_blank" class="provider-btn">
      Open ${provider} Console →
    </a>

    <div class="divider">then</div>

    <div class="step-label">Step 2: Paste your key below</div>
    <input type="password" class="key-input" id="key-input" placeholder="sk-ant-..." autocomplete="off" autofocus>
    <button class="connect-btn" id="connect-btn" onclick="connect()" disabled>Connect</button>
    <div class="status" id="status"></div>

    <div class="footer">Your key is sent only to ${provider}'s API for validation. Never stored on any server.</div>
  </div>

  <div class="card success-card" id="success-card">
    <div class="check">✓</div>
    <h2>Connected!</h2>
    <p>Return to your terminal — TaseesCode is ready.</p>
    <p style="margin-top: 16px; color: #444;">You can close this tab.</p>
  </div>

  <script>
    const input = document.getElementById('key-input');
    const btn = document.getElementById('connect-btn');
    const status = document.getElementById('status');

    input.addEventListener('input', () => {
      btn.disabled = input.value.length < 5;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.length >= 5) connect();
    });

    async function connect() {
      const key = input.value.trim();
      if (!key) return;

      btn.disabled = true;
      status.className = 'status loading';
      status.textContent = 'Verifying with ${provider}...';

      try {
        const res = await fetch('http://localhost:${port}/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });
        const data = await res.json();

        if (data.success) {
          status.className = 'status success';
          status.textContent = 'Verified!';
          document.getElementById('auth-card').style.display = 'none';
          document.getElementById('success-card').style.display = 'block';
        } else {
          status.className = 'status error';
          status.textContent = data.error || 'Invalid key. Please try again.';
          btn.disabled = false;
        }
      } catch (err) {
        status.className = 'status error';
        status.textContent = 'Connection error. Is TaseesCode still running?';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;

interface AuthResult {
  key: string;
  success: boolean;
}

export function startAuthServer(
  provider: string,
  providerUrl: string,
  validateFn: (key: string) => Promise<boolean>
): Promise<AuthResult> {
  return new Promise((resolve) => {
    let resolved = false;

    const server = http.createServer(async (req, res) => {
      // CORS headers
      const origin = req.headers.origin || "";
      const allowedOrigins = [HOSTED_AUTH_URL, `http://localhost`];
      const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
      res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : HOSTED_AUTH_URL);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Serve auth page
      if (req.method === "GET" && req.url === "/") {
        const port = (server.address() as any)?.port || 0;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(AUTH_PAGE_HTML(provider, providerUrl, port));
        return;
      }

      // Handle key submission
      if (req.method === "POST" && req.url === "/auth") {
        let body = "";
        let bodySize = 0;
        req.on("data", (chunk: Buffer) => {
          bodySize += chunk.length;
          if (bodySize > 10000) { res.writeHead(413); res.end(); req.destroy(); return; }
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const { key } = JSON.parse(body);
            const valid = await validateFn(key);

            if (valid) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true }));

              if (!resolved) {
                resolved = true;
                // Give browser time to show success
                setTimeout(() => {
                  server.close();
                  resolve({ key, success: true });
                }, 1000);
              }
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, error: "Invalid API key. Please check and try again." }));
            }
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Invalid request" }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    // Listen on random port
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any)?.port;

      // Try hosted page first (always renders), with localhost fallback
      const hostedUrl = `${HOSTED_AUTH_URL}?port=${port}&provider=${encodeURIComponent(provider)}&url=${encodeURIComponent(providerUrl)}`;
      const localUrl = `http://localhost:${port}`;

      // Open browser — prefer hosted URL for reliable rendering
      try {
        const platform = process.platform;
        const url = hostedUrl;
        if (platform === "darwin") {
          execSync(`open "${url}"`, { stdio: "ignore" });
        } else if (platform === "linux") {
          execSync(`xdg-open "${url}"`, { stdio: "ignore" });
        } else if (platform === "win32") {
          execSync(`start "${url}"`, { stdio: "ignore" });
        }
      } catch {
        // Fallback: try local URL
        try {
          const platform = process.platform;
          if (platform === "darwin") {
            execSync(`open "${localUrl}"`, { stdio: "ignore" });
          } else if (platform === "linux") {
            execSync(`xdg-open "${localUrl}"`, { stdio: "ignore" });
          } else if (platform === "win32") {
            execSync(`start "${localUrl}"`, { stdio: "ignore" });
          }
        } catch {
          // Both failed — user navigates manually
        }
      }
    });

    // Auto-timeout after 5 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        resolve({ key: "", success: false });
      }
    }, 5 * 60 * 1000);
  });
}
