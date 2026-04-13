import { aggregateSeasonResults } from "@/lib/domain/standings";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";

describe("season aggregation", () => {
  it("summarizes a completed season from historical matches", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2025_stage3");

    if (!season) {
      throw new Error("Sample season missing");
    }

    const result = aggregateSeasonResults(league, season);

    expect(result.summary.championTeamId).toBe("team_cr");
    expect(result.summary.totalMatchCount).toBe(36);
    expect(result.previousSeasonStats.find((stat) => stat.teamId === "team_t1")?.finalRank).toBe(2);
  });
});
