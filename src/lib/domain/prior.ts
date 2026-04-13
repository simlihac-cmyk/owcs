import { BASE_RATING } from "@/lib/constants";
import { aggregateSeasonResults } from "@/lib/domain/standings";
import {
  CurrentSeasonRecord,
  League,
  PreviousSeasonStats,
  RatingBreakdown,
  Season,
  SeasonTeam
} from "@/lib/types";
import { clamp, standardize } from "@/lib/utils/math";

function getSeasonTeams(league: League, seasonId: string): SeasonTeam[] {
  return league.seasonTeams.filter((team) => team.seasonId === seasonId);
}

export function recommendPriorSeasonId(league: League, season: Season): string | null {
  const ordered = [...league.seasons].sort((left, right) => left.order - right.order);
  const seasonIndex = ordered.findIndex((candidate) => candidate.id === season.id);

  if (seasonIndex <= 0) {
    return null;
  }

  return ordered[seasonIndex - 1]?.id ?? null;
}

export function buildPreviousSeasonStatsFromArchive(
  league: League,
  season: Season
): PreviousSeasonStats[] {
  const priorSeasonId = season.priorSeasonId ?? recommendPriorSeasonId(league, season);
  const priorSeason = league.seasons.find((candidate) => candidate.id === priorSeasonId);

  if (!priorSeason) {
    return [];
  }

  return aggregateSeasonResults(league, priorSeason).previousSeasonStats;
}

export function deriveInitialRatings(
  league: League,
  season: Season,
  previousSeasonStats: PreviousSeasonStats[]
): Record<string, number> {
  const seasonTeams = getSeasonTeams(league, season.id);
  const previousByTeam = new Map(previousSeasonStats.map((stat) => [stat.teamId, stat]));
  const availableStats = season.teamIds
    .map((teamId) => previousByTeam.get(teamId))
    .filter((value): value is PreviousSeasonStats => Boolean(value));

  const rankScores = availableStats.map((stat) => availableStats.length + 1 - stat.finalRank);
  const winRates = availableStats.map((stat) => stat.winRate);
  const setDiffs = availableStats.map((stat) => stat.setDiff);
  const setRatios = availableStats.map((stat) =>
    stat.setsLost === 0 ? stat.setsWon : stat.setsWon / stat.setsLost
  );

  const rankZ = standardize(rankScores);
  const winRateZ = standardize(winRates);
  const setDiffZ = standardize(setDiffs);
  const ratioZ = standardize(setRatios);

  const statRatingMap = new Map<string, number>();

  availableStats.forEach((stat, index) => {
    const score =
      rankZ[index] * 0.4 + winRateZ[index] * 0.3 + setDiffZ[index] * 0.2 + ratioZ[index] * 0.1;

    statRatingMap.set(stat.teamId, BASE_RATING + score * 85);
  });

  const newcomerFallbackRating = (() => {
    const priorRatings = Array.from(statRatingMap.values()).sort((left, right) => left - right);

    if (priorRatings.length === 0) {
      return BASE_RATING;
    }

    const lowerBucketSize = Math.max(1, Math.ceil(priorRatings.length / 3));
    const lowerBucket = priorRatings.slice(0, lowerBucketSize);
    const lowerBucketAverage =
      lowerBucket.reduce((sum, rating) => sum + rating, 0) / lowerBucket.length;

    return clamp(lowerBucketAverage - 20, BASE_RATING - 140, BASE_RATING - 40);
  })();

  const manualMap = new Map(seasonTeams.map((team) => [team.teamId, team.manualInitialRating ?? null]));

  return Object.fromEntries(
    season.teamIds.map((teamId) => [
      teamId,
      manualMap.get(teamId) ??
        statRatingMap.get(teamId) ??
        (previousSeasonStats.length > 0 ? newcomerFallbackRating : BASE_RATING)
    ])
  );
}

export function getCompletionRatio(
  currentRecords: CurrentSeasonRecord[],
  totalMatchCount: number
): number {
  return totalMatchCount === 0
    ? 0
    : currentRecords.reduce((sum, record) => sum + record.matchesPlayed, 0) / (totalMatchCount * 2);
}

export function getCurrentFormWeight(season: Season, completionRatio: number): number {
  const baseWeight = completionRatio / (completionRatio + season.simulationConfig.priorWeightDecay);
  const aggressionFactor = getModelAggressionFactor(season);

  return clamp(baseWeight * (1.05 + (aggressionFactor - 1) * 0.85), 0, 0.96);
}

function getModelAggressionFactor(season: Season): number {
  const { priorWeightDecay, shrinkageMatches, opponentStrengthWeight, setSkewFactor } =
    season.simulationConfig;

  return clamp(
    1 +
      (0.45 - priorWeightDecay) * 0.85 +
      (8 - shrinkageMatches) * 0.045 +
      (opponentStrengthWeight - 0.25) * 1.1 +
      (setSkewFactor - 1) * 0.3,
    0.72,
    1.42
  );
}

export function buildRatingBlend(params: {
  league: League;
  season: Season;
  initialRatings: Record<string, number>;
  previousSeasonStats: PreviousSeasonStats[];
  currentRecords: CurrentSeasonRecord[];
  totalMatchCount: number;
}): {
  ratingsByTeamId: Record<string, number>;
  ratingBreakdowns: RatingBreakdown[];
  completionRatio: number;
  priorWeight: number;
  currentWeight: number;
} {
  const { league, season, initialRatings, previousSeasonStats, currentRecords, totalMatchCount } = params;
  const completionRatio = getCompletionRatio(currentRecords, totalMatchCount);
  const currentWeight = getCurrentFormWeight(season, completionRatio);
  const priorWeight = 1 - currentWeight;
  const playedMatches = league.matches.filter(
    (match) => match.seasonId === season.id && match.played && match.result
  );
  const opponentStrengthBuckets = new Map<string, number[]>();

  for (const record of currentRecords) {
    opponentStrengthBuckets.set(record.teamId, []);
  }

  for (const match of playedMatches) {
    opponentStrengthBuckets.get(match.teamAId)?.push(initialRatings[match.teamBId] ?? BASE_RATING);
    opponentStrengthBuckets.get(match.teamBId)?.push(initialRatings[match.teamAId] ?? BASE_RATING);
  }

  const performanceScores = currentRecords.map((record) => {
    const normalizedSetDiff =
      record.matchesPlayed === 0 ? 0 : clamp(record.setDiff / (record.matchesPlayed * 3), -1, 1);
    const totalSets = record.setsWon + record.setsLost;
    const setShare = totalSets === 0 ? 0.5 : record.setsWon / totalSets;
    const opponents = opponentStrengthBuckets.get(record.teamId) ?? [];
    const averageOpponentStrength =
      opponents.length === 0
        ? 0
        : opponents.reduce((sum, rating) => sum + (rating - BASE_RATING), 0) / opponents.length / 120;
    const undefeatedBonus =
      record.matchesPlayed === 0
        ? 0
        : record.losses === 0
          ? 0.12 + Math.min(record.matchesPlayed, 5) * 0.01
          : record.losses === 1
            ? 0.04
            : 0;
    const lossPenalty =
      record.matchesPlayed === 0 ? 0 : (record.losses / record.matchesPlayed) * 0.08;

    return (
      record.winRate * 0.4 +
      normalizedSetDiff * 0.22 +
      (setShare - 0.5) * 0.18 +
      averageOpponentStrength * season.simulationConfig.opponentStrengthWeight +
      undefeatedBonus -
      lossPenalty
    );
  });
  const performanceZ = standardize(performanceScores);
  const aggressionFactor = getModelAggressionFactor(season);
  const previousStatMap = new Map(previousSeasonStats.map((stat) => [stat.teamId, stat]));
  const seasonTeamMap = new Map(
    league.seasonTeams
      .filter((team) => team.seasonId === season.id)
      .map((team) => [team.teamId, team.manualInitialRating ?? null])
  );

  const ratingEntries = currentRecords.map((record, index) => {
    const shrinkage =
      record.matchesPlayed === 0
        ? 0
        : record.matchesPlayed / (record.matchesPlayed + season.simulationConfig.shrinkageMatches);
    const currentFormSpread = 120 * aggressionFactor;
    const consistencyBonus =
      record.matchesPlayed === 0
        ? 0
        : record.losses === 0
          ? 42
          : record.losses === 1
            ? 10
            : -Math.min(record.losses, 4) * 12;
    const directFormBonus =
      (record.winRate - 0.5) * 65 +
      clamp(record.setDiff / Math.max(record.matchesPlayed, 1), -3, 3) * 16;
    const currentFormRaw =
      BASE_RATING + performanceZ[index] * currentFormSpread + consistencyBonus + directFormBonus;
    const currentFormRating = BASE_RATING + (currentFormRaw - BASE_RATING) * shrinkage;
    const initial = initialRatings[record.teamId] ?? BASE_RATING;
    const evidenceWeight = currentWeight * shrinkage;
    const nextRating = initial * (1 - evidenceWeight) + currentFormRaw * evidenceWeight;
    const previousSeasonStat = previousStatMap.get(record.teamId);

    return {
      teamId: record.teamId,
      initialRating: initial,
      currentFormRating,
      blendedRating: nextRating,
      priorWeight,
      currentWeight: evidenceWeight,
      manualInitialRating: seasonTeamMap.get(record.teamId) ?? null,
      previousSeasonRank: previousSeasonStat?.finalRank ?? null,
      previousSeasonWinRate: previousSeasonStat?.winRate ?? null
    };
  });

  return {
    ratingsByTeamId: Object.fromEntries(ratingEntries.map((entry) => [entry.teamId, entry.blendedRating])),
    ratingBreakdowns: ratingEntries.sort((left, right) => right.blendedRating - left.blendedRating),
    completionRatio,
    priorWeight,
    currentWeight
  };
}

export function blendRatingsWithCurrentForm(params: {
  league: League;
  season: Season;
  initialRatings: Record<string, number>;
  previousSeasonStats: PreviousSeasonStats[];
  currentRecords: CurrentSeasonRecord[];
  totalMatchCount: number;
}): Record<string, number> {
  return buildRatingBlend(params).ratingsByTeamId;
}
