import { StandingRow } from "@/lib/types";
import { formatRating, formatSigned } from "@/lib/utils/format";
import { getTeamBrand } from "@/lib/utils/team-brand";

interface RankingTableProps {
  standings: StandingRow[];
  qualifierCount?: number;
  ratingsByTeamId?: Record<string, number>;
}

export function RankingTable({ standings, qualifierCount = 4, ratingsByTeamId }: RankingTableProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-panel backdrop-blur">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-950">현재 순위표</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">현재 승패, 세트 득실, 기준 전력을 포함한 팀 순위표</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.2em] text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3">순위</th>
              <th scope="col" className="px-4 py-3">팀</th>
              <th scope="col" className="px-4 py-3">승패</th>
              <th scope="col" className="px-4 py-3">세트</th>
              <th scope="col" className="px-4 py-3">세트 득실</th>
              <th scope="col" className="px-4 py-3">전력</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => (
              <tr key={standing.teamId} className="border-t border-slate-100 text-slate-700">
                <td className="px-4 py-3 font-semibold text-ink">{standing.rank}</td>
                <td className="px-4 py-3 font-semibold">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: getTeamBrand(standing.teamId).primary }}
                    />
                    <span>{standing.teamName}</span>
                    {index < qualifierCount ? (
                      <span className="rounded-full bg-leaf/10 px-2 py-0.5 text-[11px] font-semibold text-pine">
                        시드 결정전권
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {standing.wins}-{standing.losses}
                </td>
                <td className="px-4 py-3">
                  {standing.setsWon}-{standing.setsLost}
                </td>
                <td className="px-4 py-3">{formatSigned(standing.setDiff)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {ratingsByTeamId ? formatRating(ratingsByTeamId[standing.teamId] ?? 1500) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
