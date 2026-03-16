import { registerTool, ToolResult } from "../core/tools";
import { scrape } from "../core/scraper";

registerTool({
  name: "scrape_url",
  description:
    "Scrape a webpage OR search the web for a topic and return content as clean Markdown. " +
    "Use this to read web pages, research topics, get documentation, find information. " +
    "For URLs: provide the url field. For topic search: provide the query field instead.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to scrape (optional if query is provided)" },
      query: { type: "string", description: "Search query to find and scrape results (optional if url is provided)" },
      mode: {
        type: "string",
        description: "Scrape mode: smart (default), full (JS-rendered), links, raw, search",
        enum: ["smart", "full", "links", "raw", "search"],
      },
      selector: {
        type: "string",
        description: "CSS selector to extract specific elements (optional)",
      },
    },
    required: [],
  },
  requiresApproval: false, // Reading web content is safe
  async execute(args): Promise<ToolResult> {
    const url = (args.url as string) || "";
    const query = args.query as string | undefined;
    const mode = query && !url ? "search" : ((args.mode as any) || "smart");
    const selector = args.selector as string | undefined;

    if (!url && !query) {
      return { success: false, output: "", error: "Provide either a url or query parameter" };
    }

    try {
      const result = await scrape({ mode, url, query, selector });

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
