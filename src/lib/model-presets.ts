import { SimulationConfig } from "@/lib/types";

export const MODEL_PRESETS: Array<{
  id: "balanced" | "aggressive" | "conservative";
  label: string;
  description: string;
  values: Pick<
    SimulationConfig,
    "priorWeightDecay" | "shrinkageMatches" | "opponentStrengthWeight" | "setSkewFactor"
  >;
}> = [
  {
    id: "balanced",
    label: "균형형",
    description: "OWCS처럼 짧은 시즌에서 prior와 현재 시즌 폼을 균형 있게 반영합니다.",
    values: {
      priorWeightDecay: 0.36,
      shrinkageMatches: 5,
      opponentStrengthWeight: 0.42,
      setSkewFactor: 1.18
    }
  },
  {
    id: "aggressive",
    label: "공격형",
    description: "현재 시즌 흐름과 상대 강도, 강약 차이를 더 빠르게 반영합니다.",
    values: {
      priorWeightDecay: 0.2,
      shrinkageMatches: 3,
      opponentStrengthWeight: 0.72,
      setSkewFactor: 1.48
    }
  },
  {
    id: "conservative",
    label: "보수형",
    description: "짧은 시즌의 변동성을 경계하고 prior와 표본 안정성을 더 오래 유지합니다.",
    values: {
      priorWeightDecay: 0.62,
      shrinkageMatches: 7,
      opponentStrengthWeight: 0.2,
      setSkewFactor: 0.92
    }
  }
];
