const colors = {
  orange: "#fa9c1e",
  graphite: "#4a4c4e",
  surface: "#f7f7f5",
  shadow: "rgba(30, 35, 42, 0.12)"
};

interface OverwatchMarkProps {
  size: number;
}

function OverwatchMark({ size }: OverwatchMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 600 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M296.70405 0.00424149C229.93779 0.43221149 163.9322 24.232681 112.07437 66.087451L168.73601 131.87314C216.5573 94.134131 280.99173 78.755181 340.75427 90.636091C373.59771 96.954451 404.84975 111.37577 431.2176 131.87314L487.87924 66.087451C434.24075 22.804341 365.76667 -1.0306785 296.70405 0.00424149Z"
        fill={colors.orange}
      />
      <path
        d="M93.627932 82.252881C33.924062 138.34244 -1.0821983 219.87731 0.02552166 302.12246C0.06092166 387.49363 39.004212 471.35277 103.6776 526.81868C163.45868 579.10318 244.76337 605.7375 324.13896 599C410.14931 592.59482 491.78678 546.65542 542.25612 476.85716C591.38066 410.52863 610.62695 323.06006 594.32013 241.94834C582.33252 179.85678 549.77957 122.31301 503.48268 79.542111L446.82104 145.3278C492.47682 188.36222 517.40612 251.88493 512.7059 314.55239C510.64986 345.60095 501.6323 376.24272 486.39163 403.51183L370.91956 291.97369L312.65956 166.39103L312.57196 356.56928L429.26718 469.49587C377.26528 509.89795 305.91423 523.29836 242.68945 505.3899C216.94556 498.20866 192.5676 486.15956 171.38066 469.99174L288.86927 356.56928C288.66446 294.7385 289.58677 227.99247 288.86858 166.18668L230.52166 291.97369L114.05785 404.43746C78.527382 342.41258 77.677472 262.22696 111.87602 199.51008C122.56705 179.41818 136.71708 161.08207 153.13257 145.3278L96.470932 79.542111C95.523262 80.445701 94.575592 81.349281 93.627932 82.252881Z"
        fill={colors.graphite}
      />
    </svg>
  );
}

interface BrandIconProps {
  size: number;
}

export function BrandIcon({ size }: BrandIconProps) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        background: colors.surface
      }}
    >
      <OverwatchMark size={Math.round(size * 0.78)} />
    </div>
  );
}

interface SocialCardProps {
  width: number;
  height: number;
}

export function SocialCard({ width, height }: SocialCardProps) {
  const markSize = Math.round(Math.min(width, height) * 0.55);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, rgba(250, 156, 30, 0.08), transparent 32%), linear-gradient(180deg, #fafaf8 0%, #f3f3f0 100%)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: markSize + 120,
          height: markSize + 120,
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.88)",
          boxShadow: `0 24px 70px ${colors.shadow}`
        }}
      >
        <OverwatchMark size={markSize} />
      </div>
    </div>
  );
}
