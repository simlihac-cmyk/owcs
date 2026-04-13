"use client";

import { useEffect, useState } from "react";
import { MODEL_PRESETS } from "@/lib/model-presets";
import { League, Season, Team, UpdateSeasonSettingsInput } from "@/lib/types";
import { createId } from "@/lib/utils/ids";

interface TeamRow {
  id: string;
  name: string;
  manualRating: string;
}

interface SeasonSettingsFormProps {
  league: League;
  season: Season;
  onSave: (input: UpdateSeasonSettingsInput) => void;
  onRenameTeam: (teamId: string, nextName: string) => void;
}

function buildTeamRows(league: League, season: Season): TeamRow[] {
  return season.teamIds.map((teamId) => {
    const team = league.teams.find((candidate) => candidate.id === teamId);
    const seasonTeam = league.seasonTeams.find(
      (candidate) => candidate.seasonId === season.id && candidate.teamId === teamId
    );

    return {
      id: teamId,
      name: team?.name ?? teamId,
      manualRating:
        seasonTeam?.manualInitialRating === null || seasonTeam?.manualInitialRating === undefined
          ? ""
          : String(seasonTeam.manualInitialRating)
    };
  });
}

function uniqueTiebreakers(values: string[]): ("wins" | "setDiff" | "setsWon")[] {
  const allowed = values.filter((value): value is "wins" | "setDiff" | "setsWon" =>
    ["wins", "setDiff", "setsWon"].includes(value)
  );
  return Array.from(new Set(allowed));
}

export function SeasonSettingsForm({
  league,
  season,
  onSave,
  onRenameTeam
}: SeasonSettingsFormProps) {
  const [name, setName] = useState(season.name);
  const [priorSelection, setPriorSelection] = useState(
    season.priorSeasonId === "" ? "none" : season.priorSeasonId ?? "auto"
  );
  const [qualifierCount, setQualifierCount] = useState(season.rules.qualifierCount);
  const [lcqQualifierCount, setLcqQualifierCount] = useState(season.rules.lcqQualifierCount);
  const [roundRobinType, setRoundRobinType] = useState<"single" | "double">(
    season.rules.roundRobinType
  );
  const [iterations, setIterations] = useState(season.simulationConfig.iterations);
  const [decimalPlaces, setDecimalPlaces] = useState(season.simulationConfig.decimalPlaces);
  const [priorWeightDecay, setPriorWeightDecay] = useState(season.simulationConfig.priorWeightDecay);
  const [shrinkageMatches, setShrinkageMatches] = useState(season.simulationConfig.shrinkageMatches);
  const [opponentStrengthWeight, setOpponentStrengthWeight] = useState(
    season.simulationConfig.opponentStrengthWeight
  );
  const [setSkewFactor, setSetSkewFactor] = useState(season.simulationConfig.setSkewFactor);
  const [tie1, setTie1] = useState(season.rules.rankingTiebreakers[0] ?? "wins");
  const [tie2, setTie2] = useState(season.rules.rankingTiebreakers[1] ?? "setDiff");
  const [tie3, setTie3] = useState(season.rules.rankingTiebreakers[2] ?? "setsWon");
  const [teamRows, setTeamRows] = useState<TeamRow[]>(buildTeamRows(league, season));
  const [existingTeamToAdd, setExistingTeamToAdd] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    setName(season.name);
    setPriorSelection(season.priorSeasonId === "" ? "none" : season.priorSeasonId ?? "auto");
    setQualifierCount(season.rules.qualifierCount);
    setLcqQualifierCount(season.rules.lcqQualifierCount);
    setRoundRobinType(season.rules.roundRobinType);
    setIterations(season.simulationConfig.iterations);
    setDecimalPlaces(season.simulationConfig.decimalPlaces);
    setPriorWeightDecay(season.simulationConfig.priorWeightDecay);
    setShrinkageMatches(season.simulationConfig.shrinkageMatches);
    setOpponentStrengthWeight(season.simulationConfig.opponentStrengthWeight);
    setSetSkewFactor(season.simulationConfig.setSkewFactor);
    setTie1(season.rules.rankingTiebreakers[0] ?? "wins");
    setTie2(season.rules.rankingTiebreakers[1] ?? "setDiff");
    setTie3(season.rules.rankingTiebreakers[2] ?? "setsWon");
    setTeamRows(buildTeamRows(league, season));
  }, [league, season]);

  const addExistingTeam = () => {
    if (!existingTeamToAdd || teamRows.some((row) => row.id === existingTeamToAdd)) {
      return;
    }

    const team = league.teams.find((candidate) => candidate.id === existingTeamToAdd);

    if (!team) {
      return;
    }

    setTeamRows((current) => [...current, { id: team.id, name: team.name, manualRating: "" }]);
    setExistingTeamToAdd("");
  };

  const addNewTeam = () => {
    const trimmed = newTeamName.trim();

    if (!trimmed) {
      return;
    }

    setTeamRows((current) => [
      ...current,
      {
        id: createId("team"),
        name: trimmed,
        manualRating: ""
      }
    ]);
    setNewTeamName("");
  };

  const availableExistingTeams = league.teams.filter(
    (team) => !teamRows.some((row) => row.id === team.id)
  );

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
    const existingNameMap = new Map(league.teams.map((team) => [team.id, team.name]));
    const originalRows = buildTeamRows(league, season);

    teamRows.forEach((row) => {
      const currentName = existingNameMap.get(row.id);
      if (currentName && currentName !== row.name.trim()) {
        onRenameTeam(row.id, row.name);
      }
    });

    const newTeams: Team[] = teamRows
      .filter((row) => !existingNameMap.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.name.trim()
      }));
    const teamCompositionChanged =
      teamRows.length !== originalRows.length ||
      teamRows.some((row, index) => row.id !== originalRows[index]?.id);
    const manualRatingsChanged = teamRows.some(
      (row, index) => row.manualRating !== (originalRows[index]?.manualRating ?? "")
    );
    const includeTeamEdits = teamCompositionChanged || manualRatingsChanged || newTeams.length > 0;

    onSave({
      seasonId: season.id,
      name,
      priorSeasonId:
        priorSelection === "auto" ? null : priorSelection === "none" ? "" : priorSelection,
      rules: {
        qualifierCount,
        lcqQualifierCount,
        roundRobinType,
        rankingTiebreakers: uniqueTiebreakers([tie1, tie2, tie3])
      },
      simulationConfig: {
        iterations,
        decimalPlaces,
        priorWeightDecay,
        shrinkageMatches,
        opponentStrengthWeight,
        setSkewFactor
      },
      teamEdits: includeTeamEdits
        ? {
            teamIds: teamRows.map((row) => row.id),
            newTeams,
            manualInitialRatings: Object.fromEntries(
              teamRows.map((row) => [row.id, row.manualRating ? Number(row.manualRating) : null])
            )
          }
        : undefined
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
        <h3 className="text-lg font-semibold text-ink">시즌 설정</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          팀 구성, prior 시즌, 진출 팀 수, 타이브레이커 순서, 시뮬레이션 설정을 여기서 조정할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
          <label className="block space-y-2 text-sm text-slate-600">
            <span>시즌명</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span>직전 시즌</span>
              <select
                value={priorSelection}
                onChange={(event) => setPriorSelection(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="auto">자동 추천</option>
                <option value="none">없음 / 중립 rating</option>
                {league.seasons
                  .filter((candidate) => candidate.id !== season.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>시드 결정전 진출 팀 수</span>
              <input
                type="number"
                min={1}
                value={qualifierCount}
                onChange={(event) => setQualifierCount(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>LCQ 진출 팀 수</span>
              <input
                type="number"
                min={0}
                value={lcqQualifierCount}
                onChange={(event) => setLcqQualifierCount(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span>라운드로빈</span>
              <select
                value={roundRobinType}
                onChange={(event) => setRoundRobinType(event.target.value as "single" | "double")}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="single">싱글</option>
                <option value="double">더블</option>
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
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[tie1, tie2, tie3].map((value, index) => (
              <label key={index} className="space-y-2 text-sm text-slate-600">
                <span>타이브레이커 {index + 1}</span>
                <select
                  value={value}
                  onChange={(event) => {
                    const next = event.target.value as "wins" | "setDiff" | "setsWon";
                    if (index === 0) {
                      setTie1(next);
                    } else if (index === 1) {
                      setTie2(next);
                    } else {
                      setTie3(next);
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <option value="wins">승수</option>
                  <option value="setDiff">세트 득실</option>
                  <option value="setsWon">세트 획득</option>
                </select>
              </label>
            ))}
          </div>

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
                균형형은 기본 추천, 공격형은 현재 시즌을 빠르게 반영, 보수형은 prior와 표본 안정성을 더 오래
                유지합니다.
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
        </div>

        <div className="space-y-4 rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
          <h4 className="text-base font-semibold text-ink">참가 팀 편집</h4>
          <div className="space-y-3">
            {teamRows.map((row) => (
              <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                <input
                  value={row.name}
                  onChange={(event) =>
                    setTeamRows((current) =>
                      current.map((candidate) =>
                        candidate.id === row.id ? { ...candidate, name: event.target.value } : candidate
                      )
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                />
                <input
                  type="number"
                  placeholder="수동 rating"
                  value={row.manualRating}
                  onChange={(event) =>
                    setTeamRows((current) =>
                      current.map((candidate) =>
                        candidate.id === row.id
                          ? { ...candidate, manualRating: event.target.value }
                          : candidate
                      )
                    )
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTeamRows((current) => current.filter((candidate) => candidate.id !== row.id))
                  }
                  className="rounded-2xl border border-coral/30 px-4 py-3 text-sm font-semibold text-coral"
                >
                  제외
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={existingTeamToAdd}
              onChange={(event) => setExistingTeamToAdd(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">기존 팀 추가</option>
              {availableExistingTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addExistingTeam}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              추가
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="새 팀 이름"
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
            <button
              type="button"
              onClick={addNewTeam}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              신규 팀 추가
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-2xl bg-pine px-4 py-3 text-sm font-semibold text-white"
          >
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
}
