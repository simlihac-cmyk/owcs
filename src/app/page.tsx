import { LeagueWorkspace } from "@/components/league-workspace";
import { readAdminLeague } from "@/lib/server/admin-league-file";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { league } = await readAdminLeague();

  return <LeagueWorkspace sourceLeague={league} />;
}
