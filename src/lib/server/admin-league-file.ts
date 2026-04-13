import { promises as fs } from "fs";
import path from "path";
import { loadLeagueFromJson } from "@/lib/dataProviders/jsonAdapters";
import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";
import { League } from "@/lib/types";

const ADMIN_DATA_FILENAME = "admin-league.json";

function getAdminDataDirectory(): string {
  return path.join(process.cwd(), "data");
}

export function getAdminLeagueFilePath(): string {
  return path.join(getAdminDataDirectory(), ADMIN_DATA_FILENAME);
}

export async function readAdminLeague(): Promise<{
  league: League;
  source: "file" | "sample";
  filePath: string;
  updatedAt: string | null;
}> {
  const filePath = getAdminLeagueFilePath();

  try {
    const [raw, stats] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
    return {
      league: loadLeagueFromJson(JSON.parse(raw) as League),
      source: "file",
      filePath,
      updatedAt: stats.mtime.toISOString()
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    return {
      league: loadSampleLeague(),
      source: "sample",
      filePath,
      updatedAt: null
    };
  }
}

export async function writeAdminLeague(league: League): Promise<{
  league: League;
  filePath: string;
  updatedAt: string;
}> {
  const filePath = getAdminLeagueFilePath();
  const normalizedLeague = loadLeagueFromJson(league);

  await fs.mkdir(getAdminDataDirectory(), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalizedLeague, null, 2)}\n`, "utf8");

  const stats = await fs.stat(filePath);

  return {
    league: normalizedLeague,
    filePath,
    updatedAt: stats.mtime.toISOString()
  };
}
