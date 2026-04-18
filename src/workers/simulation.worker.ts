/// <reference lib="webworker" />

import { computeSeasonInsight } from "@/lib/domain/simulation";
import { League } from "@/lib/types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (
  event: MessageEvent<{ requestId: number; league: League; seasonId: string }>
) => {
  try {
    const insight = computeSeasonInsight(event.data.league, event.data.seasonId);
    self.postMessage({
      requestId: event.data.requestId,
      type: "success",
      payload: insight
    });
  } catch (error) {
    self.postMessage({
      requestId: event.data.requestId,
      type: "error",
      payload: error instanceof Error ? error.message : "Unknown worker error"
    });
  }
};

export {};
