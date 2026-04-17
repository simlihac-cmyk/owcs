import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";

describe("2026 play-in data", () => {
  it("includes the Korea play-in as a separate tournament season", () => {
    const league = loadSampleLeague();
    const playIn = league.seasons.find((season) => season.id === "season_2026_stage1_play_in");
    const stage1 = league.seasons.find((season) => season.id === "season_2026_stage1");

    expect(playIn).toBeTruthy();
    expect(playIn?.name).toBe("2026 스테이지1 플레이인");
    expect(playIn?.format).toBe("tournament");
    expect(playIn?.parentSeasonId).toBe("season_2026_stage1");
    expect(playIn?.teamIds).toHaveLength(8);
    expect(playIn?.tournamentConfig?.bracketType).toBe("hybrid");

    expect(stage1?.rules.lcqQualifierCount).toBe(4);
    expect(stage1?.qualificationTargetSeasonIds).toContain("season_2026_stage1_play_in");
  });

  it("stores seeding, lcq, and playoffs phases with prebuilt placeholder brackets", () => {
    const league = loadSampleLeague();
    const phases = (league.seasonPhases ?? [])
      .filter((phase) => phase.seasonId === "season_2026_stage1_play_in")
      .sort((left, right) => left.order - right.order);
    const seedingMatches = league.matches.filter((match) => match.phaseId === "phase_2026_stage1_play_in_seeding");
    const lcqMatches = league.matches.filter((match) => match.phaseId === "phase_2026_stage1_play_in_lcq");
    const playoffMatches = league.matches.filter((match) => match.phaseId === "phase_2026_stage1_play_in_playoffs");
    const entries = (league.seasonEntries ?? []).filter(
      (entry) => entry.seasonId === "season_2026_stage1_play_in"
    );

    expect(phases.map((phase) => phase.name)).toEqual(["시드 결정전", "LCQ", "플레이오프"]);
    expect(phases[0]?.bracketType).toBe("round_robin");
    expect(phases[1]?.bracketType).toBe("double_elimination");
    expect(phases[2]?.bracketType).toBe("single_elimination");
    expect(seedingMatches).toHaveLength(6);
    expect(lcqMatches).toHaveLength(3);
    expect(playoffMatches).toHaveLength(5);
    expect(entries).toHaveLength(8);
    expect(entries.map((entry) => entry.displaySeed)).toEqual([
      "RS #1",
      "RS #2",
      "RS #3",
      "RS #4",
      "RS #5",
      "RS #6",
      "RS #7",
      "RS #8"
    ]);
    expect(playoffMatches[0]?.teamAId).toBe("team_slot_2026_stage1_sd_3");
    expect(playoffMatches[0]?.teamBId).toBe("team_slot_2026_stage1_lcq_2");
    expect(playoffMatches[2]?.teamBId).toBe("team_slot_2026_stage1_playoff_qf_1_winner");
    expect(playoffMatches[4]?.teamAId).toBe("team_slot_2026_stage1_playoff_sf_1_winner");
    expect(playoffMatches[4]?.firstTo).toBe(4);
  });
});
