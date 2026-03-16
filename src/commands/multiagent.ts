import { runMultiAgent, SubTask, MultiAgentCallbacks } from "../core/multiagent";

export interface MultiAgentUICallbacks {
  addMessage: (role: "system" | "assistant" | "tool", content: string, toolName?: string, toolSuccess?: boolean) => void;
  setLoading: (loading: boolean) => void;
  onApproval: (name: string, args: Record<string, unknown>) => Promise<boolean>;
  onStreamChunk?: (chunk: string) => void;
  onStreamEnd?: () => void;
}

export async function handleMultiAgent(
  task: string,
  modelId: string,
  ui: MultiAgentUICallbacks
): Promise<void> {
  if (!task.trim()) {
    ui.addMessage("system",
      "Usage: /multiagent <task>\n" +
      "Example: /multiagent Build a REST API with authentication and tests\n\n" +
      "The task will be split into sub-agents that work independently,\n" +
      "then TaseesCode synthesizes the final result."
    );
    return;
  }

  ui.setLoading(true);
  ui.addMessage("system", "🧠 Planning task decomposition...");

  const callbacks: MultiAgentCallbacks = {
    onPlanReady: (tasks: SubTask[]) => {
      const plan = tasks.map(t =>
        `  Agent #${t.id}: ${t.title}`
      ).join("\n");
      ui.addMessage("system",
        `📋 Task split into ${tasks.length} agents:\n${plan}\n`
      );
    },
    onAgentStart: (id: number, title: string) => {
      ui.addMessage("tool", `Agent #${id} started: ${title}`, `Agent #${id}`, true);
    },
    onAgentToolCall: (id: number, toolName: string) => {
      ui.addMessage("tool", `Agent #${id} → ${toolName}`, toolName, true);
    },
    onAgentDone: (id: number, result: string) => {
      const preview = result.length > 150 ? result.slice(0, 150) + "..." : result;
      ui.addMessage("tool", `Agent #${id} done: ${preview}`, `Agent #${id}`, true);
    },
    onAgentError: (id: number, error: string) => {
      ui.addMessage("tool", `Agent #${id} failed: ${error}`, `Agent #${id}`, false);
    },
    onSynthesizing: () => {
      ui.addMessage("system", "🔄 All agents complete. Synthesizing final result...");
    },
    onComplete: (_result: string) => {
      // Result is displayed via streaming or onResponse
    },
    onStreamChunk: ui.onStreamChunk,
    onStreamEnd: ui.onStreamEnd,
  };

  try {
    await runMultiAgent(task, modelId, callbacks, ui.onApproval);
  } catch (err: any) {
    ui.addMessage("system", `Multi-agent error: ${err.message}`);
  }

  ui.setLoading(false);
}
