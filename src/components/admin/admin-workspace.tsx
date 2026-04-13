"use client";

import { useEffect, useMemo, useState } from "react";
import { League, RoundRobinType, Season, SeasonStatus } from "@/lib/types";

interface AdminLeagueResponse {
  league: League;
  source: "file" | "sample";
  filePath: string;
  updatedAt: string | null;
  message?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

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
                  <span
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                      isDirty ? "ow-status-ready" : "ow-status-done"
                    }`}
                  >
                    {isDirty ? "저장되지 않은 변경사항 있음" : "원본과 동기화됨"}
                  </span>
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
                    >
                      <option value="single">single</option>
                      <option value="double">double</option>
                    </select>
                  </label>

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
          </main>
        </section>
      </div>
    </div>
  );
}
