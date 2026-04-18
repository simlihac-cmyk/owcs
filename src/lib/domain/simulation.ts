import { RESULT_OPTIONS } from "@/lib/constants";
import { applyPredictionOverrides } from "@/lib/domain/predictions";
import {
  buildPreviousSeasonStatsFromArchive,
  buildRatingBlend,
  deriveInitialRatings,
  recommendPriorSeasonId
} from "@/lib/domain/prior";
import { aggregateSeasonResults } from "@/lib/domain/standings";
import {
  League,
  Match,
  MatchOutcomeImpact,
  MatchResult,
  PredictionOverrides,
  RemainingMatchInsight,
  Season,
  SeasonInsight,
  TeamProbabilitySummary,
  TeamTrendSummary,
  TiebreakNote
} from "@/lib/types";
import { clamp, logistic, pickIndexByWeight, round } from "@/lib/utils/math";

const WINNING_SCORE_OPTIONS: MatchResult[] = [
  { setsA: 3, setsB: 2 },
  { setsA: 3, setsB: 1 },
  { setsA: 3, setsB: 0 }
];

function parseResultLabel(label: string): MatchResult {
  const [setsA, setsB] = label.split(":").map(Number);
  return {
    setsA,
    setsB
  };
}

function stringifyResult(result: MatchResult): string {
  return `${result.setsA}:${result.setsB}`;
}

function normalizeProfile(profile: number[]): number[] {
  const total = profile.reduce((sum, value) => sum + value, 0);
  return profile.map((value) => value / total);
}

function getWinningScoreProfile(params: {
  strength: number;
  skewFactor: number;
  upsetWin: boolean;
}): number[] {
  const { strength, skewFactor, upsetWin } = params;
  const emphasis = strength * skewFactor;

  if (upsetWin) {
    return normalizeProfile([0.52 - emphasis * 0.12, 0.32 + emphasis * 0.06, 0.16 + emphasis * 0.06]);
  }

  return normalizeProfile([0.44 - emphasis * 0.22, 0.33 + emphasis * 0.04, 0.23 + emphasis * 0.18]);
}

export function getMatchResultProbabilities(
  ratingA: number,
  ratingB: number,
  skewFactor = 1
): Record<string, number> {
  const probabilityA = logistic(ratingA - ratingB);
  const strength = clamp(Math.abs(probabilityA - 0.5) * 2, 0, 1);
  const favoriteIsA = probabilityA >= 0.5;
  const profileAWin = getWinningScoreProfile({
    strength,
    skewFactor,
    upsetWin: !favoriteIsA
  });
  const profileBWin = getWinningScoreProfile({
    strength,
    skewFactor,
    upsetWin: favoriteIsA
  });

  return {
    "3:0": round(profileAWin[2] * probabilityA * 100, 3),
    "3:1": round(profileAWin[1] * probabilityA * 100, 3),
    "3:2": round(profileAWin[0] * probabilityA * 100, 3),
    "2:3": round(profileBWin[0] * (1 - probabilityA) * 100, 3),
    "1:3": round(profileBWin[1] * (1 - probabilityA) * 100, 3),
    "0:3": round(profileBWin[2] * (1 - probabilityA) * 100, 3)
  };
}

function getMostLikelyResult(resultProbabilities: Record<string, number>): string {
  return Object.entries(resultProbabilities).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "3:2";
}

export function sampleMatchResult(
  ratingA: number,
  ratingB: number,
  skewFactor = 1,
  random = Math.random
): MatchResult {
  const probabilityA = logistic(ratingA - ratingB);
  const teamAWins = random() < probabilityA;
  const strength = clamp(Math.abs(probabilityA - 0.5) * 2, 0, 1);
  const favoriteIsA = probabilityA >= 0.5;
  const profile = getWinningScoreProfile({
    strength,
    skewFactor,
    upsetWin: teamAWins ? !favoriteIsA : favoriteIsA
  });
  const scoreIndex = pickIndexByWeight(profile, random());
  const chosen = WINNING_SCORE_OPTIONS[scoreIndex];

  return teamAWins ? chosen : { setsA: chosen.setsB, setsB: chosen.setsA };
}

export function runMonteCarloSimulation(params: {
  league: League;
  season: Season;
  ratingsByTeamId: Record<string, number>;
  iterations?: number;
}): TeamProbabilitySummary[] {
  const { league, season, ratingsByTeamId, iterations = season.simulationConfig.iterations } = params;
  const seasonMatches = league.matches.filter((match) => match.seasonId === season.id);
  const playedMatches = seasonMatches.filter((match) => match.played && match.result);
  const remainingMatches = seasonMatches.filter((match) => !match.played || !match.result);
  const rankCounts = new Map<string, Record<number, number>>();
  const expectedWins = new Map<string, number>();
  const expectedSetDiff = new Map<string, number>();

  season.teamIds.forEach((teamId) => {
    rankCounts.set(teamId, {});
    expectedWins.set(teamId, 0);
    expectedSetDiff.set(teamId, 0);
  });

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const simulatedMatches: Match[] = remainingMatches.map((match) => ({
      ...match,
      played: true,
      result: sampleMatchResult(
        ratingsByTeamId[match.teamAId],
        ratingsByTeamId[match.teamBId],
        season.simulationConfig.setSkewFactor
      )
    }));

    const simulationLeague: League = {
      ...league,
      matches: [...playedMatches, ...simulatedMatches]
    };
    const aggregate = aggregateSeasonResults(simulationLeague, season);

    aggregate.standings.forEach((standing) => {
      const record = rankCounts.get(standing.teamId) ?? {};
      record[standing.rank] = (record[standing.rank] ?? 0) + 1;
      rankCounts.set(standing.teamId, record);
      expectedWins.set(standing.teamId, (expectedWins.get(standing.teamId) ?? 0) + standing.wins);
      expectedSetDiff.set(
        standing.teamId,
        (expectedSetDiff.get(standing.teamId) ?? 0) + standing.setDiff
      );
    });
  }

  return season.teamIds
    .map((teamId) => {
      const finishProbabilityByRank = rankCounts.get(teamId) ?? {};
      const averageFinalRank =
        Object.entries(finishProbabilityByRank).reduce(
          (sum, [rank, count]) => sum + Number(rank) * count,
          0
        ) / iterations;
      const qualifierProbability =
        Object.entries(finishProbabilityByRank)
          .filter(([rank]) => Number(rank) <= season.rules.qualifierCount)
          .reduce((sum, [, count]) => sum + count, 0) / iterations;

      return {
        teamId,
        qualifierProbability: round(qualifierProbability * 100, 3),
        finishProbabilityByRank: Object.fromEntries(
          Object.entries(finishProbabilityByRank).map(([rank, count]) => [
            Number(rank),
            round((count / iterations) * 100, 3)
          ])
        ),
        averageFinalRank: round(averageFinalRank, 3),
        expectedWins: round((expectedWins.get(teamId) ?? 0) / iterations, 3),
        expectedSetDiff: round((expectedSetDiff.get(teamId) ?? 0) / iterations, 3)
      };
    })
    .sort((left, right) => left.averageFinalRank - right.averageFinalRank);
}

function simulateSeasonCore(params: {
  league: League;
  season: Season;
  previousSeasonStats: SeasonInsight["previousSeasonStats"];
  initialRatings: Record<string, number>;
  iterations?: number;
}) {
  const { league, season, previousSeasonStats, initialRatings, iterations } = params;
  const aggregate = aggregateSeasonResults(league, season);
  const ratingBlend = buildRatingBlend({
    league,
    season,
    initialRatings,
    previousSeasonStats,
    currentRecords: aggregate.records,
    totalMatchCount: aggregate.summary.totalMatchCount
  });
  const probabilitySummaries = runMonteCarloSimulation({
    league,
    season,
    ratingsByTeamId: ratingBlend.ratingsByTeamId,
    iterations
  });

  return {
    aggregate,
    probabilitySummaries,
    ratingBlend
  };
}

function getAnalysisIterations(season: Season): number {
  return Math.max(300, Math.min(1200, Math.round(season.simulationConfig.iterations / 4)));
}

function buildTeamTrends(
  probabilitySummaries: TeamProbabilitySummary[],
  previousSeasonStats: SeasonInsight["previousSeasonStats"]
): TeamTrendSummary[] {
  const previousRankMap = new Map(previousSeasonStats.map((stat) => [stat.teamId, stat.finalRank]));

  return probabilitySummaries.map((summary) => {
    const previousRank = previousRankMap.get(summary.teamId) ?? null;

    return {
      teamId: summary.teamId,
      previousRank,
      expectedRank: summary.averageFinalRank,
      deltaFromPreviousRank:
        previousRank === null ? null : round(previousRank - summary.averageFinalRank, 2)
    };
  });
}

function buildTiebreakNotes(insight: {
  season: Season;
  standings: SeasonInsight["currentStandings"];
  matches: Match[];
}): TiebreakNote[] {
  const { season, standings, matches } = insight;
  const notes: TiebreakNote[] = [];

  for (let index = 0; index < standings.length - 1; index += 1) {
    const higher = standings[index];
    const lower = standings[index + 1];

    if (!higher || !lower || higher.wins !== lower.wins) {
      continue;
    }

    const reasons: string[] = [];

    for (const tiebreaker of season.rules.rankingTiebreakers.filter((value) => value !== "wins")) {
      if (tiebreaker === "setDiff" && higher.setDiff !== lower.setDiff) {
        reasons.push(
          `세트 득실 ${higher.setDiff >= 0 ? `+${higher.setDiff}` : higher.setDiff} 대 ${lower.setDiff >= 0 ? `+${lower.setDiff}` : lower.setDiff}`
        );
        break;
      }

      if (tiebreaker === "setDiff" && higher.setDiff === lower.setDiff) {
        const tiedTeams = standings.filter(
          (standing) => standing.wins === higher.wins && standing.setDiff === higher.setDiff
        );

        if (tiedTeams.length === 2) {
          const headToHeadMatches = matches.filter((match) => {
            if (!match.played || !match.result || match.result.setsA === match.result.setsB) {
              return false;
            }

            return (
              (match.teamAId === higher.teamId && match.teamBId === lower.teamId) ||
              (match.teamAId === lower.teamId && match.teamBId === higher.teamId)
            );
          });
          const higherWins = headToHeadMatches.filter((match) => {
            if (!match.result) {
              return false;
            }

            return (
              (match.teamAId === higher.teamId && match.result.setsA > match.result.setsB) ||
              (match.teamBId === higher.teamId && match.result.setsB > match.result.setsA)
            );
          }).length;
          const lowerWins = headToHeadMatches.length - higherWins;

          if (higherWins !== lowerWins) {
            reasons.push(`승자승 ${higherWins}승 ${lowerWins}패`);
            break;
          }
        }
      }

      if (tiebreaker === "setsWon" && higher.setDiff !== lower.setDiff && higher.setsWon !== lower.setsWon) {
        reasons.push(`세트 득 ${higher.setsWon} 대 ${lower.setsWon}`);
        break;
      }
    }

    if (reasons.length === 0) {
      reasons.push("팀명 순서");
    }

    notes.push({
      higherTeamId: higher.teamId,
      lowerTeamId: lower.teamId,
      reason: `${higher.teamName}가 ${lower.teamName}와 승수 동률이지만 ${reasons.join(", ")} 기준으로 앞섭니다.`
    });
  }

  return notes;
}

function buildForcedLeague(league: League, targetMatch: Match, result: MatchResult): League {
  return {
    ...league,
    matches: league.matches.map((match) =>
      match.id === targetMatch.id
        ? {
            ...match,
            played: true,
            result
          }
        : match
    )
  };
}

function toProbabilityMap(summaries: TeamProbabilitySummary[]): Record<string, number> {
  return Object.fromEntries(
    summaries.map((summary) => [summary.teamId, summary.qualifierProbability])
  );
}

function toAverageRankMap(summaries: TeamProbabilitySummary[]): Record<string, number> {
  return Object.fromEntries(summaries.map((summary) => [summary.teamId, summary.averageFinalRank]));
}

function toFinishProbabilityMap(
  summaries: TeamProbabilitySummary[]
): Record<string, Record<number, number>> {
  return Object.fromEntries(
    summaries.map((summary) => [summary.teamId, summary.finishProbabilityByRank])
  );
}

function getQualifierPressure(avgRank: number, qualifierCount: number): number {
  return clamp(1 - Math.abs(avgRank - qualifierCount) / 2.5, 0, 1);
}

function getTitlePressure(avgRank: number): number {
  return clamp(1 - Math.abs(avgRank - 1) / 2.5, 0, 1);
}

function buildTeamRelevanceWeights(
  baseProbabilitySummaries: TeamProbabilitySummary[],
  qualifierCount: number
): Record<string, number> {
  return Object.fromEntries(
    baseProbabilitySummaries.map((summary) => {
      const qualifierUncertainty = clamp(
        1 - Math.abs(summary.qualifierProbability - 50) / 50,
        0,
        1
      );
      const qualifierPressure = getQualifierPressure(summary.averageFinalRank, qualifierCount);
      const titlePressure = getTitlePressure(summary.averageFinalRank);
      const titleChance = clamp((summary.finishProbabilityByRank[1] ?? 0) / 25, 0, 1);

      return [
        summary.teamId,
        1 +
          qualifierPressure * 1.35 +
          qualifierUncertainty * 0.85 +
          titlePressure * titleChance * 0.55
      ];
    })
  );
}

function getRankImpactWeight(avgRank: number, qualifierCount: number): number {
  return 0.8 + getQualifierPressure(avgRank, qualifierCount) * 0.9 + getTitlePressure(avgRank) * 0.5;
}

function buildOutcomeProbability(label: string, resultProbabilities: Record<string, number>): number {
  return (resultProbabilities[label] ?? 0) / 100;
}

function calculateExpectedQualifierImpact(params: {
  season: Season;
  outcomes: MatchOutcomeImpact[];
  resultProbabilities: Record<string, number>;
  baseQualifierProbability: Record<string, number>;
  teamRelevanceWeightById: Record<string, number>;
}): number {
  const { season, outcomes, resultProbabilities, baseQualifierProbability, teamRelevanceWeightById } =
    params;
  const weightTotal = season.teamIds.reduce(
    (sum, teamId) => sum + (teamRelevanceWeightById[teamId] ?? 1),
    0
  );

  return (
    outcomes.reduce((sum, outcome) => {
      const probability = buildOutcomeProbability(outcome.resultLabel, resultProbabilities);
      const weightedDelta = season.teamIds.reduce((teamSum, teamId) => {
        const nextValue = outcome.qualifierProbabilityByTeamId[teamId] ?? 0;
        return (
          teamSum +
          Math.abs(nextValue - (baseQualifierProbability[teamId] ?? 0)) *
            (teamRelevanceWeightById[teamId] ?? 1)
        );
      }, 0);

      return sum + probability * weightedDelta;
    }, 0) / Math.max(weightTotal, 1)
  );
}

function calculateExpectedRankImpact(params: {
  season: Season;
  outcomes: MatchOutcomeImpact[];
  resultProbabilities: Record<string, number>;
  baseAverageRank: Record<string, number>;
  teamRelevanceWeightById: Record<string, number>;
}): number {
  const { season, outcomes, resultProbabilities, baseAverageRank, teamRelevanceWeightById } = params;
  const weightTotal = season.teamIds.reduce((sum, teamId) => {
    const avgRank = baseAverageRank[teamId] ?? season.teamIds.length;
    return sum + (teamRelevanceWeightById[teamId] ?? 1) * getRankImpactWeight(avgRank, season.rules.qualifierCount);
  }, 0);

  return (
    outcomes.reduce((sum, outcome) => {
      const probability = buildOutcomeProbability(outcome.resultLabel, resultProbabilities);
      const weightedDelta = season.teamIds.reduce((teamSum, teamId) => {
        const avgRank = baseAverageRank[teamId] ?? season.teamIds.length;
        const nextRank = outcome.averageRankByTeamId[teamId] ?? avgRank;
        const rankDelta = Math.abs(nextRank - avgRank) * 6;

        return (
          teamSum +
          rankDelta *
            (teamRelevanceWeightById[teamId] ?? 1) *
            getRankImpactWeight(avgRank, season.rules.qualifierCount)
        );
      }, 0);

      return sum + probability * weightedDelta;
    }, 0) / Math.max(weightTotal, 1)
  );
}

function calculateSetScoreSensitivity(params: {
  season: Season;
  outcomes: MatchOutcomeImpact[];
  resultProbabilities: Record<string, number>;
  teamRelevanceWeightById: Record<string, number>;
  baseAverageRank: Record<string, number>;
}): number {
  const { season, outcomes, resultProbabilities, teamRelevanceWeightById, baseAverageRank } = params;
  const winnerGroups = [
    outcomes.filter((outcome) => {
      const result = parseResultLabel(outcome.resultLabel);
      return result.setsA > result.setsB;
    }),
    outcomes.filter((outcome) => {
      const result = parseResultLabel(outcome.resultLabel);
      return result.setsA < result.setsB;
    })
  ];
  const weightTotal = season.teamIds.reduce(
    (sum, teamId) => sum + (teamRelevanceWeightById[teamId] ?? 1),
    0
  );

  return winnerGroups.reduce((groupSum, groupOutcomes) => {
    const groupProbability = groupOutcomes.reduce(
      (sum, outcome) => sum + buildOutcomeProbability(outcome.resultLabel, resultProbabilities),
      0
    );

    if (groupProbability <= 0) {
      return groupSum;
    }

    const groupCenterQualifierProbability = Object.fromEntries(
      season.teamIds.map((teamId) => [
        teamId,
        groupOutcomes.reduce((sum, outcome) => {
          const probability = buildOutcomeProbability(outcome.resultLabel, resultProbabilities);
          return sum + (outcome.qualifierProbabilityByTeamId[teamId] ?? 0) * probability;
        }, 0) / groupProbability
      ])
    );
    const groupCenterRank = Object.fromEntries(
      season.teamIds.map((teamId) => [
        teamId,
        groupOutcomes.reduce((sum, outcome) => {
          const probability = buildOutcomeProbability(outcome.resultLabel, resultProbabilities);
          return sum + (outcome.averageRankByTeamId[teamId] ?? baseAverageRank[teamId] ?? 0) * probability;
        }, 0) / groupProbability
      ])
    );

    const groupDeviation =
      groupOutcomes.reduce((sum, outcome) => {
        const normalizedProbability =
          buildOutcomeProbability(outcome.resultLabel, resultProbabilities) / groupProbability;
        const weightedDeviation = season.teamIds.reduce((teamSum, teamId) => {
          const qualifierDeviation = Math.abs(
            (outcome.qualifierProbabilityByTeamId[teamId] ?? 0) -
              (groupCenterQualifierProbability[teamId] ?? 0)
          );
          const rankDeviation =
            Math.abs(
              (outcome.averageRankByTeamId[teamId] ?? baseAverageRank[teamId] ?? 0) -
                (groupCenterRank[teamId] ?? 0)
            ) * 6;

          return (
            teamSum +
            (qualifierDeviation + rankDeviation * 0.85) * (teamRelevanceWeightById[teamId] ?? 1)
          );
        }, 0);

        return sum + normalizedProbability * weightedDeviation;
      }, 0) / Math.max(weightTotal, 1);

    return groupSum + groupProbability * groupDeviation;
  }, 0);
}

function calculateExpectedSwingByTeam(params: {
  season: Season;
  outcomes: MatchOutcomeImpact[];
  resultProbabilities: Record<string, number>;
  baseQualifierProbability: Record<string, number>;
  baseAverageRank: Record<string, number>;
}): Array<{ teamId: string; swing: number }> {
  const { season, outcomes, resultProbabilities, baseQualifierProbability, baseAverageRank } =
    params;

  return season.teamIds.map((teamId) => ({
    teamId,
    swing: outcomes.reduce((sum, outcome) => {
      const probability = buildOutcomeProbability(outcome.resultLabel, resultProbabilities);
      const qualifierDelta = Math.abs(
        (outcome.qualifierProbabilityByTeamId[teamId] ?? 0) -
          (baseQualifierProbability[teamId] ?? 0)
      );
      const rankDelta =
        Math.abs((outcome.averageRankByTeamId[teamId] ?? baseAverageRank[teamId] ?? 0) - (baseAverageRank[teamId] ?? 0)) *
        4;

      return sum + probability * (qualifierDelta + rankDelta);
    }, 0)
  }));
}

function getSeasonInsightSeasonIds(league: League, season: Season): Set<string> {
  const seasonIds = new Set<string>([season.id]);
  const priorSeasonId = season.priorSeasonId ?? recommendPriorSeasonId(league, season);

  if (priorSeasonId) {
    seasonIds.add(priorSeasonId);
  }

  return seasonIds;
}

export function prepareSeasonInsightLeague(
  league: League,
  seasonId: string,
  predictionOverrides: PredictionOverrides = {}
): League {
  const season = league.seasons.find((candidate) => candidate.id === seasonId);

  if (!season) {
    throw new Error(`Season not found: ${seasonId}`);
  }

  const seasonIds = getSeasonInsightSeasonIds(league, season);
  const seasons = league.seasons.filter((candidate) => seasonIds.has(candidate.id));
  const teamIds = new Set(seasons.flatMap((candidate) => candidate.teamIds));

  return applyPredictionOverrides(
    {
      id: league.id,
      name: league.name,
      teams: league.teams.filter((team) => teamIds.has(team.id)),
      seasons,
      seasonTeams: league.seasonTeams.filter(
        (seasonTeam) => seasonIds.has(seasonTeam.seasonId) && teamIds.has(seasonTeam.teamId)
      ),
      matches: league.matches.filter((match) => seasonIds.has(match.seasonId))
    },
    predictionOverrides
  );
}

function analyzeRemainingMatchInsights(params: {
  league: League;
  season: Season;
  previousSeasonStats: SeasonInsight["previousSeasonStats"];
  initialRatings: Record<string, number>;
  ratingsByTeamId: Record<string, number>;
  baseProbabilitySummaries: TeamProbabilitySummary[];
}): RemainingMatchInsight[] {
  const {
    league,
    season,
    previousSeasonStats,
    initialRatings,
    ratingsByTeamId,
    baseProbabilitySummaries
  } = params;
  const remainingMatches = league.matches.filter(
    (match) => match.seasonId === season.id && (!match.played || !match.result)
  );
  const baseQualifierProbability = toProbabilityMap(baseProbabilitySummaries);
  const baseAverageRank = toAverageRankMap(baseProbabilitySummaries);
  const teamRelevanceWeightById = buildTeamRelevanceWeights(
    baseProbabilitySummaries,
    season.rules.qualifierCount
  );
  const analysisIterations = getAnalysisIterations(season);

  return remainingMatches
    .map((match) => {
      const resultProbabilities = getMatchResultProbabilities(
        ratingsByTeamId[match.teamAId],
        ratingsByTeamId[match.teamBId],
        season.simulationConfig.setSkewFactor
      );
      const outcomes: MatchOutcomeImpact[] = RESULT_OPTIONS.map((resultLabel) => {
        const forcedLeague = buildForcedLeague(league, match, parseResultLabel(resultLabel));
        const forcedCore = simulateSeasonCore({
          league: forcedLeague,
          season,
          previousSeasonStats,
          initialRatings,
          iterations: analysisIterations
        });

        return {
          resultLabel,
          qualifierProbabilityByTeamId: toProbabilityMap(forcedCore.probabilitySummaries),
          finishProbabilityByRankByTeamId: toFinishProbabilityMap(forcedCore.probabilitySummaries),
          averageRankByTeamId: toAverageRankMap(forcedCore.probabilitySummaries),
          leaderTeamId: forcedCore.probabilitySummaries[0]?.teamId ?? null,
          qualifierTeamIds: forcedCore.probabilitySummaries
            .slice(0, season.rules.qualifierCount)
            .map((summary) => summary.teamId)
        };
      });

      const expectedQualifierImpact = calculateExpectedQualifierImpact({
        season,
        outcomes,
        resultProbabilities,
        baseQualifierProbability,
        teamRelevanceWeightById
      });
      const expectedRankImpact = calculateExpectedRankImpact({
        season,
        outcomes,
        resultProbabilities,
        baseAverageRank,
        teamRelevanceWeightById
      });
      const setScoreSensitivity = calculateSetScoreSensitivity({
        season,
        outcomes,
        resultProbabilities,
        teamRelevanceWeightById,
        baseAverageRank
      });
      const teamAWinProbability = round(
        RESULT_OPTIONS.filter((label) => parseResultLabel(label).setsA > parseResultLabel(label).setsB).reduce(
          (sum, label) => sum + (resultProbabilities[label] ?? 0),
          0
        ),
        3
      );
      const teamBWinProbability = round(
        RESULT_OPTIONS.filter((label) => parseResultLabel(label).setsA < parseResultLabel(label).setsB).reduce(
          (sum, label) => sum + (resultProbabilities[label] ?? 0),
          0
        ),
        3
      );
      const balanceBonus =
        1 + clamp(1 - Math.abs(teamAWinProbability - teamBWinProbability) / 100, 0, 1) * 0.35;
      const importanceScore = round(
        (expectedQualifierImpact * 0.72 + expectedRankImpact * 0.88 + setScoreSensitivity * 0.95) *
          balanceBonus,
        3
      );

      const biggestSwing = calculateExpectedSwingByTeam({
        season,
        outcomes,
        resultProbabilities,
        baseQualifierProbability,
        baseAverageRank
      }).sort((left, right) => right.swing - left.swing)[0];

      return {
        matchId: match.id,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        scheduledAt: match.scheduledAt,
        teamAWinProbability,
        teamBWinProbability,
        mostLikelyResult: getMostLikelyResult(resultProbabilities),
        resultProbabilities,
        importanceScore,
        biggestSwingTeamId: biggestSwing?.teamId ?? null,
        biggestSwingValue: round(biggestSwing?.swing ?? 0, 3),
        outcomes
      };
    })
    .sort((left, right) => right.importanceScore - left.importanceScore);
}

export function computeSeasonInsight(
  league: League,
  seasonId: string,
  predictionOverrides: PredictionOverrides = {}
): SeasonInsight {
  const simulationLeague = prepareSeasonInsightLeague(league, seasonId, predictionOverrides);
  const season = simulationLeague.seasons.find((candidate) => candidate.id === seasonId);

  if (!season) {
    throw new Error(`Season not found: ${seasonId}`);
  }

  const previousSeasonStats = buildPreviousSeasonStatsFromArchive(simulationLeague, season);
  const initialRatings = deriveInitialRatings(simulationLeague, season, previousSeasonStats);
  const core = simulateSeasonCore({
    league: simulationLeague,
    season,
    previousSeasonStats,
    initialRatings
  });
  const seasonMatches = simulationLeague.matches.filter((match) => match.seasonId === season.id);
  const completedMatches = seasonMatches.filter((match) => match.played && match.result);
  const remainingMatches = seasonMatches.filter((match) => !match.played || !match.result);
  const remainingMatchInsights = analyzeRemainingMatchInsights({
    league: simulationLeague,
    season,
    previousSeasonStats,
    initialRatings,
    ratingsByTeamId: core.ratingBlend.ratingsByTeamId,
    baseProbabilitySummaries: core.probabilitySummaries
  });

  return {
    season,
    currentStandings: core.aggregate.standings,
    currentRecords: core.aggregate.records,
    summary: core.aggregate.summary,
    previousSeasonStats,
    probabilitySummaries: core.probabilitySummaries,
    ratingsByTeamId: core.ratingBlend.ratingsByTeamId,
    ratingBreakdowns: core.ratingBlend.ratingBreakdowns,
    completedMatches,
    remainingMatches,
    remainingMatchInsights,
    tiebreakNotes: buildTiebreakNotes({
      season,
      standings: core.aggregate.standings,
      matches: seasonMatches
    }),
    teamTrends: buildTeamTrends(core.probabilitySummaries, previousSeasonStats),
    priorBlend: {
      completionRatio: round(core.ratingBlend.completionRatio * 100, 1),
      priorWeight: round(core.ratingBlend.priorWeight * 100, 1),
      currentWeight: round(core.ratingBlend.currentWeight * 100, 1)
    },
    simulationMeta: {
      iterations: season.simulationConfig.iterations,
      analysisIterations: getAnalysisIterations(season),
      ranAt: new Date().toISOString()
    }
  };
}

export { stringifyResult };
