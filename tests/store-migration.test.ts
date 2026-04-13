import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";
import { SAMPLE_DATA_VERSION, migratePersistedLeagueStore } from "@/lib/store/league-store";
import { League } from "@/lib/types";

const UPDATED_MATCH_IDS = ["s2026_25", "s2026_26", "s2026_27"] as const;

function cloneLeague(league: League): League {
  return JSON.parse(JSON.stringify(league)) as League;
}

function rewindRecentResults(league: League): League {
  return {
    ...league,
    matches: league.matches.map((match) =>
      UPDATED_MATCH_IDS.includes(match.id as (typeof UPDATED_MATCH_IDS)[number])
        ? {
            ...match,
            played: false,
            result: null
          }
        : match
    )
  };
}

function getMatchResultSnapshot(league: League, matchId: string) {
  const match = league.matches.find((candidate) => candidate.id === matchId);

  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }

  return {
    played: match.played,
    result: match.result
  };
}

describe("league store migration", () => {
  it("fills in legacy LCQ counts when older bundled data omitted them", () => {
    const migrated = migratePersistedLeagueStore({
      league: loadSampleLeague(),
      baselineLeague: loadSampleLeague(),
      sampleDataVersion: SAMPLE_DATA_VERSION - 1,
      usesBundledSample: true,
      predictionOverrides: {},
      selectedSeasonId: "season_2026_stage1",
      scenarioSnapshots: [],
      changeLog: []
    });

    const sampleSeason = migrated.league?.seasons.find((season) => season.id === "season_2026_stage1");

    expect(sampleSeason?.rules.qualifierCount).toBe(4);
    expect(sampleSeason?.rules.lcqQualifierCount).toBe(4);
  });

  it("refreshes untouched bundled sample workspaces to the latest bundled results", () => {
    const staleBundledLeague = rewindRecentResults(loadSampleLeague());
    const migrated = migratePersistedLeagueStore({
      league: staleBundledLeague,
      baselineLeague: cloneLeague(staleBundledLeague),
      sampleDataVersion: SAMPLE_DATA_VERSION - 1,
      usesBundledSample: true,
      predictionOverrides: {},
      selectedSeasonId: "season_2026_stage1",
      scenarioSnapshots: [],
      changeLog: []
    });

    expect(getMatchResultSnapshot(migrated.league!, "s2026_25")).toEqual({
      played: true,
      result: { setsA: 3, setsB: 0 }
    });
    expect(getMatchResultSnapshot(migrated.league!, "s2026_26")).toEqual({
      played: true,
      result: { setsA: 0, setsB: 3 }
    });
    expect(getMatchResultSnapshot(migrated.league!, "s2026_27")).toEqual({
      played: true,
      result: { setsA: 3, setsB: 0 }
    });
    expect(getMatchResultSnapshot(migrated.baselineLeague!, "s2026_25")).toEqual({
      played: true,
      result: { setsA: 3, setsB: 0 }
    });
    expect(migrated.sampleDataVersion).toBe(SAMPLE_DATA_VERSION);
    expect(migrated.usesBundledSample).toBe(true);
  });

  it("does not overwrite customized workspaces from before the bundled-sample flag existed", () => {
    const staleBundledLeague = rewindRecentResults(loadSampleLeague());
    const customizedLeague: League = {
      ...cloneLeague(staleBundledLeague),
      teams: staleBundledLeague.teams.map((team) =>
        team.id === "team_pf" ? { ...team, name: "PF Custom" } : team
      )
    };
    const migrated = migratePersistedLeagueStore({
      league: customizedLeague,
      baselineLeague: cloneLeague(staleBundledLeague),
      sampleDataVersion: SAMPLE_DATA_VERSION - 1,
      predictionOverrides: {},
      selectedSeasonId: "season_2026_stage1",
      scenarioSnapshots: [],
      changeLog: []
    });

    expect(migrated.league?.teams.find((team) => team.id === "team_pf")?.name).toBe("PF Custom");
    expect(getMatchResultSnapshot(migrated.league!, "s2026_25")).toEqual({
      played: false,
      result: null
    });
    expect(getMatchResultSnapshot(migrated.baselineLeague!, "s2026_25")).toEqual({
      played: false,
      result: null
    });
    expect(migrated.sampleDataVersion).toBe(SAMPLE_DATA_VERSION);
    expect(migrated.usesBundledSample).toBe(false);
  });
});
