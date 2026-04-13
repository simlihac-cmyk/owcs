import { DEFAULT_SIMULATION_CONFIG } from "@/lib/constants";
import { buildPreviousSeasonStatsFromArchive } from "@/lib/domain/prior";
import { League, Match, PreviousSeasonStats, Season } from "@/lib/types";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadLeagueFromJson(json: League): League {
  const cloned = deepClone(json);

  cloned.seasons = cloned.seasons.map((season) => ({
    ...season,
    simulationConfig: {
      ...DEFAULT_SIMULATION_CONFIG,
      ...season.simulationConfig
    }
  }));

  return cloned;
}

export function loadSeasonFromJson(json: Season): Season {
  return deepClone(json);
}

export function importHistoricalMatches(matches: Match[]): Match[] {
  return deepClone(matches);
}

export function loadPreviousSeasonFromArchive(
  league: League,
  seasonId: string
): PreviousSeasonStats[] {
  const season = league.seasons.find((candidate) => candidate.id === seasonId);

  if (!season) {
    return [];
  }

  return buildPreviousSeasonStatsFromArchive(league, season);
}
