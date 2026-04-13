/// <reference lib="webworker" />

import { computeSeasonInsight } from "@/lib/domain/simulation";
import { League, PredictionOverrides } from "@/lib/types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (
  event: MessageEvent<{ league: League; seasonId: string; predictionOverrides: PredictionOverrides }>
) => {
  try {
    const insight = computeSeasonInsight(
      event.data.league,
      event.data.seasonId,
      event.data.predictionOverrides
    );
    self.postMessage({
      type: "success",
      payload: insight
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Unknown worker error"
    });
  }
};

export {};
