import {
  CurrentSeasonRecord,
  League,
  LeagueRules,
  Match,
  PreviousSeasonStats,
  Season,
  SeasonSummary,
  StandingRow
} from "@/lib/types";
import { getSeasonTeamNameMap } from "@/lib/utils/season-team-display";

function getTiebreakValue(record: CurrentSeasonRecord, key: LeagueRules["rankingTiebreakers"][number]) {
  switch (key) {
    case "wins":
      return record.wins;
    case "setDiff":
      return record.setDiff;
    case "setsWon":
      return record.setsWon;
    default:
      return 0;
  }
}

export function buildCurrentSeasonRecords(
  season: Season,
  matches: Match[]
): CurrentSeasonRecord[] {
  const recordMap = new Map<string, CurrentSeasonRecord>();

  for (const teamId of season.teamIds) {
    recordMap.set(teamId, {
      seasonId: season.id,
      teamId,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      matchesPlayed: 0,
      winRate: 0
    });
  }

  for (const match of matches) {
    if (!match.played || !match.result) {
      continue;
    }

    const teamA = recordMap.get(match.teamAId);
    const teamB = recordMap.get(match.teamBId);

    if (!teamA || !teamB) {
      continue;
    }

    const { setsA, setsB } = match.result;

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;
    teamA.setsWon += setsA;
    teamA.setsLost += setsB;
    teamB.setsWon += setsB;
    teamB.setsLost += setsA;

    if (setsA > setsB) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  return Array.from(recordMap.values()).map((record) => ({
    ...record,
    setDiff: record.setsWon - record.setsLost,
    winRate: record.matchesPlayed === 0 ? 0 : record.wins / record.matchesPlayed
  }));
}

export function sortStandings(
  records: CurrentSeasonRecord[],
  teamsById: Record<string, string>,
  rules: LeagueRules
): StandingRow[] {
  const sorted = [...records].sort((left, right) => {
    for (const key of rules.rankingTiebreakers) {
      const diff = getTiebreakValue(right, key) - getTiebreakValue(left, key);
      if (diff !== 0) {
        return diff;
      }
    }

    return teamsById[left.teamId].localeCompare(teamsById[right.teamId], "ko");
  });

  return sorted.map((record, index) => ({
    ...record,
    rank: index + 1,
    teamName: teamsById[record.teamId] ?? record.teamId
  }));
}

export function toPreviousSeasonStats(
  seasonId: string,
  standings: StandingRow[]
): PreviousSeasonStats[] {
  return standings.map((standing) => ({
    seasonId,
    teamId: standing.teamId,
    finalRank: standing.rank,
    wins: standing.wins,
    losses: standing.losses,
    setsWon: standing.setsWon,
    setsLost: standing.setsLost,
    setDiff: standing.setDiff,
    winRate: standing.winRate
  }));
}

export function aggregateSeasonResults(league: League, season: Season): {
  records: CurrentSeasonRecord[];
  standings: StandingRow[];
  summary: SeasonSummary;
  previousSeasonStats: PreviousSeasonStats[];
} {
  const seasonMatches = league.matches.filter((match) => match.seasonId === season.id);
  const records = buildCurrentSeasonRecords(season, seasonMatches);
  const teamsById = getSeasonTeamNameMap(league, season);
  const standings = sortStandings(records, teamsById, season.rules);
  const completedMatchCount = seasonMatches.filter((match) => match.played && match.result).length;
  const summary: SeasonSummary = {
    seasonId: season.id,
    championTeamId: standings[0]?.teamId ?? null,
    finalStandings: standings,
    completedMatchCount,
    totalMatchCount: seasonMatches.length
  };

  return {
    records,
    standings,
    summary,
    previousSeasonStats: toPreviousSeasonStats(season.id, standings)
  };
}
