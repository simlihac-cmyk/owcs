const DEFAULT_SITE_URL = "https://owcs.monosaccharide180.com";

function normalizeSiteUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const OWCS_SITE_SHORT_NAME = "OWCS Korea";
export const OWCS_SITE_NAME = "OWCS 시즌 아카이브 예측기";
export const OWCS_SITE_DESCRIPTION =
  "과거 시즌 기록을 아카이브하고 현재 시즌은 Monte Carlo 시뮬레이션으로 최종 순위 확률까지 확인하는 OWCS 웹앱";
export const OWCS_SITE_KEYWORDS = [
  "OWCS",
  "OWCS Korea",
  "오버워치",
  "시즌 아카이브",
  "순위 예측",
  "Monte Carlo",
  "시뮬레이션"
];
export const OWCS_SITE_URL = normalizeSiteUrl(
  process.env.OWCS_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    DEFAULT_SITE_URL
);

export function getMetadataBase(): URL {
  return new URL(OWCS_SITE_URL);
}
