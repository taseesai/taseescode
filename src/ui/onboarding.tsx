import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import boxen from "boxen";
import chalk from "chalk";
import axios from "axios";
import { setConfig, setNestedConfig, TaseesConfig } from "../utils/config";

// Color palette
const c = {
  step: chalk.hex("#4A4A4A"),
  selected: chalk.hex("#E8E8E8").bold,
  unselected: chalk.hex("#707070"),
  headAr: chalk.hex("#ABABAB"),
  headEn: chalk.hex("#8B8B8B"),
  success: chalk.hex("#E8E8E8"),
  border: "#8B8B8B",
};

interface OnboardingProps {
  onComplete: () => void;
}

type Step =
  | "welcome"
  | "language"
  | "model"
  | "apikey"
  | "permissions"
  | "theme"
  | "done";

const STEPS_ORDER: Step[] = [
  "welcome",
  "language",
  "model",
  "apikey",
  "permissions",
  "theme",
  "done",
];

interface ModelOption {
  id: string;
  label: string;
  desc: string;
  needsKey: boolean;
  keyType?: "anthropic" | "openai" | "groq" | "kimi";
  freeKey?: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: "deepseek-v3",
    label: "\u2726 DeepSeek V3",
    desc: "Cheap \u00b7 Fast \u00b7 Arabic \u2713",
    needsKey: false,
  },
  {
    id: "llama-3.3-70b",
    label: "\u2726 Llama 3.3 70B",
    desc: "Free \u00b7 Groq \u00b7 Arabic \u2713",
    needsKey: true,
    keyType: "groq",
    freeKey: true,
  },
  {
    id: "qwen-2.5-coder",
    label: "\u25c8 Qwen 2.5 Coder",
    desc: "Free key \u00b7 Best for code",
    needsKey: false,
  },
  {
    id: "kimi-k1.5",
    label: "\u25c6 Kimi K1.5",
    desc: "128K context \u00b7 Arabic \u2713",
    needsKey: true,
    keyType: "kimi",
  },
  {
    id: "claude-sonnet",
    label: "\u25c6 Claude Sonnet",
    desc: "Paid \u00b7 Best quality",
    needsKey: true,
    keyType: "anthropic",
  },
  {
    id: "gpt-4o",
    label: "\u25c7 GPT-4o",
    desc: "Paid \u00b7 OpenAI",
    needsKey: true,
    keyType: "openai",
  },
];

const LANGUAGES = [
  {
    id: "ar" as const,
    label: "\ud83c\uddf8\ud83c\udde6 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0623\u0648\u0644\u0627\u064b \u2014 Arabic first",
  },
  { id: "en" as const, label: "\ud83c\udf10 English first" },
  {
    id: "auto" as const,
    label: "\u26a1 Auto-detect from input (recommended)",
  },
];

const THEMES = [
  {
    id: "silver" as const,
    label: "\u25c6 Silver  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2014 Default (\u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a)",
  },
  {
    id: "minimal" as const,
    label: "\u25c8 Minimal \u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591  \u2014 Clean",
  },
  {
    id: "dark" as const,
    label: "\u2726 Dark    \u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593  \u2014 High contrast",
  },
];

type PermLevel = "ask" | "session" | "always";

const PERM_FILE_OPTIONS: { id: PermLevel; label: string }[] = [
  {
    id: "ask",
    label: "\ud83d\udd12 Always ask \u2014 Safest (recommended)",
  },
  { id: "session", label: "\u26a1 Ask once per session \u2014 Balanced" },
  { id: "always", label: "\ud83d\ude80 Auto-approve \u2014 Fastest (advanced users)" },
];

const PERM_CMD_OPTIONS: { id: PermLevel; label: string }[] = [
  {
    id: "ask",
    label: "\ud83d\udd12 Always ask \u2014 Safest (recommended)",
  },
  { id: "session", label: "\u26a1 Ask once per session \u2014 Balanced" },
  { id: "always", label: "\u2620\ufe0f  Auto-approve \u2014 Dangerous!" },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [cursor, setCursor] = useState(0);
  const [permSection, setPermSection] = useState<"file" | "cmd">("file");

  // Collected config
  const [language, setLanguage] = useState<"auto" | "ar" | "en">("auto");
  const [model, setModel] = useState("deepseek-v3");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "input" | "validating" | "valid" | "invalid"
  >("input");
  const [permFile, setPermFile] = useState<PermLevel>("ask");
  const [permCmd, setPermCmd] = useState<PermLevel>("ask");
  const [theme, setTheme] = useState<"silver" | "minimal" | "dark">("silver");

  // Auto-advance welcome
  useEffect(() => {
    if (step === "welcome") {
      const timer = setTimeout(() => {
        setStep("language");
        setCursor(2); // auto-detect recommended
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const currentStepNum = (): number => {
    const map: Record<Step, number> = {
      welcome: 0,
      language: 1,
      model: 2,
      apikey: 3,
      permissions: 4,
      theme: 5,
      done: 6,
    };
    return map[step];
  };

  const totalSteps = 6;

  const advanceStep = useCallback(() => {
    const idx = STEPS_ORDER.indexOf(step);
    let next = STEPS_ORDER[idx + 1];

    // Skip apikey step if model doesn't need a key
    if (next === "apikey") {
      const selectedModel = MODELS.find((m) => m.id === model);
      if (!selectedModel?.needsKey) {
        next = "permissions";
      }
    }

    setCursor(0);
    setPermSection("file");
    setStep(next);
  }, [step, model]);

  const saveAndFinish = useCallback(() => {
    const filePermMap: Record<PermLevel, "ask" | "always" | "never"> = {
      ask: "ask",
      session: "ask",
      always: "always",
    };
    const cmdPermMap: Record<PermLevel, "ask" | "always" | "never"> = {
      ask: "ask",
      session: "ask",
      always: "always",
    };

    setConfig("hasCompletedOnboarding", true);
    setConfig("language", language);
    setConfig("defaultModel", model);
    setConfig("theme", theme);
    setConfig("permissions", {
      allowFileWrite: filePermMap[permFile],
      allowCommandRun: cmdPermMap[permCmd],
    });

    if (apiKey && apiKey.length > 0) {
      const selectedModel = MODELS.find((m) => m.id === model);
      if (selectedModel?.keyType) {
        const keyField = selectedModel.keyType;
        setNestedConfig(`apiKeys.${keyField}`, apiKey);
      }
    }

    onComplete();
  }, [language, model, apiKey, permFile, permCmd, theme, onComplete]);

  const validateApiKey = useCallback(
    async (key: string) => {
      setApiKeyStatus("validating");
      const selectedModel = MODELS.find((m) => m.id === model);

      try {
        if (selectedModel?.keyType === "anthropic") {
          await axios.post(
            "https://api.anthropic.com/v1/messages",
            {
              model: "claude-sonnet-4-20250514",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }],
            },
            {
              headers: {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              timeout: 10000,
            }
          );
        } else if (selectedModel?.keyType === "openai") {
          await axios.get("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 10000,
          });
        } else if (selectedModel?.keyType === "groq") {
          await axios.get("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 10000,
          });
        } else if (selectedModel?.keyType === "kimi") {
          await axios.get("https://api.moonshot.cn/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 10000,
          });
        }
        setApiKeyStatus("valid");
        setTimeout(() => advanceStep(), 1000);
      } catch {
        setApiKeyStatus("invalid");
      }
    },
    [model, advanceStep]
  );

  // Handle key input for API key step
  useInput(
    (input, key) => {
      if (step === "apikey" && apiKeyStatus === "input") {
        if (key.escape) {
          // Escape -> fall back to deepseek
          setModel("deepseek-v3");
          setApiKey("");
          // Skip to permissions
          setCursor(0);
          setPermSection("file");
          setStep("permissions");
          return;
        }
        if (key.return && apiKey.length > 0) {
          validateApiKey(apiKey);
          return;
        }
        if (key.backspace || key.delete) {
          setApiKey((prev) => prev.slice(0, -1));
          return;
        }
        if (
          input &&
          !key.ctrl &&
          !key.meta &&
          !key.upArrow &&
          !key.downArrow
        ) {
          setApiKey((prev) => prev + input);
        }
        return;
      }

      if (step === "welcome") return;
      if (step === "apikey") return; // handled above
      if (step === "done") {
        if (key.return) {
          saveAndFinish();
        }
        return;
      }

      // Arrow navigation
      if (key.upArrow) {
        setCursor((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        const maxItems = getMaxCursor();
        setCursor((prev) => Math.min(maxItems - 1, prev + 1));
        return;
      }

      // Enter to select
      if (key.return) {
        handleSelect();
        return;
      }

      // Ctrl+C to exit
      if (input === "c" && key.ctrl) {
        exit();
      }
    },
    { isActive: true }
  );

  const getMaxCursor = (): number => {
    switch (step) {
      case "language":
        return LANGUAGES.length;
      case "model":
        return MODELS.length;
      case "permissions":
        return permSection === "file"
          ? PERM_FILE_OPTIONS.length
          : PERM_CMD_OPTIONS.length;
      case "theme":
        return THEMES.length;
      default:
        return 0;
    }
  };

  const handleSelect = () => {
    switch (step) {
      case "language":
        setLanguage(LANGUAGES[cursor].id);
        advanceStep();
        break;
      case "model":
        setModel(MODELS[cursor].id);
        advanceStep();
        break;
      case "permissions":
        if (permSection === "file") {
          setPermFile(PERM_FILE_OPTIONS[cursor].id);
          setPermSection("cmd");
          setCursor(0);
        } else {
          setPermCmd(PERM_CMD_OPTIONS[cursor].id);
          advanceStep();
        }
        break;
      case "theme":
        setTheme(THEMES[cursor].id);
        advanceStep();
        break;
    }
  };

  const renderStepBar = (): string => {
    const num = currentStepNum();
    if (num === 0) return "";
    if (step === "done") {
      return c.step("\u2501".repeat(30) + " All set! \u2705");
    }
    return c.step("\u2501".repeat(30) + ` Step ${num} of ${totalSteps}`);
  };

  const renderChoices = (
    items: { label: string }[],
    activeCursor: number
  ): string => {
    return items
      .map((item, i) => {
        const prefix = i === activeCursor ? "  \u276f " : "    ";
        const text =
          i === activeCursor
            ? c.selected(item.label)
            : c.unselected(item.label);
        return prefix + text;
      })
      .join("\n");
  };

  // Render each step
  const renderContent = (): string => {
    switch (step) {
      case "welcome": {
        const inner = [
          "",
          c.selected("    \u2726  \u0623\u0647\u0644\u0627\u064b \u0628\u0643 \u0641\u064a TaseesCode  \u2726"),
          c.headEn("    Welcome to TaseesCode"),
          "",
          c.headAr("    \u0645\u0633\u0627\u0639\u062f\u0643 \u0627\u0644\u0630\u0643\u064a \u0644\u0644\u0628\u0631\u0645\u062c\u0629 \ud83c\uddf8\ud83c\udde6"),
          c.headEn("    Your Arabic-first AI coding partner"),
          "",
        ].join("\n");

        const box = boxen(inner, {
          borderStyle: "double" as any,
          borderColor: c.border,
          padding: 0,
          textAlignment: "center" as any,
        });

        return box + "\n\n" + c.unselected("  Setting up your experience...");
      }

      case "language": {
        const heading = [
          c.headAr("\u0645\u0627 \u0644\u063a\u062a\u0643 \u0627\u0644\u0645\u0641\u0636\u0651\u0644\u0629\u061f"),
          c.headEn("What is your preferred language?"),
          "",
        ].join("\n");
        return heading + "\n" + renderChoices(LANGUAGES, cursor);
      }

      case "model": {
        const heading = [
          c.headAr(
            "\u0627\u062e\u062a\u0631 \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a"
          ),
          c.headEn("Choose your default AI model"),
          "",
        ].join("\n");

        const items = MODELS.map((m) => ({
          label: `${m.label}      ${c.step("\u2014")} ${c.unselected(m.desc)}`,
        }));

        return (
          heading +
          "\n" +
          renderChoices(items, cursor) +
          "\n\n" +
          c.step("  Use \u2191\u2193 to navigate, Enter to select")
        );
      }

      case "apikey": {
        const selectedModel = MODELS.find((m) => m.id === model);
        const providerNames: Record<string, string> = {
          anthropic: "Anthropic",
          openai: "OpenAI",
          groq: "Groq",
          kimi: "Kimi",
        };
        const providerUrls: Record<string, string> = {
          anthropic: "console.anthropic.com",
          openai: "platform.openai.com",
          groq: "console.groq.com",
          kimi: "platform.moonshot.cn",
        };
        const provider = providerNames[selectedModel?.keyType || ""] || "API";
        const url = providerUrls[selectedModel?.keyType || ""] || "";
        const isGroq = selectedModel?.keyType === "groq";

        const heading = [
          c.headAr(
            `\u0623\u062f\u062e\u0644 \u0645\u0641\u062a\u0627\u062d ${provider} API \u0627\u0644\u062e\u0627\u0635 \u0628\u0643`
          ),
          c.headEn(isGroq
            ? `Groq is FREE \u2014 get your key at console.groq.com (takes 30 seconds)`
            : `Enter your ${provider} API key`),
          "",
          c.unselected(`  Get one at: ${url}`),
          "",
        ].join("\n");

        const masked =
          apiKey.length > 8
            ? apiKey.slice(0, 8) + "\u2588".repeat(apiKey.length - 8)
            : apiKey.length > 0
            ? apiKey
            : "";

        let statusLine = "";
        if (apiKeyStatus === "validating") {
          statusLine = "\n" + c.step("  Validating...");
        } else if (apiKeyStatus === "valid") {
          statusLine = "\n" + chalk.hex("#4A9")("  \u2705 API key is valid!");
        } else if (apiKeyStatus === "invalid") {
          statusLine =
            "\n" +
            chalk.hex("#E44")("  \u274c Invalid key. Press Escape to skip.");
        }

        const footer = [
          "",
          c.unselected("  (Press Enter to confirm, Escape to skip)"),
          c.unselected(
            "  (\u0627\u0636\u063a\u0637 Enter \u0644\u0644\u062a\u0623\u0643\u064a\u062f\u060c Escape \u0644\u0644\u062a\u062e\u0637\u064a)"
          ),
        ].join("\n");

        return (
          heading +
          "  > " +
          c.selected(masked || "") +
          c.step("\u2588") +
          statusLine +
          "\n" +
          footer
        );
      }

      case "permissions": {
        if (permSection === "file") {
          const heading = [
            c.headAr(
              "\u0645\u062a\u0649 \u0623\u0633\u062a\u0623\u0630\u0646\u0643 \u0642\u0628\u0644 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0641\u0627\u062a\u061f"
            ),
            c.headEn("When should I ask before editing files?"),
            "",
          ].join("\n");
          return heading + "\n" + renderChoices(PERM_FILE_OPTIONS, cursor);
        } else {
          const heading = [
            c.headAr(
              "\u0645\u062a\u0649 \u0623\u0633\u062a\u0623\u0630\u0646\u0643 \u0642\u0628\u0644 \u062a\u0646\u0641\u064a\u0630 \u0627\u0644\u0623\u0648\u0627\u0645\u0631\u061f"
            ),
            c.headEn("When should I ask before running commands?"),
            "",
          ].join("\n");
          return heading + "\n" + renderChoices(PERM_CMD_OPTIONS, cursor);
        }
      }

      case "theme": {
        const heading = [
          c.headAr(
            "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0638\u0647\u0631 / Choose theme"
          ),
          "",
        ].join("\n");
        return heading + "\n" + renderChoices(THEMES, cursor);
      }

      case "done": {
        const selectedModel = MODELS.find((m) => m.id === model);
        const modelLabel = selectedModel
          ? `${selectedModel.label.trim()}${selectedModel.needsKey ? "" : " (Free)"}`
          : model;

        const langLabel =
          language === "ar"
            ? "\u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0623\u0648\u0644\u0627\u064b"
            : language === "en"
            ? "English first"
            : "Auto-detect";

        const themeLabel =
          theme === "silver"
            ? "Silver"
            : theme === "minimal"
            ? "Minimal"
            : "Dark";

        const permFileLabel =
          permFile === "ask"
            ? "Always ask"
            : permFile === "session"
            ? "Ask once per session"
            : "Auto-approve";

        const permCmdLabel =
          permCmd === "ask"
            ? "Always ask"
            : permCmd === "session"
            ? "Ask once per session"
            : "Auto-approve";

        const inner = [
          "",
          c.selected(
            "   \u0643\u0644 \u0634\u064a\u0621 \u062c\u0627\u0647\u0632! You are ready to code!"
          ),
          "",
          `   ${c.headEn("Model:")}       ${c.success(modelLabel)}`,
          `   ${c.headEn("Language:")}    ${c.success(langLabel)}`,
          `   ${c.headEn("Files:")}       ${c.success(permFileLabel)}`,
          `   ${c.headEn("Commands:")}    ${c.success(permCmdLabel)}`,
          `   ${c.headEn("Theme:")}       ${c.success(themeLabel)}`,
          `   ${c.headEn("Plan:")}        ${c.success("Free (100 msg / 5h)")}`,
          "",
        ].join("\n");

        const box = boxen(inner, {
          borderStyle: "double" as any,
          borderColor: c.border,
          padding: 0,
          textAlignment: "left" as any,
        });

        return (
          box +
          "\n\n" +
          c.headEn("  Press Enter to start coding...") +
          "\n" +
          c.headAr(
            "  \u0627\u0636\u063a\u0637 Enter \u0644\u0644\u0628\u062f\u0621 \u0641\u064a \u0627\u0644\u0628\u0631\u0645\u062c\u0629..."
          )
        );
      }

      default:
        return "";
    }
  };

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {renderStepBar() ? <Text>{renderStepBar()}</Text> : null}
      {renderStepBar() ? <Text>{" "}</Text> : null}
      <Text>{renderContent()}</Text>
    </Box>
  );
};
