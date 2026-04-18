"use client";

import { useEffect, useMemo, useState } from "react";
import { League, Season } from "@/lib/types";

interface SeasonArchiveListProps {
  league: League;
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
  onResetData: () => void;
  sourceKind: "file" | "sample";
  sourceUpdatedAt: string | null;
  isShowingLocalWorkspace: boolean;
}

type SeasonBucket = "korea" | "asia" | "international";

const bucketLabels: Record<SeasonBucket, string> = {
  korea: "코리아",
  asia: "아시아",
  international: "국제 대회"
};

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

function getSeasonBucket(season: Season): SeasonBucket {
  if (season.category === "international") {
    return "international";
  }

  if (season.region === "asia" || season.category === "regional") {
    return "asia";
  }

  return "korea";
}

export function SeasonArchiveList({
  league,
  selectedSeasonId,
  onSelect,
  onResetData,
  sourceKind,
  sourceUpdatedAt,
  isShowingLocalWorkspace
}: SeasonArchiveListProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(() =>
    getDefaultYear(league, selectedSeasonId)
  );
  const [selectedBucket, setSelectedBucket] = useState<SeasonBucket>("korea");

  const years = useMemo(
    () => Array.from(new Set(league.seasons.map((season) => season.year))).sort((left, right) => left - right),
    [league.seasons]
  );

  const seasonsByYear = useMemo(
    () =>
      years.map((year) => ({
        year,
        buckets: {
          korea: league.seasons
            .filter((season) => season.year === year && getSeasonBucket(season) === "korea")
            .sort((left, right) => left.order - right.order),
          asia: league.seasons
            .filter((season) => season.year === year && getSeasonBucket(season) === "asia")
            .sort((left, right) => left.order - right.order),
          international: league.seasons
            .filter((season) => season.year === year && getSeasonBucket(season) === "international")
            .sort((left, right) => left.order - right.order)
        }
      })),
    [league.seasons, years]
  );

  const selectedYearGroup =
    seasonsByYear.find((group) => group.year === selectedYear) ?? seasonsByYear[0] ?? null;
  const selectedBucketSeasons = selectedYearGroup?.buckets[selectedBucket] ?? [];
  const selectedSeason = league.seasons.find((season) => season.id === selectedSeasonId) ?? null;
  const ongoingSeasonCount = useMemo(
    () => league.seasons.filter((season) => season.status === "ongoing").length,
    [league.seasons]
  );

  useEffect(() => {
    const nextYear = getDefaultYear(league, selectedSeasonId);
    setSelectedYear((current) => (current && years.includes(current) ? current : nextYear));
  }, [league, selectedSeasonId, years]);

  useEffect(() => {
    const selectedSeason = league.seasons.find((season) => season.id === selectedSeasonId);

    if (!selectedSeason) {
      return;
    }

    setSelectedBucket(getSeasonBucket(selectedSeason));
  }, [league.seasons, selectedSeasonId]);

  return (
    <div className="space-y-4">
      <section className="ow-cut-panel ow-hero-panel ow-appear ow-stagger-1 px-5 py-6 text-[var(--ow-text)]">
        <p className="ow-kicker">시즌 아카이브</p>
        <h2 className="ow-display-title mt-3 text-[2.4rem]">{league.name}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ow-muted)]">
          연도와 대회 범주를 고르면 시즌별 순위표, 남은 경기 변수, 최종 순위 예측을 바로 비교할 수 있습니다.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ow-muted)]">전체 시즌</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{league.seasons.length}개</p>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ow-muted)]">진행 중</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{ongoingSeasonCount}개</p>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ow-muted)]">현재 선택</p>
            <p className="mt-2 text-base font-semibold text-slate-950">
              {selectedSeason?.name ?? "선택된 시즌 없음"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(90deg,rgba(255,255,255,0.86)_0%,rgba(246,248,252,0.88)_100%)] px-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {isShowingLocalWorkspace ? "서버 기준으로 되돌릴 수 있습니다." : "현재는 기준 데이터와 동기화되어 있습니다."}
            </p>
            <p className="text-sm leading-6 text-[var(--ow-muted)]">
              {isShowingLocalWorkspace
                ? "초기화하면 이 브라우저에 저장된 결과/예측 입력을 지우고 최신 기준 데이터 상태로 복구합니다."
                : sourceKind === "file"
                  ? "운영 원본이 바뀌었을 때만 초기화 버튼을 사용할 필요가 있습니다."
                  : "관리자 원본 파일이 아직 없어 샘플 fallback 기준으로 동작합니다."}
            </p>
            <p className="text-xs text-slate-500">
              기준 시각:{" "}
              {sourceUpdatedAt
                ? new Intl.DateTimeFormat("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  }).format(new Date(sourceUpdatedAt))
                : "기준 시각 없음"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 브라우저의 입력값을 지우고 현재 기준 데이터 상태로 되돌릴까요?"
                )
              ) {
                onResetData();
              }
            }}
            className="ow-danger-button rounded-full px-4 py-2 text-sm font-semibold transition"
          >
            현재 기준으로 초기화
          </button>
        </div>
      </section>

      <section className="ow-cut-panel ow-appear ow-stagger-2 p-5 text-[var(--ow-text)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--ow-text)]">시즌 선택</h3>
          <p className="mt-2 text-sm text-[var(--ow-muted)]">
            연도와 범주를 고르면 해당 시즌만 묶어서 볼 수 있습니다.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="연도 선택">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              aria-pressed={selectedYear === year}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedYear === year ? "ow-primary-button" : "ow-ghost-button"
              }`}
            >
              {year}년
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="대회 범주 선택">
          {(Object.keys(bucketLabels) as SeasonBucket[]).map((bucket) => {
            const count = selectedYearGroup?.buckets[bucket].length ?? 0;

            return (
              <button
                key={bucket}
                type="button"
                onClick={() => setSelectedBucket(bucket)}
                aria-pressed={selectedBucket === bucket}
                className={`inline-flex min-w-[88px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedBucket === bucket ? "ow-primary-button" : "ow-ghost-button"
                }`}
              >
                {bucketLabels[bucket]}
                <span className="ml-2 text-xs opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        {selectedYearGroup ? (
          <div className="mt-4 space-y-3">
            {selectedBucketSeasons.length > 0 ? (
              selectedBucketSeasons.map((season) => {
                const seasonMatches = league.matches.filter((match) => match.seasonId === season.id);
                const completedMatchCount = seasonMatches.filter((match) => match.played && match.result).length;
                const selected = selectedSeasonId === season.id;
                const statusMeta = getStatusMeta(season.status);
                const stageLabel = season.name.replace(`${season.year} `, "");
                const qualificationLabel =
                  season.qualificationTargetSeasonIds && season.qualificationTargetSeasonIds.length > 0
                    ? `진출 ${season.qualificationTargetSeasonIds.length}개`
                    : "진출 정보 없음";

                return (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => onSelect(season.id)}
                    aria-pressed={selected}
                    aria-label={`${season.name} 시즌 선택`}
                    className={`w-full rounded-[28px] border px-5 py-5 text-left transition ${
                      selected
                        ? "border-[#f28b2f]/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,238,0.98)_100%)] shadow-panel"
                        : "border-slate-200 bg-white/88 hover:border-[#f28b2f]/35 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--ow-muted)]">{season.year}</p>
                        <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-900">
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
                      {season.format === "tournament" ? (
                        <>
                          <span>
                            {season.category === "international"
                              ? "국제 대회"
                              : season.category === "regional"
                                ? "지역 토너먼트"
                                : "하부 리그"}
                          </span>
                          <span>
                            {season.tournamentConfig?.bracketType === "double_elimination"
                              ? "더블 엘리미네이션"
                              : season.tournamentConfig?.bracketType ?? "토너먼트"}
                          </span>
                          <span className="col-span-2">{qualificationLabel}</span>
                        </>
                      ) : (
                        <>
                          <span>
                            시드 결정전 {season.rules.qualifierCount}팀
                            {season.rules.lcqQualifierCount > 0
                              ? ` / LCQ ${season.rules.lcqQualifierCount}팀`
                              : ""}
                          </span>
                          <span>
                            {season.rules.roundRobinType === "double" ? "더블 라운드로빈" : "싱글 라운드로빈"}
                          </span>
                        </>
                      )}
                    </div>
                    {selected ? (
                      <div className="mt-4 text-xs font-medium text-[#d96f17]">현재 보고 있는 시즌</div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/85 px-4 py-5 text-sm text-[var(--ow-muted)]">
                {selectedYear}년 {bucketLabels[selectedBucket]} 데이터는 아직 없습니다.
              </div>
            )}
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
