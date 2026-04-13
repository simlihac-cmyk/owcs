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

export async function GET() {
  const payload = await readAdminLeague();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { league?: unknown };

  if (!isLeaguePayload(body.league)) {
    return NextResponse.json(
      { message: "리그 데이터 형식이 올바르지 않습니다." },
      { status: 400 }
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
