import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Agent, AgentCallbacks } from "./core/agent";
import { getBannerText } from "./ui/banner";
import { Prompt } from "./ui/prompt";
import { Message } from "./ui/message";
import { Spinner } from "./ui/spinner";
import { helpCommand } from "./commands/help";
import { clearCommand } from "./commands/clear";
import { modelCommand } from "./commands/model";
import { costCommand } from "./commands/cost";
import { configCommand } from "./commands/config-cmd";
import { memoryCommand } from "./commands/memory-cmd";
import { skillsCommand } from "./commands/skills";
import { apiCommand } from "./commands/api";
import { exitCommand } from "./commands/exit";
import { ModelPicker } from "./ui/model-picker";
import { MODEL_REGISTRY } from "./models";

// Register all tools
import "./tools/read-file";
import "./tools/write-file";
import "./tools/create-file";
import "./tools/delete-file";
import "./tools/list-files";
import "./tools/run-command";
import "./tools/search-code";
import "./tools/git";

interface DisplayMessage {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolSuccess?: boolean;
}

interface PendingApproval {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

let msgId = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [agent] = useState<Agent>(() => {
    const callbacks: AgentCallbacks = {
      onThinking: () => {},
      onResponse: (text) => {
        setMessages((prev) => [
          ...prev,
          { id: ++msgId, role: "assistant", content: text },
        ]);
      },
      onToolCall: (name, args) => {
        setMessages((prev) => [
          ...prev,
          {
            id: ++msgId,
            role: "tool",
            content: `Calling ${name}...`,
            toolName: name,
            toolSuccess: true,
          },
        ]);
      },
      onToolResult: (name, result, success) => {
        setMessages((prev) => [
          ...prev,
          {
            id: ++msgId,
            role: "tool",
            content: result,
            toolName: name,
            toolSuccess: success,
          },
        ]);
      },
      onApprovalNeeded: (name, args) => {
        return new Promise<boolean>((resolve) => {
          setApproval({ toolName: name, args, resolve });
        });
      },
      onError: (error) => {
        setMessages((prev) => [
          ...prev,
          { id: ++msgId, role: "system", content: `Error: ${error}` },
        ]);
      },
    };
    return new Agent(callbacks);
  });

  useEffect(() => {
    agent.initialize(process.cwd()).then(() => {
      setInitialized(true);
    });
  }, []);

  // Handle y/n for approval
  useInput((input) => {
    if (!approval) return;
    if (input === "y" || input === "Y") {
      const { resolve } = approval;
      setApproval(null);
      resolve(true);
    } else if (input === "n" || input === "N") {
      const { resolve } = approval;
      setApproval(null);
      resolve(false);
    }
  }, { isActive: !!approval });

  const handleSubmit = useCallback(
    async (input: string) => {
      // Handle slash commands
      if (input.startsWith("/")) {
        const parts = input.slice(1).split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        let output = "";
        switch (cmd) {
          case "help":
            output = helpCommand();
            break;
          case "clear":
            agent.clearConversation();
            setMessages([]);
            output = clearCommand();
            break;
          case "model": {
            // No args → open interactive picker
            if (args.length === 0) {
              setShowModelPicker(true);
              return;
            }
            const result = modelCommand(args, agent.getModel());
            if (result.startsWith("__SWITCH__")) {
              const newModel = result.replace("__SWITCH__", "");
              agent.setModel(newModel);
              output = `✅ Switched to ${MODEL_REGISTRY[newModel].name}`;
            } else if (result.startsWith("__LOCKED__")) {
              output = result; // handled by modelCommand output
            } else {
              output = result;
            }
            break;
          }
          case "cost":
            output = costCommand();
            break;
          case "config":
            output = configCommand(args);
            break;
          case "memory":
            output = await memoryCommand(args);
            break;
          case "skills":
            output = await skillsCommand(args);
            break;
          case "api":
            output = await apiCommand(args);
            break;
          case "exit":
            output = exitCommand();
            setMessages((prev) => [
              ...prev,
              { id: ++msgId, role: "system", content: output },
            ]);
            setTimeout(() => exit(), 500);
            return;
          default:
            output = `Unknown command: /${cmd}. Type /help for available commands.`;
        }

        setMessages((prev) => [
          ...prev,
          { id: ++msgId, role: "system", content: output },
        ]);
        return;
      }

      // Regular message
      setMessages((prev) => [
        ...prev,
        { id: ++msgId, role: "user", content: input },
      ]);
      setIsLoading(true);

      try {
        await agent.processMessage(input);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          { id: ++msgId, role: "system", content: `Error: ${errorMsg}` },
        ]);
      }

      setIsLoading(false);
    },
    [agent, exit]
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{getBannerText(agent.getModel())}</Text>
      <Text color="gray">
        {`  Model: ${MODEL_REGISTRY[agent.getModel()]?.name || agent.getModel()} | Type /help for commands\n`}
      </Text>

      {messages.map((msg) => (
        <Message
          key={msg.id}
          role={msg.role}
          content={msg.content}
          toolName={msg.toolName}
          toolSuccess={msg.toolSuccess}
        />
      ))}

      {isLoading && !approval && <Spinner label="Thinking..." />}

      {approval && (
        <Box flexDirection="column" marginY={1}>
          <Text bold>{`⚡ ${approval.toolName}`}</Text>
          <Text color="gray">
            {Object.entries(approval.args)
              .map(([k, v]) => {
                const val =
                  typeof v === "string" && v.length > 80
                    ? v.slice(0, 80) + "..."
                    : String(v);
                return `    ${k}: ${val}`;
              })
              .join("\n")}
          </Text>
          <Text>
            {"  Allow? "}
            <Text color="green">{"[y]"}</Text>
            <Text>{" / "}</Text>
            <Text color="red">{"[n]"}</Text>
          </Text>
        </Box>
      )}

      {showModelPicker && (
        <ModelPicker
          currentModel={agent.getModel()}
          onSelect={(modelId) => {
            setShowModelPicker(false);
            if (modelId.startsWith("__LOCKED__")) {
              const id = modelId.replace("__LOCKED__", "");
              const m = MODEL_REGISTRY[id];
              setMessages(prev => [...prev, {
                id: ++msgId, role: "system",
                content: `🔒 ${m.name} needs an API key. Set it with: /config set apiKeys.${m.provider} YOUR_KEY`
              }]);
            } else {
              agent.setModel(modelId);
              setMessages(prev => [...prev, {
                id: ++msgId, role: "system",
                content: `✅ Switched to ${MODEL_REGISTRY[modelId].name}`
              }]);
            }
          }}
          onCancel={() => setShowModelPicker(false)}
        />
      )}

      {!isLoading && !approval && !showModelPicker && initialized && (
        <Prompt onSubmit={handleSubmit} isLoading={false} />
      )}
    </Box>
  );
};
