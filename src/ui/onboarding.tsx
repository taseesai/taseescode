import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import axios from "axios";
import { setConfig, setNestedConfig } from "../utils/config";
import { startAuthServer } from "../utils/auth-server";

// ──── Palette ────
const p = {
  white: chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  accent: chalk.hex("#707070"),
  green: chalk.hex("#5A9E6F"),
  red: chalk.hex("#C75050"),
  gold: chalk.hex("#C9A962"),
};

interface OnboardingProps {
  onComplete: () => void;
}

type Step = "welcome" | "language" | "model" | "apikey" | "permissions" | "theme" | "ready";

const STEPS: Step[] = ["welcome", "language", "model", "apikey", "permissions", "theme", "ready"];

// ──── Data ────

interface ModelOption {
  id: string;
  name: string;
  tag: string;
  desc: string;
  needsKey: boolean;
  keyType?: "anthropic" | "openai" | "groq" | "kimi";
  free?: boolean;
}

const MODELS: ModelOption[] = [
  { id: "deepseek-v3",   name: "DeepSeek V3",     tag: "RECOMMENDED",  desc: "Low cost · Fast · Great Arabic",   needsKey: false },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B",   tag: "FREE",         desc: "Groq · Strong · Arabic",          needsKey: true, keyType: "groq", free: true },
  { id: "kimi-k2",       name: "Kimi K2",         tag: "FREE",         desc: "Groq · Agentic · Arabic",         needsKey: true, keyType: "groq", free: true },
  { id: "qwen3-32b",     name: "Qwen 3 32B",      tag: "FREE",         desc: "Groq · Strong coder",             needsKey: true, keyType: "groq", free: true },
  { id: "llama-4-scout",  name: "Llama 4 Scout",  tag: "FREE",         desc: "Groq · Latest Llama 4",           needsKey: true, keyType: "groq", free: true },
  { id: "claude-opus",    name: "Claude Opus 4.6", tag: "MOST CAPABLE", desc: "Deep reasoning · Agentic · 200K", needsKey: true, keyType: "anthropic" },
  { id: "claude-sonnet",  name: "Claude Sonnet 4.6", tag: "BEST VALUE", desc: "Fast + smart · 200K context",    needsKey: true, keyType: "anthropic" },
  { id: "gpt-4o",         name: "GPT-4o",          tag: "PREMIUM",      desc: "OpenAI · Vision · Broad",         needsKey: true, keyType: "openai" },
  { id: "kimi-k1.5",      name: "Kimi K1.5",      tag: "LOW COST",     desc: "128K context · Arabic",           needsKey: true, keyType: "kimi" },
];

const LANGUAGES = [
  { id: "auto" as const, label: "Auto-detect", labelAr: "كشف تلقائي", desc: "Detects from your input", icon: "⚡" },
  { id: "ar" as const,   label: "العربية أولاً", labelAr: "Arabic first", desc: "Responds in Arabic by default", icon: "🇸🇦" },
  { id: "en" as const,   label: "English first", labelAr: "الإنجليزية أولاً", desc: "Responds in English by default", icon: "🌐" },
];

const THEMES = [
  { id: "silver" as const,  label: "Silver",  desc: "Warm metallic — default", blocks: "░▒▓█" },
  { id: "minimal" as const, label: "Minimal", desc: "Clean monochrome",        blocks: "░░░░" },
  { id: "dark" as const,    label: "Dark",    desc: "High contrast",           blocks: "████" },
];

type PermLevel = "ask" | "session" | "always";

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>("welcome");
  const [cursor, setCursor] = useState(0);
  const [permPhase, setPermPhase] = useState<"file" | "cmd">("file");

  // Collected choices
  const [language, setLanguage] = useState<"auto" | "ar" | "en">("auto");
  const [model, setModel] = useState("deepseek-v3");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<"input" | "validating" | "valid" | "invalid">("input");
  const [authMethod, setAuthMethod] = useState<"choose" | "oauth" | "apikey">("choose");
  const [oauthStatus, setOauthStatus] = useState<"waiting" | "polling" | "success" | "failed">("waiting");
  const [permFile, setPermFile] = useState<PermLevel>("ask");
  const [permCmd, setPermCmd] = useState<PermLevel>("ask");
  const [theme, setTheme] = useState<"silver" | "minimal" | "dark">("silver");

  // Typewriter effect for welcome
  const [typedChars, setTypedChars] = useState(0);
  const welcomeText = "مساعدك الذكي للبرمجة";

  useEffect(() => {
    if (step === "welcome") {
      const interval = setInterval(() => {
        setTypedChars(prev => {
          if (prev >= welcomeText.length) {
            clearInterval(interval);
            // Auto-advance after typing completes
            setTimeout(() => { setStep("language"); setCursor(0); }, 1200);
            return prev;
          }
          return prev + 1;
        });
      }, 80);
      return () => clearInterval(interval);
    }
  }, [step]);

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length - 1; // exclude "ready"

  const advance = useCallback((overrideModel?: string) => {
    const idx = STEPS.indexOf(step);
    let next = STEPS[idx + 1];

    // Skip apikey if model doesn't need one
    if (next === "apikey") {
      const checkModel = overrideModel || model;
      const m = MODELS.find(m => m.id === checkModel);
      if (!m?.needsKey) next = "permissions";
    }

    setCursor(0);
    setPermPhase("file");
    setAuthMethod("choose");
    setApiKeyStatus("input");
    setOauthStatus("waiting");
    setApiKey("");
    setStep(next);
  }, [step, model]);

  const save = useCallback(() => {
    setConfig("hasCompletedOnboarding", true);
    setConfig("language", language);
    setConfig("defaultModel", model);
    setConfig("theme", theme);
    setConfig("permissions", {
      allowFileWrite: permFile === "always" ? "always" : "ask",
      allowCommandRun: permCmd === "always" ? "always" : "ask",
    });

    if (apiKey.length > 0) {
      const m = MODELS.find(m => m.id === model);
      if (m?.keyType) setNestedConfig(`apiKeys.${m.keyType}`, apiKey);
    }

    onComplete();
  }, [language, model, apiKey, permFile, permCmd, theme, onComplete]);

  const validateKey = useCallback(async (key: string) => {
    setApiKeyStatus("validating");
    const m = MODELS.find(m => m.id === model);
    try {
      if (m?.keyType === "anthropic") {
        await axios.post("https://api.anthropic.com/v1/messages",
          { model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] },
          { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, timeout: 10000 }
        );
      } else if (m?.keyType === "openai") {
        await axios.get("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` }, timeout: 10000 });
      } else if (m?.keyType === "groq") {
        await axios.get("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, timeout: 10000 });
      } else if (m?.keyType === "kimi") {
        await axios.get("https://api.moonshot.cn/v1/models", { headers: { Authorization: `Bearer ${key}` }, timeout: 10000 });
      }
      setApiKeyStatus("valid");
      // Save key IMMEDIATELY to config
      if (m?.keyType) {
        setNestedConfig(`apiKeys.${m.keyType}`, key);
      }
      setTimeout(() => advance(), 800);
    } catch {
      setApiKeyStatus("invalid");
    }
  }, [model, advance]);

  // ──── Input Handler ────
  useInput((input, key) => {
    if (input === "c" && key.ctrl) { exit(); return; }

    // API key step — multi-phase handling
    if (step === "apikey") {
      const m = MODELS.find(m => m.id === model);
      const isAnthropic = m?.keyType === "anthropic";

      // Phase 1: Choose auth method (Anthropic only)
      if (isAnthropic && authMethod === "choose") {
        if (key.escape) {
          setModel("deepseek-v3"); setApiKey("");
          setCursor(0); setPermPhase("file"); setStep("permissions");
          return;
        }
        if (key.upArrow) { setCursor(prev => Math.max(0, prev - 1)); return; }
        if (key.downArrow) { setCursor(prev => Math.min(1, prev + 1)); return; }
        if (key.return) {
          if (cursor === 0) {
            // Sign in with Anthropic account — launch local auth server
            setAuthMethod("oauth");
            setOauthStatus("polling");

            // Start auth server — opens browser, auto-receives key
            const validateAnthropicKey = async (k: string): Promise<boolean> => {
              try {
                await axios.post("https://api.anthropic.com/v1/messages",
                  { model: "claude-sonnet-4-6", max_tokens: 1, messages: [{ role: "user", content: "hi" }] },
                  { headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" }, timeout: 10000 }
                );
                return true;
              } catch { return false; }
            };

            startAuthServer("Anthropic", "https://console.anthropic.com/settings/keys", validateAnthropicKey)
              .then((result) => {
                if (result.success && result.key) {
                  setApiKey(result.key);
                  // Save key IMMEDIATELY to config — don't rely on React state for save()
                  setNestedConfig("apiKeys.anthropic", result.key);
                  setOauthStatus("success");
                  setApiKeyStatus("valid");
                  setTimeout(() => advance(), 800);
                } else {
                  setOauthStatus("failed");
                  // Fall back to manual input
                  setAuthMethod("apikey");
                }
              });
          } else {
            // Paste API key directly
            setAuthMethod("apikey");
            setCursor(0);
          }
          return;
        }
        return;
      }

      // Phase 2a: OAuth flow — waiting for user to paste key from browser
      if (authMethod === "oauth") {
        if (key.escape) { setAuthMethod("choose"); setCursor(0); return; }
        if (key.backspace || key.delete) { setApiKey(prev => prev.slice(0, -1)); return; }
        if (key.return && apiKey.length > 0) { validateKey(apiKey); return; }
        if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
          setApiKey(prev => prev + input);
        }
        return;
      }

      // Phase 2b: Direct API key input
      if (authMethod === "apikey" && apiKeyStatus === "input") {
        if (key.escape) {
          if (isAnthropic) { setAuthMethod("choose"); setCursor(0); return; }
          setModel("deepseek-v3"); setApiKey("");
          setCursor(0); setPermPhase("file"); setStep("permissions");
          return;
        }
        if (key.return && apiKey.length > 0) { validateKey(apiKey); return; }
        if (key.backspace || key.delete) { setApiKey(prev => prev.slice(0, -1)); return; }
        if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
          setApiKey(prev => prev + input);
        }
        return;
      }

      // Non-Anthropic models go straight to apikey input
      if (!isAnthropic && apiKeyStatus === "input") {
        if (key.escape) {
          setModel("deepseek-v3"); setApiKey("");
          setCursor(0); setPermPhase("file"); setStep("permissions");
          return;
        }
        if (key.return && apiKey.length > 0) { validateKey(apiKey); return; }
        if (key.backspace || key.delete) { setApiKey(prev => prev.slice(0, -1)); return; }
        if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
          setApiKey(prev => prev + input);
        }
        return;
      }

      return;
    }

    if (step === "welcome") return;

    if (step === "ready") {
      if (key.return) save();
      return;
    }

    // Navigation
    if (key.upArrow) { setCursor(prev => Math.max(0, prev - 1)); return; }
    if (key.downArrow) {
      const max = getMaxItems();
      setCursor(prev => Math.min(max - 1, prev + 1));
      return;
    }

    if (key.return) { select(); return; }
  }, { isActive: true });

  const getMaxItems = (): number => {
    switch (step) {
      case "language": return LANGUAGES.length;
      case "model": return MODELS.length;
      case "permissions": return 3; // ask, session, always
      case "theme": return THEMES.length;
      default: return 0;
    }
  };

  const select = () => {
    switch (step) {
      case "language":
        setLanguage(LANGUAGES[cursor].id);
        advance();
        break;
      case "model": {
        const selectedId = MODELS[cursor].id;
        setModel(selectedId);
        advance(selectedId);
        break;
      }
      case "permissions":
        const levels: PermLevel[] = ["ask", "session", "always"];
        if (permPhase === "file") {
          setPermFile(levels[cursor]);
          setPermPhase("cmd");
          setCursor(0);
        } else {
          setPermCmd(levels[cursor]);
          advance();
        }
        break;
      case "theme":
        setTheme(THEMES[cursor].id);
        advance();
        break;
    }
  };

  // ──── Progress Bar ────
  const renderProgress = () => {
    if (step === "welcome") return null;
    const current = Math.min(stepIndex, totalSteps);
    const filled = "━".repeat(current * 5);
    const empty = "╌".repeat((totalSteps - current) * 5);
    const label = step === "ready" ? "Complete" : `${current}/${totalSteps}`;
    return (
      <Box marginBottom={1}>
        <Text>
          {p.accent(filled)}{p.dim(empty)} {p.dim(label)}
        </Text>
      </Box>
    );
  };

  // ──── Render Steps ────
  const renderStep = () => {
    switch (step) {

      case "welcome": {
        const typed = welcomeText.slice(0, typedChars);
        const cursorChar = typedChars < welcomeText.length ? "▊" : "";
        return (
          <Box flexDirection="column" alignItems="center" paddingY={2}>
            <Text>{p.dim("╭────────────────────────────────────────╮")}</Text>
            <Text>{p.dim("│")}{" ".repeat(40)}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{"   "}{p.white.bold("◆  TaseesCode  ◆")}{"                   "}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{"   "}{p.silver("تأسيس كود")}{"                            "}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{" ".repeat(40)}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{"   "}{p.gray(typed)}{p.accent(cursorChar)}{" ".repeat(Math.max(0, 37 - typed.length - cursorChar.length))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{" ".repeat(40)}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{"   "}{p.dim("Built in Jeddah 🇸🇦 by TaseesAI")}{"     "}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{" ".repeat(40)}{p.dim("│")}</Text>
            <Text>{p.dim("╰────────────────────────────────────────╯")}</Text>
          </Box>
        );
      }

      case "language": {
        return (
          <Box flexDirection="column">
            <Text>{p.white.bold("Language")}</Text>
            <Text>{p.silver("ما لغتك المفضّلة؟")}</Text>
            <Text>{" "}</Text>
            {LANGUAGES.map((lang, i) => (
              <Text key={lang.id}>
                {i === cursor ? p.white("  ❯ ") : "    "}
                {i === cursor ? p.white.bold(`${lang.icon} ${lang.label}`) : p.gray(`${lang.icon} ${lang.label}`)}
                {"  "}
                {p.dim(lang.desc)}
              </Text>
            ))}
            <Text>{" "}</Text>
            <Text>{p.dim("  ↑↓ navigate · Enter select")}</Text>
          </Box>
        );
      }

      case "model": {
        return (
          <Box flexDirection="column">
            <Text>{p.white.bold("AI Model")}</Text>
            <Text>{p.silver("اختر نموذج الذكاء الاصطناعي")}</Text>
            <Text>{" "}</Text>
            {MODELS.map((m, i) => {
              const isActive = i === cursor;
              const tagColor = m.tag === "RECOMMENDED" ? p.gold
                : m.tag === "FREE" ? p.green
                : m.tag === "MOST CAPABLE" ? p.white
                : m.tag === "BEST VALUE" ? p.accent
                : m.tag === "PREMIUM" ? p.silver
                : p.dim;
              return (
                <Text key={m.id}>
                  {isActive ? p.white("  ❯ ") : "    "}
                  {isActive ? p.white.bold(m.name) : p.gray(m.name)}
                  {"  "}
                  {tagColor(`[${m.tag}]`)}
                  {"  "}
                  {p.dim(m.desc)}
                </Text>
              );
            })}
            <Text>{" "}</Text>
            <Text>{p.dim("  ↑↓ navigate · Enter select · You can change anytime with /model")}</Text>
          </Box>
        );
      }

      case "apikey": {
        const m = MODELS.find(m => m.id === model);
        const providerNames: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", groq: "Groq", kimi: "Kimi" };
        const providerUrls: Record<string, string> = { anthropic: "console.anthropic.com/settings/keys", openai: "platform.openai.com/api-keys", groq: "console.groq.com/keys", kimi: "platform.moonshot.cn" };
        const provider = providerNames[m?.keyType || ""] || "API";
        const url = providerUrls[m?.keyType || ""] || "";
        const isFree = m?.free;
        const isAnthropic = m?.keyType === "anthropic";

        // Show first 12 chars + last 4 chars, mask the middle
        const masked = apiKey.length > 20
          ? apiKey.slice(0, 12) + "•".repeat(Math.min(apiKey.length - 16, 20)) + apiKey.slice(-4)
          : apiKey;

        // Anthropic: show auth method chooser first
        if (isAnthropic && authMethod === "choose") {
          return (
            <Box flexDirection="column">
              <Text>{p.white.bold("Authenticate with Anthropic")}</Text>
              <Text>{p.silver("تسجيل الدخول إلى Anthropic")}</Text>
              <Text>{" "}</Text>
              <Text>
                {cursor === 0 ? p.white("  ❯ ") : "    "}
                {cursor === 0 ? p.white.bold("🌐 Sign in with your Anthropic account") : p.gray("🌐 Sign in with your Anthropic account")}
              </Text>
              <Text>
                {cursor === 0 ? p.dim("      Opens console.anthropic.com in your browser") : p.dim("      Opens console.anthropic.com in your browser")}
              </Text>
              <Text>{" "}</Text>
              <Text>
                {cursor === 1 ? p.white("  ❯ ") : "    "}
                {cursor === 1 ? p.white.bold("🔑 Paste an API key") : p.gray("🔑 Paste an API key")}
              </Text>
              <Text>
                {cursor === 1 ? p.dim("      If you already have a key") : p.dim("      If you already have a key")}
              </Text>
              <Text>{" "}</Text>
              <Text>{p.dim("  ↑↓ navigate · Enter select · Escape skip")}</Text>
            </Box>
          );
        }

        // Anthropic OAuth flow: auth server running, browser opened
        if (isAnthropic && authMethod === "oauth") {
          return (
            <Box flexDirection="column">
              <Text>{p.white.bold("Sign in with Anthropic")}</Text>
              <Text>{p.silver("تسجيل الدخول إلى حساب Anthropic")}</Text>
              <Text>{" "}</Text>
              {oauthStatus === "polling" && (
                <>
                  <Text>{p.accent("  ◆ Browser opened — complete authentication there")}</Text>
                  <Text>{" "}</Text>
                  <Text>{p.gray("  ⟳ Waiting for authentication...")}</Text>
                  <Text>{p.dim("    Sign in → Create API key → Paste in browser")}</Text>
                  <Text>{p.dim("    TaseesCode will detect it automatically")}</Text>
                </>
              )}
              {oauthStatus === "success" && (
                <>
                  <Text>{p.green("  ✓ Authenticated with Anthropic!")}</Text>
                  <Text>{p.dim("    Continuing...")}</Text>
                </>
              )}
              {oauthStatus === "failed" && (
                <>
                  <Text>{p.red("  ✗ Authentication timed out or failed")}</Text>
                  <Text>{p.dim("    Falling back to manual key input...")}</Text>
                </>
              )}
              <Text>{" "}</Text>
              <Text>{p.dim("  Escape to cancel")}</Text>
            </Box>
          );
        }

        // Standard API key input (non-Anthropic or Anthropic with "paste key" chosen)
        return (
          <Box flexDirection="column">
            <Text>{p.white.bold(`${provider} API Key`)}</Text>
            {isFree && <Text>{p.green("✦ Free — takes 30 seconds to get")}</Text>}
            <Text>{p.silver(`أدخل مفتاح ${provider} الخاص بك`)}</Text>
            <Text>{" "}</Text>
            <Text>{p.dim(`  Get your key at: ${url}`)}</Text>
            <Text>{" "}</Text>
            <Text>{"  "}{p.accent("❯ ")}{p.white(masked)}{p.accent("▊")}</Text>
            <Text>{" "}</Text>
            {apiKeyStatus === "validating" && <Text>{p.gray("  ⟳ Validating...")}</Text>}
            {apiKeyStatus === "valid" && <Text>{p.green("  ✓ Valid! Continuing...")}</Text>}
            {apiKeyStatus === "invalid" && <Text>{p.red("  ✗ Invalid key. Try again or press Escape to skip.")}</Text>}
            <Text>{" "}</Text>
            <Text>{p.dim(`  Enter confirm · Escape ${isAnthropic ? "back" : "skip (falls back to DeepSeek)"}`)}</Text>
          </Box>
        );
      }

      case "permissions": {
        const labels = [
          { label: "Ask every time", labelAr: "استأذن كل مرة", desc: "Safest", icon: "🔒" },
          { label: "Ask once per session", labelAr: "استأذن مرة واحدة", desc: "Balanced", icon: "⚡" },
          { label: "Auto-approve", labelAr: "موافقة تلقائية", desc: permPhase === "cmd" ? "⚠️ Dangerous" : "Fastest", icon: "🚀" },
        ];

        const title = permPhase === "file" ? "File Permissions" : "Command Permissions";
        const titleAr = permPhase === "file" ? "صلاحيات الملفات" : "صلاحيات الأوامر";
        const subtitle = permPhase === "file"
          ? "When should I ask before creating or editing files?"
          : "When should I ask before running terminal commands?";

        return (
          <Box flexDirection="column">
            <Text>{p.white.bold(title)}</Text>
            <Text>{p.silver(titleAr)}</Text>
            <Text>{p.dim(`  ${subtitle}`)}</Text>
            <Text>{" "}</Text>
            {labels.map((opt, i) => (
              <Text key={i}>
                {i === cursor ? p.white("  ❯ ") : "    "}
                {i === cursor ? p.white.bold(`${opt.icon} ${opt.label}`) : p.gray(`${opt.icon} ${opt.label}`)}
                {"  "}
                {p.dim(opt.desc)}
              </Text>
            ))}
            <Text>{" "}</Text>
            <Text>{p.dim(`  ${permPhase === "file" ? "1/2" : "2/2"} · ↑↓ navigate · Enter select`)}</Text>
          </Box>
        );
      }

      case "theme": {
        return (
          <Box flexDirection="column">
            <Text>{p.white.bold("Theme")}</Text>
            <Text>{p.silver("اختر المظهر")}</Text>
            <Text>{" "}</Text>
            {THEMES.map((t, i) => (
              <Text key={t.id}>
                {i === cursor ? p.white("  ❯ ") : "    "}
                {i === cursor ? p.white.bold(t.label) : p.gray(t.label)}
                {"  "}
                {p.accent(t.blocks)}
                {"  "}
                {p.dim(t.desc)}
              </Text>
            ))}
            <Text>{" "}</Text>
            <Text>{p.dim("  ↑↓ navigate · Enter select")}</Text>
          </Box>
        );
      }

      case "ready": {
        const m = MODELS.find(m => m.id === model);
        const langLabel = language === "ar" ? "Arabic first" : language === "en" ? "English first" : "Auto-detect";
        const permFileLabel = permFile === "ask" ? "Ask every time" : permFile === "session" ? "Once/session" : "Auto-approve";
        const permCmdLabel = permCmd === "ask" ? "Ask every time" : permCmd === "session" ? "Once/session" : "Auto-approve";

        const W = 44; // inner width
        const pad = (text: string) => text + " ".repeat(Math.max(0, W - text.length));
        const row = (label: string, value: string) => {
          const content = `   ${label.padEnd(12)}${value}`;
          return content + " ".repeat(Math.max(0, W - content.length));
        };
        const border = "─".repeat(W);

        return (
          <Box flexDirection="column">
            <Text>{p.dim(`╭${border}╮`)}</Text>
            <Text>{p.dim("│")}{pad("")}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{pad("   ✓ Ready to code!")}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{pad("")}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.gray(row("Model", m?.name || model))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.gray(row("Language", langLabel))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.gray(row("Theme", theme))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.gray(row("Files", permFileLabel))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.gray(row("Commands", permCmdLabel))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{pad("")}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{p.dim(pad("   Change anytime with /config"))}{p.dim("│")}</Text>
            <Text>{p.dim("│")}{pad("")}{p.dim("│")}</Text>
            <Text>{p.dim(`╰${border}╯`)}</Text>
            <Text>{" "}</Text>
            <Text>{p.accent("  Press Enter to start →")}</Text>
          </Box>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {renderProgress()}
      {renderStep()}
    </Box>
  );
};
