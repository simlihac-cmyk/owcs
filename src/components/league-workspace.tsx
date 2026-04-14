"use client";

import { useEffect, useMemo, useState } from "react";
import { SeasonArchiveList } from "@/components/season-archive-list";
import { SeasonDetail } from "@/components/season-detail";
import { applyPredictionOverrides } from "@/lib/domain/predictions";
import { useSeasonInsight } from "@/lib/use-season-insight";
import { getSelectedSeason, useLeagueStore } from "@/lib/store/league-store";
import { League, MatchResult } from "@/lib/types";

interface LeagueWorkspaceProps {
  sourceLeague: League;
}

export function LeagueWorkspace({ sourceLeague }: LeagueWorkspaceProps) {
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

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    syncWithSourceLeague(sourceLeague);
    setReadySourceFingerprint(sourceFingerprint);
  }, [hydrated, sourceFingerprint, sourceLeague, syncWithSourceLeague]);

  if (!hydrated || readySourceFingerprint !== sourceFingerprint) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ow-bg)] text-slate-600">
        현재 기준 데이터를 불러오는 중입니다.
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
