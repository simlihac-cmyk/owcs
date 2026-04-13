import { SeasonInsight, TeamProbabilitySummary } from "@/lib/types";
import { formatDateLabel, formatDecimal, formatPercent } from "@/lib/utils/format";
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
            className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-panel"
          >
            <div className="px-5 py-4" style={{ backgroundColor: brand.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.primary }} />
                  <div>
                    <p className="font-semibold text-ink">{props.teamMap[summary.teamId]}</p>
                    <p className="text-xs text-slate-500">
                      예상 최종 순위 {formatDecimal(summary.averageFinalRank, props.decimalPlaces)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold" style={{ color: brand.primary }}>
                    {formatSummaryMetric(props.metric, headlineValue, props.decimalPlaces)}
                  </p>
                  <p className="text-[11px] text-slate-500">{getSummaryMetricLabel(props.metric)}</p>
                </div>
              </div>
            </div>
            <div className="mt-auto space-y-3 px-5 py-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
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
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
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

  return (
    <div className="grid gap-3 md:hidden">
      {orderedSummaries.slice(0, 5).map((summary) => {
        const brand = getTeamBrand(summary.teamId);
        const value = getSummaryMetricValue(summary, props.metric);

        return (
          <div key={summary.teamId} className="rounded-[24px] bg-white/90 px-4 py-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.primary }} />
                <span className="font-semibold text-ink">{props.teamMap[summary.teamId]}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: brand.primary }}>
                {formatSummaryMetric(props.metric, value, 1)}
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
            <p className="mt-2 text-xs text-slate-500">예상 최종 순위 {formatDecimal(summary.averageFinalRank, 1)}</p>
          </div>
        );
      })}
    </div>
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
        <div key={dateKey} className="rounded-[24px] border border-slate-200/70 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-semibold text-ink">{formatDateLabel(dateKey)}</h4>
            <span className="text-xs font-semibold text-slate-500">{groups[dateKey].length}경기</span>
          </div>
          <div className="space-y-3">
            {groups[dateKey].map((item) => {
              const swingBrand = item.biggestSwingTeamId ? getTeamBrand(item.biggestSwingTeamId) : null;

              return (
                <div key={item.matchId} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {props.teamMap[item.teamAId]} vs {props.teamMap[item.teamBId]}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        가장 민감한 팀: {item.biggestSwingTeamId ? props.teamMap[item.biggestSwingTeamId] : "-"} (
                        {formatDecimal(item.biggestSwingValue, 1)}%p)
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
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
