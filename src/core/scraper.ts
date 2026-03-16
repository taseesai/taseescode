/**
 * TaseesScrape — The ultimate CLI scraping engine.
 *
 * Architecture:
 * - Static pages: fetch() + Cheerio + Readability + Turndown → Markdown
 * - JS-rendered: Playwright + Readability + Turndown → Markdown
 * - PDFs: download + pdf-parse → text
 * - Screenshots: Playwright → PNG
 * - Links: Cheerio → all <a href>
 * - Crawl: sitemapper + recursive fetch
 * - API discovery: Playwright network interception
 * - Raw: fetch() → HTML string
 *
 * Smart mode auto-detects the best approach.
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import path from "path";
import fs from "fs-extra";

// Lazy imports for heavy deps
let Readability: any = null;
let parseHTML: any = null;

async function loadReadability() {
  if (!Readability) {
    const mod = await import("@mozilla/readability");
    Readability = mod.Readability;
  }
  if (!parseHTML) {
    const linkedom = await import("linkedom");
    parseHTML = linkedom.parseHTML;
  }
}

export interface ScrapeOptions {
  mode: "smart" | "screenshot" | "pdf" | "links" | "full" | "crawl" | "api" | "raw";
  url: string;
  depth?: number;        // For crawl mode
  maxPages?: number;     // For crawl mode
  output?: string;       // Output file path
  selector?: string;     // CSS selector to extract specific elements
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  mode: string;
  title?: string;
  content?: string;      // Main content (markdown or text)
  html?: string;         // Raw HTML
  links?: string[];      // Extracted links
  screenshot?: string;   // File path to screenshot
  pages?: { url: string; title: string }[];  // Crawl results
  apis?: { method: string; url: string; type: string }[];  // API endpoints
  error?: string;
  metadata?: {
    statusCode?: number;
    contentType?: string;
    wordCount?: number;
    fetchTimeMs?: number;
  };
}

// ─── Turndown setup ───
function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
  // Remove scripts, styles, nav, footer, ads
  td.remove(["script", "style", "nav", "footer", "aside", "iframe", "noscript"]);
  return td;
}

// ─── Smart fetch with headers ───
async function smartFetch(url: string): Promise<{ html: string; statusCode: number; contentType: string; fetchTimeMs: number }> {
  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
    },
    redirect: "follow",
  });
  const html = await response.text();
  return {
    html,
    statusCode: response.status,
    contentType: response.headers.get("content-type") || "",
    fetchTimeMs: Date.now() - start,
  };
}

// ─── Extract content with Readability ───
async function extractContent(html: string, url: string): Promise<{ title: string; content: string; textContent: string } | null> {
  await loadReadability();
  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document, { url });
    const article = reader.parse();
    if (article && article.content) {
      return {
        title: article.title || "",
        content: article.content,
        textContent: article.textContent || "",
      };
    }
  } catch {}
  return null;
}

// ─── HTML to Markdown ───
function htmlToMarkdown(html: string): string {
  const td = createTurndown();
  return td.turndown(html).trim();
}

// ─── Extract links ───
function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    let href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    try {
      const resolved = new URL(href, baseUrl).href;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        links.push(resolved);
      }
    } catch {}
  });

  return links;
}

// ─── Check if URL is PDF ───
function isPdfUrl(url: string, contentType: string): boolean {
  return url.toLowerCase().endsWith(".pdf") || contentType.includes("application/pdf");
}

// ─── Scrape: Smart Mode ───
async function scrapeSmart(url: string, selector?: string): Promise<ScrapeResult> {
  const { html, statusCode, contentType, fetchTimeMs } = await smartFetch(url);

  // PDF detection
  if (isPdfUrl(url, contentType)) {
    return scrapePdf(url);
  }

  // Try Readability first
  const article = await extractContent(html, url);

  let content: string;
  let title: string;

  if (article && article.textContent.length > 100) {
    // Good article content — use it
    title = article.title;
    if (selector) {
      const $ = cheerio.load(html);
      const selected = $(selector).html();
      content = selected ? htmlToMarkdown(selected) : htmlToMarkdown(article.content);
    } else {
      content = htmlToMarkdown(article.content);
    }
  } else {
    // Thin content — might need JS rendering, but try Cheerio first
    const $ = cheerio.load(html);
    title = $("title").text() || "";

    if (selector) {
      const selected = $(selector).html();
      content = selected ? htmlToMarkdown(selected) : "";
    } else {
      // Remove nav/header/footer/script and convert body
      $("script, style, nav, header, footer, aside, iframe").remove();
      content = htmlToMarkdown($("body").html() || html);
    }

    // If content is still too thin, suggest --full mode
    if (content.length < 50) {
      content += "\n\n> ⚠️ Content appears thin. This page may require JavaScript rendering.\n> Try: /scrape " + url + " --full";
    }
  }

  const wordCount = content.split(/\s+/).length;

  return {
    success: true,
    url,
    mode: "smart",
    title,
    content,
    metadata: { statusCode, contentType, wordCount, fetchTimeMs },
  };
}

// ─── Scrape: Full (Playwright) ───
async function scrapeFull(url: string, selector?: string): Promise<ScrapeResult> {
  try {
    const playwright = require("playwright");
    const { chromium } = playwright;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    const html = await page.content();
    const title = await page.title();
    await browser.close();

    let content: string;
    if (selector) {
      const $ = cheerio.load(html);
      const selected = $(selector).html();
      content = selected ? htmlToMarkdown(selected) : "";
    } else {
      const article = await extractContent(html, url);
      if (article) {
        content = htmlToMarkdown(article.content);
      } else {
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer, aside, iframe").remove();
        content = htmlToMarkdown($("body").html() || "");
      }
    }

    return {
      success: true,
      url,
      mode: "full",
      title,
      content,
      metadata: { wordCount: content.split(/\s+/).length },
    };
  } catch (err: any) {
    // Playwright not installed
    if (err.message?.includes("Cannot find module") || err.message?.includes("browserType.launch")) {
      return {
        success: false,
        url,
        mode: "full",
        error: "Playwright not installed. Run: npx playwright install chromium\nFalling back to smart mode...",
      };
    }
    return { success: false, url, mode: "full", error: err.message };
  }
}

// ─── Scrape: Screenshot ───
async function scrapeScreenshot(url: string, output?: string): Promise<ScrapeResult> {
  try {
    const playwright = require("playwright");
    const { chromium } = playwright;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    const filename = output || `screenshot-${Date.now()}.png`;
    const filepath = path.resolve(process.cwd(), filename);
    await page.screenshot({ path: filepath, fullPage: true });
    await browser.close();

    return {
      success: true,
      url,
      mode: "screenshot",
      screenshot: filepath,
      content: `Screenshot saved to: ${filepath}`,
    };
  } catch (err: any) {
    return { success: false, url, mode: "screenshot", error: err.message };
  }
}

// ─── Scrape: PDF ───
async function scrapePdf(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const buffer = Buffer.from(await response.arrayBuffer());

    // Try to use pdf-parse if available
    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return {
        success: true,
        url,
        mode: "pdf",
        title: data.info?.Title || path.basename(url),
        content: data.text,
        metadata: {
          wordCount: data.text.split(/\s+/).length,
          contentType: "application/pdf",
        },
      };
    } catch {
      return {
        success: false,
        url,
        mode: "pdf",
        error: "pdf-parse not installed. Run: npm install -g pdf-parse",
      };
    }
  } catch (err: any) {
    return { success: false, url, mode: "pdf", error: err.message };
  }
}

// ─── Scrape: Links ───
async function scrapeLinks(url: string): Promise<ScrapeResult> {
  const { html, statusCode } = await smartFetch(url);
  const links = extractLinks(html, url);
  const $ = cheerio.load(html);

  // Categorize links
  const internal: string[] = [];
  const external: string[] = [];
  const urlObj = new URL(url);

  for (const link of links) {
    try {
      const linkObj = new URL(link);
      if (linkObj.hostname === urlObj.hostname) {
        internal.push(link);
      } else {
        external.push(link);
      }
    } catch {}
  }

  const content = [
    `# Links from ${url}`,
    "",
    `## Internal (${internal.length})`,
    ...internal.map(l => `- ${l}`),
    "",
    `## External (${external.length})`,
    ...external.map(l => `- ${l}`),
    "",
    `**Total: ${links.length} links**`,
  ].join("\n");

  return {
    success: true,
    url,
    mode: "links",
    title: $("title").text(),
    content,
    links,
    metadata: { statusCode },
  };
}

// ─── Scrape: Crawl ───
async function scrapeCrawl(url: string, maxPages: number = 10): Promise<ScrapeResult> {
  const visited = new Set<string>();
  const pages: { url: string; title: string }[] = [];
  const baseHost = new URL(url).hostname;
  const queue: string[] = [url];

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const { html } = await smartFetch(currentUrl);
      const $ = cheerio.load(html);
      const title = $("title").text().trim();
      pages.push({ url: currentUrl, title: title || currentUrl });

      // Extract same-domain links
      const links = extractLinks(html, currentUrl);
      for (const link of links) {
        try {
          const linkHost = new URL(link).hostname;
          if (linkHost === baseHost && !visited.has(link) && !queue.includes(link)) {
            queue.push(link);
          }
        } catch {}
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }

  const content = [
    `# Site Crawl: ${url}`,
    `**Pages found: ${pages.length}** (max: ${maxPages})`,
    "",
    ...pages.map((p, i) => `${i + 1}. [${p.title}](${p.url})`),
  ].join("\n");

  return {
    success: true,
    url,
    mode: "crawl",
    content,
    pages,
  };
}

// ─── Scrape: API Discovery ───
async function scrapeApi(url: string): Promise<ScrapeResult> {
  try {
    const playwright = require("playwright");
    const { chromium } = playwright;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const apis: { method: string; url: string; type: string }[] = [];

    // Intercept all network requests
    page.on("request", (req: any) => {
      const reqUrl = req.url();
      const resourceType = req.resourceType();
      if (resourceType === "xhr" || resourceType === "fetch") {
        apis.push({
          method: req.method(),
          url: reqUrl,
          type: resourceType,
        });
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy-loaded content
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(2000);

    await browser.close();

    // Deduplicate
    const seen = new Set<string>();
    const unique = apis.filter(a => {
      const key = `${a.method} ${a.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const content = [
      `# API Endpoints Discovered: ${url}`,
      `**${unique.length} endpoints found**`,
      "",
      ...unique.map(a => `- \`${a.method}\` ${a.url} (${a.type})`),
    ].join("\n");

    return {
      success: true,
      url,
      mode: "api",
      content,
      apis: unique,
    };
  } catch (err: any) {
    return { success: false, url, mode: "api", error: err.message };
  }
}

// ─── Scrape: Raw HTML ───
async function scrapeRaw(url: string): Promise<ScrapeResult> {
  const { html, statusCode, contentType, fetchTimeMs } = await smartFetch(url);
  return {
    success: true,
    url,
    mode: "raw",
    content: html,
    html,
    metadata: { statusCode, contentType, fetchTimeMs },
  };
}

// ═══════════════════════════════════════
// Main scrape function
// ═══════════════════════════════════════
export async function scrape(options: ScrapeOptions): Promise<ScrapeResult> {
  const { mode, url, maxPages, output, selector } = options;

  // Validate URL
  try {
    new URL(url);
  } catch {
    return { success: false, url, mode, error: `Invalid URL: ${url}` };
  }

  switch (mode) {
    case "smart":      return scrapeSmart(url, selector);
    case "full":       return scrapeFull(url, selector);
    case "screenshot": return scrapeScreenshot(url, output);
    case "pdf":        return scrapePdf(url);
    case "links":      return scrapeLinks(url);
    case "crawl":      return scrapeCrawl(url, maxPages || 10);
    case "api":        return scrapeApi(url);
    case "raw":        return scrapeRaw(url);
    default:           return scrapeSmart(url, selector);
  }
}
