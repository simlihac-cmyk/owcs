import { loadSampleLeague } from "@/lib/dataProviders/sampleLeague";

const mockedAdminLeagueFile = vi.hoisted(() => ({
  readAdminLeague: vi.fn(),
  writeAdminLeague: vi.fn()
}));

vi.mock("@/lib/server/admin-league-file", () => mockedAdminLeagueFile);

import { POST } from "@/app/api/admin/league/route";

describe("admin league route", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects stale saves when the admin source changed on the server", async () => {
    const league = loadSampleLeague();

    mockedAdminLeagueFile.readAdminLeague.mockResolvedValue({
      league,
      source: "file",
      filePath: "/tmp/admin-league.json",
      updatedAt: "2026-04-18T07:00:00.000Z"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          league,
          expectedUpdatedAt: "2026-04-18T06:30:00.000Z"
        })
      })
    );

    expect(response.status).toBe(409);
    expect(mockedAdminLeagueFile.writeAdminLeague).not.toHaveBeenCalled();

    await expect(response.json()).resolves.toMatchObject({
      conflict: true,
      updatedAt: "2026-04-18T07:00:00.000Z"
    });
  });

  it("saves when the expected updatedAt matches the current admin source", async () => {
    const league = loadSampleLeague();

    mockedAdminLeagueFile.readAdminLeague.mockResolvedValue({
      league,
      source: "file",
      filePath: "/tmp/admin-league.json",
      updatedAt: "2026-04-18T07:00:00.000Z"
    });
    mockedAdminLeagueFile.writeAdminLeague.mockResolvedValue({
      league,
      filePath: "/tmp/admin-league.json",
      updatedAt: "2026-04-18T07:05:00.000Z"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          league,
          expectedUpdatedAt: "2026-04-18T07:00:00.000Z"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockedAdminLeagueFile.writeAdminLeague).toHaveBeenCalledWith(league);

    await expect(response.json()).resolves.toMatchObject({
      source: "file",
      updatedAt: "2026-04-18T07:05:00.000Z"
    });
  });
});
