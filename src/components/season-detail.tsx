"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchManager } from "@/components/match-manager";
import { SeasonModelSettingsForm } from "@/components/season-model-settings-form";
import {
  ImportantMatchCalendar,
  MobileSummaryCards,
  SummaryMetric,
  TeamProbabilityCards
} from "@/components/season-dashboard-panels";
import { ProbabilityTable } from "@/components/probability-table";
import { RankingTable } from "@/components/ranking-table";
import { Panel, StatCard } from "@/components/season-shared";
import { TeamPage } from "@/components/team-page";
import {
  League,
  MatchOutcomeImpact,
  MatchResult,
  Season,
  SeasonInsight,
  TeamProbabilitySummary,
  UpdateSeasonSettingsInput
} from "@/lib/types";
import {
  formatDateLabel,
  formatDateTimeLabel,
  formatDecimal,
  formatPercent,
  formatRating,
  formatSigned
} from "@/lib/utils/format";
import { getSeasonTeamNameMap } from "@/lib/utils/season-team-display";
import { getTeamBrand } from "@/lib/utils/team-brand";

interface SeasonDetailProps {
  league: League;
  baselineLeague: League;
  season: Season;
  insight: SeasonInsight | null;
  isLoading: boolean;
  error: string | null;
  onChangeResult: (matchId: string, result: MatchResult | null) => void;
  onSaveSettings: (payload: UpdateSeasonSettingsInput) => void;
}

type DetailTab = "dashboard" | "teams" | "matches" | "settings" | "archive";
type ImpactMetric = "seed" | "first" | "lcq" | "ninth" | "averageRank";

const tabLabels: Record<DetailTab, string> = {
  dashboard: "대시보드",
  teams: "팀 페이지",
  matches: "남은 경기 예측",
  settings: "모델",
  archive: "아카이브"
};

const impactMetricOptions: Array<{ value: ImpactMetric; label: string }> = [
  { value: "seed", label: "시드 결정전" },
  { value: "first", label: "1위" },
  { value: "lcq", label: "LCQ" },
  { value: "ninth", label: "9위" },
  { value: "averageRank", label: "예상 최종 순위" }
];

const summaryMetricOptions: Array<{ value: SummaryMetric; label: string }> = [
  { value: "seed", label: "시드 결정전" },
  { value: "first", label: "1위" },
  { value: "averageRank", label: "예상 최종 순위" }
];

function getSeasonStatusLabel(status: Season["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "ongoing") {
    return "진행 중";
  }

  return "준비 중";
}

function getImpactMetricLabel(metric: ImpactMetric) {
  return impactMetricOptions.find((option) => option.value === metric)?.label ?? metric;
}

function getLcqRankRange(teamCount: number, qualifierCount: number, lcqQualifierCount: number) {
  if (lcqQualifierCount <= 0) {
    return null;
  }

  const start = 1;
  const end = Math.min(teamCount, lcqQualifierCount);

  if (start > teamCount || start > end) {
    return null;
  }

  return { start, end };
}

function sumRankRange(probabilityByRank: Record<number, number>, start: number, end: number) {
  let total = 0;

  for (let rank = start; rank <= end; rank += 1) {
    total += probabilityByRank[rank] ?? 0;
  }

  return total;
}

function getMetricValueFromSummary(
  summary: TeamProbabilitySummary,
  metric: ImpactMetric,
  qualifierCount: number,
  lcqQualifierCount: number,
  teamCount: number
) {
  if (metric === "seed") {
    return summary.qualifierProbability;
  }

  if (metric === "first") {
    return summary.finishProbabilityByRank[1] ?? 0;
  }

  if (metric === "lcq") {
    const range = getLcqRankRange(teamCount, qualifierCount, lcqQualifierCount);
    return range ? sumRankRange(summary.finishProbabilityByRank, range.start, range.end) : 0;
  }

  if (metric === "ninth") {
    return summary.finishProbabilityByRank[teamCount] ?? 0;
  }

  return summary.averageFinalRank;
}

function getMetricValueFromOutcome(
  outcome: MatchOutcomeImpact,
  teamId: string,
  metric: ImpactMetric,
  qualifierCount: number,
  lcqQualifierCount: number,
  teamCount: number
) {
  if (metric === "seed") {
    return outcome.qualifierProbabilityByTeamId[teamId] ?? 0;
  }

  if (metric === "first") {
    return outcome.finishProbabilityByRankByTeamId[teamId]?.[1] ?? 0;
  }

  if (metric === "lcq") {
    const range = getLcqRankRange(teamCount, qualifierCount, lcqQualifierCount);
    return range
      ? sumRankRange(outcome.finishProbabilityByRankByTeamId[teamId] ?? {}, range.start, range.end)
      : 0;
  }

  if (metric === "ninth") {
    return outcome.finishProbabilityByRankByTeamId[teamId]?.[teamCount] ?? 0;
  }

  return outcome.averageRankByTeamId[teamId] ?? 0;
}

function formatImpactMetricValue(value: number, metric: ImpactMetric) {
  return metric === "averageRank" ? `${formatDecimal(value, 1)}위` : formatPercent(value, 1);
}

function formatImpactDelta(delta: number, metric: ImpactMetric) {
  if (metric === "averageRank") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatDecimal(delta, 1)}위`;
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatDecimal(delta, 1)}%p`;
}

function getReplayCodesForDisplay(replayCodes: string[] | undefined): string[] {
  return (replayCodes ?? []).map((code) => code.trim()).filter(Boolean);
}

export function SeasonDetail({
  league,
  baselineLeague,
  season,
  insight,
  isLoading,
  error,
  onChangeResult,
  onSaveSettings
}: SeasonDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("dashboard");
  const [selectedImpactMatchId, setSelectedImpactMatchId] = useState<string>("");
  const [selectedImpactMetric, setSelectedImpactMetric] = useState<ImpactMetric>("seed");
  const [selectedSummaryMetric, setSelectedSummaryMetric] = useState<SummaryMetric>("seed");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const teamMap = getSeasonTeamNameMap(league, season);
  const priorSeason = league.seasons.find((candidate) => candidate.id === season.priorSeasonId);
  const priorTeamMap = priorSeason ? getSeasonTeamNameMap(league, priorSeason) : {};
  const availableImpactMetricOptions = useMemo(
    () =>
      impactMetricOptions.filter(
        (option) => option.value !== "lcq" || season.rules.lcqQualifierCount > 0
      ),
    [season.rules.lcqQualifierCount]
  );

  useEffect(() => {
    setActiveTab("dashboard");
  }, [season.id]);

  useEffect(() => {
    if (!insight?.remainingMatchInsights.length) {
      setSelectedImpactMatchId("");
      return;
    }

    setSelectedImpactMatchId((current) =>
      current && insight.remainingMatchInsights.some((item) => item.matchId === current)
        ? current
        : insight.remainingMatchInsights[0]?.matchId ?? ""
    );
  }, [insight]);

  useEffect(() => {
    if (!insight?.currentStandings.length) {
      setSelectedTeamId("");
      return;
    }

    setSelectedTeamId((current) =>
      current && insight.currentStandings.some((item) => item.teamId === current)
        ? current
        : insight.currentStandings[0]?.teamId ?? ""
    );
  }, [insight]);

  useEffect(() => {
    if (!availableImpactMetricOptions.some((option) => option.value === selectedImpactMetric)) {
      setSelectedImpactMetric("seed");
    }
  }, [availableImpactMetricOptions, selectedImpactMetric]);

  const selectedMatchImpact = useMemo(
    () => insight?.remainingMatchInsights.find((item) => item.matchId === selectedImpactMatchId) ?? null,
    [insight, selectedImpactMatchId]
  );

  const orderedTeamIds = useMemo(
    () => insight?.currentStandings.map((standing) => standing.teamId) ?? season.teamIds,
    [insight, season.teamIds]
  );

  const titleContenderCount = useMemo(() => {
    if (!insight) {
      return 0;
    }

    return insight.probabilitySummaries.filter(
      (summary) => (summary.finishProbabilityByRank[1] ?? 0) >= 5
    ).length;
  }, [insight]);

  const qualifierRaceCount = useMemo(() => {
    if (!insight) {
      return 0;
    }

    return insight.probabilitySummaries.filter(
      (summary) => summary.qualifierProbability >= 5 && summary.qualifierProbability <= 95
    ).length;
  }, [insight]);

  return (
    <div className="space-y-6">
      <section className="ow-cut-panel px-6 py-7 text-[var(--ow-text)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand">시즌 상세</p>
            <h1 className="mt-3 text-3xl font-semibold">{season.name}</h1>
            <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
              {getSeasonStatusLabel(season.status)}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ow-text)]">
              직전 시즌 결과를 기반으로 초기 전력을 만들고, 현재 시즌이 진행될수록 prior 영향은 줄이고 현재 폼과
              상대 강도를 더 반영하는 방식으로 최종 순위 확률을 계산합니다.
            </p>
          </div>

          <div className="ow-panel-light min-w-[290px] px-4 py-4 text-sm text-[var(--ow-text)]">
            <p>이전 시즌 기준: {priorSeason?.name ?? "중립 rating / 수동 입력"}</p>
            <p className="mt-2">메인 시뮬레이션: {season.simulationConfig.iterations.toLocaleString()}회</p>
            <p className="mt-2">
              영향 분석: {insight ? insight.simulationMeta.analysisIterations.toLocaleString() : "-"}회
            </p>
            <p className="mt-2">계산 상태: {isLoading ? "재계산 중" : "준비 완료"}</p>
            <p className="mt-2">
              마지막 계산: {insight ? formatDateTimeLabel(insight.simulationMeta.ranAt) : "대기 중"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <StatCard
            label="완료 경기"
            value={insight ? `${insight.summary.completedMatchCount}/${insight.summary.totalMatchCount}` : "..."}
          />
          <StatCard label="남은 경기" value={insight ? String(insight.remainingMatches.length) : "..."} />
          <StatCard label="1위 경쟁 팀" value={insight ? `${titleContenderCount}팀` : "..."} />
          <StatCard
            label="시드 결정전 경쟁 팀"
            value={insight ? `${qualifierRaceCount}팀` : "..."}
            tone="accent"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(tabLabels) as DetailTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab ? "ow-primary-button" : "ow-ghost-button"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-panel">
          {error}
        </div>
      ) : null}

      {activeTab === "dashboard" && insight ? (
        <div className="space-y-6">
          <MobileSummaryCards insight={insight} teamMap={teamMap} metric={selectedSummaryMetric} />

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <RankingTable
              standings={insight.currentStandings}
              qualifierCount={season.rules.qualifierCount}
              ratingsByTeamId={insight.ratingsByTeamId}
            />
            <Panel
              title="확률 카드"
                  description="지표를 눌러 시드 결정전, LCQ, 1위, 예상 최종 순위를 카드형으로 비교합니다."
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {summaryMetricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedSummaryMetric(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                      selectedSummaryMetric === option.value ? "ow-primary-button" : "ow-ghost-button"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <TeamProbabilityCards
                insight={insight}
                teamMap={teamMap}
                decimalPlaces={season.simulationConfig.decimalPlaces}
                metric={selectedSummaryMetric}
              />
            </Panel>
          </div>

          <ProbabilityTable
            summaries={insight.probabilitySummaries}
            teamNameById={teamMap}
            decimalPlaces={season.simulationConfig.decimalPlaces}
          />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel
              title="중요 경기 캘린더"
              description="날짜별로 경기 중요도를 정리합니다. 시드 결정전 판도에 큰 영향을 주는 경기가 위로 옵니다."
            >
              {insight.remainingMatchInsights.length === 0 ? (
                <p className="text-sm text-slate-500">남은 경기가 없습니다.</p>
              ) : (
                <ImportantMatchCalendar insight={insight} teamMap={teamMap} />
              )}
            </Panel>

            <Panel
              title="특정 경기 결과별 영향 보기"
              description="경기와 지표를 선택하면 세트 스코어별 결과가 판도에 주는 영향을 비교할 수 있습니다."
            >
              {selectedMatchImpact ? (
                <div className="space-y-4">
                  <select
                    value={selectedImpactMatchId}
                    onChange={(event) => setSelectedImpactMatchId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[var(--ow-text)]"
                  >
                    {insight.remainingMatchInsights.map((item) => (
                      <option key={item.matchId} value={item.matchId}>
                        {teamMap[item.teamAId]} vs {teamMap[item.teamBId]} · {formatDateLabel(item.scheduledAt)}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-2">
                    {availableImpactMetricOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedImpactMetric(option.value)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          selectedImpactMetric === option.value ? "ow-primary-button" : "ow-ghost-button"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    기본 예측: {teamMap[selectedMatchImpact.teamAId]} 승률{" "}
                    {formatPercent(selectedMatchImpact.teamAWinProbability, 1)} / {teamMap[selectedMatchImpact.teamBId]} 승률{" "}
                    {formatPercent(selectedMatchImpact.teamBWinProbability, 1)}
                  </div>

                  <div className="space-y-3">
                    {selectedMatchImpact.outcomes.map((outcome) => (
                      <div key={outcome.resultLabel} className="rounded-2xl border border-slate-200/70 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">결과 {outcome.resultLabel}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              가장 민감한 팀:{" "}
                              {selectedMatchImpact.biggestSwingTeamId
                                ? teamMap[selectedMatchImpact.biggestSwingTeamId]
                                : "-"}{" "}
                              · 기준 지표 {getImpactMetricLabel(selectedImpactMetric)}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            사전 확률 {formatPercent(selectedMatchImpact.resultProbabilities[outcome.resultLabel] ?? 0, 1)}
                          </span>
                        </div>

                        <div className="mt-3 grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {orderedTeamIds.map((teamId) => {
                            const baseSummary = insight.probabilitySummaries.find(
                              (summary) => summary.teamId === teamId
                            );

                            if (!baseSummary) {
                              return null;
                            }

                            const baseValue = getMetricValueFromSummary(
                              baseSummary,
                              selectedImpactMetric,
                              season.rules.qualifierCount,
                              season.rules.lcqQualifierCount,
                              season.teamIds.length
                            );
                            const nextValue = getMetricValueFromOutcome(
                              outcome,
                              teamId,
                              selectedImpactMetric,
                              season.rules.qualifierCount,
                              season.rules.lcqQualifierCount,
                              season.teamIds.length
                            );
                            const delta =
                              selectedImpactMetric === "averageRank"
                                ? baseValue - nextValue
                                : nextValue - baseValue;
                            const brand = getTeamBrand(teamId);

                            return (
                              <div
                                key={teamId}
                                className="flex h-full flex-col rounded-xl px-3 py-3 text-sm"
                                style={{ backgroundColor: brand.soft }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-ink">{teamMap[teamId] ?? teamId}</span>
                                  <span
                                    className={`font-semibold ${
                                      delta > 0 ? "text-pine" : delta < 0 ? "text-coral" : "text-slate-500"
                                    }`}
                                  >
                                    {formatImpactDelta(delta, selectedImpactMetric)}
                                  </span>
                                </div>
                                <p className="mt-auto pt-1 text-xs text-slate-500">
                                  {getImpactMetricLabel(selectedImpactMetric)}{" "}
                                  {formatImpactMetricValue(nextValue, selectedImpactMetric)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">영향을 분석할 남은 경기가 없습니다.</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Panel
              title="전력과 모델 설정"
              description={`prior 감쇠 ${season.simulationConfig.priorWeightDecay}, shrinkage ${season.simulationConfig.shrinkageMatches}경기, 상대 강도 반영 ${formatPercent(season.simulationConfig.opponentStrengthWeight * 100, 0)}입니다.`}
            >
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  시즌 진행률 {formatPercent(insight.priorBlend.completionRatio, 1)}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  현재 시즌 반영 비중 {formatPercent(insight.priorBlend.currentWeight, 1)}
                </div>
              </div>
              <div className="space-y-3">
                {insight.ratingBreakdowns.map((item) => {
                  const brand = getTeamBrand(item.teamId);
                  return (
                    <div key={item.teamId} className="rounded-2xl border border-slate-200/70 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.primary }} />
                          <div>
                            <p className="font-semibold text-ink">{teamMap[item.teamId] ?? item.teamId}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.previousSeasonRank
                                ? `직전 시즌 ${item.previousSeasonRank}위`
                                : "직전 시즌 데이터 없음"}
                              {item.manualInitialRating !== null ? " · 수동 초기 rating 사용" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold" style={{ color: brand.primary }}>
                            {formatRating(item.blendedRating)}
                          </p>
                          <p className="text-xs text-slate-500">반영 전력</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel title="직전 시즌 대비 기대 순위 변화" description="이전 시즌 최종 순위와 현재 기대 순위를 비교합니다.">
                <div className="space-y-3">
                  {insight.teamTrends.map((trend) => {
                    const brand = getTeamBrand(trend.teamId);
                    return (
                      <div key={trend.teamId} className="rounded-2xl px-4 py-4" style={{ backgroundColor: brand.soft }}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-ink">{teamMap[trend.teamId] ?? trend.teamId}</span>
                          <span
                            className={`text-sm font-semibold ${
                              (trend.deltaFromPreviousRank ?? 0) > 0
                                ? "text-pine"
                                : (trend.deltaFromPreviousRank ?? 0) < 0
                                  ? "text-coral"
                                  : "text-slate-500"
                            }`}
                          >
                            {trend.deltaFromPreviousRank === null
                              ? "신규/비교 불가"
                              : `${trend.deltaFromPreviousRank > 0 ? "+" : ""}${formatDecimal(
                                  trend.deltaFromPreviousRank,
                                  1
                                )}`}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          직전 시즌 {trend.previousRank ? `${trend.previousRank}위` : "기록 없음"} · 현재 기대 순위{" "}
                          {formatDecimal(trend.expectedRank, 1)}위
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="동률 및 타이브레이커 설명" description="현재 정렬 규칙에 따라 동률 구간을 문장으로 설명합니다.">
                {insight.tiebreakNotes.length === 0 ? (
                  <p className="text-sm text-slate-500">현재는 별도 설명이 필요한 동률 구간이 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    {insight.tiebreakNotes.map((note) => (
                      <div
                        key={`${note.higherTeamId}-${note.lowerTeamId}`}
                        className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600"
                      >
                        {note.reason}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "teams" && insight ? (
        <TeamPage
          season={season}
          league={league}
          insight={insight}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          teamMap={teamMap}
          priorTeamMap={priorTeamMap}
        />
      ) : null}

      {activeTab === "matches" ? (
        <MatchManager
          league={league}
          baselineLeague={baselineLeague}
          season={season}
          matches={league.matches.filter((match) => match.seasonId === season.id)}
          remainingMatchInsights={insight?.remainingMatchInsights ?? []}
          isLoading={isLoading}
          onChangeResult={onChangeResult}
        />
      ) : null}

      {activeTab === "settings" ? (
        <SeasonModelSettingsForm
          season={season}
          onSave={onSaveSettings}
        />
      ) : null}

      {activeTab === "archive" && insight ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <RankingTable
              standings={insight.summary.finalStandings}
              qualifierCount={season.rules.qualifierCount}
            />
            <Panel title="시즌 요약">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard label="선두 팀" value={teamMap[insight.summary.championTeamId ?? ""] ?? "-"} />
                <StatCard
                  label="경기 수"
                  value={`${insight.summary.completedMatchCount}/${insight.summary.totalMatchCount}`}
                />
                <StatCard label="상태" value={getSeasonStatusLabel(season.status)} />
              </div>
            </Panel>

            <Panel title="완료 경기 리플레이" description="완료된 경기의 세트 스코어와 리플레이 코드를 확인합니다.">
              {insight.completedMatches.length === 0 ? (
                <p className="text-sm text-slate-500">아직 완료된 경기가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {insight.completedMatches
                    .slice()
                    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
                    .map((match) => {
                      const replayCodes = getReplayCodesForDisplay(match.replayCodes);

                      return (
                        <div key={match.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">
                                {teamMap[match.teamAId] ?? match.teamAId} vs {teamMap[match.teamBId] ?? match.teamBId}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTimeLabel(match.scheduledAt)}</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                              {match.result ? `${match.result.setsA}:${match.result.setsB}` : "-"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {replayCodes.length > 0 ? (
                              replayCodes.map((replayCode, replayIndex) => (
                                <span
                                  key={`${match.id}-archive-replay-${replayIndex + 1}`}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                                >
                                  맵 {replayIndex + 1} · {replayCode}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-full border border-dashed border-slate-300 bg-white/80 px-3 py-1.5 text-xs text-slate-500">
                                리플레이 코드 없음
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="이전 시즌 기준 데이터" description="현재 시즌 prior의 기반이 된 직전 시즌 기록입니다.">
              {insight.previousSeasonStats.length === 0 ? (
                <p className="text-sm text-slate-500">
                  직전 시즌 데이터가 없어 중립 rating 또는 수동 rating을 사용합니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {insight.previousSeasonStats.map((stat) => (
                    <div
                      key={stat.teamId}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-ink">
                        {priorTeamMap[stat.teamId] ?? teamMap[stat.teamId] ?? stat.teamId}
                      </span>
                      <span className="text-slate-500">
                        #{stat.finalRank} / {stat.wins}-{stat.losses} / SD {formatSigned(stat.setDiff)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
