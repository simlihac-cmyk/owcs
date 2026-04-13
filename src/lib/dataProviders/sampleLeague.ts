import sampleLeagueJson from "../../../data/sample-league.json";
import { loadLeagueFromJson } from "@/lib/dataProviders/jsonAdapters";
import { League } from "@/lib/types";

export function loadSampleLeague(): League {
  return loadLeagueFromJson(sampleLeagueJson as unknown as League);
}
