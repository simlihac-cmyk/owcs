import { League, RegionCode, Season, Team } from "@/lib/types";

const REGION_LABELS: Record<RegionCode, string> = {
  korea: "코리아",
  japan: "일본",
  pacific: "퍼시픽",
  asia: "아시아",
  international: "국제",
  other: "기타"
};

export function getRegionLabel(region?: RegionCode | null): string {
  if (!region) {
    return "기타";
  }

  return REGION_LABELS[region] ?? region;
}

export function getTeamById(league: League, teamId: string): Team | null {
  return league.teams.find((team) => team.id === teamId) ?? null;
}

export function getTeamShortName(team: Team | null, fallback?: string): string {
  if (team?.shortName?.trim()) {
    return team.shortName.trim();
  }

  if (fallback?.trim()) {
    return fallback.trim();
  }

  return team?.name ?? "";
}

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

  return getTeamById(league, teamId)?.name ?? teamId;
}

export function getSeasonTeamNameMap(league: League, season: Season): Record<string, string> {
  return Object.fromEntries(
    season.teamIds.map((teamId) => [teamId, getSeasonTeamDisplayName(league, season.id, teamId)])
  );
}
