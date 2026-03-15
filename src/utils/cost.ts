import { MODEL_REGISTRY, ModelId } from "../models";

export interface SessionCost {
  inputTokens: number;
  outputTokens: number;
  totalCostSAR: number;
  breakdown: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    costSAR: number;
  }>;
}

const session: SessionCost = {
  inputTokens: 0,
  outputTokens: 0,
  totalCostSAR: 0,
  breakdown: [],
};

export function trackUsage(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): void {
  const model = MODEL_REGISTRY[modelId];
  if (!model) return;

  const costSAR =
    (inputTokens / 1_000_000) * model.inputCostSARPerMToken +
    (outputTokens / 1_000_000) * model.outputCostSARPerMToken;

  session.inputTokens += inputTokens;
  session.outputTokens += outputTokens;
  session.totalCostSAR += costSAR;

  session.breakdown.push({
    model: model.name,
    inputTokens,
    outputTokens,
    costSAR,
  });
}

export function getSessionCost(): SessionCost {
  return { ...session };
}

export function formatCostSAR(cost: number): string {
  return `${cost.toFixed(4)} SAR`;
}

export function resetSessionCost(): void {
  session.inputTokens = 0;
  session.outputTokens = 0;
  session.totalCostSAR = 0;
  session.breakdown = [];
}
