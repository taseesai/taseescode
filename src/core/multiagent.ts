import {
  getProvider,
  getModelConfig,
  ModelResponse,
  MODEL_REGISTRY,
  ChatMessage,
  StreamCallback,
} from "../models";
import { getConfig } from "../utils/config";
import { getToolDefinitions, executeTool, getTool } from "./tools";
import { trackUsage } from "../utils/cost";
import { withRetry } from "../utils/retry";

/**
 * MultiAgent Orchestrator
 *
 * Flow (credit-efficient):
 * 1. ONE planning call → splits task into N focused sub-tasks (1 API call)
 * 2. Each sub-agent executes tools (FREE — no API calls for tool use)
 * 3. Each sub-agent gets ONE reasoning call with tool results (N API calls)
 * 4. ONE synthesis call → combines all outputs (1 API call)
 *
 * Total: 2 + N calls (typically 5-7 total vs 30+ with naive approach)
 */

export interface SubTask {
  id: number;
  title: string;
  instruction: string;
  tools: string[];      // Which tools this agent should use
  status: "pending" | "running" | "done" | "failed";
  result?: string;
}

export interface MultiAgentCallbacks {
  onPlanReady: (tasks: SubTask[]) => void;
  onAgentStart: (taskId: number, title: string) => void;
  onAgentToolCall: (taskId: number, toolName: string) => void;
  onAgentDone: (taskId: number, result: string) => void;
  onAgentError: (taskId: number, error: string) => void;
  onSynthesizing: () => void;
  onComplete: (finalResult: string) => void;
  onStreamChunk?: StreamCallback;
  onStreamEnd?: () => void;
}

async function callLLM(
  messages: ChatMessage[],
  modelId: string,
  tools?: any[],
  onChunk?: StreamCallback
): Promise<ModelResponse> {
  const config = getConfig();
  const modelConfig = getModelConfig(modelId);
  const apiKey = modelConfig.provider === "custom"
    ? (config.customApis?.[modelId.replace("custom:", "")]?.apiKey || "none")
    : config.apiKeys[modelConfig.provider as keyof typeof config.apiKeys];

  if (!apiKey) throw new Error(`No API key for ${modelConfig.provider}`);

  const provider = getProvider(modelId);

  const response = await withRetry(async () => {
    if (onChunk && provider.chatStream) {
      return provider.chatStream(messages, tools || [], apiKey, modelId, onChunk);
    }
    return provider.chat(messages, tools || [], apiKey, modelId);
  }, { maxRetries: 3 });

  trackUsage(modelId, response.inputTokens, response.outputTokens);
  return response;
}

export async function runMultiAgent(
  task: string,
  modelId: string,
  callbacks: MultiAgentCallbacks,
  approvalFn: (name: string, args: Record<string, unknown>) => Promise<boolean>
): Promise<string> {
  // ═══════════════════════════════════════════
  // STEP 1: Planning — split task into sub-tasks
  // ═══════════════════════════════════════════
  const planningPrompt: ChatMessage[] = [
    {
      role: "system",
      content: `You are a task planner. Split the given task into 2-5 focused sub-tasks that can be worked on independently.

For each sub-task, specify:
- title: short name (e.g., "Set up project structure")
- instruction: detailed instruction for the agent
- tools: which tools the agent should use (from: read_file, write_file, create_file, list_files, search_code, run_command, git_diff)

Respond ONLY with valid JSON array, no markdown, no explanation:
[{"title":"...","instruction":"...","tools":["read_file","create_file"]}]

Keep sub-tasks focused and independent. Each agent works alone.
Working directory: ${process.cwd()}`
    },
    { role: "user", content: task }
  ];

  const planResponse = await callLLM(planningPrompt, modelId);

  // Parse sub-tasks
  let subTasks: SubTask[];
  try {
    const jsonMatch = planResponse.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const parsed = JSON.parse(jsonMatch[0]);
    subTasks = parsed.map((t: any, i: number) => ({
      id: i + 1,
      title: t.title || `Task ${i + 1}`,
      instruction: t.instruction || t.description || "",
      tools: t.tools || [],
      status: "pending" as const,
    }));
  } catch {
    // Fallback: treat entire task as single sub-task
    subTasks = [{
      id: 1,
      title: "Execute task",
      instruction: task,
      tools: ["read_file", "write_file", "create_file", "list_files", "search_code", "run_command"],
      status: "pending",
    }];
  }

  callbacks.onPlanReady(subTasks);

  // ═══════════════════════════════════════════
  // STEP 2: Execute each sub-agent
  // ═══════════════════════════════════════════
  const allTools = getToolDefinitions();

  for (const subTask of subTasks) {
    subTask.status = "running";
    callbacks.onAgentStart(subTask.id, subTask.title);

    try {
      // Agent gets its own conversation
      const agentMessages: ChatMessage[] = [
        {
          role: "system",
          content: `You are Agent #${subTask.id} working on: "${subTask.title}"

Your specific task: ${subTask.instruction}

Rules:
- Use the available tools to complete your task
- Be thorough but efficient
- Working directory: ${process.cwd()}
- After using tools, provide a clear summary of what you did and the results`
        },
        {
          role: "user",
          content: `Execute this task now. Use the tools available to you.\n\nTask: ${subTask.instruction}`
        }
      ];

      // Filter tools to only what this agent needs
      const agentTools = allTools.filter(t =>
        subTask.tools.length === 0 || subTask.tools.includes(t.function.name)
      );

      // Agent loop — max 5 iterations per sub-agent
      let agentIterations = 5;
      let finalOutput = "";

      while (agentIterations-- > 0) {
        // Rate limit protection
        if (agentIterations < 4) {
          await new Promise(r => setTimeout(r, 1500));
        }

        const response = await callLLM(agentMessages, modelId, agentTools);

        // No tool calls → agent is done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalOutput = response.content;
          break;
        }

        // Process tool calls
        agentMessages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(toolCall.function.arguments); } catch {}

          callbacks.onAgentToolCall(subTask.id, toolCall.function.name);

          // Check approval for dangerous tools
          const tool = getTool(toolCall.function.name);
          if (tool?.requiresApproval) {
            const config = getConfig();
            const permKey = toolCall.function.name.includes('command')
              ? 'allowCommandRun' : 'allowFileWrite';
            const perm = config.permissions[permKey as keyof typeof config.permissions];

            let approved = perm === 'always';
            if (!approved && perm !== 'never') {
              approved = await approvalFn(toolCall.function.name, args);
            }

            if (!approved) {
              agentMessages.push({
                role: "tool",
                content: JSON.stringify({ success: false, error: "User denied" }),
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
              });
              continue;
            }
          }

          const { result } = await executeTool(toolCall);
          agentMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          });
        }

        finalOutput = response.content;
      }

      subTask.result = finalOutput;
      subTask.status = "done";
      callbacks.onAgentDone(subTask.id, finalOutput);

    } catch (err: any) {
      subTask.status = "failed";
      subTask.result = `Error: ${err.message}`;
      callbacks.onAgentError(subTask.id, err.message);
    }

    // Delay between agents to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  // ═══════════════════════════════════════════
  // STEP 3: Synthesis — combine all results
  // ═══════════════════════════════════════════
  callbacks.onSynthesizing();

  const agentResults = subTasks.map(t =>
    `## Agent #${t.id}: ${t.title} [${t.status}]\n${t.result || "(no output)"}`
  ).join("\n\n");

  const synthesisMessages: ChatMessage[] = [
    {
      role: "system",
      content: `You are the lead orchestrator. Multiple agents have completed their sub-tasks. Review their outputs and provide a unified, coherent final response to the user's original request.

Be concise. Summarize what was accomplished. Highlight any issues. If code was written, mention the key files created.`
    },
    {
      role: "user",
      content: `Original task: ${task}\n\n--- Agent Results ---\n\n${agentResults}\n\n---\n\nProvide the final unified response.`
    }
  ];

  const synthesis = await callLLM(
    synthesisMessages,
    modelId,
    undefined,
    callbacks.onStreamChunk
  );

  if (callbacks.onStreamEnd) callbacks.onStreamEnd();

  callbacks.onComplete(synthesis.content);
  return synthesis.content;
}
