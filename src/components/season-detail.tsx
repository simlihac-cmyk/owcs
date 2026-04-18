"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchManager } from "@/components/match-manager";
import { SeasonModelSettingsForm } from "@/components/season-model-settings-form";
import {
  ImportantMatchCalendar,
  MobileSummaryCards,
  SummaryMetric,
  TeamProbabilityCards,
  UpcomingPredictionSpotlight
} from "@/components/season-dashboard-panels";
import { ProbabilityTable } from "@/components/probability-table";
import { RankingTable } from "@/components/ranking-table";
import { ExpandablePanel, Panel, StatCard } from "@/components/season-shared";
import { TeamPage } from "@/components/team-page";
import { TournamentSeasonDetail } from "@/components/tournament-season-detail";
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

function getSeasonFormatLabel(season: Season) {
  return season.rules.roundRobinType === "double" ? "더블 라운드로빈" : "싱글 라운드로빈";
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
  const heroSummary = useMemo(() => {
    if (!insight) {
      return "현재 순위와 남은 경기 변수를 한 화면에서 확인할 수 있습니다.";
    }

    if (season.status === "completed") {
      return `총 ${insight.summary.totalMatchCount}경기를 모두 반영한 아카이브 시즌입니다.`;
    }

    if (insight.remainingMatches.length === 0) {
      return "남은 경기가 없어 현재까지의 결과를 기준으로 예측이 사실상 확정된 상태입니다.";
    }

    return `남은 ${insight.remainingMatches.length}경기와 ${qualifierRaceCount}팀의 시드 경쟁 흐름을 함께 볼 수 있습니다.`;
  }, [insight, qualifierRaceCount, season.status]);

  if (season.format === "tournament") {
    return <TournamentSeasonDetail league={league} season={season} />;
  }

	  return (
    <div className="space-y-6">
      <section className="ow-cut-panel ow-hero-panel ow-appear ow-stagger-1 px-6 py-7 text-[var(--ow-text)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ow-kicker">시즌 개요</p>
            <h1 className="ow-display-title mt-3 text-[clamp(2.4rem,4vw,4.2rem)]">{season.name}</h1>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-[var(--ow-muted)]">{heroSummary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                {getSeasonStatusLabel(season.status)}
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                {getSeasonFormatLabel(season)}
              </div>
            </div>
          </div>

          <div className="ow-panel-light min-w-[290px] max-w-[420px] px-4 py-4 text-sm text-[var(--ow-text)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ow-muted)]">
              이번 시즌 체크포인트
            </p>
            <div className="mt-3 space-y-2">
              <p>비교 기준 시즌: {priorSeason?.name ?? "직전 데이터 없음 / 수동 기준값 사용"}</p>
              <p>현재 상태: {isLoading ? "예측 다시 계산 중" : "최신 결과 반영 완료"}</p>
              <p>마지막 반영 시각: {insight ? formatDateTimeLabel(insight.simulationMeta.ranAt) : "대기 중"}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/70 px-3 py-3">
                순위 예측 반복 계산 {season.simulationConfig.iterations.toLocaleString()}회
              </div>
              <div className="rounded-2xl bg-white/70 px-3 py-3">
                영향 분석 반복 계산{" "}
                {insight ? insight.simulationMeta.analysisIterations.toLocaleString() : "-"}회
              </div>
            </div>
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

      <div className="ow-appear ow-stagger-2 flex flex-wrap gap-2" aria-label="시즌 상세 탭">
        {(Object.keys(tabLabels) as DetailTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
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
        <div className="space-y-6 ow-appear ow-stagger-3">
          {season.status !== "completed" || insight.remainingMatchInsights.length > 0 ? (
            <UpcomingPredictionSpotlight insight={insight} teamMap={teamMap} isLoading={isLoading} />
          ) : null}

          <MobileSummaryCards insight={insight} teamMap={teamMap} metric={selectedSummaryMetric} />

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <RankingTable
              standings={insight.currentStandings}
              qualifierCount={season.rules.qualifierCount}
              ratingsByTeamId={insight.ratingsByTeamId}
            />
            <Panel title="확률 카드">
              <div className="mb-4 flex flex-wrap gap-2" aria-label="확률 카드 기준 선택">
                {summaryMetricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedSummaryMetric(option.value)}
                    aria-pressed={selectedSummaryMetric === option.value}
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

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Panel title="중요 경기 일정">
              {insight.remainingMatchInsights.length === 0 ? (
                <p className="text-sm text-slate-700">남은 경기가 없습니다.</p>
              ) : (
                <ImportantMatchCalendar insight={insight} teamMap={teamMap} />
              )}
            </Panel>

            <Panel title="레이스 흐름 요약" description="지금 시즌 레이스를 빠르게 이해할 수 있는 핵심 지표입니다.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  비교 기준 시즌: {priorSeason?.name ?? "직전 데이터 없음"}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  현재 시즌 반영 비중 {formatPercent(insight.priorBlend.currentWeight, 1)}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  영향 분석 대상 경기 {insight.remainingMatchInsights.length}개
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  설명이 필요한 동률 구간 {insight.tiebreakNotes.length}건
                </div>
              </div>
            </Panel>
          </div>

          <ExpandablePanel
            title="전체 확률표"
            description="모든 팀의 순위별 확률 분포를 표 형태로 자세히 확인할 수 있습니다."
            summaryNote="기본은 접힘"
          >
            <ProbabilityTable
              summaries={insight.probabilitySummaries}
              teamNameById={teamMap}
              decimalPlaces={season.simulationConfig.decimalPlaces}
            />
          </ExpandablePanel>

          <ExpandablePanel
            title="경기 결과별 영향"
            description="개별 경기 결과가 시드 경쟁과 예상 순위에 얼마나 영향을 주는지 자세히 봅니다."
            summaryNote={selectedMatchImpact ? `${teamMap[selectedMatchImpact.teamAId]} vs ${teamMap[selectedMatchImpact.teamBId]}` : "분석 경기 선택"}
          >
            {selectedMatchImpact ? (
              <div className="space-y-4">
                <label htmlFor="impact-match-select" className="sr-only">
                  영향 분석 경기 선택
                </label>
                <select
                  id="impact-match-select"
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

                <div className="flex flex-wrap gap-2" aria-label="영향 지표 선택">
                  {availableImpactMetricOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedImpactMetric(option.value)}
                      aria-pressed={selectedImpactMetric === option.value}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        selectedImpactMetric === option.value ? "ow-primary-button" : "ow-ghost-button"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
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
                          <p className="mt-1 text-xs text-slate-700">
                            가장 민감한 팀:{" "}
                            {selectedMatchImpact.biggestSwingTeamId
                              ? teamMap[selectedMatchImpact.biggestSwingTeamId]
                              : "-"}{" "}
                            · 기준 지표 {getImpactMetricLabel(selectedImpactMetric)}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
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
                                    delta > 0 ? "text-pine" : delta < 0 ? "text-coral" : "text-slate-700"
                                  }`}
                                >
                                  {formatImpactDelta(delta, selectedImpactMetric)}
                                </span>
                              </div>
                              <p className="mt-auto pt-1 text-xs text-slate-700">
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
              <p className="text-sm text-slate-700">영향을 분석할 남은 경기가 없습니다.</p>
            )}
          </ExpandablePanel>

          <ExpandablePanel
            title="예측 근거와 세부 메모"
            description="전력 산정 근거, 직전 시즌 대비 변화, 동률 메모를 펼쳐서 확인할 수 있습니다."
            summaryNote="상세 설명"
          >
            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <Panel
                title="예측 기준과 팀 전력"
                description="직전 시즌 기록과 현재 시즌 경기력을 함께 반영한 기준 전력입니다."
              >
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    시즌 진행률 {formatPercent(insight.priorBlend.completionRatio, 1)}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    현재 시즌 반영 비중 {formatPercent(insight.priorBlend.currentWeight, 1)}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    직전 시즌 감소 계수 {formatDecimal(season.simulationConfig.priorWeightDecay, 2)}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    상대 전력 반영 비중 {formatPercent(season.simulationConfig.opponentStrengthWeight * 100, 0)}
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
                              <p className="mt-1 text-xs text-slate-700">
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
                            <p className="text-xs text-slate-700">현재 기준 전력</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <div className="space-y-6">
                <Panel title="직전 시즌 대비 기대 순위 변화">
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
                                    : "text-slate-700"
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
                          <p className="mt-2 text-sm text-slate-700">
                            직전 시즌 {trend.previousRank ? `${trend.previousRank}위` : "기록 없음"} · 현재 기대 순위{" "}
                            {formatDecimal(trend.expectedRank, 1)}위
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel title="동률 메모">
                  {insight.tiebreakNotes.length === 0 ? (
                    <p className="text-sm text-slate-700">현재는 별도 설명이 필요한 동률 구간이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {insight.tiebreakNotes.map((note) => (
                        <div
                          key={`${note.higherTeamId}-${note.lowerTeamId}`}
                          className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700"
                        >
                          {note.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </ExpandablePanel>
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

            <Panel title="완료 경기 리플레이">
              {insight.completedMatches.length === 0 ? (
                <p className="text-sm text-slate-700">아직 완료된 경기가 없습니다.</p>
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
                              <p className="mt-1 text-xs text-slate-700">{formatDateTimeLabel(match.scheduledAt)}</p>
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
                              <span className="rounded-full border border-dashed border-slate-300 bg-white/80 px-3 py-1.5 text-xs text-slate-700">
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
            <Panel title="이전 시즌 기준 데이터">
              {insight.previousSeasonStats.length === 0 ? (
                <p className="text-sm text-slate-700">
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
                      <span className="text-slate-700">
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
