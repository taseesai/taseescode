import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import { MODEL_REGISTRY } from "../models";
import { getConfig } from "../utils/config";

interface ModelPickerProps {
  currentModel: string;
  onSelect: (modelId: string) => void;
  onCancel: () => void;
}

const FREE_PROVIDERS = ["deepseek"];
const FREE_KEY_PROVIDERS = ["groq"];

function getKeyStatus(provider: string): "free" | "free-key" | "set" | "missing" {
  if (FREE_PROVIDERS.includes(provider)) return "free";
  const cfg = getConfig();
  const apiKeys = (cfg as unknown as Record<string, unknown>).apiKeys as Record<string, string | null> | undefined;
  const keyMap: Record<string, string> = { anthropic: "anthropic", openai: "openai", qwen: "qwen", kimi: "kimi", groq: "groq" };
  const field = keyMap[provider];
  if (!field || !apiKeys) {
    return FREE_KEY_PROVIDERS.includes(provider) ? "free-key" : "missing";
  }
  const key = apiKeys[field];
  if (key && key.length > 10) return "set";
  if (FREE_KEY_PROVIDERS.includes(provider)) return "free-key";
  return "missing";
}

const MODEL_IDS = Object.keys(MODEL_REGISTRY);

export const ModelPicker: React.FC<ModelPickerProps> = ({ currentModel, onSelect, onCancel }) => {
  const [index, setIndex] = useState(() => {
    const i = MODEL_IDS.indexOf(currentModel);
    return i >= 0 ? i : 0;
  });

  useInput((input, key) => {
    if (key.upArrow) {
      setIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setIndex(i => Math.min(MODEL_IDS.length - 1, i + 1));
    } else if (key.return) {
      const modelId = MODEL_IDS[index];
      const m = MODEL_REGISTRY[modelId];
      const status = getKeyStatus(m.provider);
      if (status === "missing" || status === "free-key") {
        onSelect(`__LOCKED__${modelId}`);
      } else {
        onSelect(modelId);
      }
    } else if (key.escape || input === "q") {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>{chalk.hex("#E8E8E8").bold("  Switch Model")}</Text>
      <Text>{chalk.hex("#4A4A4A")("  ─".repeat(22))}</Text>
      <Text>{chalk.hex("#4A4A4A")("  ↑↓ navigate · Enter select · Esc cancel")}</Text>
      <Box flexDirection="column" marginTop={1}>
        {MODEL_IDS.map((id, i) => {
          const m = MODEL_REGISTRY[id];
          const status = getKeyStatus(m.provider);
          const isSelected = i === index;
          const isCurrent = id === currentModel;

          const locked  = status === "missing" || status === "free-key";
          const nameColor = locked
            ? chalk.hex("#4A4A4A")
            : isSelected
            ? chalk.hex("#E8E8E8").bold
            : chalk.hex("#ABABAB");

          const badge = status === "free"
            ? chalk.hex("#7ACC7A")("✦ No key needed")
            : status === "free-key"
            ? chalk.hex("#7AC8C8")("✦ Free key    ")
            : status === "set"
            ? chalk.hex("#7ACC7A")("✅ Key set     ")
            : chalk.hex("#E87B7B")("🔒 Needs key   ");

          const ctx   = chalk.hex("#4A4A4A")(`${(m.contextWindow / 1000).toFixed(0)}K`);
          const isFree = m.inputCostSARPerMToken === 0 && m.outputCostSARPerMToken === 0;
          const cost  = isFree
            ? chalk.hex("#7ACC7A")("Free")
            : m.inputCostSARPerMToken < 0.1
            ? chalk.hex("#7AC8C8")(`${m.inputCostSARPerMToken} SAR/M`)
            : chalk.hex("#8B8B8B")(`${m.inputCostSARPerMToken} SAR/M`);

          const cursor   = isSelected ? chalk.hex("#E8E8E8")("❯") : " ";
          const current  = isCurrent  ? chalk.hex("#707070")(" ●") : "  ";

          return (
            <Box key={id} flexDirection="row" marginLeft={1}>
              <Text>{`${cursor} ${current} `}</Text>
              <Text>{nameColor(`${m.name.padEnd(20)}`)}</Text>
              <Text>{`  ${badge}  `}</Text>
              <Text>{chalk.hex("#4A4A4A")(`ctx:`)}</Text>
              <Text>{` ${ctx}  `}</Text>
              <Text>{chalk.hex("#4A4A4A")(`in:`)}</Text>
              <Text>{` ${cost}`}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} marginLeft={2}>
        {(() => {
          const m = MODEL_REGISTRY[MODEL_IDS[index]];
          const status = getKeyStatus(m.provider);
          if (status === "missing") {
            const field = m.provider;
            return (
              <Box flexDirection="column">
                <Text>{chalk.hex("#E87B7B")(`  🔒 ${m.name} needs an API key`)}</Text>
                <Text>{chalk.hex("#4A4A4A")(`  Set it: /config set apiKeys.${field} YOUR_KEY`)}</Text>
              </Box>
            );
          }
          if (status === "free-key") {
            return (
              <Box flexDirection="column">
                <Text>{chalk.hex("#7AC8C8")(`  ✦ ${m.name} — FREE, get key at console.groq.com`)}</Text>
                <Text>{chalk.hex("#4A4A4A")(`  Set it: /config set apiKeys.groq YOUR_KEY`)}</Text>
              </Box>
            );
          }
          if (status === "free") {
            return (
              <Box flexDirection="column">
                <Text>{chalk.hex("#7ACC7A")(`  ✦ ${m.name} — free, no key needed`)}</Text>
                {m.bestFor ? <Text>{chalk.hex("#4A4A4A")(`  ✦ Best for: ${m.bestFor}`)}</Text> : null}
              </Box>
            );
          }
          return (
            <Box flexDirection="column">
              <Text>{chalk.hex("#7ACC7A")(`  ✅ ${m.name} — ready to use`)}</Text>
              {m.bestFor ? <Text>{chalk.hex("#4A4A4A")(`  ✦ Best for: ${m.bestFor}`)}</Text> : null}
            </Box>
          );
        })()}
      </Box>
    </Box>
  );
};
