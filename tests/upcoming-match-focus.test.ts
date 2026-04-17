import { getUpcomingMatchFocus, toCalendarDateKey } from "@/lib/domain/upcoming-match-focus";
import { RemainingMatchInsight } from "@/lib/types";

function createInsight(matchId: string, scheduledAt: string): RemainingMatchInsight {
  return {
    matchId,
    teamAId: "team_a",
    teamBId: "team_b",
    scheduledAt,
    teamAWinProbability: 55,
    teamBWinProbability: 45,
    mostLikelyResult: "3:1",
    resultProbabilities: {
      "3:0": 18,
      "3:1": 32,
      "3:2": 5,
      "2:3": 12,
      "1:3": 18,
      "0:3": 15
    },
    importanceScore: 12,
    biggestSwingTeamId: "team_a",
    biggestSwingValue: 4.2,
    outcomes: []
  };
}

describe("upcoming match focus", () => {
  it("selects today's matches first when they exist", () => {
    const focus = getUpcomingMatchFocus(
      [
        createInsight("past", "2026-04-17T09:00:00.000Z"),
        createInsight("today-1", "2026-04-18T04:00:00.000Z"),
        createInsight("today-2", "2026-04-18T12:00:00.000Z"),
        createInsight("future", "2026-04-19T09:00:00.000Z")
      ],
      {
        now: new Date("2026-04-18T02:00:00.000Z"),
        timeZone: "UTC"
      }
    );

    expect(focus?.mode).toBe("today");
    expect(focus?.dateKey).toBe("2026-04-18");
    expect(focus?.matches.map((match) => match.matchId)).toEqual(["today-1", "today-2"]);
  });

  it("selects the nearest future date when today has no matches", () => {
    const focus = getUpcomingMatchFocus(
      [
        createInsight("past", "2026-04-16T09:00:00.000Z"),
        createInsight("future-2", "2026-04-20T09:00:00.000Z"),
        createInsight("future-1", "2026-04-19T09:00:00.000Z")
      ],
      {
        now: new Date("2026-04-18T02:00:00.000Z"),
        timeZone: "UTC"
      }
    );

    expect(focus?.mode).toBe("upcoming");
    expect(focus?.dateKey).toBe("2026-04-19");
    expect(focus?.matches.map((match) => match.matchId)).toEqual(["future-1"]);
  });

  it("falls back to the most recent pending date when only past matches remain", () => {
    const focus = getUpcomingMatchFocus(
      [
        createInsight("older", "2026-04-15T09:00:00.000Z"),
        createInsight("latest-pending", "2026-04-17T09:00:00.000Z")
      ],
      {
        now: new Date("2026-04-18T02:00:00.000Z"),
        timeZone: "UTC"
      }
    );

    expect(focus?.mode).toBe("pending");
    expect(focus?.dateKey).toBe("2026-04-17");
    expect(focus?.matches.map((match) => match.matchId)).toEqual(["latest-pending"]);
  });

  it("builds sortable calendar keys for a given timezone", () => {
    expect(toCalendarDateKey("2026-04-18T23:30:00.000Z", "Asia/Seoul")).toBe("2026-04-19");
    expect(toCalendarDateKey("2026-04-18T23:30:00.000Z", "UTC")).toBe("2026-04-18");
  });
});
