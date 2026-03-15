import { ToolDefinition, ToolCall } from "../models";

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolHandler {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresApproval: boolean;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

const toolHandlers: Map<string, ToolHandler> = new Map();

export function registerTool(handler: ToolHandler): void {
  toolHandlers.set(handler.name, handler);
}

export function getTool(name: string): ToolHandler | undefined {
  return toolHandlers.get(name);
}

export function getAllTools(): ToolHandler[] {
  return Array.from(toolHandlers.values());
}

export function getToolDefinitions(): ToolDefinition[] {
  return getAllTools().map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executeTool(
  toolCall: ToolCall
): Promise<{ handler: ToolHandler; result: ToolResult }> {
  const handler = toolHandlers.get(toolCall.function.name);
  if (!handler) {
    return {
      handler: {
        name: toolCall.function.name,
        description: "",
        parameters: {},
        requiresApproval: false,
        execute: async () => ({
          success: false,
          output: "",
          error: "Unknown tool",
        }),
      },
      result: {
        success: false,
        output: "",
        error: `Unknown tool: ${toolCall.function.name}`,
      },
    };
  }

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return {
      handler,
      result: {
        success: false,
        output: "",
        error: "Failed to parse tool arguments",
      },
    };
  }

  const result = await handler.execute(args);
  return { handler, result };
}
