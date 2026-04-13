import { computeSeasonInsight } from "@/lib/domain/simulation";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";

const OWCS_BALANCED_CONFIG = {
  priorWeightDecay: 0.36,
  shrinkageMatches: 5,
  opponentStrengthWeight: 0.42,
  setSkewFactor: 1.18
};

const OWCS_AGGRESSIVE_CONFIG = {
  priorWeightDecay: 0.2,
  shrinkageMatches: 3,
  opponentStrengthWeight: 0.72,
  setSkewFactor: 1.48
};

const OWCS_CONSERVATIVE_CONFIG = {
  priorWeightDecay: 0.62,
  shrinkageMatches: 7,
  opponentStrengthWeight: 0.2,
  setSkewFactor: 0.92
};

describe("simulation engine", () => {
  it("returns probability summaries for each team", () => {
    const league = loadSampleLeague();
    const result = computeSeasonInsight(league, "season_2026_stage1");

    expect(result.probabilitySummaries).toHaveLength(9);
    expect(result.remainingMatches.length).toBe(9);
    expect(result.remainingMatchInsights.length).toBe(9);
    expect(result.ratingBreakdowns).toHaveLength(9);
    expect(result.simulationMeta.analysisIterations).toBeGreaterThan(0);

    for (const summary of result.probabilitySummaries) {
      expect(summary.qualifierProbability).toBeGreaterThanOrEqual(0);
      expect(summary.qualifierProbability).toBeLessThanOrEqual(100);
      expect(Object.keys(summary.finishProbabilityByRank).length).toBeGreaterThan(0);
    }

    for (const matchInsight of result.remainingMatchInsights) {
      expect(matchInsight.outcomes).toHaveLength(6);
      expect(matchInsight.importanceScore).toBeGreaterThanOrEqual(0);
    }
  });

  it("reflects prediction overrides in projected standings and probabilities", () => {
    const league = loadSampleLeague();
    const baseline = computeSeasonInsight(league, "season_2026_stage1");
    const overrides = Object.fromEntries(
      baseline.remainingMatches.map((match) => [
        match.id,
        {
          setsA: 3,
          setsB: 0
        }
      ])
    );
    const projected = computeSeasonInsight(league, "season_2026_stage1", overrides);
    const totalMatchesPlayed =
      projected.currentRecords.reduce((sum, record) => sum + record.matchesPlayed, 0) / 2;

    expect(projected.remainingMatches).toHaveLength(0);
    expect(projected.remainingMatchInsights).toHaveLength(0);
    expect(projected.completedMatches).toHaveLength(projected.summary.totalMatchCount);
    expect(totalMatchesPlayed).toBe(projected.summary.totalMatchCount);

    for (const standing of projected.currentStandings) {
      const summary = projected.probabilitySummaries.find((item) => item.teamId === standing.teamId);

      expect(summary).toBeDefined();
      expect(summary?.finishProbabilityByRank[standing.rank]).toBe(100);
      expect(summary?.qualifierProbability).toBe(
        standing.rank <= projected.season.rules.qualifierCount ? 100 : 0
      );
    }
  });

  it("treats CR as a heavy favorite over winless new-team NE with OWCS balanced settings", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2026_stage1");

    if (!season) {
      throw new Error("Sample season missing");
    }

    season.simulationConfig = {
      ...season.simulationConfig,
      ...OWCS_BALANCED_CONFIG
    };

    const result = computeSeasonInsight(league, "season_2026_stage1");
    const targetMatch = result.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_cr" && matchInsight.teamBId === "team_ne"
    );

    expect(targetMatch).toBeDefined();
    expect(targetMatch?.teamAWinProbability ?? 0).toBeGreaterThan(80);
  });

  it("leans toward ZETA over T1 with OWCS balanced settings", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2026_stage1");

    if (!season) {
      throw new Error("Sample season missing");
    }

    season.simulationConfig = {
      ...season.simulationConfig,
      ...OWCS_BALANCED_CONFIG
    };

    const result = computeSeasonInsight(league, "season_2026_stage1");
    const targetMatch = result.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_t1" && matchInsight.teamBId === "team_zeta"
    );

    expect(targetMatch).toBeDefined();
    expect(targetMatch?.teamAWinProbability ?? 100).toBeLessThan(50);
  });

  it("creates a noticeable gap between aggressive and conservative presets", () => {
    const aggressiveLeague = loadSampleLeague();
    const aggressiveSeason = aggressiveLeague.seasons.find(
      (candidate) => candidate.id === "season_2026_stage1"
    );
    const conservativeLeague = loadSampleLeague();
    const conservativeSeason = conservativeLeague.seasons.find(
      (candidate) => candidate.id === "season_2026_stage1"
    );

    if (!aggressiveSeason || !conservativeSeason) {
      throw new Error("Sample season missing");
    }

    aggressiveSeason.simulationConfig = {
      ...aggressiveSeason.simulationConfig,
      ...OWCS_AGGRESSIVE_CONFIG
    };
    conservativeSeason.simulationConfig = {
      ...conservativeSeason.simulationConfig,
      ...OWCS_CONSERVATIVE_CONFIG
    };

    const aggressiveResult = computeSeasonInsight(aggressiveLeague, "season_2026_stage1");
    const conservativeResult = computeSeasonInsight(conservativeLeague, "season_2026_stage1");
    const aggressiveMatch = aggressiveResult.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_t1" && matchInsight.teamBId === "team_zeta"
    );
    const conservativeMatch = conservativeResult.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_t1" && matchInsight.teamBId === "team_zeta"
    );

    expect(aggressiveMatch).toBeDefined();
    expect(conservativeMatch).toBeDefined();
    expect(
      (conservativeMatch?.teamAWinProbability ?? 0) - (aggressiveMatch?.teamAWinProbability ?? 0)
    ).toBeGreaterThan(6);
  });

  it("ranks a balanced contender match above a lopsided upset-prone match in importance", () => {
    const league = loadSampleLeague();
    const season = league.seasons.find((candidate) => candidate.id === "season_2026_stage1");

    if (!season) {
      throw new Error("Sample season missing");
    }

    season.simulationConfig = {
      ...season.simulationConfig,
      ...OWCS_BALANCED_CONFIG
    };

    const result = computeSeasonInsight(league, "season_2026_stage1");
    const contenderMatch = result.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_t1" && matchInsight.teamBId === "team_zeta"
    );
    const lopsidedMatch = result.remainingMatchInsights.find(
      (matchInsight) => matchInsight.teamAId === "team_cr" && matchInsight.teamBId === "team_ne"
    );

    expect(contenderMatch).toBeDefined();
    expect(lopsidedMatch).toBeDefined();
    expect(contenderMatch!.importanceScore).toBeGreaterThan(lopsidedMatch!.importanceScore);
  });
});
