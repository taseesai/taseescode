import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Agent, AgentCallbacks } from "./core/agent";
import { getBannerText } from "./ui/banner";
import { Prompt } from "./ui/prompt";
import { Message } from "./ui/message";
import { Spinner } from "./ui/spinner";
import { helpCommand } from "./commands/help";
import { clearCommand } from "./commands/clear";
import { modelCommand, launchAnthropicAuth } from "./commands/model";
import { costCommand } from "./commands/cost";
import { configCommand } from "./commands/config-cmd";
import { memoryCommand } from "./commands/memory-cmd";
import { skillsCommand } from "./commands/skills";
import { apiCommand } from "./commands/api";
import { exitCommand } from "./commands/exit";
import { handleReview } from "./commands/review";
import { handleExplain } from "./commands/explain";
import { handleFix } from "./commands/fix";
import { handleHistory } from "./commands/history";
import { handleStandup } from "./commands/standup";
import { handleHealth } from "./commands/health";
import { handleMultiAgent } from "./commands/multiagent";
import { handleScrape } from "./commands/scrape";
import { handleBudget } from "./commands/budget";
import { handleTrust } from "./commands/trust";
import { handleAudit } from "./commands/audit";
import { handleLearn } from "./commands/learn";
import { handleDeploy } from "./commands/deploy";
import { handleDebt } from "./commands/debt";
import { handleTestGen } from "./commands/test-gen";
import { handleOffline } from "./commands/offline";
import { handleVoice, startVoiceRecording } from "./commands/voice";
import { handleReplay, recordEntry, isRecording } from "./commands/replay";
import { handleDiffExplain } from "./commands/diff-explain";
import { handleExplainAr } from "./commands/explain-ar";
import { ModelPicker } from "./ui/model-picker";
import { MODEL_REGISTRY } from "./models";
import { getConfig } from "./utils/config";
import { getSessionCost } from "./utils/cost";
import { generateSessionId, saveSession, SessionRecord } from "./utils/session";
import { getTheme } from "./utils/theme";

// Register all tools
import "./tools/read-file";
import "./tools/write-file";
import "./tools/create-file";
import "./tools/delete-file";
import "./tools/list-files";
import "./tools/run-command";
import "./tools/search-code";
import "./tools/git";
import "./tools/scrape-tool";

interface DisplayMessage {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  toolSuccess?: boolean;
  isStreaming?: boolean;
}

interface PendingApproval {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

let msgId = 0;

export const App: React.FC = () => {
  const { exit } = useApp();
  const config = getConfig();
  const theme = getTheme(config.theme || 'silver');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null);
  const sessionId = useRef(generateSessionId());

  const [agent] = useState<Agent>(() => {
    const callbacks: AgentCallbacks = {
      onThinking: () => {},
      onResponse: (text) => {
        setMessages((prev) => [
          ...prev,
          { id: ++msgId, role: "assistant", content: text },
        ]);
      },
      onStreamChunk: (chunk) => {
        setMessages((prev) => {
          // Find the streaming message and append to it
          const last = prev[prev.length - 1];
          if (last && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk },
            ];
          }
          // Create new streaming message
          const newId = ++msgId;
          setStreamingMsgId(newId);
          return [
            ...prev,
            { id: newId, role: "assistant", content: chunk, isStreaming: true },
          ];
        });
      },
      onStreamEnd: () => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, isStreaming: false },
            ];
          }
          return prev;
        });
        setStreamingMsgId(null);
      },
      onToolCall: (name, args) => {
        // End any active stream first
        setMessages((prev) => {
          const updated = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
          return [
            ...updated,
            {
              id: ++msgId,
              role: "tool" as const,
              content: `Calling ${name}...`,
              toolName: name,
              toolSuccess: true,
            },
          ];
        });
        setStreamingMsgId(null);
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

  // Save session + flush memory on exit
  const saveCurrentSession = useCallback(async () => {
    try {
      // Flush auto-memory to disk
      await agent.flushMemory();

      const cost = getSessionCost();
      const conv = agent.getConversation();
      const session: SessionRecord = {
        id: sessionId.current,
        startedAt: new Date().toISOString(),
        model: agent.getModel(),
        cwd: process.cwd(),
        messageCount: conv.getMessageCount(),
        totalCostSAR: cost.totalCostSAR,
        messages: conv.getSerializableMessages(),
      };
      if (session.messageCount > 0) {
        await saveSession(session);
      }
    } catch {
      // Silent fail — don't block exit
    }
  }, [agent]);

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
      const SLASH_CMDS = [
        "help","clear","model","cost","config","memory","skills","exit","api",
        "review","explain","fix","history","standup","health",
        "compact","permissions","multiagent","scrape",
        "budget","trust","audit","learn",
        "deploy","debt","test-gen","offline","voice",
        "replay","diff-explain","explain-ar",
      ];
      const firstToken = input.startsWith("/") ? input.slice(1).split(/[\s/]/)[0] : "";
      if (input.startsWith("/") && SLASH_CMDS.includes(firstToken)) {
        const parts = input.slice(1).split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        const argsStr = parts.slice(1).join(" ");

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
            if (args.length === 0) {
              setShowModelPicker(true);
              return;
            }
            const result = modelCommand(args, agent.getModel());
            if (result.startsWith("__SWITCH__")) {
              const newModel = result.replace("__SWITCH__", "");
              agent.setModel(newModel);
              output = `✅ Switched to ${MODEL_REGISTRY[newModel].name}`;
            } else if (result.startsWith("__AUTH_ANTHROPIC__")) {
              const targetModel = result.replace("__AUTH_ANTHROPIC__", "");
              setMessages(prev => [...prev, {
                id: ++msgId, role: "system",
                content: `🌐 Opening browser for Anthropic authentication...\n   Complete sign-in in your browser — TaseesCode will detect it automatically.`
              }]);
              setIsLoading(true);
              const authResult = await launchAnthropicAuth();
              setIsLoading(false);
              if (authResult.success) {
                agent.setModel(targetModel);
                output = `✅ Authenticated with Anthropic! Switched to ${MODEL_REGISTRY[targetModel].name}`;
              } else {
                output = `Authentication cancelled. Use /config set apiKeys.anthropic YOUR_KEY to set manually.`;
              }
            } else if (result.startsWith("__LOCKED__")) {
              output = result;
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
          case "review":
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleReview(argsStr, agent);
            setIsLoading(false);
            if (!output) return; // AI handled the response
            break;
          case "explain":
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleExplain(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          case "fix":
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleFix(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          case "history":
            output = await handleHistory(argsStr);
            break;
          case "standup":
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleStandup(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          case "health":
            output = await handleHealth(argsStr);
            break;
          case "compact": {
            const info = agent.getContextInfo();
            agent.clearConversation();
            output = `Context compacted. Was: ~${info.tokens} tokens, ${info.messages} messages. Cleared.`;
            break;
          }
          case "permissions": {
            const cfg = getConfig();
            output = [
              'Current Permissions:',
              `  File write: ${cfg.permissions.allowFileWrite}`,
              `  Command run: ${cfg.permissions.allowCommandRun}`,
              '',
              'Change with:',
              '  /config set permissions.allowFileWrite ask|always|never',
              '  /config set permissions.allowCommandRun ask|always|never',
            ].join('\n');
            break;
          }
          case "scrape": {
            setIsLoading(true);
            output = await handleScrape(argsStr, (status) => {
              setMessages(prev => [...prev, {
                id: ++msgId, role: "system", content: status,
              }]);
            });
            setIsLoading(false);
            break;
          }
          case "budget":
            output = await handleBudget(argsStr);
            break;
          case "trust":
            output = await handleTrust(argsStr);
            break;
          case "audit": {
            setIsLoading(true);
            output = await handleAudit(argsStr);
            setIsLoading(false);
            break;
          }
          case "learn": {
            setIsLoading(true);
            output = await handleLearn(argsStr);
            setIsLoading(false);
            break;
          }
          case "deploy": {
            setIsLoading(true);
            output = await handleDeploy(argsStr);
            setIsLoading(false);
            break;
          }
          case "debt": {
            setIsLoading(true);
            output = await handleDebt(argsStr);
            setIsLoading(false);
            break;
          }
          case "test-gen": {
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleTestGen(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          }
          case "offline":
            output = await handleOffline(argsStr);
            break;
          case "voice": {
            const voiceResult = await handleVoice(argsStr);
            if (voiceResult === "__VOICE_START__") {
              // Start voice recording with animated UI
              setMessages(prev => [...prev, {
                id: ++msgId, role: "system",
                content: "🎙️ Listening... (speak now, stops on silence)",
              }]);
              setIsLoading(true);

              const voiceText = await startVoiceRecording({
                onListening: () => {
                  // Already showing "Listening..."
                },
                onTranscribing: () => {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "system") {
                      updated[updated.length - 1] = { ...last, content: "🎙️ Transcribing..." };
                    }
                    return updated;
                  });
                },
                onPartialText: (text) => {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "system") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: `🎙️ ${text}▊`,
                      };
                    }
                    return updated;
                  });
                },
                onFinalText: (text) => {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "system") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: `🎙️ "${text}"`,
                      };
                    }
                    return updated;
                  });
                },
                onError: (error) => {
                  setMessages(prev => [...prev, {
                    id: ++msgId, role: "system", content: error,
                  }]);
                },
              });

              if (voiceText) {
                // Submit the transcribed text as a regular message
                setMessages(prev => [...prev, {
                  id: ++msgId, role: "user", content: voiceText,
                }]);
                try {
                  await agent.processMessage(voiceText);
                } catch (err: any) {
                  setMessages(prev => [...prev, {
                    id: ++msgId, role: "system",
                    content: `Error: ${err.message}`,
                  }]);
                }
              }
              setIsLoading(false);
              return;
            }
            output = voiceResult;
            break;
          }
          case "replay":
            output = await handleReplay(argsStr);
            break;
          case "diff-explain": {
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleDiffExplain(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          }
          case "explain-ar": {
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            setIsLoading(true);
            output = await handleExplainAr(argsStr, agent);
            setIsLoading(false);
            if (!output) return;
            break;
          }
          case "multiagent": {
            setMessages(prev => [...prev, { id: ++msgId, role: "user", content: input }]);
            await handleMultiAgent(argsStr, agent.getModel(), {
              addMessage: (role, content, toolName?, toolSuccess?) => {
                setMessages(prev => [...prev, {
                  id: ++msgId,
                  role: role as any,
                  content,
                  toolName,
                  toolSuccess,
                }]);
              },
              setLoading: (loading) => setIsLoading(loading),
              onApproval: (name, args) => {
                return new Promise<boolean>((resolve) => {
                  setApproval({ toolName: name, args, resolve });
                });
              },
              onStreamChunk: (chunk) => {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.isStreaming) {
                    return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
                  }
                  return [...prev, { id: ++msgId, role: "assistant", content: chunk, isStreaming: true }];
                });
              },
              onStreamEnd: () => {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.isStreaming) {
                    return [...prev.slice(0, -1), { ...last, isStreaming: false }];
                  }
                  return prev;
                });
              },
            });
            return;
          }
          case "exit":
            output = exitCommand();
            setMessages((prev) => [
              ...prev,
              { id: ++msgId, role: "system", content: output },
            ]);
            await saveCurrentSession();
            setTimeout(() => exit(), 500);
            return;
          default:
            output = `Unknown command: /${cmd}. Type /help for available commands.`;
        }

        if (output) {
          setMessages((prev) => {
            // Dedup: don't add if last message has same content
            const last = prev[prev.length - 1];
            if (last && last.role === "system" && last.content === output) return prev;
            return [...prev, { id: ++msgId, role: "system", content: output }];
          });
        }
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
    [agent, exit, saveCurrentSession]
  );

  // Context info for status bar
  const contextInfo = initialized ? agent.getContextInfo() : { tokens: 0, messages: 0 };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{getBannerText(agent.getModel())}</Text>
      <Text color={theme.dim}>
        {`  Model: ${MODEL_REGISTRY[agent.getModel()]?.name || agent.getModel()} | Type /help for commands\n`}
      </Text>

      {messages.map((msg) => (
        <Message
          key={msg.id}
          role={msg.role}
          content={msg.content}
          toolName={msg.toolName}
          toolSuccess={msg.toolSuccess}
          isStreaming={msg.isStreaming}
          theme={theme}
        />
      ))}

      {isLoading && !approval && !streamingMsgId && <Spinner label="Thinking..." />}

      {approval && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={theme.warning}>{`⚡ ${approval.toolName}`}</Text>
          <Text color={theme.dim}>
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
            <Text color={theme.success}>{"[y]"}</Text>
            <Text>{" / "}</Text>
            <Text color={theme.error}>{"[n]"}</Text>
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

              // Anthropic models → launch OAuth flow
              if (m.provider === "anthropic") {
                setMessages(prev => [...prev, {
                  id: ++msgId, role: "system",
                  content: `🌐 Opening browser for Anthropic authentication...\n   Complete sign-in in your browser — TaseesCode will detect it automatically.`
                }]);
                setIsLoading(true);
                launchAnthropicAuth().then((authResult) => {
                  setIsLoading(false);
                  if (authResult.success) {
                    agent.setModel(id);
                    setMessages(prev => [...prev, {
                      id: ++msgId, role: "system",
                      content: `✅ Authenticated with Anthropic! Switched to ${m.name}`
                    }]);
                  } else {
                    setMessages(prev => [...prev, {
                      id: ++msgId, role: "system",
                      content: `Authentication cancelled. Use /config set apiKeys.anthropic YOUR_KEY to set manually.`
                    }]);
                  }
                });
              } else {
                setMessages(prev => [...prev, {
                  id: ++msgId, role: "system",
                  content: `🔒 ${m.name} needs an API key. Set it with: /config set apiKeys.${m.provider} YOUR_KEY`
                }]);
              }
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
        <>
          {/* Status bar */}
          <Box marginTop={0}>
            <Text color={theme.dim}>
              {`  ${contextInfo.messages} msgs | ~${Math.round(contextInfo.tokens / 1000)}K tokens`}
            </Text>
          </Box>
          <Prompt onSubmit={handleSubmit} isLoading={false} />
        </>
      )}
    </Box>
  );
};
