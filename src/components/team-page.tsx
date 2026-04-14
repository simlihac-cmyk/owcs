import { League, Season, SeasonInsight } from "@/lib/types";
import {
  formatDateTimeLabel,
  formatDecimal,
  formatPercent,
  formatRating,
  formatSigned
} from "@/lib/utils/format";
import { getTeamBrand } from "@/lib/utils/team-brand";
import { Panel, StatCard } from "@/components/season-shared";

export function TeamPage(props: {
  season: Season;
  league: League;
  insight: SeasonInsight;
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
  teamMap: Record<string, string>;
  priorTeamMap: Record<string, string>;
}) {
  const summary = props.insight.probabilitySummaries.find((item) => item.teamId === props.selectedTeamId);
  const record = props.insight.currentStandings.find((item) => item.teamId === props.selectedTeamId);
  const rating = props.insight.ratingBreakdowns.find((item) => item.teamId === props.selectedTeamId);
  const previousStat = props.insight.previousSeasonStats.find((item) => item.teamId === props.selectedTeamId);
  const orderedTeamSummaries = props.insight.currentStandings
    .map((standing) =>
      props.insight.probabilitySummaries.find((item) => item.teamId === standing.teamId)
    )
    .filter((item): item is SeasonInsight["probabilitySummaries"][number] => Boolean(item));
  const matches = props.league.matches
    .filter(
      (match) =>
        match.seasonId === props.season.id &&
        (match.teamAId === props.selectedTeamId || match.teamBId === props.selectedTeamId)
    )
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const brand = getTeamBrand(props.selectedTeamId);

  if (!summary || !record || !rating) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Panel title="팀 선택">
        <div className="space-y-3">
          {orderedTeamSummaries.map((item) => {
            const itemBrand = getTeamBrand(item.teamId);
            const active = item.teamId === props.selectedTeamId;

            return (
              <button
                key={item.teamId}
                type="button"
                onClick={() => props.onSelectTeam(item.teamId)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  active ? "border-transparent shadow-panel" : "border-slate-200 hover:bg-slate-50"
                }`}
                style={active ? { backgroundColor: itemBrand.soft } : undefined}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: itemBrand.primary }} />
                    <span className="font-semibold text-ink">{props.teamMap[item.teamId]}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: itemBrand.primary }}>
                    {formatDecimal(item.averageFinalRank, props.season.simulationConfig.decimalPlaces)}위
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-6">
        <section
          className="rounded-[32px] border border-white/60 px-6 py-6 shadow-panel"
          style={{ background: `linear-gradient(135deg, ${brand.soft} 0%, #ffffff 80%)` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.primary }} />
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-ink">{props.teamMap[props.selectedTeamId]}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="현재 전력" value={formatRating(rating.blendedRating)} />
              <StatCard label="현재 순위" value={`${record.rank}위`} />
              <StatCard label="예상 승수" value={formatDecimal(summary.expectedWins, 1)} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
          <Panel title="전력 분석">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                초기 rating {formatRating(rating.initialRating)}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                현재 폼 rating {formatRating(rating.currentFormRating)}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                prior 비중 {formatPercent(rating.priorWeight * 100, 0)}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                현재 시즌 비중 {formatPercent(rating.currentWeight * 100, 0)}
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              {previousStat
                ? `직전 시즌 ${previousStat.finalRank}위 · ${previousStat.wins}-${previousStat.losses} · SD ${formatSigned(previousStat.setDiff)}`
                : "직전 시즌 기록 없음"}
            </div>
          </Panel>

          <Panel title="순위 분포">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: props.insight.probabilitySummaries.length }, (_, index) => index + 1).map((rank) => {
                const probability = summary.finishProbabilityByRank[rank] ?? 0;
                return (
                  <div
                    key={rank}
                    className="rounded-2xl px-4 py-4 text-center"
                    style={{
                      backgroundColor: `rgba(36, 92, 72, ${Math.max(0.08, probability / 100)})`,
                      color: probability >= 45 ? "#ffffff" : "#163043"
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.18em]">#{rank}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatPercent(probability, props.season.simulationConfig.decimalPlaces)}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel title="시즌 일정">
          <div className="grid gap-3 md:grid-cols-2">
            {matches.map((match) => {
              const isHome = match.teamAId === props.selectedTeamId;
              const opponentId = isHome ? match.teamBId : match.teamAId;
              const resultText = match.result ? `${match.result.setsA}:${match.result.setsB}` : "미정";
              const displayResult = match.result
                ? isHome
                  ? resultText
                  : `${match.result.setsB}:${match.result.setsA}`
                : "미정";

              return (
                <div key={match.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {props.teamMap[props.selectedTeamId]} vs {props.teamMap[opponentId]}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTimeLabel(match.scheduledAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-ink">{displayResult}</p>
                      <p className="text-xs text-slate-500">{match.played && match.result ? "완료" : "남은 경기"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
