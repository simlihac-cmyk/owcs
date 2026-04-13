import { League, PredictionOverrides } from "@/lib/types";

export function applyPredictionOverrides(
  league: League,
  predictionOverrides: PredictionOverrides
): League {
  const overrideIds = new Set(Object.keys(predictionOverrides));

  if (overrideIds.size === 0) {
    return league;
  }

  return {
    ...league,
    matches: league.matches.map((match) => {
      if (!overrideIds.has(match.id)) {
        return match;
      }

      const nextResult = predictionOverrides[match.id] ?? null;

      return {
        ...match,
        played: Boolean(nextResult),
        result: nextResult
      };
    })
  };
}
