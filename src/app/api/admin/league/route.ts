import { NextResponse } from "next/server";
import { readAdminLeague, writeAdminLeague } from "@/lib/server/admin-league-file";
import { League } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLeaguePayload(value: unknown): value is League {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<League>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.teams) &&
    Array.isArray(candidate.seasons) &&
    Array.isArray(candidate.seasonTeams) &&
    Array.isArray(candidate.matches)
  );
}

function isExpectedUpdatedAt(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

export async function GET() {
  const payload = await readAdminLeague();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { league?: unknown; expectedUpdatedAt?: unknown };

  if (!isLeaguePayload(body.league)) {
    return NextResponse.json(
      { message: "리그 데이터 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (!isExpectedUpdatedAt(body.expectedUpdatedAt)) {
    return NextResponse.json(
      { message: "기준 저장 시각 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const current = await readAdminLeague();
  const expectedUpdatedAt = body.expectedUpdatedAt ?? null;

  if (body.expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
    return NextResponse.json(
      {
        league: current.league,
        source: current.source,
        filePath: current.filePath,
        updatedAt: current.updatedAt,
        conflict: true,
        message:
          "다른 작업자가 관리자 원본을 먼저 저장했습니다. 최신 원본을 다시 불러온 뒤 초안을 다시 적용해 주세요."
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const saved = await writeAdminLeague(body.league);

  return NextResponse.json(
    {
      league: saved.league,
      source: "file" as const,
      filePath: saved.filePath,
      updatedAt: saved.updatedAt,
      message: "관리자 원본 데이터를 저장했습니다."
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
