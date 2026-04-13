"use client";

import { FormEvent, useState } from "react";
import { DEFAULT_LEAGUE_RULES, DEFAULT_SIMULATION_CONFIG } from "@/lib/constants";
import { MODEL_PRESETS } from "@/lib/model-presets";
import { League } from "@/lib/types";

interface CreateSeasonFormProps {
  league: League;
  onSubmit: (input: {
    name: string;
    year: number;
    order: number;
    teamNames: string[];
    priorSeasonId?: string | null;
    rules: {
      qualifierCount: number;
      lcqQualifierCount: number;
      roundRobinType: "single" | "double";
    };
    simulationConfig: {
      iterations: number;
      decimalPlaces: number;
      priorWeightDecay: number;
      shrinkageMatches: number;
      opponentStrengthWeight: number;
      setSkewFactor: number;
    };
    manualInitialRatings?: Record<string, number>;
  }) => void;
  onClose: () => void;
}

function parseManualRatings(text: string): Record<string, number> {
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, rating] = line.split(":");
        return [name.trim(), Number(rating.trim())];
      })
      .filter((entry) => entry[0] && Number.isFinite(entry[1]))
  );
}

export function CreateSeasonForm({ league, onSubmit, onClose }: CreateSeasonFormProps) {
  const latestSeason = league.seasons.slice().sort((left, right) => right.order - left.order)[0];
  const [name, setName] = useState("2026 스테이지 4");
  const [year, setYear] = useState(latestSeason ? latestSeason.year : 2026);
  const [order, setOrder] = useState(latestSeason ? latestSeason.order + 1 : 1);
  const [teamText, setTeamText] = useState(
    latestSeason
      ? latestSeason.teamIds
          .map((teamId) => league.teams.find((team) => team.id === teamId)?.name ?? "")
          .join("\n")
      : ""
  );
  const [priorMode, setPriorMode] = useState<"auto" | "none" | "manual">("auto");
  const [manualPriorSeasonId, setManualPriorSeasonId] = useState(
    league.seasons[league.seasons.length - 1]?.id ?? ""
  );
  const [qualifierCount, setQualifierCount] = useState(DEFAULT_LEAGUE_RULES.qualifierCount);
  const [lcqQualifierCount, setLcqQualifierCount] = useState(DEFAULT_LEAGUE_RULES.lcqQualifierCount);
  const [roundRobinType, setRoundRobinType] = useState<"single" | "double">(
    DEFAULT_LEAGUE_RULES.roundRobinType
  );
  const [iterations, setIterations] = useState(DEFAULT_SIMULATION_CONFIG.iterations);
  const [decimalPlaces, setDecimalPlaces] = useState(DEFAULT_SIMULATION_CONFIG.decimalPlaces);
  const [priorWeightDecay, setPriorWeightDecay] = useState(DEFAULT_SIMULATION_CONFIG.priorWeightDecay);
  const [shrinkageMatches, setShrinkageMatches] = useState(DEFAULT_SIMULATION_CONFIG.shrinkageMatches);
  const [opponentStrengthWeight, setOpponentStrengthWeight] = useState(
    DEFAULT_SIMULATION_CONFIG.opponentStrengthWeight
  );
  const [setSkewFactor, setSetSkewFactor] = useState(DEFAULT_SIMULATION_CONFIG.setSkewFactor);
  const [manualRatingsText, setManualRatingsText] = useState("");

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const priorSeasonId =
      priorMode === "auto" ? undefined : priorMode === "none" ? "" : manualPriorSeasonId;

    onSubmit({
      name,
      year,
      order,
      teamNames: teamText.split(/[\n,]+/),
      priorSeasonId,
      rules: {
        qualifierCount,
        lcqQualifierCount,
        roundRobinType
      },
      simulationConfig: {
        iterations,
        decimalPlaces,
        priorWeightDecay,
        shrinkageMatches,
        opponentStrengthWeight,
        setSkewFactor
      },
      manualInitialRatings: parseManualRatings(manualRatingsText)
    });
    onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ink">새 시즌 만들기</h3>
        <button type="button" onClick={onClose} className="text-sm text-slate-500">
          닫기
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2 text-sm text-slate-600">
          <span>시즌명</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>연도</span>
          <input
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>정렬 순서</span>
          <input
            type="number"
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>시드 결정전 진출 팀 수</span>
          <input
            type="number"
            min={1}
            value={qualifierCount}
            onChange={(event) => setQualifierCount(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>LCQ 진출 팀 수</span>
          <input
            type="number"
            min={0}
            value={lcqQualifierCount}
            onChange={(event) => setLcqQualifierCount(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm text-slate-600">
        <span>참가 팀 목록</span>
        <textarea
          rows={6}
          value={teamText}
          onChange={(event) => setTeamText(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          placeholder="한 줄에 한 팀씩 또는 쉼표로 구분해서 입력"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2 text-sm text-slate-600">
          <span>이전 시즌 기준</span>
          <select
            value={priorMode}
            onChange={(event) => setPriorMode(event.target.value as "auto" | "none" | "manual")}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          >
            <option value="auto">자동 추천</option>
            <option value="manual">직접 선택</option>
            <option value="none">없음 / 중립 rating</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>리그 방식</span>
          <select
            value={roundRobinType}
            onChange={(event) => setRoundRobinType(event.target.value as "single" | "double")}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          >
            <option value="single">싱글 라운드로빈</option>
            <option value="double">더블 라운드로빈</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>시뮬레이션 횟수</span>
          <input
            type="number"
            min={500}
            step={500}
            value={iterations}
            onChange={(event) => setIterations(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          />
        </label>
      </div>

      {priorMode === "manual" ? (
        <label className="space-y-2 text-sm text-slate-600">
          <span>직전 시즌 선택</span>
          <select
            value={manualPriorSeasonId}
            onChange={(event) => setManualPriorSeasonId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          >
            {league.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="space-y-2 text-sm text-slate-600">
        <span>소수점 자리수</span>
        <input
          type="number"
          min={0}
          max={3}
          value={decimalPlaces}
          onChange={(event) => setDecimalPlaces(Number(event.target.value))}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
        />
      </label>

      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
        <div className="space-y-3 md:col-span-2">
          <p className="text-sm font-semibold text-ink">모델 프리셋</p>
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
          <p className="text-xs text-slate-500">
            균형형은 기본 추천, 공격형은 현재 시즌을 빠르게 반영, 보수형은 prior와 표본 안정성을 더 오래 유지합니다.
          </p>
        </div>
        <label className="space-y-2 text-sm text-slate-600">
          <span>prior 감쇠 속도</span>
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
          <span>상대 강도 반영 비중</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={opponentStrengthWeight}
            onChange={(event) => setOpponentStrengthWeight(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600">
          <span>세트 스코어 분포 민감도</span>
          <input
            type="number"
            min={0.5}
            max={2}
            step={0.05}
            value={setSkewFactor}
            onChange={(event) => setSetSkewFactor(Number(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm text-slate-600">
        <span>수동 초기 rating 입력 (선택)</span>
        <textarea
          rows={4}
          value={manualRatingsText}
          onChange={(event) => setManualRatingsText(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pine"
          placeholder={"PF: 1500\nZAN: 1500"}
        />
      </label>

      <p className="text-xs leading-5 text-slate-500">
        직전 시즌 데이터가 없는 신규 팀은 중립 rating으로 시작합니다. 팀별로 수동 rating을 적으면 그 값을 우선
        사용합니다.
      </p>

      <button
        type="submit"
        className="w-full rounded-2xl bg-pine px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#234d40]"
      >
        시즌 생성
      </button>
    </form>
  );
}
