import { registerTool, ToolResult } from "../core/tools";
import { scrape } from "../core/scraper";

registerTool({
  name: "scrape_url",
  description:
    "Scrape a webpage and return its content as clean Markdown. " +
    "Use this to read web pages, extract articles, get documentation, or research topics. " +
    "Returns clean text content, not raw HTML.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to scrape" },
      mode: {
        type: "string",
        description: "Scrape mode: smart (default), full (JS-rendered), links, raw",
        enum: ["smart", "full", "links", "raw"],
      },
      selector: {
        type: "string",
        description: "CSS selector to extract specific elements (optional)",
      },
    },
    required: ["url"],
  },
  requiresApproval: false, // Reading web content is safe
  async execute(args): Promise<ToolResult> {
    const url = args.url as string;
    const mode = (args.mode as any) || "smart";
    const selector = args.selector as string | undefined;

    try {
      const result = await scrape({ mode, url, selector });

      if (!result.success) {
        return { success: false, output: "", error: result.error || "Scrape failed" };
      }

      // Truncate very long content for the LLM context
      let content = result.content || "";
      if (content.length > 15000) {
        content = content.slice(0, 15000) + "\n\n[... content truncated at 15,000 chars ...]";
      }

      const output = [
        result.title ? `Title: ${result.title}` : "",
        result.metadata?.wordCount ? `Words: ${result.metadata.wordCount}` : "",
        "",
        content,
      ].filter(Boolean).join("\n");

      return { success: true, output };
    } catch (err: any) {
      return { success: false, output: "", error: err.message };
    }
  },
});
