"use client";

import { useEffect, useMemo, useState } from "react";
import { SeasonArchiveList } from "@/components/season-archive-list";
import { SeasonDetail } from "@/components/season-detail";
import { applyPredictionOverrides } from "@/lib/domain/predictions";
import { useSeasonInsight } from "@/lib/use-season-insight";
import {
  getSelectedSeason,
  isLeagueDirtyFromBaseline,
  useLeagueStore
} from "@/lib/store/league-store";
import { League, MatchResult } from "@/lib/types";

interface LeagueWorkspaceProps {
  sourceLeague: League;
  sourceKind: "file" | "sample";
  sourceUpdatedAt: string | null;
}

function formatSourceTimestamp(value: string | null): string {
  if (!value) {
    return "기준 시각 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function LeagueWorkspace({
  sourceLeague,
  sourceKind,
  sourceUpdatedAt
}: LeagueWorkspaceProps) {
  const hydrated = useLeagueStore((state) => state.hydrated);
  const league = useLeagueStore((state) => state.league);
  const baselineLeague = useLeagueStore((state) => state.baselineLeague);
  const predictionOverrides = useLeagueStore((state) => state.predictionOverrides);
  const selectedSeasonId = useLeagueStore((state) => state.selectedSeasonId);
  const revision = useLeagueStore((state) => state.revision);
  const selectSeason = useLeagueStore((state) => state.selectSeason);
  const replaceWithBundledSample = useLeagueStore((state) => state.replaceWithBundledSample);
  const syncWithSourceLeague = useLeagueStore((state) => state.syncWithSourceLeague);
  const updateSeasonSettings = useLeagueStore((state) => state.updateSeasonSettings);
  const updateMatchResult = useLeagueStore((state) => state.updateMatchResult);
  const [readySourceFingerprint, setReadySourceFingerprint] = useState<string | null>(null);
  const sourceFingerprint = useMemo(() => JSON.stringify(sourceLeague), [sourceLeague]);
  const selectedSeason = getSelectedSeason(league, selectedSeasonId);
  const insightSeasonId = selectedSeason?.format === "tournament" ? null : selectedSeason?.id ?? null;
  const isShowingLocalWorkspace = useMemo(
    () => isLeagueDirtyFromBaseline(league, baselineLeague),
    [baselineLeague, league]
  );
  const displayLeague = useMemo(
    () => applyPredictionOverrides(league, predictionOverrides),
    [league, predictionOverrides]
  );
  const insightState = useSeasonInsight(league, insightSeasonId, predictionOverrides, revision);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    syncWithSourceLeague(sourceLeague);
    setReadySourceFingerprint(sourceFingerprint);
  }, [hydrated, sourceFingerprint, sourceLeague, syncWithSourceLeague]);

  if (!hydrated || readySourceFingerprint !== sourceFingerprint) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--ow-bg)] text-slate-600"
        role="status"
        aria-live="polite"
      >
        현재 기준 데이터를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="ow-shell">
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col gap-6 px-4 py-6 md:px-6">
        {isShowingLocalWorkspace || sourceKind !== "file" ? (
          <section
            className={`ow-cut-panel rounded-[28px] px-5 py-5 text-[var(--ow-text)] ${
              isShowingLocalWorkspace
                ? "border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,0.92)_100%)]"
                : "border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,0.92)_100%)]"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">데이터 상태</p>
                <h2 className="text-lg font-semibold text-slate-950">
                  {isShowingLocalWorkspace
                    ? "이 브라우저의 로컬 작업본을 표시 중입니다."
                    : "관리자 원본 파일이 없어 샘플 데이터를 표시 중입니다."}
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  {isShowingLocalWorkspace
                    ? "현재 화면은 서버 배포 상태가 아니라 이 브라우저에 저장된 작업본일 수 있습니다. 최신 기준 상태를 보려면 아래 초기화 버튼으로 되돌려 주세요."
                    : "관리자 원본이 아직 생성되지 않아 샘플 fallback 데이터로 동작하고 있습니다."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">현재 보기</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {isShowingLocalWorkspace ? "로컬 작업본" : "샘플 fallback"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">기준 갱신 시각</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatSourceTimestamp(sourceUpdatedAt)}</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[390px_1fr] xl:gap-8">
          <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-1.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
            <SeasonArchiveList
              league={league}
              selectedSeasonId={selectedSeason?.id ?? null}
              onSelect={selectSeason}
              onResetData={replaceWithBundledSample}
              sourceKind={sourceKind}
              sourceUpdatedAt={sourceUpdatedAt}
              isShowingLocalWorkspace={isShowingLocalWorkspace}
            />
          </aside>

          <main className="space-y-6">
            {selectedSeason ? (
              <SeasonDetail
                league={displayLeague}
                baselineLeague={baselineLeague}
                season={selectedSeason}
                insight={insightState.insight}
                isLoading={insightState.isLoading}
                error={insightState.error}
                onChangeResult={(matchId: string, result: MatchResult | null) =>
                  updateMatchResult(selectedSeason.id, matchId, result)
                }
                onSaveSettings={updateSeasonSettings}
              />
            ) : (
              <div className="ow-cut-panel px-6 py-16 text-center text-slate-600">
                선택된 시즌이 없습니다.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
