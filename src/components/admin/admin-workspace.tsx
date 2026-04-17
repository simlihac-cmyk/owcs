"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LEAGUE_RULES,
  DEFAULT_SIMULATION_CONFIG,
  DEFAULT_TOURNAMENT_CONFIG,
  RESULT_OPTIONS
} from "@/lib/constants";
import { createSeasonShell, createTeamsFromNames, generateRoundRobinMatches } from "@/lib/domain/schedule";
import { formatDateTimeLabel } from "@/lib/utils/format";
import {
  BracketType,
  League,
  MatchResult,
  RegionCode,
  RoundRobinType,
  Season,
  SeasonCategory,
  SeasonFormat,
  SeasonStatus,
  Team
} from "@/lib/types";

interface AdminLeagueResponse {
  league: League;
  source: "file" | "sample";
  filePath: string;
  updatedAt: string | null;
  message?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface CreateSeasonFormState {
  name: string;
  year: number;
  order: number;
  teamText: string;
  priorSeasonId: string;
  format: SeasonFormat;
  category: SeasonCategory;
  region: RegionCode;
  parentSeasonId: string;
  qualificationTargetIdsText: string;
  bracketType: BracketType;
  defaultFirstTo: number;
  grandFinalFirstTo: number;
  hasBracketReset: boolean;
  qualifierCount: number;
  lcqQualifierCount: number;
  roundRobinType: RoundRobinType;
  iterations: number;
  decimalPlaces: number;
}

function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((left, right) => right.order - left.order);
}

function getDefaultSeasonId(league: League): string | null {
  return sortSeasons(league.seasons)[0]?.id ?? null;
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "아직 저장되지 않음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSeasonMatchCounts(league: League, seasonId: string) {
  const matches = league.matches.filter((match) => match.seasonId === seasonId);
  return {
    total: matches.length,
    played: matches.filter((match) => match.played && match.result).length
  };
}

function stringifyResult(result?: MatchResult | null): string {
  if (!result) {
    return "";
  }

  return `${result.setsA}:${result.setsB}`;
}

function parseResult(value: string): MatchResult | null {
  if (!value) {
    return null;
  }

  const [setsA, setsB] = value.split(":").map(Number);
  return { setsA, setsB };
}

function deriveSeasonStatus(matchesCount: number, playedCount: number): SeasonStatus {
  if (matchesCount > 0 && playedCount === matchesCount) {
    return "completed";
  }

  if (playedCount > 0) {
    return "ongoing";
  }

  return "draft";
}

function getReplayCodeCount(result: MatchResult | null | undefined): number {
  if (!result) {
    return 0;
  }

  return result.setsA + result.setsB;
}

function normalizeReplayCodes(replayCodes: string[] | undefined, result: MatchResult | null | undefined): string[] {
  const targetLength = getReplayCodeCount(result);

  if (targetLength === 0) {
    return [];
  }

  return Array.from({ length: targetLength }, (_, index) => replayCodes?.[index] ?? "");
}

function dedupeTeamNames(teamNames: string[]): string[] {
  return Array.from(
    new Set(
      teamNames
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );
}

function parseQualificationTargetIds(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveTeamPool(league: League, teamNames: string[]) {
  const normalizedMap = new Map(league.teams.map((team) => [team.name.toLowerCase(), team]));
  const newTeams: Team[] = [];
  const teamIds = dedupeTeamNames(teamNames).map((teamName) => {
    const existing = normalizedMap.get(teamName.toLowerCase());

    if (existing) {
      return existing.id;
    }

    const nextTeam = createTeamsFromNames([teamName])[0];
    newTeams.push(nextTeam);
    normalizedMap.set(teamName.toLowerCase(), nextTeam);
    return nextTeam.id;
  });

  return { teamIds, newTeams };
}

function getLatestSeason(league: League): Season | null {
  return sortSeasons(league.seasons)[0] ?? null;
}

function buildCreateSeasonFormState(league: League): CreateSeasonFormState {
  const latestSeason = getLatestSeason(league);

  return {
    name: latestSeason ? `${latestSeason.year} 새 스테이지` : "2026 새 스테이지",
    year: latestSeason?.year ?? 2026,
    order: latestSeason ? latestSeason.order + 1 : 1,
    teamText: latestSeason
      ? latestSeason.teamIds
          .map((teamId) => league.teams.find((team) => team.id === teamId)?.name ?? "")
          .filter(Boolean)
          .join("\n")
      : "",
    priorSeasonId: latestSeason?.id ?? "",
    format: latestSeason?.format ?? "league",
    category: latestSeason?.category ?? "subregion",
    region: latestSeason?.region ?? "korea",
    parentSeasonId: latestSeason?.parentSeasonId ?? "",
    qualificationTargetIdsText: (latestSeason?.qualificationTargetSeasonIds ?? []).join("\n"),
    bracketType: latestSeason?.tournamentConfig?.bracketType ?? DEFAULT_TOURNAMENT_CONFIG.bracketType,
    defaultFirstTo:
      latestSeason?.tournamentConfig?.defaultFirstTo ?? DEFAULT_TOURNAMENT_CONFIG.defaultFirstTo,
    grandFinalFirstTo:
      latestSeason?.tournamentConfig?.grandFinalFirstTo ?? DEFAULT_TOURNAMENT_CONFIG.grandFinalFirstTo ?? 4,
    hasBracketReset:
      latestSeason?.tournamentConfig?.hasBracketReset ?? DEFAULT_TOURNAMENT_CONFIG.hasBracketReset,
    qualifierCount: latestSeason?.rules.qualifierCount ?? DEFAULT_LEAGUE_RULES.qualifierCount,
    lcqQualifierCount: latestSeason?.rules.lcqQualifierCount ?? DEFAULT_LEAGUE_RULES.lcqQualifierCount,
    roundRobinType: latestSeason?.rules.roundRobinType ?? DEFAULT_LEAGUE_RULES.roundRobinType,
    iterations: latestSeason?.simulationConfig.iterations ?? DEFAULT_SIMULATION_CONFIG.iterations,
    decimalPlaces: latestSeason?.simulationConfig.decimalPlaces ?? DEFAULT_SIMULATION_CONFIG.decimalPlaces
  };
}

export function AdminWorkspace() {
  const [serverLeague, setServerLeague] = useState<League | null>(null);
  const [draftLeague, setDraftLeague] = useState<League | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [source, setSource] = useState<"file" | "sample">("sample");
  const [filePath, setFilePath] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState("관리자 원본 데이터를 불러오는 중입니다.");
  const [showCreateSeasonForm, setShowCreateSeasonForm] = useState(false);
  const [createSeasonForm, setCreateSeasonForm] = useState<CreateSeasonFormState | null>(null);

  const orderedSeasons = useMemo(
    () => (draftLeague ? sortSeasons(draftLeague.seasons) : []),
    [draftLeague]
  );

  const selectedSeason = useMemo(
    () => orderedSeasons.find((season) => season.id === selectedSeasonId) ?? null,
    [orderedSeasons, selectedSeasonId]
  );

  const isDirty = useMemo(() => {
    if (!serverLeague || !draftLeague) {
      return false;
    }

    return JSON.stringify(serverLeague) !== JSON.stringify(draftLeague);
  }, [draftLeague, serverLeague]);

  async function loadLeague() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/league", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("관리자 원본 데이터를 불러오지 못했습니다.");
      }

      const payload = (await response.json()) as AdminLeagueResponse;
      const defaultSeasonId = getDefaultSeasonId(payload.league);

      setServerLeague(payload.league);
      setDraftLeague(payload.league);
      setSelectedSeasonId((current) =>
        current && payload.league.seasons.some((season) => season.id === current)
          ? current
          : defaultSeasonId
      );
      setSource(payload.source);
      setFilePath(payload.filePath);
      setUpdatedAt(payload.updatedAt);
      setSaveState("idle");
      setCreateSeasonForm(buildCreateSeasonFormState(payload.league));
      setStatusMessage(
        payload.source === "file"
          ? "파일 기반 관리자 원본을 불러왔습니다."
          : "아직 관리자 원본 파일이 없어 샘플 데이터를 기준으로 작업 중입니다."
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeague();
  }, []);

  function updateSeason(
    seasonId: string,
    updater: (season: Season) => Season
  ) {
    setDraftLeague((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        seasons: current.seasons.map((season) =>
          season.id === seasonId
            ? {
                ...updater(season),
                updatedAt: new Date().toISOString()
              }
            : season
        )
      };
    });
    setSaveState("idle");
  }

  function updateTeamName(teamId: string, nextName: string) {
    setDraftLeague((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        teams: current.teams.map((team) =>
          team.id === teamId
            ? {
                ...team,
                name: nextName
              }
            : team
        )
      };
    });
    setSaveState("idle");
  }

  function updateMatchResult(matchId: string, result: MatchResult | null) {
    setDraftLeague((current) => {
      if (!current || !selectedSeason) {
        return current;
      }

      const nextMatches = current.matches.map((match) =>
        match.id === matchId
          ? {
              ...match,
              played: Boolean(result),
              result,
              replayCodes: normalizeReplayCodes(match.replayCodes, result)
            }
          : match
      );
      const seasonMatches = nextMatches.filter((match) => match.seasonId === selectedSeason.id);
      const playedCount = seasonMatches.filter((match) => match.played && match.result).length;

      return {
        ...current,
        matches: nextMatches,
        seasons: current.seasons.map((season) =>
          season.id === selectedSeason.id
            ? {
                ...season,
                status: deriveSeasonStatus(seasonMatches.length, playedCount),
                updatedAt: new Date().toISOString()
              }
            : season
        )
      };
    });
    setSaveState("idle");
  }

  function updateMatchReplayCode(matchId: string, replayIndex: number, nextValue: string) {
    setDraftLeague((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        matches: current.matches.map((match) => {
          if (match.id !== matchId) {
            return match;
          }

          const replayCodes = normalizeReplayCodes(match.replayCodes, match.result);
          replayCodes[replayIndex] = nextValue;

          return {
            ...match,
            replayCodes
          };
        })
      };
    });
    setSaveState("idle");
  }

  function updateCreateSeasonForm<Key extends keyof CreateSeasonFormState>(
    key: Key,
    value: CreateSeasonFormState[Key]
  ) {
    setCreateSeasonForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value
      };
    });
  }

  function handleCreateSeason() {
    if (!draftLeague || !createSeasonForm) {
      return;
    }

    const teamNames = createSeasonForm.teamText.split(/[\n,]+/);
    const { teamIds, newTeams } = resolveTeamPool(draftLeague, teamNames);

    if (teamIds.length < 2) {
      setError("새 시즌에는 최소 2개 이상의 팀이 필요합니다.");
      setStatusMessage("새 시즌에는 최소 2개 이상의 팀이 필요합니다.");
      return;
    }

    const shell = createSeasonShell({
      leagueId: draftLeague.id,
      name: createSeasonForm.name.trim() || "새 시즌",
      year: createSeasonForm.year,
      order: createSeasonForm.order,
      teamIds,
      priorSeasonId: createSeasonForm.priorSeasonId || null
    });

    const nextSeason: Season = {
      ...shell.season,
      name: createSeasonForm.name.trim() || shell.season.name,
      year: createSeasonForm.year,
      order: createSeasonForm.order,
      priorSeasonId: createSeasonForm.priorSeasonId || null,
      format: createSeasonForm.format,
      category: createSeasonForm.category,
      region: createSeasonForm.region,
      parentSeasonId: createSeasonForm.parentSeasonId || null,
      qualificationTargetSeasonIds: parseQualificationTargetIds(createSeasonForm.qualificationTargetIdsText),
      tournamentConfig:
        createSeasonForm.format === "tournament"
          ? {
              bracketType: createSeasonForm.bracketType,
              defaultFirstTo: createSeasonForm.defaultFirstTo,
              grandFinalFirstTo: createSeasonForm.grandFinalFirstTo,
              hasBracketReset: createSeasonForm.hasBracketReset
            }
          : null,
      rules: {
        ...shell.season.rules,
        qualifierCount: createSeasonForm.qualifierCount,
        lcqQualifierCount: createSeasonForm.lcqQualifierCount,
        roundRobinType: createSeasonForm.roundRobinType
      },
      simulationConfig: {
        ...shell.season.simulationConfig,
        iterations: createSeasonForm.iterations,
        decimalPlaces: createSeasonForm.decimalPlaces
      }
    };

    const nextLeague: League = {
      ...draftLeague,
      teams: [...draftLeague.teams, ...newTeams],
      seasons: [...draftLeague.seasons, nextSeason].sort((left, right) => left.order - right.order),
      seasonTeams: [
        ...draftLeague.seasonTeams.filter((item) => item.seasonId !== nextSeason.id),
        ...teamIds.map((teamId) => ({
          seasonId: nextSeason.id,
          teamId,
          manualInitialRating: null
        }))
      ],
      matches:
        nextSeason.format === "league"
          ? [
              ...draftLeague.matches,
              ...generateRoundRobinMatches(
                nextSeason.id,
                teamIds,
                createSeasonForm.roundRobinType,
                nextSeason.createdAt
              )
            ]
          : draftLeague.matches
    };

    setDraftLeague(nextLeague);
    setSelectedSeasonId(nextSeason.id);
    setCreateSeasonForm(buildCreateSeasonFormState(nextLeague));
    setShowCreateSeasonForm(false);
    setError(null);
    setSaveState("idle");
    setStatusMessage(`"${nextSeason.name}" 시즌 초안을 만들었습니다. 원본 저장을 눌러 반영하세요.`);
  }

  function handleDeleteSeason() {
    if (!draftLeague || !selectedSeason) {
      return;
    }

    if (draftLeague.seasons.length <= 1) {
      setError("마지막 시즌은 삭제할 수 없습니다.");
      setStatusMessage("마지막 시즌은 삭제할 수 없습니다.");
      return;
    }

    const shouldDelete = window.confirm(
      `"${selectedSeason.name}" 시즌을 삭제할까요? 연결된 경기와 시즌팀 데이터도 함께 삭제됩니다.`
    );

    if (!shouldDelete) {
      return;
    }

    const remainingSeasons = draftLeague.seasons
      .filter((season) => season.id !== selectedSeason.id)
      .map((season) =>
        season.priorSeasonId === selectedSeason.id
          ? {
              ...season,
              priorSeasonId: null,
              updatedAt: new Date().toISOString()
            }
          : season
      );
    const nextLeague: League = {
      ...draftLeague,
      seasons: remainingSeasons,
      seasonTeams: draftLeague.seasonTeams.filter((item) => item.seasonId !== selectedSeason.id),
      matches: draftLeague.matches.filter((match) => match.seasonId !== selectedSeason.id),
      seasonPhases: (draftLeague.seasonPhases ?? []).filter((phase) => phase.seasonId !== selectedSeason.id),
      seasonEntries: (draftLeague.seasonEntries ?? []).filter((entry) => entry.seasonId !== selectedSeason.id),
      qualificationLinks: (draftLeague.qualificationLinks ?? []).filter(
        (link) => link.sourceSeasonId !== selectedSeason.id
      )
    };
    const nextSelectedSeason = sortSeasons(remainingSeasons)[0] ?? null;

    setDraftLeague(nextLeague);
    setSelectedSeasonId(nextSelectedSeason?.id ?? null);
    setCreateSeasonForm(buildCreateSeasonFormState(nextLeague));
    setError(null);
    setSaveState("idle");
    setStatusMessage(`"${selectedSeason.name}" 시즌을 삭제했습니다. 원본 저장을 눌러 반영하세요.`);
  }

  async function handleSave() {
    if (!draftLeague) {
      return;
    }

    setSaveState("saving");
    setError(null);

    try {
      const response = await fetch("/api/admin/league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          league: draftLeague
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "관리자 원본 저장에 실패했습니다.");
      }

      const payload = (await response.json()) as AdminLeagueResponse;
      setServerLeague(payload.league);
      setDraftLeague(payload.league);
      setSource(payload.source);
      setFilePath(payload.filePath);
      setUpdatedAt(payload.updatedAt);
      setSaveState("saved");
      setStatusMessage(payload.message ?? "관리자 원본 데이터를 저장했습니다.");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "저장 중 알 수 없는 오류가 발생했습니다.";
      setSaveState("error");
      setError(message);
      setStatusMessage(message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-600">
        관리자 원본 데이터를 불러오는 중입니다.
      </div>
    );
  }

  if (!draftLeague || !selectedSeason) {
    return (
      <div className="ow-cut-panel rounded-[28px] px-8 py-14 text-center text-slate-600">
        관리자에서 편집할 시즌 데이터를 찾지 못했습니다.
      </div>
    );
  }

  const currentTeams = selectedSeason.teamIds
    .map((teamId) => draftLeague.teams.find((team) => team.id === teamId))
    .filter((team): team is NonNullable<typeof team> => Boolean(team));
  const selectedSeasonMatches = draftLeague.matches
    .filter((match) => match.seasonId === selectedSeason.id)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const matchCounts = getSeasonMatchCounts(draftLeague, selectedSeason.id);

  return (
    <div className="ow-shell">
      <div className="mx-auto flex min-h-screen max-w-[1760px] flex-col gap-6 px-4 py-6">
        <section className="ow-cut-panel rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="ow-badge inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                관리자 페이지
              </span>
              <div>
                <h1 className="text-3xl font-semibold text-[var(--ow-text)]">OWCS 운영 원본 관리</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  이 화면은 시즌 원본 데이터와 규칙을 운영자 기준으로 수정하는 한국어 백오피스 초안입니다.
                  현재는 개발용으로 열어두었고, 운영 배포 시에는 `/admin` 경로를 별도 보호하는 것을 전제로
                  설계했습니다.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="ow-panel-light rounded-[24px] px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">데이터 원천</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {source === "file" ? "관리자 원본 파일" : "샘플 fallback"}
                </div>
              </div>
              <div className="ow-panel-light rounded-[24px] px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">시즌 수</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{draftLeague.seasons.length}개</div>
              </div>
              <div className="ow-panel-light rounded-[24px] px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">팀 수</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{draftLeague.teams.length}개</div>
              </div>
              <div className="ow-panel-light rounded-[24px] px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">최종 저장</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateLabel(updatedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="ow-panel-light rounded-[28px] px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">시즌 선택</h2>
                  <p className="mt-1 text-sm text-slate-500">수정할 시즌을 선택하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadLeague()}
                  className="ow-ghost-button rounded-full px-4 py-2 text-sm font-medium"
                >
                  다시 불러오기
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {orderedSeasons.map((season) => {
                  const counts = getSeasonMatchCounts(draftLeague, season.id);
                  const active = season.id === selectedSeason.id;

                  return (
                    <button
                      key={season.id}
                      type="button"
                      onClick={() => setSelectedSeasonId(season.id)}
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                        active
                          ? "border-[rgba(242,139,47,0.45)] bg-[rgba(242,139,47,0.12)]"
                          : "border-[rgba(17,24,39,0.08)] bg-white/70 hover:border-[rgba(242,139,47,0.24)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-slate-900">{season.name}</strong>
                        <span className="ow-badge rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase">
                          {season.status}
                        </span>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">
                        {season.year} 시즌 · 경기 {counts.played}/{counts.total}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ow-panel-light rounded-[28px] px-5 py-5 text-sm text-slate-600">
              <h3 className="text-base font-semibold text-slate-900">작업 메모</h3>
              <ul className="mt-3 space-y-2 leading-6">
                <li>현재 단계에서는 시즌 기본 정보와 규칙 중심으로 편집합니다.</li>
                <li>일반 사용자용 공개 화면과 관리자 원본 저장 흐름을 분리했습니다.</li>
                <li>운영 배포 시 `/admin`은 별도 접근 보호가 필요합니다.</li>
              </ul>
              <p className="mt-4 break-all rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
                저장 경로: {filePath || "아직 관리자 원본 파일이 생성되지 않았습니다."}
              </p>
            </div>
          </aside>

          <main className="space-y-6">
            <div className="ow-cut-panel rounded-[28px] px-6 py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedSeason.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    시즌 메타 정보, 진출 구조, 시뮬레이션 파라미터를 한국어 운영자 화면에서 수정할 수 있게
                    준비한 1차 편집 화면입니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSeasonForm((current) => !current);
                      setCreateSeasonForm(buildCreateSeasonFormState(draftLeague));
                    }}
                    className="ow-ghost-button rounded-full px-4 py-2 text-sm font-medium"
                  >
                    {showCreateSeasonForm ? "시즌 생성 닫기" : "새 시즌 만들기"}
                  </button>
                  <span
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                      isDirty ? "ow-status-ready" : "ow-status-done"
                    }`}
                  >
                    {isDirty ? "저장되지 않은 변경사항 있음" : "원본과 동기화됨"}
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteSeason}
                    disabled={draftLeague.seasons.length <= 1}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    선택 시즌 삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftLeague(serverLeague)}
                    disabled={!isDirty || !serverLeague}
                    className="ow-ghost-button rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    변경 취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!isDirty || saveState === "saving"}
                    className="ow-primary-button rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {saveState === "saving" ? "저장 중..." : "원본 저장"}
                  </button>
                </div>
              </div>

              <p className={`mt-4 text-sm ${error ? "text-red-600" : "text-slate-500"}`}>
                {statusMessage}
              </p>
            </div>

            {showCreateSeasonForm && createSeasonForm ? (
              <div className="ow-panel-light rounded-[28px] px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">새 시즌 만들기</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      관리자 원본에 새 시즌 초안을 추가합니다. 저장 전까지는 현재 draft에만 반영됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSeasonForm(false);
                      setCreateSeasonForm(buildCreateSeasonFormState(draftLeague));
                    }}
                    className="ow-ghost-button rounded-full px-4 py-2 text-sm font-medium"
                  >
                    닫기
                  </button>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-600">
                    <span>시즌명</span>
                    <input
                      value={createSeasonForm.name}
                      onChange={(event) => updateCreateSeasonForm("name", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>연도</span>
                      <input
                        type="number"
                        value={createSeasonForm.year}
                        onChange={(event) => updateCreateSeasonForm("year", Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>표시 순서</span>
                      <input
                        type="number"
                        value={createSeasonForm.order}
                        onChange={(event) => updateCreateSeasonForm("order", Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-600">
                    <span>참가 팀 목록</span>
                    <textarea
                      rows={8}
                      value={createSeasonForm.teamText}
                      onChange={(event) => updateCreateSeasonForm("teamText", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      placeholder="한 줄에 한 팀씩 입력하거나 쉼표로 구분해 주세요."
                    />
                  </label>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>시즌 형식</span>
                        <select
                          value={createSeasonForm.format}
                          onChange={(event) =>
                            updateCreateSeasonForm("format", event.target.value as SeasonFormat)
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="league">league</option>
                          <option value="tournament">tournament</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>분류</span>
                        <select
                          value={createSeasonForm.category}
                          onChange={(event) =>
                            updateCreateSeasonForm("category", event.target.value as SeasonCategory)
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="subregion">subregion</option>
                          <option value="regional">regional</option>
                          <option value="international">international</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>지역</span>
                        <select
                          value={createSeasonForm.region}
                          onChange={(event) =>
                            updateCreateSeasonForm("region", event.target.value as RegionCode)
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="korea">korea</option>
                          <option value="japan">japan</option>
                          <option value="pacific">pacific</option>
                          <option value="asia">asia</option>
                          <option value="international">international</option>
                          <option value="other">other</option>
                        </select>
                      </label>
                    </div>

                    <label className="space-y-2 text-sm text-slate-600">
                      <span>이전 시즌 기준</span>
                      <select
                        value={createSeasonForm.priorSeasonId}
                        onChange={(event) => updateCreateSeasonForm("priorSeasonId", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="">없음</option>
                        {orderedSeasons.map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-600">
                      <span>부모 시즌 ID</span>
                      <input
                        value={createSeasonForm.parentSeasonId}
                        onChange={(event) => updateCreateSeasonForm("parentSeasonId", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        placeholder="없으면 비워둠"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-slate-600">
                      <span>다음 대회 ID 목록</span>
                      <textarea
                        rows={3}
                        value={createSeasonForm.qualificationTargetIdsText}
                        onChange={(event) =>
                          updateCreateSeasonForm("qualificationTargetIdsText", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        placeholder="한 줄에 하나씩 또는 쉼표로 구분"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>시드 결정전 진출 팀 수</span>
                        <input
                          type="number"
                          min={1}
                          value={createSeasonForm.qualifierCount}
                          onChange={(event) =>
                            updateCreateSeasonForm("qualifierCount", Number(event.target.value))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>LCQ 진출 팀 수</span>
                        <input
                          type="number"
                          min={0}
                          value={createSeasonForm.lcqQualifierCount}
                          onChange={(event) =>
                            updateCreateSeasonForm("lcqQualifierCount", Number(event.target.value))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>라운드로빈 방식</span>
                        <select
                          value={createSeasonForm.roundRobinType}
                          onChange={(event) =>
                            updateCreateSeasonForm(
                              "roundRobinType",
                              event.target.value as RoundRobinType
                            )
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                          disabled={createSeasonForm.format !== "league"}
                        >
                          <option value="single">single</option>
                          <option value="double">double</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>시뮬레이션 횟수</span>
                        <input
                          type="number"
                          min={500}
                          step={500}
                          value={createSeasonForm.iterations}
                          onChange={(event) => updateCreateSeasonForm("iterations", Number(event.target.value))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>소수점 자리수</span>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={createSeasonForm.decimalPlaces}
                          onChange={(event) =>
                            updateCreateSeasonForm("decimalPlaces", Number(event.target.value))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                    </div>

                    {createSeasonForm.format === "tournament" ? (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="space-y-2 text-sm text-slate-600">
                          <span>브래킷 타입</span>
                          <select
                            value={createSeasonForm.bracketType}
                            onChange={(event) =>
                              updateCreateSeasonForm("bracketType", event.target.value as BracketType)
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                          >
                            <option value="double_elimination">double_elimination</option>
                            <option value="single_elimination">single_elimination</option>
                            <option value="round_robin">round_robin</option>
                            <option value="swiss">swiss</option>
                            <option value="hybrid">hybrid</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-sm text-slate-600">
                          <span>기본 FT</span>
                          <input
                            type="number"
                            min={1}
                            value={createSeasonForm.defaultFirstTo}
                            onChange={(event) =>
                              updateCreateSeasonForm("defaultFirstTo", Number(event.target.value))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-slate-600">
                          <span>결승 FT</span>
                          <input
                            type="number"
                            min={1}
                            value={createSeasonForm.grandFinalFirstTo}
                            onChange={(event) =>
                              updateCreateSeasonForm("grandFinalFirstTo", Number(event.target.value))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                          />
                        </label>
                        <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={createSeasonForm.hasBracketReset}
                            onChange={(event) =>
                              updateCreateSeasonForm("hasBracketReset", event.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          <span>브래킷 리셋 사용</span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateSeason}
                    className="ow-primary-button rounded-full px-5 py-2.5 text-sm font-semibold"
                  >
                    시즌 초안 추가
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="ow-panel-light rounded-[28px] px-5 py-5">
                <h3 className="text-lg font-semibold text-slate-900">시즌 기본 정보</h3>
                <div className="mt-4 grid gap-4">
                  <label className="space-y-2 text-sm text-slate-600">
                    <span>시즌명</span>
                    <input
                      value={selectedSeason.name}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          name: event.target.value
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>연도</span>
                      <input
                        type="number"
                        value={selectedSeason.year}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            year: Number(event.target.value)
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>표시 순서</span>
                      <input
                        type="number"
                        value={selectedSeason.order}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            order: Number(event.target.value)
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>시즌 형식</span>
                      <select
                        value={selectedSeason.format}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            format: event.target.value as SeasonFormat,
                            tournamentConfig:
                              event.target.value === "tournament"
                                ? season.tournamentConfig ?? { ...DEFAULT_TOURNAMENT_CONFIG }
                                : null
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="league">league</option>
                        <option value="tournament">tournament</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>분류</span>
                      <select
                        value={selectedSeason.category}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            category: event.target.value as SeasonCategory
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="subregion">subregion</option>
                        <option value="regional">regional</option>
                        <option value="international">international</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>지역</span>
                      <select
                        value={selectedSeason.region}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            region: event.target.value as RegionCode
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="korea">korea</option>
                        <option value="japan">japan</option>
                        <option value="pacific">pacific</option>
                        <option value="asia">asia</option>
                        <option value="international">international</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-slate-600">
                    <span>상태</span>
                    <select
                      value={selectedSeason.status}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          status: event.target.value as SeasonStatus
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <option value="draft">draft</option>
                      <option value="ongoing">ongoing</option>
                      <option value="completed">completed</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-slate-600">
                    <span>Prior 시즌</span>
                    <select
                      value={selectedSeason.priorSeasonId ?? ""}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          priorSeasonId: event.target.value || null
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <option value="">없음</option>
                      {orderedSeasons
                        .filter((season) => season.id !== selectedSeason.id)
                        .map((season) => (
                          <option key={season.id} value={season.id}>
                            {season.name}
                      </option>
                    ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-slate-600">
                    <span>부모 시즌 ID</span>
                    <input
                      value={selectedSeason.parentSeasonId ?? ""}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          parentSeasonId: event.target.value || null
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-600">
                    <span>다음 대회 ID 목록</span>
                    <textarea
                      rows={3}
                      value={(selectedSeason.qualificationTargetSeasonIds ?? []).join("\n")}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          qualificationTargetSeasonIds: parseQualificationTargetIds(event.target.value)
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>
                </div>
              </div>

              <div className="ow-panel-light rounded-[28px] px-5 py-5">
                <h3 className="text-lg font-semibold text-slate-900">시즌 규칙</h3>
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>시드 결정전 진출 팀 수</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedSeason.rules.qualifierCount}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            rules: {
                              ...season.rules,
                              qualifierCount: Number(event.target.value)
                            }
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>LCQ 진출 팀 수</span>
                      <input
                        type="number"
                        min={0}
                        value={selectedSeason.rules.lcqQualifierCount}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            rules: {
                              ...season.rules,
                              lcqQualifierCount: Number(event.target.value)
                            }
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-slate-600">
                    <span>라운드로빈 방식</span>
                    <select
                      value={selectedSeason.rules.roundRobinType}
                      onChange={(event) =>
                        updateSeason(selectedSeason.id, (season) => ({
                          ...season,
                          rules: {
                            ...season.rules,
                            roundRobinType: event.target.value as RoundRobinType
                          }
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      disabled={selectedSeason.format !== "league"}
                    >
                      <option value="single">single</option>
                      <option value="double">double</option>
                    </select>
                  </label>

                  {selectedSeason.format === "tournament" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>브래킷 타입</span>
                        <select
                          value={selectedSeason.tournamentConfig?.bracketType ?? DEFAULT_TOURNAMENT_CONFIG.bracketType}
                          onChange={(event) =>
                            updateSeason(selectedSeason.id, (season) => ({
                              ...season,
                              tournamentConfig: {
                                ...(season.tournamentConfig ?? DEFAULT_TOURNAMENT_CONFIG),
                                bracketType: event.target.value as BracketType
                              }
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="double_elimination">double_elimination</option>
                          <option value="single_elimination">single_elimination</option>
                          <option value="round_robin">round_robin</option>
                          <option value="swiss">swiss</option>
                          <option value="hybrid">hybrid</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>기본 FT</span>
                        <input
                          type="number"
                          min={1}
                          value={selectedSeason.tournamentConfig?.defaultFirstTo ?? DEFAULT_TOURNAMENT_CONFIG.defaultFirstTo}
                          onChange={(event) =>
                            updateSeason(selectedSeason.id, (season) => ({
                              ...season,
                              tournamentConfig: {
                                ...(season.tournamentConfig ?? DEFAULT_TOURNAMENT_CONFIG),
                                defaultFirstTo: Number(event.target.value)
                              }
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-600">
                        <span>결승 FT</span>
                        <input
                          type="number"
                          min={1}
                          value={selectedSeason.tournamentConfig?.grandFinalFirstTo ?? DEFAULT_TOURNAMENT_CONFIG.grandFinalFirstTo ?? 4}
                          onChange={(event) =>
                            updateSeason(selectedSeason.id, (season) => ({
                              ...season,
                              tournamentConfig: {
                                ...(season.tournamentConfig ?? DEFAULT_TOURNAMENT_CONFIG),
                                grandFinalFirstTo: Number(event.target.value)
                              }
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </label>
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedSeason.tournamentConfig?.hasBracketReset ?? DEFAULT_TOURNAMENT_CONFIG.hasBracketReset}
                          onChange={(event) =>
                            updateSeason(selectedSeason.id, (season) => ({
                              ...season,
                              tournamentConfig: {
                                ...(season.tournamentConfig ?? DEFAULT_TOURNAMENT_CONFIG),
                                hasBracketReset: event.target.checked
                              }
                            }))
                          }
                          className="h-4 w-4"
                        />
                        <span>브래킷 리셋 사용</span>
                      </label>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>시뮬레이션 반복 횟수</span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={selectedSeason.simulationConfig.iterations}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            simulationConfig: {
                              ...season.simulationConfig,
                              iterations: Number(event.target.value)
                            }
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span>표시 소수점 자리수</span>
                      <input
                        type="number"
                        min={0}
                        max={4}
                        value={selectedSeason.simulationConfig.decimalPlaces}
                        onChange={(event) =>
                          updateSeason(selectedSeason.id, (season) => ({
                            ...season,
                            simulationConfig: {
                              ...season.simulationConfig,
                              decimalPlaces: Number(event.target.value)
                            }
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="ow-panel-light rounded-[28px] px-5 py-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">시즌 팀 구성</h3>
                  <span className="text-sm text-slate-500">{currentTeams.length}개 팀</span>
                </div>

                <div className="mt-4 space-y-3">
                  {currentTeams.map((team) => (
                    <label
                      key={team.id}
                      className="flex flex-col gap-2 rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-600"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        팀명
                      </span>
                      <input
                        value={team.name}
                        onChange={(event) => updateTeamName(team.id, event.target.value)}
                        className="rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="ow-panel-light rounded-[28px] px-5 py-5">
                  <h3 className="text-lg font-semibold text-slate-900">현재 시즌 요약</h3>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">경기 진행도</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {matchCounts.played} / {matchCounts.total}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">마지막 수정 시각</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatDateLabel(selectedSeason.updatedAt)}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white/70 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">관리자 저장 상태</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{statusMessage}</div>
                    </div>
                  </div>
                </div>

                <div className="ow-panel-light rounded-[28px] px-5 py-5">
                  <h3 className="text-lg font-semibold text-slate-900">다음 단계</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>경기 결과 직접 편집 UI 연결</li>
                    <li>시즌 생성 / 삭제 기능 추가</li>
                    <li>관리자 변경 이력과 백업 복원 기능 추가</li>
                    <li>운영 배포 시 Cloudflare Access 보호 적용</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="ow-panel-light rounded-[28px] px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">경기 결과 관리</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    운영 원본 기준으로 경기 결과를 직접 입력하거나 되돌릴 수 있습니다.
                  </p>
                </div>
                <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600">
                  완료 {matchCounts.played} / 전체 {matchCounts.total}
                </div>
              </div>

              {selectedSeasonMatches.length === 0 ? (
                <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center text-sm text-slate-500">
                  이 시즌에는 등록된 경기가 없습니다.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedSeasonMatches.map((match) => {
                    const teamA = draftLeague.teams.find((team) => team.id === match.teamAId)?.name ?? match.teamAId;
                    const teamB = draftLeague.teams.find((team) => team.id === match.teamBId)?.name ?? match.teamBId;
                    const activeResult = stringifyResult(match.result);
                    const replayCodeCount = getReplayCodeCount(match.result);
                    const replayCodes = normalizeReplayCodes(match.replayCodes, match.result);

                    return (
                      <div
                        key={match.id}
                        className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-base text-slate-900">
                                {teamA} vs {teamB}
                              </strong>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  match.result
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {match.result ? `기록됨 ${activeResult}` : "미기록"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              일정: {formatDateTimeLabel(match.scheduledAt)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {RESULT_OPTIONS.map((option) => {
                              const isActive = activeResult === option;

                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => updateMatchResult(match.id, parseResult(option))}
                                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                                    isActive
                                      ? "bg-[linear-gradient(135deg,#ffbf69,#f28b2f)] text-[#101722] shadow-[0_8px_24px_rgba(242,139,47,0.28)]"
                                      : "border border-slate-200 bg-white text-slate-600 hover:border-[#f28b2f] hover:text-[#c86c1d]"
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => updateMatchResult(match.id, null)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              결과 지우기
                            </button>
                          </div>
                        </div>

                        {replayCodeCount > 0 ? (
                          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">리플레이 코드</p>
                              <span className="text-xs text-slate-500">{replayCodeCount}개 맵</span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              {replayCodes.map((replayCode, replayIndex) => (
                                <label
                                  key={`${match.id}-replay-${replayIndex + 1}`}
                                  className="space-y-2 text-sm text-slate-600"
                                >
                                  <span>맵 {replayIndex + 1}</span>
                                  <input
                                    value={replayCode}
                                    onChange={(event) =>
                                      updateMatchReplayCode(match.id, replayIndex, event.target.value)
                                    }
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                    placeholder={`리플레이 코드 ${replayIndex + 1}`}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
