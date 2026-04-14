"use client";

import { useEffect, useMemo, useState } from "react";
import { League, Season } from "@/lib/types";

interface SeasonArchiveListProps {
  league: League;
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
  onResetData: () => void;
}

function getStatusMeta(status: Season["status"]) {
  if (status === "completed") {
    return {
      label: "종료",
      className: "border-slate-200 bg-slate-100 text-slate-700"
    };
  }

  if (status === "ongoing") {
    return {
      label: "진행 중",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }

  return {
    label: "준비 중",
    className: "border-amber-200 bg-amber-50 text-amber-700"
  };
}

function getDefaultYear(league: League, selectedSeasonId: string | null): number | null {
  const selectedSeason = league.seasons.find((season) => season.id === selectedSeasonId);

  if (selectedSeason) {
    return selectedSeason.year;
  }

  return [...league.seasons].sort((left, right) => left.year - right.year)[0]?.year ?? null;
}

export function SeasonArchiveList({
  league,
  selectedSeasonId,
  onSelect,
  onResetData
}: SeasonArchiveListProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(() =>
    getDefaultYear(league, selectedSeasonId)
  );

  const years = useMemo(
    () => Array.from(new Set(league.seasons.map((season) => season.year))).sort((left, right) => left - right),
    [league.seasons]
  );

  const seasonsByYear = useMemo(
    () =>
      years.map((year) => ({
        year,
        seasons: league.seasons
          .filter((season) => season.year === year)
          .sort((left, right) => left.order - right.order)
      })),
    [league.seasons, years]
  );

  const selectedYearGroup =
    seasonsByYear.find((group) => group.year === selectedYear) ?? seasonsByYear[0] ?? null;

  useEffect(() => {
    const nextYear = getDefaultYear(league, selectedSeasonId);
    setSelectedYear((current) => (current && years.includes(current) ? current : nextYear));
  }, [league, selectedSeasonId, years]);

  return (
    <div className="space-y-4">
      <section className="ow-cut-panel px-5 py-6 text-[var(--ow-text)]">
        <p className="ow-title text-xs uppercase">시즌 아카이브</p>
        <h2 className="mt-3 text-[2.15rem] font-semibold tracking-[-0.03em]">{league.name}</h2>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("지금까지 입력한 예측을 지우고 현재 기준 데이터 상태로 복구할까요?")) {
                onResetData();
              }
            }}
            className="ow-primary-button rounded-full px-5 py-2.5 text-sm font-semibold transition"
          >
            초기화
          </button>
        </div>
      </section>

      <section className="ow-cut-panel p-5 text-[var(--ow-text)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--ow-text)]">시즌 선택</h3>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedYear === year ? "ow-primary-button" : "ow-ghost-button"
              }`}
            >
              {year}년
            </button>
          ))}
        </div>

        {selectedYearGroup ? (
          <div className="mt-4 space-y-3">
            {selectedYearGroup.seasons.map((season) => {
              const seasonMatches = league.matches.filter((match) => match.seasonId === season.id);
              const completedMatchCount = seasonMatches.filter((match) => match.played && match.result).length;
              const selected = selectedSeasonId === season.id;
              const statusMeta = getStatusMeta(season.status);
              const stageLabel = season.name.replace(`${season.year} `, "");

              return (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => onSelect(season.id)}
                  className={`w-full rounded-[28px] border px-5 py-5 text-left transition ${
                    selected
                      ? "border-[#f28b2f]/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,238,0.98)_100%)] shadow-panel"
                      : "border-slate-200 bg-white/88 hover:border-[#f28b2f]/35 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--ow-muted)]">{season.year}</p>
                      <h3 className="mt-2 text-lg font-semibold leading-snug text-[var(--ow-text)]">
                        {stageLabel}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--ow-muted)]">
                    <span>참가 팀 {season.teamIds.length}개</span>
                    <span>
                      {completedMatchCount}/{seasonMatches.length}경기
                    </span>
                    <span>
                      시드 결정전 {season.rules.qualifierCount}팀
                      {season.rules.lcqQualifierCount > 0
                        ? ` / LCQ ${season.rules.lcqQualifierCount}팀`
                        : ""}
                    </span>
                    <span>{season.rules.roundRobinType === "double" ? "더블 라운드로빈" : "싱글 라운드로빈"}</span>
                  </div>
                  {selected ? (
                    <div className="mt-4 text-xs font-medium text-[#d96f17]">선택됨</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 text-sm text-[var(--ow-muted)]">
            표시할 시즌이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
