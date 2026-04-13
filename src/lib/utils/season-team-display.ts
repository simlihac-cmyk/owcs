import { League, Season } from "@/lib/types";

export function getSeasonTeamDisplayName(
  league: League,
  seasonId: string,
  teamId: string
): string {
  const seasonTeam = league.seasonTeams.find(
    (candidate) => candidate.seasonId === seasonId && candidate.teamId === teamId
  );
  const displayName = seasonTeam?.metadata?.displayName;

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName;
  }

  return league.teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function getSeasonTeamNameMap(league: League, season: Season): Record<string, string> {
  return Object.fromEntries(
    season.teamIds.map((teamId) => [teamId, getSeasonTeamDisplayName(league, season.id, teamId)])
  );
}
