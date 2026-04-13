"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LEAGUE_RULES, DEFAULT_SIMULATION_CONFIG } from "@/lib/constants";
import { recommendPriorSeasonId } from "@/lib/domain/prior";
import {
  createSeasonShell,
  createTeamsFromNames,
  generateRoundRobinMatches,
  regenerateSeasonSchedule
} from "@/lib/domain/schedule";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";
import {
  ChangeLogEntry,
  CreateSeasonInput,
  ExportedLeagueWorkspace,
  League,
  MatchResult,
  PredictionOverrides,
  SavedScenarioSnapshot,
  Season,
  SeasonTeam,
  Team,
  UpdateSeasonSettingsInput
} from "@/lib/types";
import { createId } from "@/lib/utils/ids";
import { getSeasonTeamNameMap } from "@/lib/utils/season-team-display";

interface UndoSnapshot {
  league: League;
  selectedSeasonId: string | null;
  label: string;
  createdAt: string;
}

interface PersistedLeagueStoreState {
  league?: League;
  baselineLeague?: League;
  sampleDataVersion?: number;
  usesBundledSample?: boolean;
  predictionOverrides?: PredictionOverrides;
  selectedSeasonId?: string | null;
  scenarioSnapshots?: SavedScenarioSnapshot[];
  changeLog?: ChangeLogEntry[];
}

interface LeagueStoreState {
  hydrated: boolean;
  league: League;
  baselineLeague: League;
  sampleDataVersion: number;
  usesBundledSample: boolean;
  predictionOverrides: PredictionOverrides;
  selectedSeasonId: string | null;
  scenarioSnapshots: SavedScenarioSnapshot[];
  changeLog: ChangeLogEntry[];
  undoStack: UndoSnapshot[];
  revision: number;
  markHydrated: () => void;
  selectSeason: (seasonId: string) => void;
  replaceWithBundledSample: () => void;
  undoLastChange: () => void;
  saveScenarioSnapshot: (name?: string) => void;
  loadScenarioSnapshot: (snapshotId: string) => void;
  deleteScenarioSnapshot: (snapshotId: string) => void;
  exportWorkspace: () => ExportedLeagueWorkspace;
  importWorkspace: (payload: ExportedLeagueWorkspace) => void;
  createSeason: (input: CreateSeasonInput) => void;
  updateSeasonSettings: (input: UpdateSeasonSettingsInput) => void;
  updateMatchResult: (seasonId: string, matchId: string, result: MatchResult | null) => void;
  addManualMatch: (seasonId: string, teamAId: string, teamBId: string, scheduledAt: string) => void;
  removeMatch: (seasonId: string, matchId: string) => void;
  renameTeam: (teamId: string, nextName: string) => void;
}

function deriveSeasonStatus(matchesCount: number, playedCount: number): Season["status"] {
  if (matchesCount > 0 && playedCount === matchesCount) {
    return "completed";
  }

  if (playedCount > 0) {
    return "ongoing";
  }

  return "draft";
}

function dedupeTeamNames(teamNames: string[]): string[] {
  return Array.from(
    new Set(
      teamNames
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );
}

function resolveTeamPool(existingTeams: Team[], teamNames: string[]): {
  teamIds: string[];
  newTeams: Team[];
} {
  const normalizedMap = new Map(existingTeams.map((team) => [team.name.toLowerCase(), team]));
  const newTeams: Team[] = [];
  const teamIds = dedupeTeamNames(teamNames).map((teamName) => {
    const existing = normalizedMap.get(teamName.toLowerCase());

    if (existing) {
      return existing.id;
    }

    const nextTeam = createTeamsFromNames([teamName])[0];
    newTeams.push(nextTeam);
    normalizedMap.set(teamName.toLowerCase(), nextTeam);
    return nextTeam.id;
  });

  return { teamIds, newTeams };
}

function recommendPriorForNewSeason(league: League, nextOrder: number): string | null {
  const ordered = [...league.seasons]
    .filter((season) => season.order < nextOrder)
    .sort((left, right) => right.order - left.order);

  return ordered[0]?.id ?? null;
}

function updateSeasonTimestamps(season: Season): Season {
  return {
    ...season,
    updatedAt: new Date().toISOString()
  };
}

function syncSeasonStatus(league: League, seasonId: string): League {
  const matches = league.matches.filter((match) => match.seasonId === seasonId);
  const playedCount = matches.filter((match) => match.played && match.result).length;

  return {
    ...league,
    seasons: league.seasons.map((season) =>
      season.id === seasonId
        ? {
            ...updateSeasonTimestamps(season),
            status: deriveSeasonStatus(matches.length, playedCount)
          }
        : season
    )
  };
}

function getDefaultSelectedSeasonId(league: League): string | null {
  const ongoing = [...league.seasons]
    .filter((season) => season.status === "ongoing")
    .sort((left, right) => right.order - left.order)[0];

  if (ongoing) {
    return ongoing.id;
  }

  return [...league.seasons].sort((left, right) => right.order - left.order)[0]?.id ?? null;
}

function cloneLeague(league: League): League {
  return JSON.parse(JSON.stringify(league)) as League;
}

function getLegacyLcqQualifierCount(teamCount: number, qualifierCount: number): number {
  return Math.max(teamCount - qualifierCount - 1, 0);
}

function normalizeLeague(league: League): League {
  return {
    ...league,
    seasons: league.seasons.map((season) => {
      const qualifierCount = season.rules.qualifierCount ?? DEFAULT_LEAGUE_RULES.qualifierCount;

      return {
        ...season,
        rules: {
          ...DEFAULT_LEAGUE_RULES,
          ...season.rules,
          qualifierCount,
          lcqQualifierCount:
            season.rules.lcqQualifierCount ??
            getLegacyLcqQualifierCount(season.teamIds.length, qualifierCount)
        },
        simulationConfig: {
          ...DEFAULT_SIMULATION_CONFIG,
          ...season.simulationConfig
        }
      };
    })
  };
}

function cloneSnapshot(snapshot: SavedScenarioSnapshot): SavedScenarioSnapshot {
  return {
    ...snapshot,
    league: cloneLeague(snapshot.league)
  };
}

function makeChangeLogEntry(label: string, seasonId?: string | null): ChangeLogEntry {
  return {
    id: createId("log"),
    createdAt: new Date().toISOString(),
    label,
    seasonId: seasonId ?? null
  };
}

function appendChangeLog(
  changeLog: ChangeLogEntry[],
  label: string,
  seasonId?: string | null
): ChangeLogEntry[] {
  return [makeChangeLogEntry(label, seasonId), ...changeLog].slice(0, 24);
}

function appendUndoSnapshot(state: LeagueStoreState, label: string): UndoSnapshot[] {
  return [
    {
      league: cloneLeague(state.league),
      selectedSeasonId: state.selectedSeasonId,
      label,
      createdAt: new Date().toISOString()
    },
    ...state.undoStack
  ].slice(0, 20);
}

function getMatchLabel(league: League, seasonId: string, teamAId: string, teamBId: string): string {
  const season = league.seasons.find((candidate) => candidate.id === seasonId);

  if (!season) {
    return `${teamAId} vs ${teamBId}`;
  }

  const teamMap = getSeasonTeamNameMap(league, season);
  return `${teamMap[teamAId] ?? teamAId} vs ${teamMap[teamBId] ?? teamBId}`;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const initialLeague = normalizeLeague(loadSampleLeague());
export const STORE_VERSION = 3;
export const SAMPLE_DATA_VERSION = 2;

function areLeaguesEquivalent(left: League, right: League): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function refreshBundledSampleIfEligible(
  league: League,
  baselineLeague: League,
  sampleDataVersion: number | undefined,
  usesBundledSample: boolean | undefined
): {
  league: League;
  baselineLeague: League;
  sampleDataVersion: number;
  usesBundledSample: boolean;
} {
  if (sampleDataVersion === SAMPLE_DATA_VERSION) {
    return {
      league,
      baselineLeague,
      sampleDataVersion,
      usesBundledSample: usesBundledSample ?? true
    };
  }

  const latestBundledLeague = normalizeLeague(cloneLeague(initialLeague));
  const workspaceMatchesBaseline = areLeaguesEquivalent(league, baselineLeague);
  const assumedUsesBundledSample = usesBundledSample ?? true;

  if (!assumedUsesBundledSample || !workspaceMatchesBaseline) {
    return {
      league,
      baselineLeague,
      sampleDataVersion: SAMPLE_DATA_VERSION,
      usesBundledSample: false
    };
  }

  return {
    league: latestBundledLeague,
    baselineLeague: latestBundledLeague,
    sampleDataVersion: SAMPLE_DATA_VERSION,
    usesBundledSample: true
  };
}

export function migratePersistedLeagueStore(
  persistedState: PersistedLeagueStoreState | undefined
): PersistedLeagueStoreState {
  const normalizedLeague = normalizeLeague(cloneLeague(persistedState?.league ?? initialLeague));
  const normalizedBaselineLeague = normalizeLeague(
    cloneLeague(persistedState?.baselineLeague ?? persistedState?.league ?? initialLeague)
  );
  const refreshed = refreshBundledSampleIfEligible(
    normalizedLeague,
    normalizedBaselineLeague,
    persistedState?.sampleDataVersion,
    persistedState?.usesBundledSample
  );
  const league = refreshed.league;
  const baselineLeague = refreshed.baselineLeague;

  return {
    league,
    baselineLeague,
    sampleDataVersion: refreshed.sampleDataVersion,
    usesBundledSample: refreshed.usesBundledSample,
    predictionOverrides: persistedState?.predictionOverrides ?? {},
    selectedSeasonId:
      persistedState?.selectedSeasonId &&
      league.seasons.some((season) => season.id === persistedState.selectedSeasonId)
        ? persistedState.selectedSeasonId
        : getDefaultSelectedSeasonId(league),
    scenarioSnapshots: (persistedState?.scenarioSnapshots ?? []).map((snapshot) => ({
      ...snapshot,
      league: normalizeLeague(snapshot.league)
    })),
    changeLog: persistedState?.changeLog ?? []
  };
}

export const useLeagueStore = create<LeagueStoreState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      league: initialLeague,
      baselineLeague: cloneLeague(initialLeague),
      sampleDataVersion: SAMPLE_DATA_VERSION,
      usesBundledSample: true,
      predictionOverrides: {},
      selectedSeasonId: getDefaultSelectedSeasonId(initialLeague),
      scenarioSnapshots: [],
      changeLog: [
        {
          id: createId("log"),
          createdAt: new Date().toISOString(),
          label: "기본 예시 데이터를 불러왔습니다.",
          seasonId: getDefaultSelectedSeasonId(initialLeague)
        }
      ],
      undoStack: [],
      revision: 0,
      markHydrated: () => set({ hydrated: true }),
      selectSeason: (seasonId) => set({ selectedSeasonId: seasonId }),
      replaceWithBundledSample: () =>
        set((state) => {
          const league = normalizeLeague(loadSampleLeague());

          return {
            league,
            baselineLeague: cloneLeague(league),
            sampleDataVersion: SAMPLE_DATA_VERSION,
            usesBundledSample: true,
            predictionOverrides: {},
            selectedSeasonId: getDefaultSelectedSeasonId(league),
            scenarioSnapshots: [],
            undoStack: appendUndoSnapshot(state, "최신 예시 데이터 불러오기"),
            changeLog: [
              makeChangeLogEntry("최신 예시 데이터로 작업 공간을 교체했습니다."),
              ...state.changeLog
            ].slice(0, 24),
            revision: state.revision + 1
          };
        }),
      undoLastChange: () =>
        set((state) => {
          const [latest, ...rest] = state.undoStack;

          if (!latest) {
            return state;
          }

          return {
            league: cloneLeague(latest.league),
            selectedSeasonId: latest.selectedSeasonId,
            undoStack: rest,
            changeLog: appendChangeLog(
              state.changeLog,
              `직전 변경을 되돌렸습니다. (${latest.label})`,
              latest.selectedSeasonId
            ),
            revision: state.revision + 1
          };
        }),
      saveScenarioSnapshot: (name) =>
        set((state) => {
          const snapshotName = name?.trim() || `시나리오 ${state.scenarioSnapshots.length + 1}`;
          const snapshot: SavedScenarioSnapshot = {
            id: createId("scenario"),
            name: snapshotName,
            createdAt: new Date().toISOString(),
            league: cloneLeague(state.league),
            selectedSeasonId: state.selectedSeasonId
          };

          return {
            scenarioSnapshots: [snapshot, ...state.scenarioSnapshots].slice(0, 12),
            changeLog: appendChangeLog(state.changeLog, `시나리오 "${snapshotName}"를 저장했습니다.`),
            revision: state.revision + 1
          };
        }),
      loadScenarioSnapshot: (snapshotId) =>
        set((state) => {
          const snapshot = state.scenarioSnapshots.find((candidate) => candidate.id === snapshotId);

          if (!snapshot) {
            return state;
          }

          return {
            league: cloneLeague(snapshot.league),
            selectedSeasonId: snapshot.selectedSeasonId,
            usesBundledSample: false,
            undoStack: appendUndoSnapshot(state, `시나리오 불러오기: ${snapshot.name}`),
            changeLog: appendChangeLog(state.changeLog, `시나리오 "${snapshot.name}"를 불러왔습니다.`),
            revision: state.revision + 1
          };
        }),
      deleteScenarioSnapshot: (snapshotId) =>
        set((state) => {
          const snapshot = state.scenarioSnapshots.find((candidate) => candidate.id === snapshotId);

          if (!snapshot) {
            return state;
          }

          return {
            scenarioSnapshots: state.scenarioSnapshots.filter((candidate) => candidate.id !== snapshotId),
            changeLog: appendChangeLog(state.changeLog, `시나리오 "${snapshot.name}"를 삭제했습니다.`),
            revision: state.revision + 1
          };
        }),
      exportWorkspace: () => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        league: cloneLeague(get().league),
        baselineLeague: cloneLeague(get().baselineLeague),
        predictionOverrides: { ...get().predictionOverrides },
        selectedSeasonId: get().selectedSeasonId,
        scenarioSnapshots: get().scenarioSnapshots.map(cloneSnapshot),
        changeLog: [...get().changeLog]
      }),
      importWorkspace: (payload) =>
        set((state) => {
          const league = normalizeLeague(cloneLeague(payload.league));

          return {
            league,
            baselineLeague: normalizeLeague(cloneLeague(payload.baselineLeague)),
            sampleDataVersion: SAMPLE_DATA_VERSION,
            usesBundledSample: false,
            predictionOverrides: payload.predictionOverrides ?? {},
            selectedSeasonId:
              payload.selectedSeasonId && league.seasons.some((season) => season.id === payload.selectedSeasonId)
                ? payload.selectedSeasonId
                : getDefaultSelectedSeasonId(league),
            scenarioSnapshots: (payload.scenarioSnapshots ?? []).map(cloneSnapshot),
            changeLog: appendChangeLog(state.changeLog, "백업 파일에서 작업 공간을 복원했습니다."),
            undoStack: appendUndoSnapshot(state, "백업 불러오기"),
            revision: state.revision + 1
          };
        }),
      createSeason: (input) =>
        set((state) => {
          const { teamIds, newTeams } = resolveTeamPool(state.league.teams, input.teamNames);
          const shell = createSeasonShell({
            leagueId: state.league.id,
            name: input.name,
            year: input.year,
            order: input.order,
            teamIds,
            priorSeasonId:
              input.priorSeasonId === undefined
                ? recommendPriorForNewSeason(state.league, input.order)
                : input.priorSeasonId
          });
          const season: Season = {
            ...shell.season,
            name: input.name,
            year: input.year,
            order: input.order,
            priorSeasonId:
              input.priorSeasonId === undefined
                ? recommendPriorForNewSeason(state.league, input.order)
                : input.priorSeasonId,
            rules: {
              ...DEFAULT_LEAGUE_RULES,
              ...input.rules
            },
            simulationConfig: {
              ...DEFAULT_SIMULATION_CONFIG,
              ...input.simulationConfig
            }
          };
          const seasonTeams: SeasonTeam[] = teamIds.map((teamId) => ({
            seasonId: season.id,
            teamId,
            manualInitialRating:
              input.manualInitialRatings?.[
                newTeams.find((team) => team.id === teamId)?.name ??
                  state.league.teams.find((team) => team.id === teamId)?.name ??
                  ""
              ] ?? null
          }));
          const matches = generateRoundRobinMatches(
            season.id,
            teamIds,
            season.rules.roundRobinType,
            season.createdAt
          );
          const nextLeague = {
            ...state.league,
            teams: [...state.league.teams, ...newTeams],
            seasons: [...state.league.seasons, season].sort((left, right) => left.order - right.order),
            seasonTeams: [...state.league.seasonTeams.filter((item) => item.seasonId !== season.id), ...seasonTeams],
            matches: [...state.league.matches, ...matches]
          };

          return {
            league: syncSeasonStatus(nextLeague, season.id),
            selectedSeasonId: season.id,
            usesBundledSample: false,
            undoStack: appendUndoSnapshot(state, `시즌 생성: ${input.name}`),
            changeLog: appendChangeLog(state.changeLog, `새 시즌 "${input.name}"을 만들었습니다.`, season.id),
            revision: state.revision + 1
          };
        }),
      updateSeasonSettings: (input) =>
        set((state) => {
          const currentSeason = state.league.seasons.find((season) => season.id === input.seasonId);

          if (!currentSeason) {
            return state;
          }

          const extraTeams = input.teamEdits?.newTeams ?? [];
          const nextTeams =
            extraTeams.length > 0
              ? [
                  ...state.league.teams,
                  ...extraTeams.filter(
                    (candidate) => !state.league.teams.some((team) => team.id === candidate.id)
                  )
                ]
              : state.league.teams;
          const nextTeamIds = input.teamEdits?.teamIds ?? currentSeason.teamIds;
          const nextRules = {
            ...currentSeason.rules,
            ...input.rules
          };
          const seasonMatches = state.league.matches.filter((match) => match.seasonId === currentSeason.id);
          const teamIdsChanged =
            input.teamEdits !== undefined && !areStringArraysEqual(nextTeamIds, currentSeason.teamIds);
          const needsScheduleRebuild =
            teamIdsChanged ||
            (input.rules?.roundRobinType !== undefined &&
              input.rules.roundRobinType !== currentSeason.rules.roundRobinType);
          const rebuiltMatches = needsScheduleRebuild
            ? regenerateSeasonSchedule({
                season: {
                  ...currentSeason,
                  rules: nextRules
                },
                existingMatches: seasonMatches,
                nextTeamIds
              })
            : seasonMatches;

          const updatedLeague: League = {
            ...state.league,
            teams: nextTeams,
            seasons: state.league.seasons.map((season) =>
              season.id === input.seasonId
                ? {
                    ...updateSeasonTimestamps(season),
                    name: input.name ?? season.name,
                    priorSeasonId:
                      input.priorSeasonId === undefined ? season.priorSeasonId : input.priorSeasonId,
                    teamIds: nextTeamIds,
                    rules: nextRules,
                    simulationConfig: {
                      ...season.simulationConfig,
                      ...input.simulationConfig
                    }
                  }
                : season
            ),
            seasonTeams: [
              ...state.league.seasonTeams.filter((team) => team.seasonId !== input.seasonId),
              ...nextTeamIds.map((teamId) => ({
                seasonId: input.seasonId,
                teamId,
                manualInitialRating:
                  input.teamEdits?.manualInitialRatings?.[teamId] ??
                  state.league.seasonTeams.find(
                    (team) => team.seasonId === input.seasonId && team.teamId === teamId
                  )?.manualInitialRating ??
                  null
              }))
            ],
            matches: [
              ...state.league.matches.filter((match) => match.seasonId !== input.seasonId),
              ...rebuiltMatches
            ]
          };

          return {
            league: syncSeasonStatus(updatedLeague, input.seasonId),
            usesBundledSample: false,
            undoStack: appendUndoSnapshot(state, `시즌 설정 저장: ${currentSeason.name}`),
            changeLog: appendChangeLog(
              state.changeLog,
              `"${currentSeason.name}" 시즌 설정을 저장했습니다.`,
              currentSeason.id
            ),
            revision: state.revision + 1
          };
        }),
      updateMatchResult: (seasonId, matchId, result) =>
        set((state) => {
          const targetMatch = state.league.matches.find((match) => match.id === matchId);
          const matchLabel = targetMatch
            ? getMatchLabel(state.league, seasonId, targetMatch.teamAId, targetMatch.teamBId)
            : matchId;
          const nextPredictionOverrides = {
            ...state.predictionOverrides,
            [matchId]: result
          };

          return {
            predictionOverrides: nextPredictionOverrides,
            undoStack: appendUndoSnapshot(state, `경기 결과 변경: ${matchLabel}`),
            changeLog: appendChangeLog(
              state.changeLog,
              result
                ? `${matchLabel} 결과를 ${result.setsA}:${result.setsB}로 저장했습니다.`
                : `${matchLabel} 결과를 삭제했습니다.`,
              seasonId
            ),
            revision: state.revision + 1
          };
        }),
      addManualMatch: (seasonId, teamAId, teamBId, scheduledAt) =>
        set((state) => {
          const nextLeague = {
            ...state.league,
            matches: [
              ...state.league.matches,
              {
                id: createId("match"),
                seasonId,
                teamAId,
                teamBId,
                scheduledAt,
                played: false,
                result: null
              }
            ]
          };

          return {
            league: syncSeasonStatus(nextLeague, seasonId),
            usesBundledSample: false,
            undoStack: appendUndoSnapshot(state, `경기 일정 추가: ${getMatchLabel(state.league, seasonId, teamAId, teamBId)}`),
            changeLog: appendChangeLog(
              state.changeLog,
              `${getMatchLabel(state.league, seasonId, teamAId, teamBId)} 일정을 추가했습니다.`,
              seasonId
            ),
            revision: state.revision + 1
          };
        }),
      removeMatch: (seasonId, matchId) =>
        set((state) => {
          const targetMatch = state.league.matches.find((match) => match.id === matchId);
          const nextLeague = {
            ...state.league,
            matches: state.league.matches.filter((match) => match.id !== matchId)
          };

          return {
            league: syncSeasonStatus(nextLeague, seasonId),
            usesBundledSample: false,
            undoStack: appendUndoSnapshot(
              state,
              `경기 일정 삭제: ${
                targetMatch
                  ? getMatchLabel(state.league, seasonId, targetMatch.teamAId, targetMatch.teamBId)
                  : matchId
              }`
            ),
            changeLog: appendChangeLog(
              state.changeLog,
              `${
                targetMatch
                  ? getMatchLabel(state.league, seasonId, targetMatch.teamAId, targetMatch.teamBId)
                  : matchId
              } 일정을 삭제했습니다.`,
              seasonId
            ),
            revision: state.revision + 1
          };
        }),
      renameTeam: (teamId, nextName) =>
        set((state) => ({
          league: {
            ...state.league,
            teams: state.league.teams.map((team) =>
              team.id === teamId ? { ...team, name: nextName.trim() || team.name } : team
            )
          },
          usesBundledSample: false,
          undoStack: appendUndoSnapshot(state, `팀명 변경: ${teamId}`),
          changeLog: appendChangeLog(state.changeLog, `팀명을 "${nextName.trim()}"(으)로 수정했습니다.`),
          revision: state.revision + 1
        }))
    }),
    {
      name: "league-archive-store",
      version: STORE_VERSION,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return migratePersistedLeagueStore(undefined);
        }

        if (version < STORE_VERSION) {
          return migratePersistedLeagueStore(persistedState as PersistedLeagueStoreState);
        }

        return persistedState as LeagueStoreState;
      },
      partialize: (state) => ({
        league: state.league,
        baselineLeague: state.baselineLeague,
        sampleDataVersion: state.sampleDataVersion,
        usesBundledSample: state.usesBundledSample,
        predictionOverrides: state.predictionOverrides,
        selectedSeasonId: state.selectedSeasonId,
        scenarioSnapshots: state.scenarioSnapshots,
        changeLog: state.changeLog
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        const migrated = migratePersistedLeagueStore(state);
        state.league = migrated.league ?? normalizeLeague(cloneLeague(initialLeague));
        state.baselineLeague = migrated.baselineLeague ?? normalizeLeague(cloneLeague(initialLeague));
        state.sampleDataVersion = migrated.sampleDataVersion ?? SAMPLE_DATA_VERSION;
        state.usesBundledSample = migrated.usesBundledSample ?? false;
        state.predictionOverrides = migrated.predictionOverrides ?? {};
        state.selectedSeasonId = migrated.selectedSeasonId ?? getDefaultSelectedSeasonId(state.league);
        state.scenarioSnapshots = migrated.scenarioSnapshots ?? [];
        state.changeLog = migrated.changeLog ?? [];
        state.markHydrated();
      }
    }
  )
);

export function getSelectedSeason(league: League, selectedSeasonId: string | null): Season | null {
  if (!selectedSeasonId) {
    const defaultSelectedSeasonId = getDefaultSelectedSeasonId(league);
    return league.seasons.find((season) => season.id === defaultSelectedSeasonId) ?? null;
  }

  return (
    league.seasons.find((season) => season.id === selectedSeasonId) ??
    league.seasons.find((season) => season.id === getDefaultSelectedSeasonId(league)) ??
    null
  );
}

export function getRecommendedPriorSeason(league: League, season: Season): string | null {
  return season.priorSeasonId ?? recommendPriorSeasonId(league, season);
}

export function isLeagueDirtyFromBaseline(league: League, baselineLeague: League): boolean {
  return JSON.stringify(league) !== JSON.stringify(baselineLeague);
}
