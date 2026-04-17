const TEAM_COLORS: Record<string, { primary: string; soft: string; ring: string }> = {
  team_cr: { primary: "#d9485a", soft: "#fde7eb", ring: "#f5b8c1" },
  team_t1: { primary: "#e11d48", soft: "#ffe3ea", ring: "#f8b6c6" },
  team_flc: { primary: "#10b981", soft: "#defcf2", ring: "#9ae6cd" },
  team_zeta: { primary: "#111827", soft: "#e6e9ee", ring: "#c8ced8" },
  team_way: { primary: "#7c3aed", soft: "#efe7ff", ring: "#d2c0ff" },
  team_ftg: { primary: "#16a34a", soft: "#e5f9eb", ring: "#a7e1b7" },
  team_wae: { primary: "#a16207", soft: "#fdf2d8", ring: "#f1d28a" },
  team_rong: { primary: "#111111", soft: "#ececec", ring: "#cfcfcf" },
  team_ocn: { primary: "#2563eb", soft: "#e3eeff", ring: "#b8d0ff" },
  team_cb: { primary: "#c97a00", soft: "#fff1d8", ring: "#f0cf8d" },
  team_mir: { primary: "#0ea5e9", soft: "#e0f6ff", ring: "#a9def5" },
  team_pf: { primary: "#5b21b6", soft: "#efe8ff", ring: "#d1bfff" },
  team_daf: { primary: "#ef4444", soft: "#fee8e8", ring: "#f8b7b7" },
  team_vl: { primary: "#111827", soft: "#ebedf2", ring: "#cad1dc" },
  team_pot: { primary: "#d97706", soft: "#fff1db", ring: "#f7cf92" },
  team_ins: { primary: "#a855f7", soft: "#f3e8ff", ring: "#ddbefd" },
  team_99d: { primary: "#a16207", soft: "#fdf3dc", ring: "#edd097" },
  team_lz: { primary: "#4f46e5", soft: "#e7e9ff", ring: "#c7cbff" },
  team_bld: { primary: "#dc2626", soft: "#ffe5e5", ring: "#f5b4b4" },
  team_ng: { primary: "#15803d", soft: "#e4f7e8", ring: "#afdcb9" },
  team_vec: { primary: "#334155", soft: "#edf2f7", ring: "#cfd8e3" },
  team_agg: { primary: "#dc2626", soft: "#ffe5e5", ring: "#f5b4b4" },
  team_zan: { primary: "#6b7280", soft: "#f1f5f9", ring: "#d6dce5" },
  team_ne: { primary: "#1d4ed8", soft: "#e7efff", ring: "#bfd0ff" }
};

const DEFAULT_BRAND = {
  primary: "#245c48",
  soft: "#e4f2ed",
  ring: "#b4d4c8"
};

export function getTeamBrand(teamId: string) {
  return TEAM_COLORS[teamId] ?? DEFAULT_BRAND;
}
