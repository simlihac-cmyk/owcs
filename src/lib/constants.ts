import { LeagueRules, SimulationConfig, TournamentConfig } from "@/lib/types";

export const DEFAULT_LEAGUE_RULES: LeagueRules = {
  qualifierCount: 4,
  lcqQualifierCount: 4,
  rankingTiebreakers: ["wins", "setDiff", "setsWon"],
  roundRobinType: "single"
};

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  iterations: 4000,
  priorWeightDecay: 0.36,
  decimalPlaces: 1,
  shrinkageMatches: 5,
  opponentStrengthWeight: 0.42,
  setSkewFactor: 1.18
};

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  bracketType: "double_elimination",
  defaultFirstTo: 3,
  grandFinalFirstTo: 4,
  hasBracketReset: false
};

export const RESULT_OPTIONS = ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] as const;

export const BASE_RATING = 1500;
