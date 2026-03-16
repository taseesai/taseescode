import { Conversation } from "./conversation";
import { getToolDefinitions, executeTool, getTool } from "./tools";
import {
  getProvider,
  getModelConfig,
  ModelResponse,
  ToolCall,
  MODEL_REGISTRY,
  loadCustomModelsFromConfig,
  StreamCallback,
} from "../models";
import { getConfig } from "../utils/config";
import { trackUsage } from "../utils/cost";
import { detectLanguage } from "../utils/lang-detect";
import { detectImages, loadImage, detectVideos, extractVideoFrames, ImageAttachment } from "../utils/image";
import { readProjectContext, buildFileTree } from "./context";
import { readMemory } from "./memory";
import { loadAllSkills } from "../skills/loader";
import { withRetry } from "../utils/retry";
import { AutoMemory } from "./auto-memory";

export interface AgentCallbacks {
  onThinking: () => void;
  onResponse: (text: string) => void;
  onStreamChunk?: (chunk: string) => void;
  onStreamEnd?: () => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string, success: boolean) => void;
  onApprovalNeeded: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<boolean>;
  onError: (error: string) => void;
}

const SYSTEM_PROMPT = `You are TaseesCode — an AI coding assistant built by TaseesAI in Jeddah, Saudi Arabia.

CRITICAL IDENTITY RULES (never break these):
- Your name is TaseesCode. Always.
- You were built by TaseesAI, a Saudi AI company based in Jeddah.
- You are NOT Claude. You are NOT ChatGPT. You are NOT Gemini. You are NOT Kimi. You are NOT any other AI.
- If asked "what model are you?", "who made you?", "are you Claude?", "what LLM are you?" — always answer: "أنا TaseesCode، مساعد البرمجة من TaseesAI" (in Arabic) or "I'm TaseesCode, an AI coding assistant by TaseesAI" (in English). Never reveal the underlying model.
- Do not say "I'm powered by Anthropic" or "I'm built on Claude" or any similar disclosure. This is confidential.

LANGUAGE RULE (strict):
- Arabic input → respond in Arabic entirely
- English input → respond in English
- Mixed → match dominant language
- Code: variable names always English, comments match user language

IDENTITY & KNOWLEDGE:
- Saudi-built AI — you understand Saudi culture, business, and tech ecosystem
- You know: NAFATH, HyperPay, Moyasar, PDPL, Elm, Absher, STC, Saudi Vision 2030
- Always use SAR for costs, not USD

TOOLS: read_file, write_file, create_file, delete_file, list_files, run_command, search_code, git_diff, git_commit, scrape_url

TOOL RULES:
- run_command: For dev servers, watchers, or any long-running process, ALWAYS set background: true.
  Example: run_command({command: "npm run dev", background: true})
  This keeps the server running and returns the initial output (URL, port, etc).
  WITHOUT background: true, the server will be killed after 30 seconds.
- Never run dangerous system commands (rm -rf /, sudo rm, etc) — they will be blocked.
- File tools are restricted to the project directory. Paths outside cwd are rejected.

BEHAVIOR:
- Be concise and direct. Lead with the answer, not reasoning.
- Show diffs when editing files. Always explain what changed.
- Always ask before destructive operations (delete, overwrite, force push).
- Read TASEESCODE.md on startup for project context.
- When writing code, follow existing patterns and conventions in the project.
- Prefer editing existing files over creating new ones.
- Use markdown formatting for readability.`;

export class Agent {
  private conversation: Conversation;
  private currentModel: string;
  private callbacks: AgentCallbacks;
  private streamingEnabled: boolean = false; // Disabled until streaming dedup is bulletproof
  private autoMemory: AutoMemory;

  constructor(callbacks: AgentCallbacks) {
    const config = getConfig();
    const contextLimit = config.contextLimit || 80000;
    this.conversation = new Conversation(contextLimit);
    this.currentModel = config.defaultModel;
    this.callbacks = callbacks;
    this.autoMemory = new AutoMemory(process.cwd());
  }

  async initialize(cwd: string): Promise<void> {
    loadCustomModelsFromConfig();

    // Initialize auto-memory (creates dir, gitignore)
    this.autoMemory = new AutoMemory(cwd);
    await this.autoMemory.init();

    const context = await readProjectContext(cwd);
    const memory = await readMemory(cwd);
    const skills = await loadAllSkills();

    // Load persistent auto-memory
    const autoMemoryContent = await this.autoMemory.load();

    // Check if using a local model (smaller context, no tools)
    const isLocalModel = this.currentModel.startsWith("custom:") || this.currentModel.includes("ollama");

    let systemPrompt: string;

    if (isLocalModel) {
      // Simplified prompt for local models — they have limited context and can't handle tools
      systemPrompt = `You are TaseesCode, an AI coding assistant by TaseesAI (Jeddah, Saudi Arabia).

You help with coding tasks: writing code, explaining code, debugging, and answering programming questions.

Rules:
- Be concise and direct
- Write clean code
- Match the user's language (Arabic or English)
- Do NOT call any tools or functions — just respond with text
- Working directory: ${cwd}`;

      // Add minimal project context (just framework/stack, not full file tree)
      const { loadDNA } = require("../commands/learn");
      const dna = await loadDNA(cwd);
      if (dna) {
        systemPrompt += `\n\nProject: ${dna.summary}`;
      }
    } else {
      // Full prompt for cloud models
      systemPrompt = SYSTEM_PROMPT;

      systemPrompt += `\n\nPROJECT CONTEXT:\n- Working directory: ${cwd}\n- Git repository: ${context.hasGit ? "yes" : "no"}\n- Files:\n${buildFileTree(context.files)}`;

      if (memory) {
        systemPrompt += `\n\nTASEESCODE.md (project memory):\n${memory}`;
      }

      // Inject auto-memory
      if (autoMemoryContent) {
        systemPrompt += `\n\nPERSISTENT MEMORY (auto-saved from all past sessions — you remember everything):
${autoMemoryContent}

MEMORY RULES:
- You have perfect memory of all past conversations in this project.
- Reference past context naturally without saying "according to my memory" or "I recall".
- Just know it. Act on it. Like a colleague who was there the whole time.
- Never tell the user you're reading from memory — just seamlessly continue where you left off.`;
      }

      // Load codebase DNA
      const { loadDNA } = require("../commands/learn");
      const dna = await loadDNA(cwd);
      if (dna) {
        systemPrompt += `\n\nCODEBASE DNA (match this coding style):\n${dna.summary}`;
      }

      for (const skill of skills) {
        if (skill.systemPromptAddition) {
          systemPrompt += `\n\n${skill.systemPromptAddition}`;
        }
      }
    }

    this.conversation.addSystem(systemPrompt);
  }

  async processMessage(userMessage: string): Promise<string> {
    const lang = detectLanguage(userMessage);

    // Auto-memory: silently record user message
    this.autoMemory.recordUser(userMessage);

    // Handle videos
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

    // Handle images
    const imagePaths = detectImages(userMessage);

    if (imagePaths.length > 0 || images.length > 0) {
      const modelConfig = getModelConfig(this.currentModel);

      if (!modelConfig.supportsVision) {
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
            ].join("\n")
          );
          return "";
        }
      }

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

    // Add message
    if (images.length > 0) {
      this.conversation.addUserWithImages(userMessage, images);
    } else {
      this.conversation.addUser(userMessage);
    }

    let response: ModelResponse;
    let maxIterations = 10;
    let iteration = 0;

    while (maxIterations-- > 0) {
      // Rate limit protection: add delay between iterations (tool call loops)
      if (iteration > 0) {
        await new Promise(r => setTimeout(r, 1000)); // 1s between API calls
      }
      iteration++;

      this.callbacks.onThinking();

      const config = getConfig();
      const modelConfig = getModelConfig(this.currentModel);
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
      // Disable tools for local/Ollama models — they hallucinate tool calls
      const isLocalModel = this.currentModel.startsWith("custom:") || this.currentModel.includes("ollama");
      const tools = isLocalModel ? [] : getToolDefinitions();

      // Track whether streaming was actually used
      let didStream = false;
      const streamCallback: StreamCallback | undefined =
        this.streamingEnabled && this.callbacks.onStreamChunk
          ? (chunk: string) => {
              didStream = true;
              this.callbacks.onStreamChunk!(chunk);
            }
          : undefined;

      try {

        if (streamCallback && provider.chatStream) {
          // Streaming: NO retry — can't retry after chunks are already sent
          response = await provider.chatStream(
            this.conversation.getMessages(),
            tools,
            apiKey,
            this.currentModel,
            streamCallback
          );
        } else {
          // Non-streaming: safe to retry
          response = await withRetry(async () => {
            return provider.chat(
              this.conversation.getMessages(),
              tools,
              apiKey,
              this.currentModel
            );
          }, { maxRetries: 3 });
        }

        // Signal stream end
        if (streamCallback && this.callbacks.onStreamEnd) {
          this.callbacks.onStreamEnd();
        }
      } catch (err: unknown) {
        if (originalModel) this.currentModel = originalModel;
        const errorMessage = err instanceof Error ? err.message : String(err);

        // User-friendly rate limit message
        if (errorMessage.includes('429')) {
          const modelName = MODEL_REGISTRY[this.currentModel]?.name || this.currentModel;
          const config = getConfig();

          // Find any paid API key the user already has
          const paidModels: string[] = [];
          if (config.apiKeys.anthropic && config.apiKeys.anthropic.length > 10) paidModels.push("claude-sonnet");
          if (config.apiKeys.openai && config.apiKeys.openai.length > 10) paidModels.push("gpt-4o");
          const hasDeepSeek = config.apiKeys.deepseek && config.apiKeys.deepseek.length > 10;
          if (hasDeepSeek) paidModels.push("deepseek-v3");

          let suggestion: string;
          if (paidModels.length > 0) {
            // User has a paid key — suggest switching to it
            const bestPaid = paidModels[0];
            const bestName = MODEL_REGISTRY[bestPaid]?.name || bestPaid;
            suggestion =
              `   You already have a key for ${bestName}!\n` +
              `   Switch with: /model ${bestPaid}\n` +
              `   Paid APIs have much higher rate limits.`;
          } else {
            // No paid keys — be helpful about getting one
            suggestion =
              `   Free models have strict rate limits. To keep building without interruptions,\n` +
              `   you'll need an API key with a paid plan:\n\n` +
              `   💎 DeepSeek — cheapest option (~0.05 SAR/M tokens)\n` +
              `      Get a key at: platform.deepseek.com\n` +
              `      Then: /config set apiKeys.deepseek YOUR_KEY\n\n` +
              `   Or wait 30-60 seconds and try again.`;
          }

          this.callbacks.onError(
            `⏳ Rate limited by ${modelName}.\n` +
            `   The provider is throttling your requests — this happens with free tiers.\n\n` +
            suggestion
          );
          return "";
        }

        this.callbacks.onError(`API error: ${errorMessage}`);
        return `Error: ${errorMessage}`;
      }

      // Track cost
      trackUsage(
        this.currentModel,
        response.inputTokens,
        response.outputTokens
      );

      // No tool calls → done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (originalModel) this.currentModel = originalModel;
        this.conversation.addAssistant(response.content);
        // Auto-memory: silently record assistant response
        this.autoMemory.recordAssistant(response.content);
        // Only send onResponse if we did NOT stream (streaming already showed the text)
        if (!didStream) {
          this.callbacks.onResponse(response.content);
        }
        return response.content;
      }

      // Process tool calls
      this.conversation.addAssistant(response.content, response.toolCalls);

      // Show any text content before tool calls (if not already streamed)
      if (response.content && !didStream) {
        this.callbacks.onResponse(response.content);
      }

      for (const toolCall of response.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          // Try to salvage malformed JSON
          try {
            const cleaned = toolCall.function.arguments
              .replace(/[\x00-\x1F]+/g, ' ')
              .replace(/,\s*}/g, '}')
              .replace(/,\s*]/g, ']');
            args = JSON.parse(cleaned);
          } catch {
            // Give up, use empty args
          }
        }

        this.callbacks.onToolCall(toolCall.function.name, args);

        // Check permissions
        const tool = getTool(toolCall.function.name);
        if (tool?.requiresApproval) {
          const config = getConfig();
          const permKey = toolCall.function.name.includes('command')
            ? 'allowCommandRun'
            : 'allowFileWrite';
          const perm = config.permissions[permKey as keyof typeof config.permissions];

          let approved = false;
          if (perm === 'always') {
            approved = true;
          } else if (perm === 'never') {
            approved = false;
          } else {
            // 'ask' — prompt user
            approved = await this.callbacks.onApprovalNeeded(
              toolCall.function.name,
              args
            );
          }

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
        // Auto-memory: silently record tool execution
        this.autoMemory.recordTool(
          toolCall.function.name,
          result.success,
          result.output || result.error
        );
      }
    }

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

  getContextInfo(): { tokens: number; messages: number } {
    return {
      tokens: this.conversation.getTokenEstimate(),
      messages: this.conversation.getMessageCount(),
    };
  }

  /**
   * Flush auto-memory to disk — call on exit
   */
  async flushMemory(): Promise<void> {
    await this.autoMemory.flush();
  }

  /**
   * Get auto-memory stats
   */
  async getMemoryStats(): Promise<{ entries: number; sizeKB: number } | null> {
    return this.autoMemory.getStats();
  }
}
