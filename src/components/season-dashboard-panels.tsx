import {
  getUpcomingMatchFocus,
  UpcomingMatchFocusMode
} from "@/lib/domain/upcoming-match-focus";
import { SeasonInsight, TeamProbabilitySummary } from "@/lib/types";
import { formatDateLabel, formatDateTimeLabel, formatDecimal, formatPercent } from "@/lib/utils/format";
import { getTeamBrand } from "@/lib/utils/team-brand";

export type SummaryMetric = "seed" | "first" | "averageRank";

function getSummariesInStandingOrder(insight: SeasonInsight): TeamProbabilitySummary[] {
  const summaryByTeamId = new Map(
    insight.probabilitySummaries.map((summary) => [summary.teamId, summary])
  );

  return insight.currentStandings
    .map((standing) => summaryByTeamId.get(standing.teamId))
    .filter((summary): summary is TeamProbabilitySummary => Boolean(summary));
}

function getSummaryMetricValue(summary: TeamProbabilitySummary, metric: SummaryMetric) {
  if (metric === "first") {
    return summary.finishProbabilityByRank[1] ?? 0;
  }

  if (metric === "averageRank") {
    return summary.averageFinalRank;
  }

  return summary.qualifierProbability;
}

function getSummaryMetricLabel(metric: SummaryMetric) {
  if (metric === "first") {
    return "1위 확률";
  }

  if (metric === "averageRank") {
    return "예상 최종 순위";
  }

  return "시드 결정전 확률";
}

function formatSummaryMetric(metric: SummaryMetric, value: number, digits: number) {
  return metric === "averageRank" ? `${formatDecimal(value, digits)}위` : formatPercent(value, digits);
}

export function TeamProbabilityCards(props: {
  insight: SeasonInsight;
  teamMap: Record<string, string>;
  decimalPlaces: number;
  metric: SummaryMetric;
}) {
  const orderedSummaries = getSummariesInStandingOrder(props.insight);

  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {orderedSummaries.map((summary) => {
        const brand = getTeamBrand(summary.teamId);
        const headlineValue = getSummaryMetricValue(summary, props.metric);

        return (
          <div
            key={summary.teamId}
            className="ow-appear flex h-full flex-col overflow-hidden rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,253,0.96)_100%)] shadow-panel transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(17,32,49,0.14)]"
          >
            <div
              className="relative px-5 py-4"
              style={{
                background: `linear-gradient(135deg, ${brand.soft} 0%, rgba(255,255,255,0.86) 90%)`
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: brand.primary }} />
                  <div>
                    <p className="font-semibold text-ink">{props.teamMap[summary.teamId]}</p>
                    <p className="text-xs text-slate-700">
                      예상 최종 순위 {formatDecimal(summary.averageFinalRank, props.decimalPlaces)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold" style={{ color: brand.primary }}>
                    {formatSummaryMetric(props.metric, headlineValue, props.decimalPlaces)}
                  </p>
                  <p className="text-[11px] text-slate-700">{getSummaryMetricLabel(props.metric)}</p>
                </div>
              </div>
            </div>
            <div className="mt-auto space-y-3 px-5 py-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                  <span>1위 확률</span>
                  <span>{formatPercent(summary.finishProbabilityByRank[1] ?? 0, props.decimalPlaces)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${summary.finishProbabilityByRank[1] ?? 0}%`,
                      backgroundColor: brand.primary
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  예상 승수 {formatDecimal(summary.expectedWins, props.decimalPlaces)}
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  예상 세트 득실 {summary.expectedSetDiff > 0 ? "+" : ""}
                  {formatDecimal(summary.expectedSetDiff, props.decimalPlaces)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MobileSummaryCards(props: {
  insight: SeasonInsight;
  teamMap: Record<string, string>;
  metric: SummaryMetric;
}) {
  const orderedSummaries = getSummariesInStandingOrder(props.insight);
  const standingRankByTeamId = new Map(
    props.insight.currentStandings.map((standing) => [standing.teamId, standing.rank])
  );

  return (
    <div className="grid gap-3 md:hidden">
      <div className="ow-appear flex items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.8)_0%,rgba(244,248,252,0.84)_100%)] px-4 py-3 shadow-panel">
        <div>
          <p className="text-sm font-semibold text-slate-950">모바일 요약</p>
          <p className="text-xs text-slate-700">전체 {orderedSummaries.length}팀의 핵심 지표를 한 번에 확인합니다.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {getSummaryMetricLabel(props.metric)}
        </span>
      </div>
      {orderedSummaries.map((summary) => {
        const brand = getTeamBrand(summary.teamId);
        const value = getSummaryMetricValue(summary, props.metric);
        const standingRank = standingRankByTeamId.get(summary.teamId);

        return (
          <div
            key={summary.teamId}
            className="ow-appear rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,253,0.96)_100%)] px-4 py-4 shadow-panel"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.primary }} />
                <span className="font-semibold text-ink">{props.teamMap[summary.teamId]}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: brand.primary }}>
                {formatSummaryMetric(props.metric, value, 1)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                현재 {standingRank ?? "-"}위
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                1위 확률 {formatPercent(summary.finishProbabilityByRank[1] ?? 0, 1)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${props.metric === "averageRank" ? Math.max(8, 100 - value * 10) : value}%`,
                  backgroundColor: brand.primary
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-700">
              예상 최종 순위 {formatDecimal(summary.averageFinalRank, 1)}위 · 예상 승수{" "}
              {formatDecimal(summary.expectedWins, 1)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function getUpcomingPredictionTitle(mode: UpcomingMatchFocusMode) {
  if (mode === "today") {
    return "오늘 경기 승부 예측";
  }

  if (mode === "upcoming") {
    return "가장 가까운 다음 경기 승부 예측";
  }

  return "최근 미반영 경기 승부 예측";
}

function getUpcomingPredictionDescription(
  mode: UpcomingMatchFocusMode,
  matchCount: number
) {
  if (mode === "today") {
    return `관리자가 결과를 늦게 입력해도 오늘 일정 ${matchCount}경기의 예상 결과를 먼저 확인할 수 있습니다.`;
  }

  if (mode === "upcoming") {
    return `오늘 경기가 없어, 이후 가장 가까운 날짜의 ${matchCount}경기를 메인 예측으로 보여줍니다.`;
  }

  return `오늘 이후 일정이 없어 아직 결과가 반영되지 않은 최근 ${matchCount}경기를 우선 표시합니다.`;
}

export function UpcomingPredictionSpotlight(props: {
  insight: SeasonInsight;
  teamMap: Record<string, string>;
  isLoading?: boolean;
}) {
  const spotlight = getUpcomingMatchFocus(props.insight.remainingMatchInsights);

  if (!spotlight) {
    return (
      <section className="ow-cut-panel ow-appear overflow-hidden bg-[linear-gradient(135deg,rgba(255,250,242,0.98)_0%,rgba(255,244,225,0.96)_100%)] px-6 py-6 text-[var(--ow-text)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="ow-kicker text-[#8a5720]">메인 예측</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">다음 경기 승부 예측</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              현재 표시할 예정 경기 예측이 없습니다. 결과가 모두 반영됐거나 시즌이 종료된 상태입니다.
            </p>
          </div>
          <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
            {props.isLoading ? "예측 재계산 중" : "대기 중"}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="ow-cut-panel ow-appear overflow-hidden bg-[linear-gradient(135deg,rgba(255,250,242,0.98)_0%,rgba(255,244,225,0.96)_100%)] px-6 py-6 text-[var(--ow-text)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="ow-kicker text-[#8a5720]">메인 예측</p>
          <h3 className="mt-2 text-[clamp(1.7rem,2.7vw,2.5rem)] font-semibold text-ink">
            {getUpcomingPredictionTitle(spotlight.mode)}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {getUpcomingPredictionDescription(spotlight.mode, spotlight.matches.length)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
            {formatDateLabel(spotlight.dateKey)}
          </span>
          <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
            {spotlight.matches.length}경기
          </span>
          <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
            {props.isLoading ? "예측 재계산 중" : "최신 예측"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {spotlight.matches.map((item) => {
          const teamABrand = getTeamBrand(item.teamAId);
          const teamBBrand = getTeamBrand(item.teamBId);
          const favoriteTeamId =
            item.teamAWinProbability === item.teamBWinProbability
              ? null
              : item.teamAWinProbability > item.teamBWinProbability
                ? item.teamAId
                : item.teamBId;
          const favoriteBrand = favoriteTeamId ? getTeamBrand(favoriteTeamId) : null;
          const resultHighlights = Object.entries(item.resultProbabilities)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 3);

          return (
            <article
              key={item.matchId}
              className="rounded-[30px] border border-white/80 bg-white/88 px-5 py-5 shadow-[0_22px_52px_rgba(17,32,49,0.10)] backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {formatDateTimeLabel(item.scheduledAt)}
                  </p>
                  <h4 className="mt-2 text-xl font-semibold text-ink">
                    {props.teamMap[item.teamAId]} vs {props.teamMap[item.teamBId]}
                  </h4>
                </div>

                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: favoriteBrand?.soft ?? "rgba(148,163,184,0.18)",
                    color: favoriteBrand?.primary ?? "#475569"
                  }}
                >
                  {favoriteTeamId ? `${props.teamMap[favoriteTeamId]} 우세` : "초접전"}
                </span>
              </div>

              <div className="mt-4 rounded-[24px] border border-slate-200/70 bg-slate-50/90 px-4 py-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {props.teamMap[item.teamAId]}
                    </p>
                    <p className="mt-1 text-3xl font-semibold" style={{ color: teamABrand.primary }}>
                      {formatPercent(item.teamAWinProbability, 1)}
                    </p>
                  </div>
                  <div className="text-center text-xs font-semibold tracking-[0.18em] text-slate-500">
                    승률
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {props.teamMap[item.teamBId]}
                    </p>
                    <p className="mt-1 text-3xl font-semibold" style={{ color: teamBBrand.primary }}>
                      {formatPercent(item.teamBWinProbability, 1)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full"
                    style={{
                      width: `${item.teamAWinProbability}%`,
                      backgroundColor: teamABrand.primary
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${item.teamBWinProbability}%`,
                      backgroundColor: teamBBrand.primary
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    가장 유력한 스코어 {item.mostLikelyResult}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    승률 차 {formatDecimal(Math.abs(item.teamAWinProbability - item.teamBWinProbability), 1)}%p
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    중요도 {formatDecimal(item.importanceScore, 1)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {resultHighlights.map(([resultLabel, probability]) => (
                  <div
                    key={`${item.matchId}-${resultLabel}`}
                    className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3 text-sm text-slate-700"
                  >
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">
                      결과
                    </p>
                    <p className="mt-1 text-lg font-semibold text-ink">{resultLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">
                      확률 {formatPercent(probability, 1)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ImportantMatchCalendar(props: {
  insight: SeasonInsight;
  teamMap: Record<string, string>;
}) {
  const groups = props.insight.remainingMatchInsights.reduce<Record<string, SeasonInsight["remainingMatchInsights"]>>(
    (accumulator, item) => {
      const key = item.scheduledAt.slice(0, 10);
      accumulator[key] = [...(accumulator[key] ?? []), item];
      return accumulator;
    },
    {}
  );

  const orderedKeys = Object.keys(groups).sort();

  return (
    <div className="space-y-4">
      {orderedKeys.map((dateKey) => (
        <div
          key={dateKey}
          className="ow-appear rounded-[24px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(249,250,252,0.98)_0%,rgba(241,245,249,0.98)_100%)] p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-semibold text-ink">{formatDateLabel(dateKey)}</h4>
            <span className="text-xs font-semibold text-slate-700">{groups[dateKey].length}경기</span>
          </div>
          <div className="space-y-3">
            {groups[dateKey].map((item) => {
              const swingBrand = item.biggestSwingTeamId ? getTeamBrand(item.biggestSwingTeamId) : null;

              return (
                <div
                  key={item.matchId}
                  className="rounded-2xl border border-white/70 bg-white/95 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(17,32,49,0.1)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {props.teamMap[item.teamAId]} vs {props.teamMap[item.teamBId]}
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        가장 민감한 팀: {item.biggestSwingTeamId ? props.teamMap[item.biggestSwingTeamId] : "-"} (
                        {formatDecimal(item.biggestSwingValue, 1)}%p)
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      중요도 {formatDecimal(item.importanceScore, 1)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, item.importanceScore * 8)}%`,
                        backgroundColor: swingBrand?.primary ?? "#245c48"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
