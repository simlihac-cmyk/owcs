"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/season-shared";
import { aggregateSeasonResults, buildCurrentSeasonRecords, sortStandings } from "@/lib/domain/standings";
import { League, Match, Season, SeasonEntry } from "@/lib/types";
import { formatDateLabel, formatDateTimeLabel } from "@/lib/utils/format";
import {
  getRegionLabel,
  getSeasonTeamNameMap,
  getTeamById,
  getTeamShortName
} from "@/lib/utils/season-team-display";
import { getTeamBrand } from "@/lib/utils/team-brand";

type TournamentTab = "overview" | "bracket" | "matches" | "qualification";

type TournamentTeamDetail = {
  teamId: string;
  displayName: string;
  shortName: string;
  country: string | null;
  primaryRegion: Season["region"] | null;
  brand: ReturnType<typeof getTeamBrand>;
};

type PlacementRow = {
  placementStart: number;
  placementEnd: number;
  teamId: string;
};

type TournamentSlotRule =
  | {
      kind: "sourcePlacement";
      sourceSeasonId: string;
      placement: number;
    }
  | {
      kind: "phasePlacement";
      phaseId: string;
      placement: number;
    }
  | {
      kind: "matchOutcome";
      matchId: string;
      outcome: "winner" | "loser";
    };

const derivedTournamentSlotRules: Record<string, TournamentSlotRule> = {
  team_slot_2026_stage1_sd_1: {
    kind: "phasePlacement",
    phaseId: "phase_2026_stage1_play_in_seeding",
    placement: 1
  },
  team_slot_2026_stage1_sd_2: {
    kind: "phasePlacement",
    phaseId: "phase_2026_stage1_play_in_seeding",
    placement: 2
  },
  team_slot_2026_stage1_sd_3: {
    kind: "phasePlacement",
    phaseId: "phase_2026_stage1_play_in_seeding",
    placement: 3
  },
  team_slot_2026_stage1_sd_4: {
    kind: "phasePlacement",
    phaseId: "phase_2026_stage1_play_in_seeding",
    placement: 4
  },
  team_slot_2026_stage1_lcq_upper_loser: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_lcq_01",
    outcome: "loser"
  },
  team_slot_2026_stage1_lcq_lower_winner: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_lcq_02",
    outcome: "winner"
  },
  team_slot_2026_stage1_lcq_1: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_lcq_01",
    outcome: "winner"
  },
  team_slot_2026_stage1_lcq_2: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_lcq_03",
    outcome: "winner"
  },
  team_slot_2026_stage1_playoff_qf_1_winner: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_playoffs_01",
    outcome: "winner"
  },
  team_slot_2026_stage1_playoff_qf_2_winner: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_playoffs_02",
    outcome: "winner"
  },
  team_slot_2026_stage1_playoff_sf_1_winner: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_playoffs_03",
    outcome: "winner"
  },
  team_slot_2026_stage1_playoff_sf_2_winner: {
    kind: "matchOutcome",
    matchId: "match_2026_stage1_play_in_playoffs_04",
    outcome: "winner"
  }
};

const tabLabels: Record<TournamentTab, string> = {
  overview: "개요",
  bracket: "대진표",
  matches: "경기 결과",
  qualification: "진출 구조"
};

const bracketSideOrder: Record<string, number> = {
  upper: 0,
  lower: 1,
  grand_final: 2,
  wild_card: 3,
  group: 4,
  other: 5
};

const BRACKET_ROW_HEIGHT = 22;
const BRACKET_MATCH_ROW_SPAN = 5;
const BRACKET_LANE_WIDTH = 36;
const BRACKET_HEADER_HEIGHT = 42;
const BRACKET_CARD_WIDTH = 244;
const BRACKET_SECTION_GAP = 52;
const BRACKET_PADDING = 16;

type BracketCardLayout = {
  match: Match;
  rowStart: number;
  centerPx: number;
};

type PositionedBracketCard = BracketCardLayout & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type InferredBracketEdge = {
  fromMatchId: string;
  toMatchId: string;
  outcome: "winner" | "loser";
};

function getSeasonStatusLabel(status: Season["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "ongoing") {
    return "진행 중";
  }

  return "준비 중";
}

function getSeasonCategoryLabel(category: Season["category"]) {
  if (category === "international") {
    return "국제 대회";
  }

  if (category === "regional") {
    return "지역 대회";
  }

  return "하부 리그";
}

function getBracketTypeLabel(bracketType: "round_robin" | "single_elimination" | "double_elimination" | "swiss" | "hybrid") {
  if (bracketType === "double_elimination") {
    return "더블 엘리미네이션";
  }

  if (bracketType === "single_elimination") {
    return "싱글 엘리미네이션";
  }

  if (bracketType === "round_robin") {
    return "라운드 로빈";
  }

  if (bracketType === "swiss") {
    return "스위스";
  }

  return "하이브리드";
}

function getBracketSideLabel(side: Match["bracketSide"]) {
  if (side === "upper") {
    return "승자조";
  }

  if (side === "lower") {
    return "패자조";
  }

  if (side === "grand_final") {
    return "결승";
  }

  if (side === "wild_card") {
    return "와일드카드";
  }

  if (side === "group") {
    return "그룹";
  }

  return "기타";
}

function getBracketBoardTitle(
  side: Match["bracketSide"],
  bracketType: "round_robin" | "single_elimination" | "double_elimination" | "swiss" | "hybrid"
) {
  if (bracketType === "single_elimination" && side === "upper") {
    return "플레이오프";
  }

  return getBracketSideLabel(side);
}

function getQualifierTypeLabel(entry: SeasonEntry) {
  if (entry.qualifierType === "regional_top_finish") {
    return "지역 상위권";
  }

  if (entry.qualifierType === "wild_card") {
    return "와일드카드";
  }

  if (entry.qualifierType === "partner_seed") {
    return "파트너 시드";
  }

  if (entry.qualifierType === "points") {
    return "포인트";
  }

  return "수동 지정";
}

function getEntrySourceTypeLabel(entry: SeasonEntry) {
  if (entry.entrySourceType === "direct_qualifier") {
    return "직행";
  }

  if (entry.entrySourceType === "wild_card_winner") {
    return "와일드카드 승자";
  }

  if (entry.entrySourceType === "invited") {
    return "초청";
  }

  return "승계";
}

function getMatchWinnerId(match: Match): string | null {
  if (!match.result) {
    return null;
  }

  if (match.result.setsA === match.result.setsB) {
    return null;
  }

  return match.result.setsA > match.result.setsB ? match.teamAId : match.teamBId;
}

function getMatchLoserId(match: Match): string | null {
  const winnerId = getMatchWinnerId(match);

  if (!winnerId) {
    return null;
  }

  return winnerId === match.teamAId ? match.teamBId : match.teamAId;
}

function isResolvedMatch(match: Match) {
  return Boolean(match.played && match.result && match.result.setsA !== match.result.setsB);
}

function areMatchesComplete(matches: Match[]) {
  return matches.length > 0 && matches.every(isResolvedMatch);
}

function formatMatchScheduleLabel(scheduledAt: string) {
  return scheduledAt.includes("T00:00:00")
    ? `${formatDateLabel(scheduledAt)} · 시간 미정`
    : formatDateTimeLabel(scheduledAt);
}

function createTournamentTeamDetail(
  league: League,
  seasonTeamNameMap: Record<string, string>,
  teamId: string
): TournamentTeamDetail {
  const team = getTeamById(league, teamId);
  const displayName = seasonTeamNameMap[teamId] ?? team?.name ?? teamId;

  return {
    teamId,
    displayName,
    shortName: getTeamShortName(team, displayName),
    country: team?.country?.trim() || null,
    primaryRegion: team?.primaryRegion ?? null,
    brand: getTeamBrand(teamId)
  };
}

function compareMatches(left: Match, right: Match) {
  return (
    left.scheduledAt.localeCompare(right.scheduledAt) ||
    (left.roundNumber ?? 0) - (right.roundNumber ?? 0) ||
    (left.matchNumber ?? 0) - (right.matchNumber ?? 0)
  );
}

function layoutRoundCards(rounds: Array<{ round: number; matches: Match[] }>) {
  const maxMatches = Math.max(...rounds.map((round) => round.matches.length), 1);
  const rowCount = Math.max(maxMatches * BRACKET_MATCH_ROW_SPAN * 2, BRACKET_MATCH_ROW_SPAN * 2);
  const boardHeight = rowCount * BRACKET_ROW_HEIGHT;
  const layouts = rounds.map((roundGroup) => {
    const slotSize = Math.max(
      BRACKET_MATCH_ROW_SPAN + 2,
      Math.floor(rowCount / Math.max(roundGroup.matches.length, 1))
    );

    return {
      ...roundGroup,
      cards: roundGroup.matches.map((match, index) => {
        const rowStart =
          index * slotSize + Math.max(1, Math.floor((slotSize - BRACKET_MATCH_ROW_SPAN) / 2) + 1);

        return {
          match,
          rowStart,
          centerPx: (rowStart - 1 + BRACKET_MATCH_ROW_SPAN / 2) * BRACKET_ROW_HEIGHT
        } satisfies BracketCardLayout;
      })
    };
  });

  return {
    rowCount,
    boardHeight,
    rounds: layouts
  };
}

function inferBracketEdges(matches: Match[]): InferredBracketEdge[] {
  const orderedMatches = [...matches].sort(compareMatches);

  return orderedMatches.flatMap((match) => {
    const winnerId = getMatchWinnerId(match);
    const loserId = getMatchLoserId(match);
    const edges: InferredBracketEdge[] = [];

    if (match.winnerToMatchId) {
      edges.push({
        fromMatchId: match.id,
        toMatchId: match.winnerToMatchId,
        outcome: "winner"
      });
    } else if (winnerId) {
      const winnerTarget = orderedMatches.find((candidate) => {
        if (candidate.id === match.id) {
          return false;
        }

        if (compareMatches(candidate, match) <= 0) {
          return false;
        }

        if (candidate.teamAId !== winnerId && candidate.teamBId !== winnerId) {
          return false;
        }

        if (match.bracketSide === "upper") {
          return candidate.bracketSide === "upper" || candidate.bracketSide === "grand_final";
        }

        if (match.bracketSide === "lower") {
          return candidate.bracketSide === "lower" || candidate.bracketSide === "grand_final";
        }

        return true;
      });

      if (winnerTarget) {
        edges.push({
          fromMatchId: match.id,
          toMatchId: winnerTarget.id,
          outcome: "winner"
        });
      }
    }

    if (match.loserToMatchId) {
      edges.push({
        fromMatchId: match.id,
        toMatchId: match.loserToMatchId,
        outcome: "loser"
      });
    } else if (loserId && match.bracketSide === "upper") {
      const loserTarget = orderedMatches.find((candidate) => {
        if (candidate.id === match.id) {
          return false;
        }

        if (compareMatches(candidate, match) <= 0) {
          return false;
        }

        if (candidate.teamAId !== loserId && candidate.teamBId !== loserId) {
          return false;
        }

        return candidate.bracketSide === "lower";
      });

      if (loserTarget) {
        edges.push({
          fromMatchId: match.id,
          toMatchId: loserTarget.id,
          outcome: "loser"
        });
      }
    }

    return edges;
  });
}

function getPhaseSourceLabel(league: League, entry: SeasonEntry): string | null {
  if (entry.phaseId) {
    const sourcePhase = (league.seasonPhases ?? []).find((candidate) => candidate.id === entry.phaseId);
    const sourceSeason = sourcePhase
      ? league.seasons.find((candidate) => candidate.id === sourcePhase.seasonId)
      : null;

    if (sourcePhase) {
      const baseLabel = sourceSeason ? `${sourceSeason.name} ${sourcePhase.name}` : sourcePhase.name;
      return entry.sourcePlacement ? `${baseLabel} ${entry.sourcePlacement}위` : baseLabel;
    }
  }

  if (!entry.sourceSeasonId) {
    return null;
  }

  const sourceSeason = league.seasons.find((candidate) => candidate.id === entry.sourceSeasonId);

  if (sourceSeason) {
    return entry.sourcePlacement
      ? `${sourceSeason.name} ${entry.sourcePlacement}위`
      : sourceSeason.name;
  }

  const sourcePhase = (league.seasonPhases ?? []).find((candidate) => candidate.id === entry.sourceSeasonId);

  if (sourcePhase) {
    return entry.sourcePlacement ? `${sourcePhase.name} ${entry.sourcePlacement}위` : sourcePhase.name;
  }

  return entry.sourcePlacement ? `${entry.sourcePlacement}위` : null;
}

function getTeamMetaLine(detail: TournamentTeamDetail, fallbackRegion?: Season["region"] | null) {
  const parts: string[] = [];

  if (detail.displayName !== detail.shortName) {
    parts.push(detail.displayName);
  }

  if (detail.country?.trim()) {
    parts.push(detail.country.trim());
  } else if (fallbackRegion) {
    parts.push(getRegionLabel(fallbackRegion));
  }

  return parts.join(" · ");
}

function BracketMatchCard(props: {
  match: Match;
  teamDetailsById: Record<string, TournamentTeamDetail>;
}) {
  const { match, teamDetailsById } = props;
  const winnerId = getMatchWinnerId(match);
  const teamRows = [
    {
      teamId: match.teamAId,
      detail: teamDetailsById[match.teamAId],
      score: match.result?.setsA ?? null
    },
    {
      teamId: match.teamBId,
      detail: teamDetailsById[match.teamBId],
      score: match.result?.setsB ?? null
    }
  ];

  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
          {match.matchNumber ? `Match ${match.matchNumber}` : "Match"}
        </span>
        <span className="text-[10px] text-slate-600">{formatMatchScheduleLabel(match.scheduledAt)}</span>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {teamRows.map((team) => {
          const detail = team.detail ?? {
            teamId: team.teamId,
            displayName: team.teamId,
            shortName: team.teamId,
            country: null,
            primaryRegion: null,
            brand: getTeamBrand(team.teamId)
          };
          const isWinner = winnerId === team.teamId;
          const metaLine = getTeamMetaLine(detail, detail.primaryRegion);

          return (
            <div
              key={`${match.id}-${team.teamId}`}
              className={`flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5 ${
                isWinner ? "border border-transparent" : "border border-slate-200/70 bg-slate-50/80"
              }`}
              style={
                isWinner
                  ? {
                      background: `linear-gradient(135deg, ${detail.brand.soft} 0%, rgba(255,255,255,0.96) 100%)`,
                      borderColor: detail.brand.primary
                    }
                  : undefined
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: detail.brand.primary }}
                />
                <div className="min-w-0">
                  <p className={`truncate text-[13px] font-semibold ${isWinner ? "text-slate-950" : "text-slate-700"}`}>
                    {detail.shortName}
                  </p>
                  {metaLine ? (
                    <p className="truncate text-[10px] text-slate-600">{metaLine}</p>
                  ) : null}
                </div>
              </div>
              <span className={`shrink-0 text-[13px] font-bold ${isWinner ? "text-slate-950" : "text-slate-700"}`}>
                {team.score ?? "-"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 text-[10px] text-slate-600">
        <span>{match.firstTo ? `FT${match.firstTo}` : "세트 규칙 미지정"}</span>
        <span>{winnerId ? "완료" : "예정"}</span>
      </div>
    </div>
  );
}

function BracketBoard(props: {
  title: string;
  description: string;
  rounds: Array<{ round: number; matches: Match[] }>;
  teamDetailsById: Record<string, TournamentTeamDetail>;
}) {
  const { title, description, rounds, teamDetailsById } = props;
  const maxMatches = Math.max(...rounds.map((round) => round.matches.length), 1);
  const rowCount = Math.max(maxMatches * BRACKET_MATCH_ROW_SPAN * 2, BRACKET_MATCH_ROW_SPAN * 2);
  const boardHeight = rowCount * BRACKET_ROW_HEIGHT;
  const roundLayouts = rounds.map((roundGroup) => {
    const slotSize = Math.max(
      BRACKET_MATCH_ROW_SPAN + 2,
      Math.floor(rowCount / Math.max(roundGroup.matches.length, 1))
    );

    return {
      ...roundGroup,
      cards: roundGroup.matches.map((match, index) => {
        const rowStart =
          index * slotSize + Math.max(1, Math.floor((slotSize - BRACKET_MATCH_ROW_SPAN) / 2) + 1);

        return {
          match,
          rowStart,
          centerPx: (rowStart - 1 + BRACKET_MATCH_ROW_SPAN / 2) * BRACKET_ROW_HEIGHT
        };
      })
    };
  });

  return (
    <Panel title={title} description={description}>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-3">
          {roundLayouts.map((roundGroup, index) => (
            <Fragment key={`${title}-${roundGroup.round}`}>
              <section className="w-[292px] shrink-0 rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-950">
                    {roundGroup.round > 0 ? `${roundGroup.round}라운드` : "기타 라운드"}
                  </h4>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {roundGroup.matches.length}경기
                  </span>
                </div>
                <div
                  className="relative mt-4 grid"
                  style={{
                    height: `${boardHeight}px`,
                    gridTemplateRows: `repeat(${rowCount}, minmax(0, ${BRACKET_ROW_HEIGHT}px))`
                  }}
                >
                  {roundGroup.cards.map((card) => (
                    <div
                      key={card.match.id}
                      style={{ gridRow: `${card.rowStart} / span ${BRACKET_MATCH_ROW_SPAN}` }}
                    >
                      <BracketMatchCard match={card.match} teamDetailsById={teamDetailsById} />
                    </div>
                  ))}
                </div>
              </section>

              {index < rounds.length - 1 ? (
                <div className="shrink-0" style={{ width: `${BRACKET_LANE_WIDTH}px` }}>
                  <div
                    className="relative"
                    style={{
                      marginTop: `${BRACKET_HEADER_HEIGHT}px`,
                      height: `${boardHeight}px`
                    }}
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-px bg-slate-200"
                      style={{ left: `${BRACKET_LANE_WIDTH / 2}px` }}
                    />
                    {roundGroup.cards.map((card) => (
                      <span
                        key={`${card.match.id}-from`}
                        className="absolute left-0 h-px bg-slate-300"
                        style={{
                          top: `${card.centerPx}px`,
                          width: `${BRACKET_LANE_WIDTH / 2}px`
                        }}
                      />
                    ))}
                    {roundLayouts[index + 1]?.cards.map((card) => (
                      <span
                        key={`${card.match.id}-to`}
                        className="absolute h-px bg-slate-300"
                        style={{
                          top: `${card.centerPx}px`,
                          left: `${BRACKET_LANE_WIDTH / 2}px`,
                          width: `${BRACKET_LANE_WIDTH / 2}px`
                        }}
                      />
                    ))}
                    {roundLayouts[index + 1]?.cards.map((card) => (
                      <span
                        key={`${card.match.id}-dot`}
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white"
                        style={{
                          top: `${card.centerPx}px`,
                          left: `${BRACKET_LANE_WIDTH / 2}px`
                        }}
                      />
                    ))}
                    <div className="absolute inset-x-0 top-3 flex items-center justify-center">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DoubleEliminationBracketBoard(props: {
  roundsBySide: Array<{ side: string; rounds: Array<{ round: number; matches: Match[] }> }>;
  teamDetailsById: Record<string, TournamentTeamDetail>;
}) {
  const { roundsBySide, teamDetailsById } = props;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [boardScale, setBoardScale] = useState(1);
  const upperRounds = roundsBySide.find((group) => group.side === "upper")?.rounds ?? [];
  const lowerRounds = roundsBySide.find((group) => group.side === "lower")?.rounds ?? [];
  const grandRounds = roundsBySide.find((group) => group.side === "grand_final")?.rounds ?? [];
  const upperLayout = layoutRoundCards(upperRounds);
  const lowerLayout = layoutRoundCards(lowerRounds);
  const cardHeight = BRACKET_MATCH_ROW_SPAN * BRACKET_ROW_HEIGHT;
  const roundsSpan = Math.max(upperLayout.rounds.length, lowerLayout.rounds.length, 1);
  const grandFinalX = BRACKET_PADDING + roundsSpan * (BRACKET_CARD_WIDTH + BRACKET_LANE_WIDTH);
  const upperSectionTop = BRACKET_PADDING + 40;
  const lowerSectionTop = upperSectionTop + upperLayout.boardHeight + BRACKET_SECTION_GAP;
  const boardHeight = lowerSectionTop + lowerLayout.boardHeight + BRACKET_PADDING;
  const grandLayouts: PositionedBracketCard[] = grandRounds.flatMap((roundGroup) =>
    roundGroup.matches.map((match, index) => ({
      match,
      rowStart: index + 1,
      centerPx: boardHeight / 2,
      x: grandFinalX,
      y: boardHeight / 2 - cardHeight / 2,
      width: BRACKET_CARD_WIDTH,
      height: cardHeight
    }))
  );

  const positionedCards = [
    ...upperLayout.rounds.flatMap((roundGroup, roundIndex) =>
      roundGroup.cards.map((card) => ({
        ...card,
        x: BRACKET_PADDING + roundIndex * (BRACKET_CARD_WIDTH + BRACKET_LANE_WIDTH),
        y: upperSectionTop + (card.rowStart - 1) * BRACKET_ROW_HEIGHT,
        width: BRACKET_CARD_WIDTH,
        height: cardHeight
      }))
    ),
    ...lowerLayout.rounds.flatMap((roundGroup, roundIndex) =>
      roundGroup.cards.map((card) => ({
        ...card,
        x: BRACKET_PADDING + roundIndex * (BRACKET_CARD_WIDTH + BRACKET_LANE_WIDTH),
        y: lowerSectionTop + (card.rowStart - 1) * BRACKET_ROW_HEIGHT,
        width: BRACKET_CARD_WIDTH,
        height: cardHeight
      }))
    ),
    ...grandLayouts
  ];
  const positionMap = Object.fromEntries(positionedCards.map((card) => [card.match.id, card]));
  const edges = inferBracketEdges(positionedCards.map((card) => card.match)).filter(
    (edge) => positionMap[edge.fromMatchId] && positionMap[edge.toMatchId]
  );
  const boardWidth = grandFinalX + BRACKET_CARD_WIDTH + BRACKET_PADDING;
  const scaledBoardHeight = boardHeight * boardScale;

  useEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return;
    }

    const updateScale = () => {
      const availableWidth = Math.max(element.clientWidth - 8, 320);
      setBoardScale(Math.min(1, availableWidth / boardWidth));
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(element);

    return () => observer.disconnect();
  }, [boardWidth]);

  return (
    <Panel
      title="대진표"
      description="승자조와 패자조의 흐름을 실제 입상 경로 기준으로 연결해 결승까지 한 번에 읽을 수 있게 정리했습니다."
    >
      <div ref={viewportRef} className="pb-2">
        <div
          className="relative mx-auto"
          style={{ width: `${boardWidth * boardScale}px`, height: `${scaledBoardHeight}px` }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${boardWidth}px`,
              height: `${boardHeight}px`,
              transform: `scale(${boardScale})`
            }}
          >
            <div
              className="absolute inset-0 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,0.98)_100%)] shadow-sm"
            />
            <div
              className="absolute rounded-[20px] border border-emerald-100 bg-emerald-50/45"
              style={{
                left: `${BRACKET_PADDING / 2}px`,
                top: `${upperSectionTop - 12}px`,
                width: `${grandFinalX - BRACKET_PADDING + 4}px`,
                height: `${upperLayout.boardHeight + 22}px`
              }}
            />
            <div
              className="absolute rounded-[20px] border border-amber-100 bg-amber-50/45"
              style={{
                left: `${BRACKET_PADDING / 2}px`,
                top: `${lowerSectionTop - 12}px`,
                width: `${grandFinalX - BRACKET_PADDING + 4}px`,
                height: `${lowerLayout.boardHeight + 22}px`
              }}
            />
            <div
              className="absolute rounded-[22px] border border-slate-200 bg-white/88 shadow-sm"
              style={{
                left: `${grandFinalX - 8}px`,
                top: `${boardHeight / 2 - cardHeight / 2 - 18}px`,
                width: `${BRACKET_CARD_WIDTH + 16}px`,
                height: `${cardHeight + 36}px`
              }}
            />
            <div className="pointer-events-none absolute left-0 right-0 top-0">
              <svg width={boardWidth} height={boardHeight} className="overflow-visible">
                {edges.map((edge) => {
                  const from = positionMap[edge.fromMatchId];
                  const to = positionMap[edge.toMatchId];
                  const startX = from.x + from.width;
                  const startY = from.y + from.height / 2;
                  const endX = to.x;
                  const endY = to.y + to.height / 2;
                  const midX = startX + (endX - startX) / 2;

                  return (
                    <g key={`${edge.fromMatchId}-${edge.toMatchId}-${edge.outcome}`}>
                      <path
                        d={`M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`}
                        fill="none"
                        stroke={edge.outcome === "winner" ? "#0f766e" : "#d97706"}
                        strokeDasharray={edge.outcome === "winner" ? undefined : "6 6"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.9}
                      />
                      <circle
                        cx={endX}
                        cy={endY}
                        r="4"
                        fill={edge.outcome === "winner" ? "#14b8a6" : "#fb923c"}
                        stroke="white"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div
              className="absolute left-4 right-4 h-px bg-slate-200/80"
              style={{ top: `${upperSectionTop + upperLayout.boardHeight + BRACKET_SECTION_GAP / 2 - 10}px` }}
            />

            <div
              className="absolute left-4 top-3 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
              style={{ top: `${BRACKET_PADDING - 2}px` }}
            >
              승자조
            </div>
            <div
              className="absolute left-4 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
              style={{ top: `${lowerSectionTop - 28}px` }}
            >
              패자조
            </div>
            <div
              className="absolute rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm"
              style={{ left: `${grandFinalX + 12}px`, top: `${boardHeight / 2 - cardHeight / 2 - 28}px` }}
            >
              결승
            </div>
            <div className="absolute right-4 top-3 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 rounded-full bg-teal-700" />
                승자
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-amber-500" />
                패자조
              </span>
            </div>

            {positionedCards.map((card) => (
              <div
                key={card.match.id}
                className="absolute"
                style={{
                  left: `${card.x}px`,
                  top: `${card.y}px`,
                  width: `${card.width}px`,
                  height: `${card.height}px`
                }}
              >
                <BracketMatchCard match={card.match} teamDetailsById={teamDetailsById} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function getPlacementLabel(start: number, end: number) {
  return start === end ? `${start}위` : `${start}-${end}위`;
}

function buildDoubleEliminationPlacements(matches: Match[]): PlacementRow[] {
  const placements: PlacementRow[] = [];
  const seenTeamIds = new Set<string>();
  const grandFinal = [...matches]
    .filter((match) => match.bracketSide === "grand_final")
    .sort(compareMatches)
    .at(-1);
  const championId = grandFinal ? getMatchWinnerId(grandFinal) : null;
  const runnerUpId = grandFinal ? getMatchLoserId(grandFinal) : null;

  if (championId) {
    placements.push({ placementStart: 1, placementEnd: 1, teamId: championId });
    seenTeamIds.add(championId);
  }

  if (runnerUpId) {
    placements.push({ placementStart: 2, placementEnd: 2, teamId: runnerUpId });
    seenTeamIds.add(runnerUpId);
  }

  const lowerRounds = Array.from(
    new Map(
      matches
        .filter((match) => match.bracketSide === "lower")
        .sort((left, right) => (right.roundNumber ?? 0) - (left.roundNumber ?? 0) || compareMatches(left, right))
        .map((match) => [match.roundNumber ?? 0, [] as Match[]])
    ).keys()
  ).sort((left, right) => right - left);

  let nextPlacement = 3;

  for (const roundNumber of lowerRounds) {
    const roundLosers = matches
      .filter((match) => match.bracketSide === "lower" && (match.roundNumber ?? 0) === roundNumber)
      .sort(compareMatches)
      .map((match) => getMatchLoserId(match))
      .filter((teamId): teamId is string => Boolean(teamId))
      .filter((teamId) => !seenTeamIds.has(teamId));

    if (roundLosers.length === 0) {
      continue;
    }

    const placementStart = nextPlacement;
    const placementEnd = nextPlacement + roundLosers.length - 1;

    for (const teamId of roundLosers) {
      placements.push({ placementStart, placementEnd, teamId });
      seenTeamIds.add(teamId);
    }

    nextPlacement += roundLosers.length;
  }

  return placements;
}

function buildSingleEliminationPlacements(matches: Match[]): PlacementRow[] {
  const placements: PlacementRow[] = [];
  const seenTeamIds = new Set<string>();
  const completedMatches = [...matches].filter((match) => match.result).sort(compareMatches);
  const finalMatch =
    completedMatches.find((match) => match.isGrandFinal) ??
    [...completedMatches].sort((left, right) => (right.roundNumber ?? 0) - (left.roundNumber ?? 0) || compareMatches(left, right))[0] ??
    null;

  const championId = finalMatch ? getMatchWinnerId(finalMatch) : null;
  const runnerUpId = finalMatch ? getMatchLoserId(finalMatch) : null;

  if (championId) {
    placements.push({ placementStart: 1, placementEnd: 1, teamId: championId });
    seenTeamIds.add(championId);
  }

  if (runnerUpId) {
    placements.push({ placementStart: 2, placementEnd: 2, teamId: runnerUpId });
    seenTeamIds.add(runnerUpId);
  }

  const thirdPlaceMatch =
    completedMatches.find((match) => match.bracketSide === "other" && match.id !== finalMatch?.id) ?? null;
  const thirdPlaceWinnerId = thirdPlaceMatch ? getMatchWinnerId(thirdPlaceMatch) : null;
  const fourthPlaceId = thirdPlaceMatch ? getMatchLoserId(thirdPlaceMatch) : null;

  if (thirdPlaceWinnerId) {
    placements.push({ placementStart: 3, placementEnd: 3, teamId: thirdPlaceWinnerId });
    seenTeamIds.add(thirdPlaceWinnerId);
  }

  if (fourthPlaceId) {
    placements.push({ placementStart: 4, placementEnd: 4, teamId: fourthPlaceId });
    seenTeamIds.add(fourthPlaceId);
  }

  const rounds = Array.from(
    new Set(
      completedMatches
        .filter((match) => match.id !== finalMatch?.id && match.id !== thirdPlaceMatch?.id)
        .map((match) => match.roundNumber ?? 0)
    )
  ).sort((left, right) => right - left);

  let nextPlacement = thirdPlaceMatch ? 5 : 3;

  for (const roundNumber of rounds) {
    const roundLosers = completedMatches
      .filter(
        (match) =>
          match.id !== finalMatch?.id &&
          match.id !== thirdPlaceMatch?.id &&
          (match.roundNumber ?? 0) === roundNumber
      )
      .sort(compareMatches)
      .map((match) => getMatchLoserId(match))
      .filter((teamId): teamId is string => Boolean(teamId))
      .filter((teamId) => !seenTeamIds.has(teamId));

    if (roundLosers.length === 0) {
      continue;
    }

    const placementStart = nextPlacement;
    const placementEnd = nextPlacement + roundLosers.length - 1;

    for (const teamId of roundLosers) {
      placements.push({ placementStart, placementEnd, teamId });
      seenTeamIds.add(teamId);
    }

    nextPlacement += roundLosers.length;
  }

  return placements;
}

function getReplayCodesForDisplay(replayCodes: string[] | undefined): string[] {
  return (replayCodes ?? []).map((code) => code.trim()).filter(Boolean);
}

function getPlacementForTeam(placementRows: PlacementRow[], teamId: string): PlacementRow | null {
  return placementRows.find((row) => row.teamId === teamId) ?? null;
}

export function TournamentSeasonDetail(props: { league: League; season: Season }) {
  const { league, season } = props;
  const [activeTab, setActiveTab] = useState<TournamentTab>("overview");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const teamMap = getSeasonTeamNameMap(league, season);
  const seasonPhases = useMemo(
    () =>
      [...(league.seasonPhases ?? [])]
        .filter((phase) => phase.seasonId === season.id)
        .sort((left, right) => left.order - right.order),
    [league.seasonPhases, season.id]
  );
  const seasonEntries = useMemo(
    () =>
      [...(league.seasonEntries ?? [])]
        .filter((entry) => entry.seasonId === season.id)
        .sort((left, right) => left.seed - right.seed),
    [league.seasonEntries, season.id]
  );
  const qualificationLinks = useMemo(
    () => [...(league.qualificationLinks ?? [])].filter((link) => link.sourceSeasonId === season.id),
    [league.qualificationLinks, season.id]
  );
  const seasonMatches = useMemo(
    () =>
      [...league.matches]
        .filter((match) => match.seasonId === season.id)
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
    [league.matches, season.id]
  );
  const slotRulesByTeamId = useMemo(
    () => {
      const referencedSlotTeamIds = new Set([
        ...season.teamIds,
        ...seasonMatches.flatMap((match) => [match.teamAId, match.teamBId])
      ]);

      return {
        ...seasonEntries.reduce<Record<string, TournamentSlotRule>>((rules, entry) => {
          if (!entry.sourcePlacement) {
            return rules;
          }

          if (entry.phaseId) {
            rules[entry.teamId] = {
              kind: "phasePlacement",
              phaseId: entry.phaseId,
              placement: entry.sourcePlacement
            };
            return rules;
          }

          if (entry.sourceSeasonId) {
            rules[entry.teamId] = {
              kind: "sourcePlacement",
              sourceSeasonId: entry.sourceSeasonId,
              placement: entry.sourcePlacement
            };
          }

          return rules;
        }, {}),
        ...Object.fromEntries(
          Object.entries(derivedTournamentSlotRules).filter(([teamId]) => referencedSlotTeamIds.has(teamId))
        )
      };
    },
    [season.teamIds, seasonEntries, seasonMatches]
  );
  const sourceSeasonPlacementTeamIds = useMemo(() => {
    const sourceSeasonIds = Array.from(
      new Set(
        Object.values(slotRulesByTeamId)
          .filter((rule): rule is Extract<TournamentSlotRule, { kind: "sourcePlacement" }> => rule.kind === "sourcePlacement")
          .map((rule) => rule.sourceSeasonId)
      )
    );
    const placementsByKey: Record<string, string> = {};

    for (const sourceSeasonId of sourceSeasonIds) {
      const sourceSeason = league.seasons.find((candidate) => candidate.id === sourceSeasonId);

      if (!sourceSeason) {
        continue;
      }

      const sourceMatches = league.matches.filter((match) => match.seasonId === sourceSeasonId);

      if (!areMatchesComplete(sourceMatches)) {
        continue;
      }

      const aggregate = aggregateSeasonResults(league, sourceSeason);

      for (const standing of aggregate.standings) {
        placementsByKey[`${sourceSeasonId}:${standing.rank}`] = standing.teamId;
      }
    }

    return placementsByKey;
  }, [league, slotRulesByTeamId]);
  const phasePlacementTeamIds = useMemo(() => {
    const phaseIds = Array.from(
      new Set(
        Object.values(slotRulesByTeamId)
          .filter((rule): rule is Extract<TournamentSlotRule, { kind: "phasePlacement" }> => rule.kind === "phasePlacement")
          .map((rule) => rule.phaseId)
      )
    );
    const placementsByKey: Record<string, string> = {};

    for (const phaseId of phaseIds) {
      const phase = (league.seasonPhases ?? []).find((candidate) => candidate.id === phaseId);

      if (!phase) {
        continue;
      }

      const sourceSeason = league.seasons.find((candidate) => candidate.id === phase.seasonId);

      if (!sourceSeason) {
        continue;
      }

      const phaseMatches = league.matches.filter((match) => match.phaseId === phaseId);

      if (!areMatchesComplete(phaseMatches)) {
        continue;
      }

      const phaseSeason = {
        ...sourceSeason,
        id: phase.id,
        name: phase.name,
        teamIds: phase.teamIds
      };
      const sourceTeamMap = getSeasonTeamNameMap(league, sourceSeason);
      const phaseTeamNames = Object.fromEntries(
        phase.teamIds.map((teamId) => [
          teamId,
          createTournamentTeamDetail(league, sourceTeamMap, teamId).displayName
        ])
      );
      const records = buildCurrentSeasonRecords(phaseSeason, phaseMatches);
      const standings = sortStandings(records, phaseTeamNames, sourceSeason.rules);

      for (const standing of standings) {
        placementsByKey[`${phaseId}:${standing.rank}`] = standing.teamId;
      }
    }

    return placementsByKey;
  }, [league, slotRulesByTeamId]);
  const matchOutcomeTeamIds = useMemo(() => {
    const outcomeRules = Object.values(slotRulesByTeamId).filter(
      (rule): rule is Extract<TournamentSlotRule, { kind: "matchOutcome" }> => rule.kind === "matchOutcome"
    );
    const matchById = new Map(
      league.matches
        .filter((match) => outcomeRules.some((rule) => rule.matchId === match.id))
        .map((match) => [match.id, match])
    );
    const outcomesByKey: Record<string, string> = {};

    for (const rule of outcomeRules) {
      const match = matchById.get(rule.matchId);

      if (!match || !isResolvedMatch(match)) {
        continue;
      }

      const teamId = rule.outcome === "winner" ? getMatchWinnerId(match) : getMatchLoserId(match);

      if (teamId) {
        outcomesByKey[`${rule.matchId}:${rule.outcome}`] = teamId;
      }
    }

    return outcomesByKey;
  }, [league.matches, slotRulesByTeamId]);
  const teamDetailsById = useMemo(
    () => {
      const referencedTeamIds = Array.from(
        new Set([
          ...season.teamIds,
          ...Object.keys(slotRulesByTeamId),
          ...seasonMatches.flatMap((match) => [match.teamAId, match.teamBId])
        ])
      );
      const resolveDisplayTeamId = (teamId: string) => {
        let currentTeamId = teamId;
        const seenTeamIds = new Set<string>();

        while (!seenTeamIds.has(currentTeamId)) {
          seenTeamIds.add(currentTeamId);

          const rule = slotRulesByTeamId[currentTeamId];
          const nextTeamId =
            rule?.kind === "sourcePlacement"
              ? sourceSeasonPlacementTeamIds[`${rule.sourceSeasonId}:${rule.placement}`]
              : rule?.kind === "phasePlacement"
                ? phasePlacementTeamIds[`${rule.phaseId}:${rule.placement}`]
                : rule?.kind === "matchOutcome"
                  ? matchOutcomeTeamIds[`${rule.matchId}:${rule.outcome}`]
                  : null;

          if (!nextTeamId || nextTeamId === currentTeamId) {
            return currentTeamId;
          }

          currentTeamId = nextTeamId;
        }

        return currentTeamId;
      };

      return Object.fromEntries(
        referencedTeamIds.map((teamId) => {
          return [
            teamId,
            createTournamentTeamDetail(league, teamMap, resolveDisplayTeamId(teamId))
          ];
        })
      );
    },
    [league, matchOutcomeTeamIds, phasePlacementTeamIds, season.teamIds, seasonMatches, slotRulesByTeamId, sourceSeasonPlacementTeamIds, teamMap]
  );
  const mainEventPhase = useMemo(
    () =>
      seasonPhases.find((phase) => phase.phaseType === "main_event") ??
      seasonPhases.at(-1) ??
      null,
    [seasonPhases]
  );
  const firstPhaseWithMatches = useMemo(
    () =>
      seasonPhases.find((phase) => seasonMatches.some((match) => match.phaseId === phase.id)) ??
      null,
    [seasonMatches, seasonPhases]
  );

  useEffect(() => {
    setActiveTab("overview");
  }, [season.id]);

  useEffect(() => {
    setSelectedPhaseId((current) =>
      current && seasonPhases.some((phase) => phase.id === current)
        ? current
        : mainEventPhase && seasonMatches.some((match) => match.phaseId === mainEventPhase.id)
          ? mainEventPhase.id
          : firstPhaseWithMatches?.id ?? mainEventPhase?.id ?? seasonPhases[0]?.id ?? ""
    );
  }, [firstPhaseWithMatches, mainEventPhase, seasonMatches, seasonPhases]);

  const selectedPhase = seasonPhases.find((phase) => phase.id === selectedPhaseId) ?? seasonPhases[0] ?? null;
  const selectedPhaseMatches = selectedPhase
    ? seasonMatches.filter((match) => match.phaseId === selectedPhase.id)
    : seasonMatches;
  const bracketGroups = useMemo(() => {
    const groups = new Map<string, Map<number, Match[]>>();

    for (const match of selectedPhaseMatches) {
      const side = match.bracketSide ?? "other";
      const sideGroup = groups.get(side) ?? new Map<number, Match[]>();
      const round = match.roundNumber ?? 0;
      sideGroup.set(round, [...(sideGroup.get(round) ?? []), match].sort((left, right) => {
        const leftMatchNumber = left.matchNumber ?? 0;
        const rightMatchNumber = right.matchNumber ?? 0;
        return leftMatchNumber - rightMatchNumber || left.scheduledAt.localeCompare(right.scheduledAt);
      }));
      groups.set(side, sideGroup);
    }

    return [...groups.entries()]
      .sort((left, right) => (bracketSideOrder[left[0]] ?? 99) - (bracketSideOrder[right[0]] ?? 99))
      .map(([side, rounds]) => ({
        side,
        rounds: [...rounds.entries()]
          .sort((left, right) => left[0] - right[0])
          .map(([round, matches]) => ({ round, matches }))
      }));
  }, [selectedPhaseMatches]);
  const summaryPhase = mainEventPhase ?? selectedPhase;
  const summaryMatches = useMemo(
    () =>
      summaryPhase
        ? seasonMatches.filter((match) => match.phaseId === summaryPhase.id)
        : seasonMatches,
    [seasonMatches, summaryPhase]
  );
  const placementRows = useMemo(
    () =>
      summaryPhase?.bracketType === "double_elimination"
        ? buildDoubleEliminationPlacements(summaryMatches)
        : summaryPhase?.bracketType === "single_elimination"
          ? buildSingleEliminationPlacements(summaryMatches)
        : [],
    [summaryMatches, summaryPhase]
  );
  const championId = placementRows[0]?.teamId ?? null;
  const runnerUpId = placementRows[1]?.teamId ?? null;
  const championDetail = championId ? teamDetailsById[championId] : null;
  const runnerUpDetail = runnerUpId ? teamDetailsById[runnerUpId] : null;
  const dateRange = useMemo(() => {
    const startCandidates = [
      ...seasonPhases.map((phase) => phase.startDate),
      ...seasonMatches.map((match) => match.scheduledAt)
    ].filter(Boolean);
    const endCandidates = [
      ...seasonPhases.map((phase) => phase.endDate),
      ...seasonMatches.map((match) => match.scheduledAt)
    ].filter(Boolean);

    return {
      start: [...startCandidates].sort()[0] ?? null,
      end: [...endCandidates].sort().at(-1) ?? null
    };
  }, [seasonMatches, seasonPhases]);
  const regionEntrySummary = useMemo(() => {
    const counts = new Map<string, number>();

    for (const entry of seasonEntries) {
      const label = getRegionLabel(entry.metadata?.subregion ?? season.region);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  }, [season.region, seasonEntries]);
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, Match[]>();

    for (const match of seasonMatches) {
      const dateKey = match.scheduledAt.slice(0, 10);
      groups.set(dateKey, [...(groups.get(dateKey) ?? []), match]);
    }

    return [...groups.entries()].map(([date, matches]) => ({
      date,
      matches: matches.sort(compareMatches)
    }));
  }, [seasonMatches]);
  const replayItems = useMemo(
    () =>
      seasonMatches.flatMap((match) =>
        getReplayCodesForDisplay(match.replayCodes).map((code, index) => ({
          code,
          match,
          index
        }))
      ),
    [seasonMatches]
  );

  return (
    <div className="space-y-6">
      <section id="tournament-overview" className="ow-cut-panel px-6 py-7 text-[var(--ow-text)]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
              {getSeasonStatusLabel(season.status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
              {getSeasonCategoryLabel(season.category)}
            </span>
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
              {getRegionLabel(season.region)}
            </span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.28em] text-sand">Tournament Archive</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">{season.name}</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">우승</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{championDetail?.shortName ?? "미정"}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">준우승</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{runnerUpDetail?.shortName ?? "미정"}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">기간</p>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {dateRange.start ? formatDateTimeLabel(dateRange.start) : "-"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {dateRange.end ? formatDateTimeLabel(dateRange.end) : "-"}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">형식</p>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {season.tournamentConfig ? getBracketTypeLabel(season.tournamentConfig.bracketType) : "미지정"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                FT{season.tournamentConfig?.defaultFirstTo ?? 3}
                {season.tournamentConfig?.grandFinalFirstTo
                  ? ` · 결승 FT${season.tournamentConfig.grandFinalFirstTo}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" aria-label="토너먼트 상세 탭">
        {(Object.keys(tabLabels) as TournamentTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab ? "ow-primary-button" : "ow-ghost-button"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === "bracket" ? <section id="tournament-bracket" className="space-y-6">
        <Panel title="대진표" description="phase를 선택해 실제 토너먼트 흐름을 바로 확인할 수 있습니다.">
          {seasonPhases.length === 0 ? (
            <p className="text-sm text-slate-700">대진표를 보여줄 phase가 없습니다.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" aria-label="토너먼트 phase 선택">
                {seasonPhases.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setSelectedPhaseId(phase.id)}
                    aria-pressed={selectedPhase?.id === phase.id}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedPhase?.id === phase.id ? "ow-primary-button" : "ow-ghost-button"
                    }`}
                  >
                    {phase.name}
                  </button>
                ))}
              </div>
              {selectedPhase ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {getBracketTypeLabel(selectedPhase.bracketType)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    팀 {selectedPhase.teamIds.length}개
                  </span>
                  {selectedPhase.metadata?.defaultFirstTo ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      FT{selectedPhase.metadata.defaultFirstTo}
                    </span>
                  ) : null}
                  {selectedPhase.metadata?.advancesCount ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      상위 {selectedPhase.metadata.advancesCount}팀 진출
                    </span>
                  ) : null}
                  {selectedPhase.metadata?.notes ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {selectedPhase.metadata.notes}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Panel>

        {bracketGroups.length === 0 ? (
          <Panel title="대진표">
            <p className="text-sm text-slate-700">선택한 phase에 대진표 경기 데이터가 없습니다.</p>
          </Panel>
        ) : selectedPhase?.bracketType === "double_elimination" &&
          bracketGroups.some((group) => group.side === "upper") &&
          bracketGroups.some((group) => group.side === "lower") ? (
          <DoubleEliminationBracketBoard roundsBySide={bracketGroups} teamDetailsById={teamDetailsById} />
        ) : (
          bracketGroups.map((group) => (
            <BracketBoard
              key={group.side}
              title={getBracketBoardTitle(group.side as Match["bracketSide"], selectedPhase?.bracketType ?? "single_elimination")}
              description="라운드별 컬럼과 진행 흐름을 읽기 쉽게 정리한 보드입니다."
              rounds={group.rounds}
              teamDetailsById={teamDetailsById}
            />
          ))
        )}
      </section> : null}

      {activeTab === "overview" ? <section id="tournament-results" className="space-y-6">
        <Panel title="최종 순위" description="위키의 긴 표 대신 핵심 순위와 팀 정보를 한 번에 읽기 쉬운 표로 정리합니다.">
          {placementRows.length === 0 ? (
            <p className="text-sm text-slate-700">최종 순위 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-3 py-2">순위</th>
                    <th className="px-3 py-2">팀</th>
                    <th className="px-3 py-2">지역</th>
                    <th className="px-3 py-2">진출 경로</th>
                  </tr>
                </thead>
                <tbody>
                  {placementRows.map((row) => {
                    const detail = teamDetailsById[row.teamId];
                    const entry = seasonEntries.find((candidate) => candidate.teamId === row.teamId);

                    return (
                      <tr key={`${row.placementStart}-${row.teamId}`} className="rounded-2xl bg-slate-50">
                        <td className="rounded-l-2xl px-3 py-3 text-sm font-semibold text-slate-950">
                          {getPlacementLabel(row.placementStart, row.placementEnd)}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: detail?.brand.primary ?? "#0f172a" }}
                            />
                            <span className="font-semibold text-slate-950">{detail?.shortName ?? row.teamId}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-700">
                          {entry?.metadata?.subregion ? getRegionLabel(entry.metadata.subregion) : getRegionLabel(detail?.primaryRegion ?? season.region)}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3 text-sm text-slate-700">
                          {entry ? `${getQualifierTypeLabel(entry)} · ${getEntrySourceTypeLabel(entry)}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <Panel title="참가팀" description="팀명, 시드, 지역, 진출 경로를 카드형으로 정리합니다.">
            {seasonEntries.length === 0 ? (
              <p className="text-sm text-slate-700">참가팀 데이터가 없습니다.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {seasonEntries.map((entry) => {
                  const detail = teamDetailsById[entry.teamId];
                  const sourceLabel = getPhaseSourceLabel(league, entry);
                  const placement = getPlacementForTeam(placementRows, entry.teamId);

                  return (
                    <div
                      key={`${entry.seasonId}-${entry.teamId}`}
                      className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: detail?.brand.primary ?? "#245c48" }}
                            />
                            <strong className="truncate text-base text-slate-950">{detail?.shortName ?? entry.teamId}</strong>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-700">
                            {detail ? getTeamMetaLine(detail, entry.metadata?.subregion ?? detail.primaryRegion) : entry.teamId}
                          </p>
                        </div>
                        <span className="rounded-full bg-[rgba(242,139,47,0.12)] px-3 py-1 text-xs font-semibold text-[#c86c1d]">
                          {entry.displaySeed ?? `#${entry.seed}`}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {placement ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-900">
                            최종 {getPlacementLabel(placement.placementStart, placement.placementEnd)}
                          </span>
                        ) : null}
                        {entry.metadata?.subregion ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                            {getRegionLabel(entry.metadata.subregion)}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {getQualifierTypeLabel(entry)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {getEntrySourceTypeLabel(entry)}
                        </span>
                      </div>

                      {sourceLabel ? <p className="mt-3 text-xs text-slate-700">{sourceLabel}</p> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="지역 분포" description="어느 지역에서 몇 팀이 올라왔는지 바로 읽히게 정리합니다.">
            <div className="space-y-3">
              {regionEntrySummary.length === 0 ? (
                <p className="text-sm text-slate-700">지역 분포 정보가 없습니다.</p>
              ) : (
                regionEntrySummary.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.count}팀
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section> : null}

      {activeTab === "qualification" ? <section id="tournament-phases" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="대회 구조" description="와일드카드, 메인 이벤트, 결승 규칙 같은 토너먼트 구조를 단계별로 보여줍니다.">
          <div className="mb-4 rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            {summaryPhase ? `${summaryPhase.name} · ${getBracketTypeLabel(summaryPhase.bracketType)}` : "대표 phase 정보 없음"}
            {summaryPhase?.metadata?.advancesCount ? ` · 상위 ${summaryPhase.metadata.advancesCount}팀 진출` : ""}
            {qualificationLinks.length > 0 ? ` · 다음 대회 연결 ${qualificationLinks.length}개` : ""}
          </div>
          {seasonPhases.length === 0 ? (
            <p className="text-sm text-slate-700">등록된 phase가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {seasonPhases.map((phase) => (
                <div key={phase.id} className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">{phase.name}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {getBracketTypeLabel(phase.bracketType)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatDateTimeLabel(phase.startDate)} - {formatDateTimeLabel(phase.endDate)}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    팀 {phase.teamIds.length}개
                    {phase.metadata?.advancesCount ? ` · 상위 ${phase.metadata.advancesCount}팀 진출` : ""}
                    {phase.metadata?.defaultFirstTo ? ` · FT${phase.metadata.defaultFirstTo}` : ""}
                    {phase.metadata?.grandFinalFirstTo ? ` · 결승 FT${phase.metadata.grandFinalFirstTo}` : ""}
                  </p>
                  {phase.metadata?.notes ? <p className="mt-2 text-xs text-slate-700">{phase.metadata.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="진출 구조" description="이 대회의 상위권 팀이 다음 대회 어디로 이어지는지 명확하게 보여줍니다.">
          {qualificationLinks.length === 0 ? (
            <p className="text-sm text-slate-700">등록된 qualification link가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {qualificationLinks.map((link) => (
                <div key={link.id} className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4">
                  <p className="font-semibold text-slate-950">{link.label}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {getPlacementLabel(link.placementStart, link.placementEnd)}
                    {" -> "}
                    {league.seasons.find((candidate) => candidate.id === link.targetSeasonId)?.name ?? link.targetSeasonId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section> : null}

      {activeTab === "matches" ? <section id="tournament-matches">
        <Panel title="경기 결과" description="날짜순 기록과 phase, 브래킷 위치를 함께 묶어 실제 아카이브처럼 읽기 쉽게 정리합니다.">
          {groupedMatches.length === 0 ? (
            <p className="text-sm text-slate-700">등록된 경기가 없습니다.</p>
          ) : (
            <div className="space-y-5">
              {groupedMatches.map((group) => (
                <div key={group.date}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {group.date}
                    </span>
                    <span className="text-xs text-slate-500">{group.matches.length}경기</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.matches.map((match) => {
                      const teamADetail = teamDetailsById[match.teamAId];
                      const teamBDetail = teamDetailsById[match.teamBId];
                      const replayCodes = getReplayCodesForDisplay(match.replayCodes);

                      return (
                        <div key={match.id} className="rounded-[24px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">
                                {teamADetail?.shortName ?? teamMap[match.teamAId] ?? match.teamAId} vs{" "}
                                {teamBDetail?.shortName ?? teamMap[match.teamBId] ?? match.teamBId}
                              </p>
                              <p className="mt-1 text-xs text-slate-700">{formatMatchScheduleLabel(match.scheduledAt)}</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                              {match.result ? `${match.result.setsA}:${match.result.setsB}` : "예정"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-700">
                            {match.phaseId
                              ? seasonPhases.find((phase) => phase.id === match.phaseId)?.name ?? match.phaseId
                              : "기본 phase"}
                            {match.bracketSide ? ` · ${getBracketSideLabel(match.bracketSide)}` : ""}
                            {match.roundNumber ? ` · R${match.roundNumber}` : ""}
                          </p>
                          {replayCodes.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {replayCodes.map((code) => (
                                <span
                                  key={`${match.id}-${code}`}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                  리플레이 {code}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section> : null}

      {activeTab === "matches" ? <section id="tournament-media">
        <Panel title="미디어와 리플레이 코드" description="위키의 VOD 영역처럼 토너먼트 관련 미디어를 모을 수 있도록 준비한 섹션입니다.">
          {replayItems.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-700">
              등록된 리플레이 코드나 영상 링크가 아직 없습니다.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {replayItems.map((item) => (
                <div key={`${item.match.id}-${item.index}`} className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Replay Code</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{item.code}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    {(teamDetailsById[item.match.teamAId]?.shortName ?? item.match.teamAId)} vs{" "}
                    {(teamDetailsById[item.match.teamBId]?.shortName ?? item.match.teamBId)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{formatMatchScheduleLabel(item.match.scheduledAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section> : null}
    </div>
  );
}
