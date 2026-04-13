import { buildPreviousSeasonStatsFromArchive, deriveInitialRatings } from "@/lib/domain/prior";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";

describe("previous season prior", () => {
  it("builds prior stats from the previous archived season and gives new teams a lower default", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2026_stage1");

    if (!season) {
      throw new Error("Sample season missing");
    }

    const previousStats = buildPreviousSeasonStatsFromArchive(league, season);
    const ratings = deriveInitialRatings(league, season, previousStats);

    expect(previousStats.find((stat) => stat.teamId === "team_cr")?.finalRank).toBe(1);
    expect(previousStats.find((stat) => stat.teamId === "team_rong")?.finalRank).toBe(6);
    expect(ratings.team_cr).toBeGreaterThan(ratings.team_cb);
    expect(ratings.team_ne).toBeLessThan(1500);
    expect(ratings.team_zan).toBeLessThan(1500);
    expect(ratings.team_pf).toBeLessThan(1500);
  });
});
