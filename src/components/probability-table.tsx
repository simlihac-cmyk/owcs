import { TeamProbabilitySummary } from "@/lib/types";
import { formatDecimal, formatPercent, formatSigned } from "@/lib/utils/format";
import { getTeamBrand } from "@/lib/utils/team-brand";

interface ProbabilityTableProps {
  summaries: TeamProbabilitySummary[];
  teamNameById: Record<string, string>;
  decimalPlaces: number;
}

function getCellStyle(probability: number) {
  const opacity = Math.min(0.85, Math.max(0.08, probability / 100));
  return {
    backgroundColor: `rgba(36, 92, 72, ${opacity})`,
    color: probability >= 45 ? "#ffffff" : "#163043"
  };
}

export function ProbabilityTable({ summaries, teamNameById, decimalPlaces }: ProbabilityTableProps) {
  const rankColumns = Array.from({ length: summaries.length }, (_, index) => index + 1);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-panel backdrop-blur">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-950">최종 순위 분포</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">팀별 시드 결정전 확률과 최종 순위 분포 표</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3">팀</th>
              <th scope="col" className="px-4 py-3">시드 결정전</th>
              <th scope="col" className="px-4 py-3">예상 최종 순위</th>
              <th scope="col" className="px-4 py-3">예상 승수</th>
              <th scope="col" className="px-4 py-3">예상 세트 득실</th>
              {rankColumns.map((rank) => (
                <th key={rank} scope="col" className="px-3 py-3 text-center">
                  #{rank}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.teamId} className="border-t border-slate-100 text-slate-700">
                <th scope="row" className="px-4 py-3 font-semibold text-ink">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: getTeamBrand(summary.teamId).primary }}
                    />
                    <span>{teamNameById[summary.teamId] ?? summary.teamId}</span>
                  </div>
                </th>
                <td className="px-4 py-3 font-semibold text-pine">
                  {formatPercent(summary.qualifierProbability, decimalPlaces)}
                </td>
                <td className="px-4 py-3">{formatDecimal(summary.averageFinalRank, decimalPlaces)}</td>
                <td className="px-4 py-3">{formatDecimal(summary.expectedWins, decimalPlaces)}</td>
                <td className="px-4 py-3">{formatSigned(summary.expectedSetDiff, decimalPlaces)}</td>
                {rankColumns.map((rank) => {
                  const probability = summary.finishProbabilityByRank[rank] ?? 0;

                  return (
                    <td key={rank} className="px-2 py-2">
                      <div
                        className="rounded-xl px-2 py-2 text-center text-xs font-semibold"
                        style={getCellStyle(probability)}
                      >
                        {formatPercent(probability, decimalPlaces)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
