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
    description: "과거 시즌과 이번 시즌 결과를 균형 있게 반영합니다.",
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
    description: "과거 시즌보다 이번 시즌의 결과를 적극 반영.",
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
    description: "과거 시즌의 결과를 더 많이 반영.",
    values: {
      priorWeightDecay: 0.62,
      shrinkageMatches: 7,
      opponentStrengthWeight: 0.2,
      setSkewFactor: 0.92
    }
  }
];
