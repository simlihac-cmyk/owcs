import { aggregateSeasonResults, sortStandings } from "@/lib/domain/standings";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";
import { CurrentSeasonRecord, LeagueRules } from "@/lib/types";

describe("standings", () => {
  it("calculates sample season standings in expected order", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2025_stage3");

    if (!season) {
      throw new Error("Sample season missing");
    }

    const result = aggregateSeasonResults(league, season);

    expect(result.summary.completedMatchCount).toBe(36);
    expect(result.standings[0]?.teamName).toBe("CR");
    expect(result.standings[1]?.teamName).toBe("T1");
    expect(result.standings[2]?.teamName).toBe("FLC");
    expect(result.standings[result.standings.length - 1]?.teamName).toBe("MIR");
  });

  it("uses set diff and sets won tiebreakers in order", () => {
    const rules: LeagueRules = {
      qualifierCount: 4,
      lcqQualifierCount: 0,
      rankingTiebreakers: ["wins", "setDiff", "setsWon"],
      roundRobinType: "single"
    };
    const records: CurrentSeasonRecord[] = [
      {
        seasonId: "s1",
        teamId: "a",
        wins: 3,
        losses: 2,
        setsWon: 11,
        setsLost: 9,
        setDiff: 2,
        matchesPlayed: 5,
        winRate: 0.6
      },
      {
        seasonId: "s1",
        teamId: "b",
        wins: 3,
        losses: 2,
        setsWon: 10,
        setsLost: 9,
        setDiff: 1,
        matchesPlayed: 5,
        winRate: 0.6
      },
      {
        seasonId: "s1",
        teamId: "c",
        wins: 3,
        losses: 2,
        setsWon: 9,
        setsLost: 7,
        setDiff: 2,
        matchesPlayed: 5,
        winRate: 0.6
      }
    ];

    const standings = sortStandings(records, { a: "Alpha", b: "Beta", c: "Gamma" }, rules);

    expect(standings.map((standing) => standing.teamId)).toEqual(["a", "c", "b"]);
  });
});
