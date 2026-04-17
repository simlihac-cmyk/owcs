export type RankingTiebreaker = "wins" | "setDiff" | "setsWon";
export type RoundRobinType = "single" | "double";
export type SeasonStatus = "draft" | "ongoing" | "completed";
export type SeasonFormat = "league" | "tournament";
export type SeasonCategory = "subregion" | "regional" | "international";
export type RegionCode = "korea" | "japan" | "pacific" | "asia" | "international" | "other";
export type PhaseType =
  | "regular_season"
  | "playoffs"
  | "wild_card"
  | "main_event"
  | "groups"
  | "bracket";
export type BracketType =
  | "round_robin"
  | "single_elimination"
  | "double_elimination"
  | "swiss"
  | "hybrid";
export type EntrySourceType = "direct_qualifier" | "wild_card_winner" | "invited" | "carry_over";
export type QualifierType = "regional_top_finish" | "wild_card" | "partner_seed" | "points" | "manual";
export type QualificationOutcome =
  | "advance"
  | "wild_card"
  | "international_qualification"
  | "eliminated";
export type BracketSide = "upper" | "lower" | "grand_final" | "wild_card" | "group" | "other";

export interface Team {
  id: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
  primaryRegion?: RegionCode | null;
  aliases?: string[];
  logoPath?: string | null;
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

export interface TournamentConfig {
  bracketType: BracketType;
  defaultFirstTo: number;
  grandFinalFirstTo?: number | null;
  hasBracketReset: boolean;
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
  format: SeasonFormat;
  category: SeasonCategory;
  region: RegionCode;
  parentSeasonId?: string | null;
  qualificationTargetSeasonIds?: string[];
  tournamentConfig?: TournamentConfig | null;
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
  replayCodes?: string[];
  phaseId?: string | null;
  bracketSide?: BracketSide;
  roundNumber?: number | null;
  matchNumber?: number | null;
  firstTo?: number | null;
  isGrandFinal?: boolean;
  winnerToMatchId?: string | null;
  loserToMatchId?: string | null;
}

export interface SeasonPhase {
  id: string;
  seasonId: string;
  name: string;
  order: number;
  phaseType: PhaseType;
  bracketType: BracketType;
  teamIds: string[];
  startDate: string;
  endDate: string;
  metadata?: {
    advancesCount?: number;
    notes?: string;
    defaultFirstTo?: number;
    grandFinalFirstTo?: number;
    hasBracketReset?: boolean;
  };
}

export interface SeasonEntry {
  seasonId: string;
  teamId: string;
  phaseId?: string | null;
  seed: number;
  displaySeed?: string | null;
  entrySourceType: EntrySourceType;
  qualifierType: QualifierType;
  sourceSeasonId?: string | null;
  sourcePlacement?: number | null;
  metadata?: {
    subregion?: RegionCode;
    note?: string;
  };
}

export interface QualificationLink {
  id: string;
  sourceSeasonId: string;
  sourcePhaseId?: string | null;
  placementStart: number;
  placementEnd: number;
  qualificationType: QualificationOutcome;
  targetSeasonId: string;
  label: string;
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
  seasonPhases?: SeasonPhase[];
  seasonEntries?: SeasonEntry[];
  qualificationLinks?: QualificationLink[];
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
  format?: SeasonFormat;
  category?: SeasonCategory;
  region?: RegionCode;
  parentSeasonId?: string | null;
  qualificationTargetSeasonIds?: string[];
  tournamentConfig?: TournamentConfig | null;
}

export interface UpdateSeasonSettingsInput {
  seasonId: string;
  name?: string;
  priorSeasonId?: string | null;
  rules?: Partial<LeagueRules>;
  simulationConfig?: Partial<SimulationConfig>;
  format?: SeasonFormat;
  category?: SeasonCategory;
  region?: RegionCode;
  parentSeasonId?: string | null;
  qualificationTargetSeasonIds?: string[];
  tournamentConfig?: TournamentConfig | null;
  teamEdits?: {
    teamIds: string[];
    newTeams?: Team[];
    manualInitialRatings?: Record<string, number | null>;
  };
}
