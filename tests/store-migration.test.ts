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

  it("keeps existing workspaces intact while bumping the sample data version", () => {
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
      played: false,
      result: null
    });
    expect(getMatchResultSnapshot(migrated.league!, "s2026_26")).toEqual({
      played: false,
      result: null
    });
    expect(getMatchResultSnapshot(migrated.league!, "s2026_27")).toEqual({
      played: false,
      result: null
    });
    expect(getMatchResultSnapshot(migrated.baselineLeague!, "s2026_25")).toEqual({
      played: false,
      result: null
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

  it("starts from an empty placeholder league before the server baseline arrives", () => {
    const migrated = migratePersistedLeagueStore(undefined);

    expect(migrated.league).toMatchObject({
      id: "owcs_archive",
      seasons: [],
      matches: []
    });
    expect(migrated.baselineLeague).toMatchObject({
      id: "owcs_archive",
      seasons: [],
      matches: []
    });
    expect(migrated.sampleDataVersion).toBe(SAMPLE_DATA_VERSION);
  });
});
