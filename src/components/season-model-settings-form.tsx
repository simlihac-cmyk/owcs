"use client";

import { useEffect, useState } from "react";
import { MODEL_PRESETS } from "@/lib/model-presets";
import { Season, UpdateSeasonSettingsInput } from "@/lib/types";

interface SeasonModelSettingsFormProps {
  season: Season;
  onSave: (input: UpdateSeasonSettingsInput) => void;
}

export function SeasonModelSettingsForm({ season, onSave }: SeasonModelSettingsFormProps) {
  const [iterations, setIterations] = useState(season.simulationConfig.iterations);
  const [decimalPlaces, setDecimalPlaces] = useState(season.simulationConfig.decimalPlaces);
  const [priorWeightDecay, setPriorWeightDecay] = useState(season.simulationConfig.priorWeightDecay);
  const [shrinkageMatches, setShrinkageMatches] = useState(season.simulationConfig.shrinkageMatches);
  const [opponentStrengthWeight, setOpponentStrengthWeight] = useState(
    season.simulationConfig.opponentStrengthWeight
  );
  const [setSkewFactor, setSetSkewFactor] = useState(season.simulationConfig.setSkewFactor);

  useEffect(() => {
    setIterations(season.simulationConfig.iterations);
    setDecimalPlaces(season.simulationConfig.decimalPlaces);
    setPriorWeightDecay(season.simulationConfig.priorWeightDecay);
    setShrinkageMatches(season.simulationConfig.shrinkageMatches);
    setOpponentStrengthWeight(season.simulationConfig.opponentStrengthWeight);
    setSetSkewFactor(season.simulationConfig.setSkewFactor);
  }, [season]);

  const applyPreset = (presetId: (typeof MODEL_PRESETS)[number]["id"]) => {
    const preset = MODEL_PRESETS.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setPriorWeightDecay(preset.values.priorWeightDecay);
    setShrinkageMatches(preset.values.shrinkageMatches);
    setOpponentStrengthWeight(preset.values.opponentStrengthWeight);
    setSetSkewFactor(preset.values.setSkewFactor);
  };

  const handleSave = () => {
    onSave({
      seasonId: season.id,
      simulationConfig: {
        iterations,
        decimalPlaces,
        priorWeightDecay,
        shrinkageMatches,
        opponentStrengthWeight,
        setSkewFactor
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
        <h3 className="text-lg font-semibold text-ink">모델 설정</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          시즌 구조는 고정하고, 시뮬레이션 모델의 반응성만 조정합니다. 프리셋을 고르거나 세부
          파라미터를 직접 바꿔볼 수 있습니다.
        </p>
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {MODEL_PRESETS.map((preset) => (
            <div key={preset.id} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-ink">{preset.label}</p>
              <p className="mt-1 leading-6">{preset.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
          <label className="space-y-2 text-sm text-slate-600">
            <span>시뮬레이션 횟수</span>
            <input
              type="number"
              min={500}
              step={500}
              value={iterations}
              onChange={(event) => setIterations(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>소수점 자리수</span>
            <input
              type="number"
              min={0}
              max={3}
              value={decimalPlaces}
              onChange={(event) => setDecimalPlaces(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>prior 감쇠 강도</span>
            <input
              type="number"
              min={0.1}
              max={2}
              step={0.05}
              value={priorWeightDecay}
              onChange={(event) => setPriorWeightDecay(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
          <label className="space-y-2 text-sm text-slate-600">
            <span>shrinkage 경기 수</span>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={shrinkageMatches}
              onChange={(event) => setShrinkageMatches(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>상대 강도 반영치</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={opponentStrengthWeight}
              onChange={(event) => setOpponentStrengthWeight(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600">
            <span>세트 스코어 민감도</span>
            <input
              type="number"
              min={0.5}
              max={2}
              step={0.01}
              value={setSkewFactor}
              onChange={(event) => setSetSkewFactor(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} className="ow-primary-button rounded-full px-5 py-2.5 text-sm font-semibold">
          모델 설정 저장
        </button>
      </div>
    </div>
  );
}
