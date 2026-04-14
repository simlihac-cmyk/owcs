import { DEFAULT_LEAGUE_RULES, DEFAULT_SIMULATION_CONFIG } from "@/lib/constants";
import { Match, RoundRobinType, Season, SeasonTeam, Team } from "@/lib/types";
import { createId } from "@/lib/utils/ids";

type Pairing = [string, string];

function buildRounds(teamIds: string[]): Pairing[][] {
  const hasBye = teamIds.length % 2 !== 0;
  const rotation = hasBye ? [...teamIds, "__BYE__"] : [...teamIds];
  const rounds: Pairing[][] = [];
  const roundCount = rotation.length - 1;
  const half = rotation.length / 2;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const round: Pairing[] = [];

    for (let pairIndex = 0; pairIndex < half; pairIndex += 1) {
      const teamA = rotation[pairIndex];
      const teamB = rotation[rotation.length - 1 - pairIndex];

      if (teamA !== "__BYE__" && teamB !== "__BYE__") {
        round.push(roundIndex % 2 === 0 ? [teamA, teamB] : [teamB, teamA]);
      }
    }

    rounds.push(round);
    rotation.splice(1, 0, rotation.pop() as string);
  }

  return rounds;
}

function pairKey(teamAId: string, teamBId: string, occurrence: number): string {
  return [teamAId, teamBId].sort().join("__") + `__${occurrence}`;
}

export function generateRoundRobinMatches(
  seasonId: string,
  teamIds: string[],
  roundRobinType: RoundRobinType,
  startAt: string
): Match[] {
  const rounds = buildRounds(teamIds);
  const repeatCount = roundRobinType === "double" ? 2 : 1;
  const matches: Match[] = [];
  const startDate = new Date(startAt);

  for (let repeat = 0; repeat < repeatCount; repeat += 1) {
    rounds.forEach((round, roundIndex) => {
      round.forEach(([teamAId, teamBId], pairIndex) => {
        const scheduledAt = new Date(startDate);
        scheduledAt.setDate(startDate.getDate() + (repeat * rounds.length + roundIndex) * 7 + pairIndex);

        const swapSides = repeat % 2 !== 0;
        matches.push({
          id: createId("match"),
          seasonId,
          teamAId: swapSides ? teamBId : teamAId,
          teamBId: swapSides ? teamAId : teamBId,
          scheduledAt: scheduledAt.toISOString(),
          played: false,
          result: null,
          replayCodes: []
        });
      });
    });
  }

  return matches;
}

export function regenerateSeasonSchedule(params: {
  season: Season;
  existingMatches: Match[];
  nextTeamIds: string[];
}): Match[] {
  const { season, existingMatches, nextTeamIds } = params;
  const generated = generateRoundRobinMatches(
    season.id,
    nextTeamIds,
    season.rules.roundRobinType,
    existingMatches[0]?.scheduledAt ?? new Date().toISOString()
  );

  const existingPairBuckets = new Map<string, Match[]>();
  const existingSorted = [...existingMatches].sort((left, right) =>
    left.scheduledAt.localeCompare(right.scheduledAt)
  );
  const occurrenceCount = new Map<string, number>();

  for (const match of existingSorted) {
    const base = [match.teamAId, match.teamBId].sort().join("__");
    const occurrence = occurrenceCount.get(base) ?? 0;
    occurrenceCount.set(base, occurrence + 1);
    const key = pairKey(match.teamAId, match.teamBId, occurrence);
    const bucket = existingPairBuckets.get(key) ?? [];
    bucket.push(match);
    existingPairBuckets.set(key, bucket);
  }

  const generatedOccurrenceCount = new Map<string, number>();

  return generated.map((match) => {
    const base = [match.teamAId, match.teamBId].sort().join("__");
    const occurrence = generatedOccurrenceCount.get(base) ?? 0;
    generatedOccurrenceCount.set(base, occurrence + 1);
    const key = pairKey(match.teamAId, match.teamBId, occurrence);
    const preserved = existingPairBuckets.get(key)?.shift();

    if (!preserved) {
      return match;
    }

    return {
      ...match,
      id: preserved.id,
      played: preserved.played,
      result: preserved.result,
      replayCodes: preserved.replayCodes ?? []
    };
  });
}

export function createSeasonShell(params: {
  leagueId: string;
  name: string;
  year: number;
  order: number;
  teamIds: string[];
  priorSeasonId?: string | null;
}): {
  season: Season;
  seasonTeams: SeasonTeam[];
  matches: Match[];
} {
  const seasonId = createId("season");
  const timestamp = new Date().toISOString();
  const season: Season = {
    id: seasonId,
    leagueId: params.leagueId,
    name: params.name,
    year: params.year,
    order: params.order,
    teamIds: params.teamIds,
    priorSeasonId: params.priorSeasonId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "draft",
    rules: { ...DEFAULT_LEAGUE_RULES },
    simulationConfig: { ...DEFAULT_SIMULATION_CONFIG }
  };

  return {
    season,
    seasonTeams: params.teamIds.map((teamId) => ({ seasonId, teamId, manualInitialRating: null })),
    matches: generateRoundRobinMatches(
      seasonId,
      params.teamIds,
      season.rules.roundRobinType,
      timestamp
    )
  };
}

export function createTeamsFromNames(teamNames: string[]): Team[] {
  return teamNames.map((name) => ({
    id: createId("team"),
    name: name.trim()
  }));
}
