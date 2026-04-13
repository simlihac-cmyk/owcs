"use client";

import { useMemo } from "react";
import { SeasonArchiveList } from "@/components/season-archive-list";
import { SeasonDetail } from "@/components/season-detail";
import { applyPredictionOverrides } from "@/lib/domain/predictions";
import { useSeasonInsight } from "@/lib/use-season-insight";
import { getSelectedSeason, useLeagueStore } from "@/lib/store/league-store";
import { MatchResult } from "@/lib/types";

export function LeagueWorkspace() {
  const hydrated = useLeagueStore((state) => state.hydrated);
  const league = useLeagueStore((state) => state.league);
  const baselineLeague = useLeagueStore((state) => state.baselineLeague);
  const predictionOverrides = useLeagueStore((state) => state.predictionOverrides);
  const selectedSeasonId = useLeagueStore((state) => state.selectedSeasonId);
  const revision = useLeagueStore((state) => state.revision);
  const selectSeason = useLeagueStore((state) => state.selectSeason);
  const replaceWithBundledSample = useLeagueStore((state) => state.replaceWithBundledSample);
  const updateSeasonSettings = useLeagueStore((state) => state.updateSeasonSettings);
  const updateMatchResult = useLeagueStore((state) => state.updateMatchResult);
  const selectedSeason = getSelectedSeason(league, selectedSeasonId);
  const displayLeague = useMemo(
    () => applyPredictionOverrides(league, predictionOverrides),
    [league, predictionOverrides]
  );
  const insightState = useSeasonInsight(
    league,
    selectedSeason?.id ?? null,
    predictionOverrides,
    revision
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ow-bg)] text-slate-600">
        저장된 데이터를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="ow-shell">
      <div className="mx-auto grid min-h-screen max-w-[1720px] gap-6 px-4 py-6 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <SeasonArchiveList
            league={league}
            selectedSeasonId={selectedSeason?.id ?? null}
            onSelect={selectSeason}
            onResetData={replaceWithBundledSample}
          />
        </aside>

        <main>
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
  );
}
