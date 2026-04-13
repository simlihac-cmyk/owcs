"use client";

import { useEffect, useState } from "react";
import { computeSeasonInsight } from "@/lib/domain/simulation";
import { League, PredictionOverrides, SeasonInsight } from "@/lib/types";

interface SeasonInsightState {
  insight: SeasonInsight | null;
  isLoading: boolean;
  error: string | null;
}

export function useSeasonInsight(
  league: League,
  seasonId: string | null,
  predictionOverrides: PredictionOverrides,
  revision: number
): SeasonInsightState {
  const [state, setState] = useState<SeasonInsightState>({
    insight: null,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (!seasonId) {
      setState({
        insight: null,
        isLoading: false,
        error: null
      });
      return;
    }

    let active = true;
    setState((current) => ({
      insight: current.insight?.season.id === seasonId ? current.insight : null,
      isLoading: true,
      error: null
    }));

    if (typeof Worker === "undefined") {
      try {
        const insight = computeSeasonInsight(league, seasonId, predictionOverrides);
        if (active) {
          setState({
            insight,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        if (active) {
          setState({
            insight: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Simulation failed"
          });
        }
      }

      return;
    }

    const worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url));

    worker.onmessage = (event: MessageEvent<{ type: string; payload: SeasonInsight | string }>) => {
      if (!active) {
        return;
      }

      if (event.data.type === "success") {
        setState({
          insight: event.data.payload as SeasonInsight,
          isLoading: false,
          error: null
        });
      } else {
        setState({
          insight: null,
          isLoading: false,
          error: event.data.payload as string
        });
      }
    };

    worker.onerror = () => {
      if (!active) {
        return;
      }

      try {
        const insight = computeSeasonInsight(league, seasonId, predictionOverrides);
        setState({
          insight,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setState({
          insight: null,
          isLoading: false,
          error: error instanceof Error ? error.message : "Simulation failed"
        });
      }
    };

    worker.postMessage({ league, seasonId, predictionOverrides });

    return () => {
      active = false;
      worker.terminate();
    };
  }, [league, seasonId, predictionOverrides, revision]);

  return state;
}
