"use client";

import { useEffect, useMemo, useState } from "react";
import { RESULT_OPTIONS } from "@/lib/constants";
import { League, Match, MatchResult, RemainingMatchInsight, Season } from "@/lib/types";
import { formatDateLabel, formatPercent } from "@/lib/utils/format";
import { getSeasonTeamNameMap } from "@/lib/utils/season-team-display";
import { getTeamBrand } from "@/lib/utils/team-brand";

interface MatchManagerProps {
  league: League;
  baselineLeague: League;
  season: Season;
  matches: Match[];
  remainingMatchInsights: RemainingMatchInsight[];
  isLoading: boolean;
  onChangeResult: (matchId: string, result: MatchResult | null) => void;
}

interface WeekGroup {
  weekIndex: number;
  dateGroups: Array<{
    dateKey: string;
    matches: Match[];
  }>;
}

function stringifyResult(result?: MatchResult | null): string {
  if (!result) {
    return "";
  }

  return `${result.setsA}:${result.setsB}`;
}

function parseResult(value: string): MatchResult | null {
  if (!value) {
    return null;
  }

  const [setsA, setsB] = value.split(":").map(Number);
  return { setsA, setsB };
}

function getResultProbabilityLabel(insight: RemainingMatchInsight | undefined, resultLabel: string): string {
  return formatPercent(insight?.resultProbabilities[resultLabel] ?? 0, 1);
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function dayDiff(left: string, right: string): number {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);

  return Math.round((rightDate.getTime() - leftDate.getTime()) / (1000 * 60 * 60 * 24));
}

function buildWeekGroups(matches: Match[], referenceMatches: Match[]): WeekGroup[] {
  const targetIds = new Set(matches.map((match) => match.id));
  const referenceDateMap = referenceMatches.reduce<Map<string, Match[]>>((accumulator, match) => {
    const dateKey = toDateKey(match.scheduledAt);
    accumulator.set(dateKey, [...(accumulator.get(dateKey) ?? []), match]);
    return accumulator;
  }, new Map());
  const orderedDateKeys = Array.from(referenceDateMap.keys()).sort((left, right) => left.localeCompare(right));
  const result: WeekGroup[] = [];
  let weekIndex = 0;
  let currentWeekStart = "";

  for (const dateKey of orderedDateKeys) {
    if (!currentWeekStart || dayDiff(currentWeekStart, dateKey) > 3) {
      weekIndex += 1;
      currentWeekStart = dateKey;
    }

    const dayMatches = (referenceDateMap.get(dateKey) ?? [])
      .filter((match) => targetIds.has(match.id))
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

    if (dayMatches.length === 0) {
      continue;
    }

    const previousWeek = result[result.length - 1];

    if (!previousWeek || previousWeek.weekIndex !== weekIndex) {
      result.push({
        weekIndex,
        dateGroups: []
      });
    }

    result[result.length - 1].dateGroups.push({
      dateKey,
      matches: dayMatches
    });
  }

  return result;
}

export function MatchManager({
  league,
  baselineLeague,
  season,
  matches,
  remainingMatchInsights,
  isLoading,
  onChangeResult
}: MatchManagerProps) {
  const teamMap = getSeasonTeamNameMap(league, season);
  const [cachedInsightByMatchId, setCachedInsightByMatchId] = useState<Record<string, RemainingMatchInsight>>({});
  const [selectedResultByMatchId, setSelectedResultByMatchId] = useState<Record<string, MatchResult | null>>({});

  useEffect(() => {
    if (remainingMatchInsights.length === 0) {
      return;
    }

    setCachedInsightByMatchId((previous) => {
      const next = { ...previous };

      for (const item of remainingMatchInsights) {
        next[item.matchId] = item;
      }

      return next;
    });
  }, [remainingMatchInsights]);

  useEffect(() => {
    setSelectedResultByMatchId((previous) => {
      const next = { ...previous };

      for (const match of matches) {
        next[match.id] = match.result ?? null;
      }

      return next;
    });
  }, [matches]);

  const insightByMatchId = useMemo(
    () => ({
      ...cachedInsightByMatchId,
      ...Object.fromEntries(remainingMatchInsights.map((item) => [item.matchId, item]))
    }),
    [cachedInsightByMatchId, remainingMatchInsights]
  );

  const baselineRemainingMatchIds = useMemo(
    () =>
      new Set(
        baselineLeague.matches
          .filter((match) => match.seasonId === season.id && (!match.played || !match.result))
          .map((match) => match.id)
      ),
    [baselineLeague, season.id]
  );

  const baselineSeasonMatches = useMemo(
    () =>
      baselineLeague.matches
        .filter((match) => match.seasonId === season.id)
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
    [baselineLeague, season.id]
  );

  const predictionMatches = useMemo(
    () =>
      matches
        .filter((match) => baselineRemainingMatchIds.has(match.id))
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
    [matches, baselineRemainingMatchIds]
  );

  const predictionWeekGroups = useMemo(
    () => buildWeekGroups(predictionMatches, baselineSeasonMatches),
    [predictionMatches, baselineSeasonMatches]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-white/60 bg-white/85 p-4 shadow-panel backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">남은 경기 예측</h3>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {isLoading ? "계산 중.." : "예측 반영 완료"}
          </div>
        </div>
      </div>

      {predictionMatches.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center text-sm text-slate-500">
          현재 기준으로 남은 경기가 없습니다.
        </div>
      ) : (
        predictionWeekGroups.map((weekGroup) => (
          <section
            key={`prediction-week-${weekGroup.weekIndex}`}
            className="rounded-[26px] border border-white/60 bg-white/85 p-4 shadow-panel backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Week</p>
                <h4 className="text-lg font-semibold text-ink">{weekGroup.weekIndex}주차</h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {weekGroup.dateGroups.reduce((sum, dateGroup) => sum + dateGroup.matches.length, 0)}경기
              </span>
            </div>

            <div className="space-y-3">
              {weekGroup.dateGroups.map((dateGroup) => (
                <div key={dateGroup.dateKey} className="rounded-[22px] border border-slate-200/70 bg-slate-50 px-3 py-3">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <h5 className="font-semibold text-ink">{formatDateLabel(dateGroup.dateKey)}</h5>
                    <span className="text-xs font-semibold text-slate-500">{dateGroup.matches.length}경기</span>
                  </div>

                  <div className="space-y-1.5">
                    {dateGroup.matches.map((match) => {
                      const insight = insightByMatchId[match.id];
                      const activeResult = selectedResultByMatchId[match.id] ?? null;
                      return (
                        <div
                          key={match.id}
                          className="rounded-[20px] border border-white/80 bg-white px-3.5 py-3 shadow-sm"
                        >
                          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <p className="truncate text-base font-semibold text-ink">
                                  {teamMap[match.teamAId]} vs {teamMap[match.teamBId]}
                                </p>
                                {activeResult ? (
                                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-[#b56a1f]">
                                    예측 {activeResult.setsA}:{activeResult.setsB}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    아직 예측하지 않음
                                  </span>
                                )}
                              </div>

                              {insight ? (
                                <div className="mt-2.5 max-w-[420px] rounded-2xl border border-slate-200/70 bg-slate-50/90 px-3 py-3">
                                  <div className="flex items-center justify-between gap-4 text-[11px]">
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-ink">{teamMap[match.teamAId]}</p>
                                      <p className="mt-0.5 font-semibold text-slate-600">
                                        {formatPercent(insight.teamAWinProbability, 1)}
                                      </p>
                                    </div>
                                    <div className="min-w-0 text-right">
                                      <p className="truncate font-semibold text-ink">{teamMap[match.teamBId]}</p>
                                      <p className="mt-0.5 font-semibold text-slate-600">
                                        {formatPercent(insight.teamBWinProbability, 1)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-200/80">
                                    <div
                                      className="h-full"
                                      style={{
                                        width: `${insight.teamAWinProbability}%`,
                                        backgroundColor: getTeamBrand(match.teamAId).primary
                                      }}
                                    />
                                    <div
                                      className="h-full"
                                      style={{
                                        width: `${insight.teamBWinProbability}%`,
                                        backgroundColor: getTeamBrand(match.teamBId).primary
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 xl:min-w-0 xl:justify-end">
                              {RESULT_OPTIONS.map((option) => {
                                const isActive = stringifyResult(activeResult) === option;
                                const isMostLikely = insight?.mostLikelyResult === option;

                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                      const nextResult = parseResult(option);
                                      setSelectedResultByMatchId((previous) => ({
                                        ...previous,
                                        [match.id]: nextResult
                                      }));
                                      onChangeResult(match.id, nextResult);
                                    }}
                                    className={`flex min-w-[58px] flex-col items-center rounded-[18px] border px-2 py-1.5 text-xs font-semibold transition ${
                                      isActive
                                        ? "border-[#f28b2f] bg-[linear-gradient(135deg,#ffbf69,#f28b2f)] text-[#101722] shadow-[0_8px_24px_rgba(242,139,47,0.35)]"
                                        : isMostLikely
                                          ? "border-[#f3d5ae] bg-[linear-gradient(180deg,#fffaf2,#fff5e8)] text-[#8a5720] shadow-[0_4px_12px_rgba(242,139,47,0.10)]"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-[#f28b2f] hover:text-[#c86c1d]"
                                    }`}
                                  >
                                    <span className={`text-[10px] ${isActive ? "text-[#5f3a10]" : "text-slate-400"}`}>
                                      {getResultProbabilityLabel(insight, option)}
                                    </span>
                                    <span className="mt-0.5 text-sm">{option}</span>
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedResultByMatchId((previous) => ({
                                    ...previous,
                                    [match.id]: null
                                  }));
                                  onChangeResult(match.id, null);
                                }}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                예측 지우기
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
