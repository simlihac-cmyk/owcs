"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeSeasonInsight, prepareSeasonInsightLeague } from "@/lib/domain/simulation";
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
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const simulationLeague = useMemo(() => {
    if (!seasonId) {
      return null;
    }

    return prepareSeasonInsightLeague(league, seasonId, predictionOverrides);
  }, [league, predictionOverrides, seasonId]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seasonId || !simulationLeague) {
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
        const insight = computeSeasonInsight(simulationLeague, seasonId);
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

    const worker =
      workerRef.current ?? new Worker(new URL("../workers/simulation.worker.ts", import.meta.url));
    workerRef.current = worker;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    worker.onmessage = (
      event: MessageEvent<{ requestId: number; type: string; payload: SeasonInsight | string }>
    ) => {
      if (!active) {
        return;
      }

      if (event.data.requestId !== requestId) {
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
        const insight = computeSeasonInsight(simulationLeague, seasonId);
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

    worker.postMessage({ requestId, league: simulationLeague, seasonId });

    return () => {
      active = false;
    };
  }, [revision, seasonId, simulationLeague]);

  return state;
}
