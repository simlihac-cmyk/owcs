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

  it("includes the 2026 Asia stage 1 and international event shells", () => {
    const league = loadSampleLeague();
    const asiaStage1 = league.seasons.find((season) => season.id === "season_2026_asia_stage1");
    const championsClash = league.seasons.find((season) => season.id === "season_2026_champions_clash");
    const midseason = league.seasons.find((season) => season.id === "season_2026_midseason_championship");
    const worldFinals = league.seasons.find((season) => season.id === "season_2026_world_finals");

    expect(asiaStage1?.name).toBe("2026 아시아 스테이지 1");
    expect(asiaStage1?.category).toBe("regional");
    expect(asiaStage1?.region).toBe("asia");
    expect(asiaStage1?.qualificationTargetSeasonIds).toEqual(["season_2026_champions_clash"]);
    expect(asiaStage1?.teamIds).toHaveLength(8);

    expect(championsClash?.name).toBe("2026 챔피언스 클래시");
    expect(championsClash?.category).toBe("international");
    expect(championsClash?.teamIds).toHaveLength(8);

    expect(midseason?.name).toBe("2026 미드시즌 챔피언십");
    expect(worldFinals?.name).toBe("2026 월드 파이널");
  });

  it("connects Korea play-in results to Asia and Asia results to Champions Clash placeholder slots", () => {
    const league = loadSampleLeague();
    const asiaEntries = (league.seasonEntries ?? [])
      .filter((entry) => entry.seasonId === "season_2026_asia_stage1")
      .sort((left, right) => left.seed - right.seed);
    const championsClashEntries = (league.seasonEntries ?? [])
      .filter((entry) => entry.seasonId === "season_2026_champions_clash")
      .sort((left, right) => left.seed - right.seed);
    const qualificationLinks = league.qualificationLinks ?? [];

    expect(asiaEntries.map((entry) => entry.displaySeed)).toEqual([
      "KOR #1",
      "KOR #2",
      "KOR #3",
      "KOR #4",
      "JPN #1",
      "JPN #2",
      "JPN #3",
      "PAC #1"
    ]);
    expect(asiaEntries.slice(0, 4).map((entry) => entry.phaseId)).toEqual([
      "phase_2026_stage1_play_in_playoffs",
      "phase_2026_stage1_play_in_playoffs",
      "phase_2026_stage1_play_in_playoffs",
      "phase_2026_stage1_play_in_playoffs"
    ]);
    expect(championsClashEntries.slice(0, 2).map((entry) => entry.phaseId)).toEqual([
      "phase_2026_asia_stage1_championship",
      "phase_2026_asia_stage1_championship"
    ]);
    expect(championsClashEntries.map((entry) => entry.displaySeed)).toEqual([
      "ASIA #1",
      "ASIA #2",
      "CN #1",
      "CN #2",
      "EMEA #1",
      "EMEA #2",
      "NA #1",
      "NA #2"
    ]);
    expect(qualificationLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "qual_2026_stage1_play_in_top4_asia_stage1",
          targetSeasonId: "season_2026_asia_stage1",
          placementStart: 1,
          placementEnd: 4
        }),
        expect.objectContaining({
          id: "qual_2026_asia_stage1_top2_champions_clash",
          targetSeasonId: "season_2026_champions_clash",
          placementStart: 1,
          placementEnd: 2
        })
      ])
    );
  });
});
