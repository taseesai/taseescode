import { Conversation } from "./conversation";
import { getToolDefinitions, executeTool, getTool } from "./tools";
import {
  getProvider,
  getModelConfig,
  ModelResponse,
  ToolCall,
  MODEL_REGISTRY,
  loadCustomModelsFromConfig,
} from "../models";
import { getConfig } from "../utils/config";
import { trackUsage } from "../utils/cost";
import { detectLanguage } from "../utils/lang-detect";
import { detectImages, loadImage, detectVideos, extractVideoFrames, ImageAttachment } from "../utils/image";
import { readProjectContext, buildFileTree } from "./context";
import { readMemory } from "./memory";
import { loadAllSkills } from "../skills/loader";

export interface AgentCallbacks {
  onThinking: () => void;
  onResponse: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string, success: boolean) => void;
  onApprovalNeeded: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<boolean>;
  onError: (error: string) => void;
}

const SYSTEM_PROMPT = `You are TaseesCode, an AI coding assistant built by TaseesAI in Jeddah, Saudi Arabia.

LANGUAGE RULE (strict):
- Arabic input → respond in Arabic entirely
- English input → respond in English
- Mixed → match dominant language
- Code: variable names always English, comments match user language

IDENTITY:
- Saudi-built, knows NAFATH, HyperPay, Moyasar, PDPL, Elm, Absher APIs
- Costs in SAR not USD
- Vision 2030 aware

TOOLS: read_file, write_file, create_file, delete_file, list_files, run_command, search_code, git_diff, git_commit

BEHAVIOR: concise, show diffs on edits, always ask before destructive ops, read TASEESCODE.md on startup`;

export class Agent {
  private conversation: Conversation;
  private currentModel: string;
  private callbacks: AgentCallbacks;

  constructor(callbacks: AgentCallbacks) {
    this.conversation = new Conversation();
    this.currentModel = getConfig().defaultModel;
    this.callbacks = callbacks;
  }

  async initialize(cwd: string): Promise<void> {
    // Load custom API models from config
    loadCustomModelsFromConfig();

    const context = await readProjectContext(cwd);
    const memory = await readMemory(cwd);
    const skills = await loadAllSkills();

    let systemPrompt = SYSTEM_PROMPT;

    // Add project context
    systemPrompt += `\n\nPROJECT CONTEXT:\n- Working directory: ${cwd}\n- Git repository: ${context.hasGit ? "yes" : "no"}\n- Files:\n${buildFileTree(context.files)}`;

    // Add memory if exists
    if (memory) {
      systemPrompt += `\n\nTASEESCODE.md (project memory):\n${memory}`;
    }

    // Add skill prompts
    for (const skill of skills) {
      if (skill.systemPromptAddition) {
        systemPrompt += `\n\n${skill.systemPromptAddition}`;
      }
    }

    this.conversation.addSystem(systemPrompt);
  }

  async processMessage(userMessage: string): Promise<string> {
    const lang = detectLanguage(userMessage);

    // Detect videos in the message and extract frames
    const videoPaths = detectVideos(userMessage);
    let images: ImageAttachment[] = [];
    let originalModel: string | null = null;

    for (const videoPath of videoPaths) {
      try {
        this.callbacks.onResponse(`🎬 Video detected: ${videoPath}\n   Extracting frames with ffmpeg...`);
        const result = await extractVideoFrames(videoPath, 6);
        this.callbacks.onResponse(
          `🎬 Extracted ${result.frameCount} frames from ${Math.round(result.duration)}s video`
        );
        images.push(...result.frames);
      } catch (err) {
        this.callbacks.onError(`Could not process video: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Detect images in the message
    const imagePaths = detectImages(userMessage);

    if (imagePaths.length > 0 || images.length > 0) {
      const modelConfig = getModelConfig(this.currentModel);

      if (!modelConfig.supportsVision) {
        // Auto-route to a vision-capable model
        const visionModelIds = ["claude-sonnet", "gpt-4o"];
        const config = getConfig();
        const availableVisionModel = visionModelIds.find((id) => {
          const m = MODEL_REGISTRY[id];
          if (!m) return false;
          const key = config.apiKeys[m.provider as keyof typeof config.apiKeys];
          return key && key.length > 10;
        });

        if (availableVisionModel) {
          this.callbacks.onResponse(
            `📸 Image detected — switching to ${MODEL_REGISTRY[availableVisionModel].name} for vision analysis...`
          );
          originalModel = this.currentModel;
          this.currentModel = availableVisionModel;
        } else {
          this.callbacks.onError(
            [
              "📸 Image detected but no vision model available.",
              "",
              "  To analyze images, set one of these keys:",
              "  /config set apiKeys.anthropic sk-ant-...   (Claude Sonnet)",
              "  /config set apiKeys.openai sk-...          (GPT-4o)",
              "",
              "  Get a free Anthropic key at: console.anthropic.com",
            ].join("\n")
          );
          return "";
        }
      }

      // Load all detected images
      for (const imgPath of imagePaths) {
        try {
          const img = await loadImage(imgPath);
          images.push(img);
          this.callbacks.onResponse(`📸 Loaded image: ${img.source}`);
        } catch (err) {
          this.callbacks.onError(`Could not load image: ${imgPath}`);
        }
      }
    }

    // Add message — with or without images
    if (images.length > 0) {
      this.conversation.addUserWithImages(userMessage, images);
    } else {
      this.conversation.addUser(userMessage);
    }

    let response: ModelResponse;
    let maxIterations = 10;

    while (maxIterations-- > 0) {
      this.callbacks.onThinking();

      const config = getConfig();
      const modelConfig = getModelConfig(this.currentModel);
      // Custom providers use their own API key from customApis config
      const apiKey = modelConfig.provider === "custom"
        ? (config.customApis?.[this.currentModel.replace("custom:", "")]?.apiKey || "none")
        : config.apiKeys[modelConfig.provider as keyof typeof config.apiKeys];

      if (!apiKey) {
        if (originalModel) this.currentModel = originalModel;
        const errorMsg =
          lang === "ar"
            ? `لا يوجد مفتاح API لـ ${modelConfig.provider}.\nاستخدم: /config set apiKeys.${modelConfig.provider} YOUR_KEY\nأو اختر نموذجاً مجانياً: /model llama-3.3-70b`
            : `No API key for ${modelConfig.provider}.\nSet it with: /config set apiKeys.${modelConfig.provider} YOUR_KEY\nOr use a free model: /model llama-3.3-70b`;
        this.callbacks.onError(errorMsg);
        return errorMsg;
      }

      const provider = getProvider(this.currentModel);
      const tools = getToolDefinitions();

      try {
        response = await provider.chat(
          this.conversation.getMessages(),
          tools,
          apiKey,
          this.currentModel
        );
      } catch (err: unknown) {
        if (originalModel) this.currentModel = originalModel;
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.callbacks.onError(`API error: ${errorMessage}`);
        return `Error: ${errorMessage}`;
      }

      // Track cost
      trackUsage(
        this.currentModel,
        response.inputTokens,
        response.outputTokens
      );

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (originalModel) this.currentModel = originalModel;
        this.conversation.addAssistant(response.content);
        this.callbacks.onResponse(response.content);
        return response.content;
      }

      // Process tool calls
      this.conversation.addAssistant(response.content, response.toolCalls);

      for (const toolCall of response.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          // continue with empty args
        }

        this.callbacks.onToolCall(toolCall.function.name, args);

        const tool = getTool(toolCall.function.name);
        if (tool?.requiresApproval) {
          const approved = await this.callbacks.onApprovalNeeded(
            toolCall.function.name,
            args
          );
          if (!approved) {
            this.conversation.addToolResult(
              toolCall.id,
              JSON.stringify({
                success: false,
                output: "",
                error: "User denied this action",
              }),
              toolCall.function.name
            );
            this.callbacks.onToolResult(
              toolCall.function.name,
              "Denied by user",
              false
            );
            continue;
          }
        }

        const { result } = await executeTool(toolCall);
        this.conversation.addToolResult(
          toolCall.id,
          JSON.stringify(result),
          toolCall.function.name
        );
        this.callbacks.onToolResult(
          toolCall.function.name,
          result.output || result.error || "",
          result.success
        );
      }

      // Loop back to get next response after tool results
    }

    // Restore original model if we auto-switched for vision
    if (originalModel) {
      this.currentModel = originalModel;
    }

    return response!.content || "Max iterations reached.";
  }

  setModel(modelId: string): void {
    this.currentModel = modelId;
  }

  getModel(): string {
    return this.currentModel;
  }

  clearConversation(): void {
    this.conversation.clear();
  }

  getConversation(): Conversation {
    return this.conversation;
  }
}
