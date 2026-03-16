import { scrape, ScrapeOptions, ScrapeResult } from "../core/scraper";

/**
 * /scrape — TaseesScrape: The ultimate CLI scraper
 *
 * Usage:
 *   /scrape https://example.com              Smart scrape (auto-detect)
 *   /scrape https://example.com --full        JS-rendered (Playwright)
 *   /scrape https://example.com --screenshot  Capture screenshot
 *   /scrape https://example.com --pdf         Extract PDF text
 *   /scrape https://example.com --links       Extract all links
 *   /scrape https://example.com --crawl       Crawl entire site
 *   /scrape https://example.com --crawl 20    Crawl with max pages
 *   /scrape https://example.com --api         Discover API endpoints
 *   /scrape https://example.com --raw         Raw HTML output
 *   /scrape https://example.com --select "div.content"  CSS selector
 */

type ScrapeMode = ScrapeOptions["mode"];

export async function handleScrape(
  argsStr: string,
  onStatus: (msg: string) => void
): Promise<string> {
  if (!argsStr.trim()) {
    return [
      "🕷️ TaseesScrape — The Ultimate CLI Scraper",
      "━".repeat(45),
      "",
      "Usage: /scrape <url> [options]",
      "",
      "Modes:",
      "  /scrape <url>                Smart scrape (auto-detect)",
      "  /scrape <url> --full         JS-rendered pages (Playwright)",
      "  /scrape <url> --screenshot   Capture full-page screenshot",
      "  /scrape <url> --pdf          Extract text from PDF",
      "  /scrape <url> --links        Extract all links (internal/external)",
      "  /scrape <url> --crawl [n]    Crawl entire site (default: 10 pages)",
      "  /scrape <url> --api          Discover API/XHR endpoints",
      "  /scrape <url> --raw          Raw HTML output",
      "",
      "Options:",
      "  --select \"css\"     Extract specific elements by CSS selector",
      "  --output file.md   Save output to file",
      "",
      "Examples:",
      "  /scrape https://example.com",
      "  /scrape https://news.ycombinator.com --links",
      "  /scrape https://spa-app.com --full",
      "  /scrape https://site.com --crawl 20",
      "  /scrape https://api-site.com --api",
      "  /scrape https://site.com --select \"article.main\"",
    ].join("\n");
  }

  // Parse arguments
  const parts = argsStr.trim().split(/\s+/);
  let url = "";
  let mode: ScrapeMode = "smart";
  let maxPages = 10;
  let output: string | undefined;
  let selector: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("http://") || part.startsWith("https://")) {
      url = part;
    } else if (part === "--full") {
      mode = "full";
    } else if (part === "--screenshot") {
      mode = "screenshot";
    } else if (part === "--pdf") {
      mode = "pdf";
    } else if (part === "--links") {
      mode = "links";
    } else if (part === "--crawl") {
      mode = "crawl";
      // Check if next arg is a number
      if (parts[i + 1] && /^\d+$/.test(parts[i + 1])) {
        maxPages = parseInt(parts[i + 1]);
        i++;
      }
    } else if (part === "--api") {
      mode = "api";
    } else if (part === "--raw") {
      mode = "raw";
    } else if (part === "--output" && parts[i + 1]) {
      output = parts[i + 1];
      i++;
    } else if (part === "--select" && parts[i + 1]) {
      selector = parts[i + 1].replace(/"/g, "");
      i++;
    } else if (!url && !part.startsWith("--")) {
      // Try to treat as URL
      url = part.startsWith("http") ? part : `https://${part}`;
    }
  }

  if (!url) {
    return "❌ No URL provided. Usage: /scrape <url> [--mode]";
  }

  // Auto-add https if missing
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  const modeLabels: Record<ScrapeMode, string> = {
    smart: "🧠 Smart scraping",
    full: "🌐 Full JS rendering",
    screenshot: "📸 Capturing screenshot",
    pdf: "📄 Extracting PDF",
    links: "🔗 Extracting links",
    crawl: `🕷️ Crawling site (max ${maxPages} pages)`,
    api: "🔌 Discovering API endpoints",
    raw: "📝 Fetching raw HTML",
  };

  onStatus(`${modeLabels[mode]}: ${url}...`);

  try {
    const result = await scrape({ mode, url, maxPages, output, selector });

    if (!result.success) {
      return `❌ Scrape failed: ${result.error}`;
    }

    // Build output
    const lines: string[] = [];

    if (result.title) {
      lines.push(`# ${result.title}`);
      lines.push("");
    }

    if (result.metadata) {
      const meta: string[] = [];
      if (result.metadata.statusCode) meta.push(`Status: ${result.metadata.statusCode}`);
      if (result.metadata.wordCount) meta.push(`Words: ${result.metadata.wordCount}`);
      if (result.metadata.fetchTimeMs) meta.push(`Time: ${result.metadata.fetchTimeMs}ms`);
      if (meta.length > 0) {
        lines.push(`> ${meta.join(" · ")}`);
        lines.push("");
      }
    }

    if (result.content) {
      lines.push(result.content);
    }

    if (result.screenshot) {
      lines.push(`📸 Screenshot saved: ${result.screenshot}`);
    }

    const finalOutput = lines.join("\n");

    // Save to file if requested
    if (output) {
      const fs = require("fs-extra");
      const outPath = require("path").resolve(process.cwd(), output);
      await fs.writeFile(outPath, finalOutput, "utf-8");
      return finalOutput + `\n\n💾 Saved to: ${outPath}`;
    }

    return finalOutput;
  } catch (err: any) {
    return `❌ Scrape error: ${err.message}`;
  }
}
