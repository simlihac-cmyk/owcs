export type RankingTiebreaker = "wins" | "setDiff" | "setsWon";
export type RoundRobinType = "single" | "double";
export type SeasonStatus = "draft" | "ongoing" | "completed";

export interface Team {
  id: string;
  name: string;
}

export interface MatchResult {
  setsA: number;
  setsB: number;
}

export type PredictionOverrides = Record<string, MatchResult | null>;

export interface LeagueRules {
  qualifierCount: number;
  lcqQualifierCount: number;
  rankingTiebreakers: RankingTiebreaker[];
  roundRobinType: RoundRobinType;
}

export interface SimulationConfig {
  iterations: number;
  priorWeightDecay: number;
  decimalPlaces: number;
  shrinkageMatches: number;
  opponentStrengthWeight: number;
  setSkewFactor: number;
}

export interface Season {
  id: string;
  leagueId: string;
  name: string;
  year: number;
  order: number;
  teamIds: string[];
  rules: LeagueRules;
  priorSeasonId?: string | null;
  createdAt: string;
  updatedAt: string;
  status: SeasonStatus;
  simulationConfig: SimulationConfig;
}

export interface SeasonTeam {
  seasonId: string;
  teamId: string;
  manualInitialRating?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Match {
  id: string;
  seasonId: string;
  teamAId: string;
  teamBId: string;
  scheduledAt: string;
  played: boolean;
  result?: MatchResult | null;
}

export interface CurrentSeasonRecord {
  seasonId: string;
  teamId: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  matchesPlayed: number;
  winRate: number;
}

export interface PreviousSeasonStats {
  seasonId: string;
  teamId: string;
  finalRank: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  winRate: number;
}

export interface TeamProbabilitySummary {
  teamId: string;
  qualifierProbability: number;
  finishProbabilityByRank: Record<number, number>;
  averageFinalRank: number;
  expectedWins: number;
  expectedSetDiff: number;
}

export interface StandingRow extends CurrentSeasonRecord {
  rank: number;
  teamName: string;
}

export interface RatingBreakdown {
  teamId: string;
  initialRating: number;
  currentFormRating: number;
  blendedRating: number;
  priorWeight: number;
  currentWeight: number;
  manualInitialRating: number | null;
  previousSeasonRank: number | null;
  previousSeasonWinRate: number | null;
}

export interface MatchOutcomeImpact {
  resultLabel: string;
  qualifierProbabilityByTeamId: Record<string, number>;
  finishProbabilityByRankByTeamId: Record<string, Record<number, number>>;
  averageRankByTeamId: Record<string, number>;
  leaderTeamId: string | null;
  qualifierTeamIds: string[];
}

export interface RemainingMatchInsight {
  matchId: string;
  teamAId: string;
  teamBId: string;
  scheduledAt: string;
  teamAWinProbability: number;
  teamBWinProbability: number;
  mostLikelyResult: string;
  resultProbabilities: Record<string, number>;
  importanceScore: number;
  biggestSwingTeamId: string | null;
  biggestSwingValue: number;
  outcomes: MatchOutcomeImpact[];
}

export interface TiebreakNote {
  higherTeamId: string;
  lowerTeamId: string;
  reason: string;
}

export interface TeamTrendSummary {
  teamId: string;
  previousRank: number | null;
  expectedRank: number;
  deltaFromPreviousRank: number | null;
}

export interface SeasonSummary {
  seasonId: string;
  championTeamId: string | null;
  finalStandings: StandingRow[];
  completedMatchCount: number;
  totalMatchCount: number;
}

export interface League {
  id: string;
  name: string;
  teams: Team[];
  seasons: Season[];
  seasonTeams: SeasonTeam[];
  matches: Match[];
}

export interface ChangeLogEntry {
  id: string;
  createdAt: string;
  label: string;
  seasonId?: string | null;
}

export interface SavedScenarioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  league: League;
  selectedSeasonId: string | null;
}

export interface ExportedLeagueWorkspace {
  version: number;
  exportedAt: string;
  league: League;
  baselineLeague: League;
  predictionOverrides?: PredictionOverrides;
  selectedSeasonId: string | null;
  scenarioSnapshots: SavedScenarioSnapshot[];
  changeLog: ChangeLogEntry[];
}

export interface SeasonInsight {
  season: Season;
  currentStandings: StandingRow[];
  currentRecords: CurrentSeasonRecord[];
  summary: SeasonSummary;
  previousSeasonStats: PreviousSeasonStats[];
  probabilitySummaries: TeamProbabilitySummary[];
  ratingsByTeamId: Record<string, number>;
  ratingBreakdowns: RatingBreakdown[];
  completedMatches: Match[];
  remainingMatches: Match[];
  remainingMatchInsights: RemainingMatchInsight[];
  tiebreakNotes: TiebreakNote[];
  teamTrends: TeamTrendSummary[];
  priorBlend: {
    completionRatio: number;
    priorWeight: number;
    currentWeight: number;
  };
  simulationMeta: {
    iterations: number;
    analysisIterations: number;
    ranAt: string;
  };
}

export interface CreateSeasonInput {
  name: string;
  year: number;
  order: number;
  teamNames: string[];
  rules?: Partial<LeagueRules>;
  simulationConfig?: Partial<SimulationConfig>;
  priorSeasonId?: string | null;
  manualInitialRatings?: Record<string, number>;
}

export interface UpdateSeasonSettingsInput {
  seasonId: string;
  name?: string;
  priorSeasonId?: string | null;
  rules?: Partial<LeagueRules>;
  simulationConfig?: Partial<SimulationConfig>;
  teamEdits?: {
    teamIds: string[];
    newTeams?: Team[];
    manualInitialRatings?: Record<string, number | null>;
  };
}
