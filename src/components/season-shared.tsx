import { ReactNode } from "react";

export function StatCard(props: { label: string; value: string; tone?: "default" | "accent" }) {
  return (
    <div
      className={`ow-panel-light ow-grid-surface flex h-full flex-col px-5 py-5 ${
        props.tone === "accent"
          ? "border-emerald-300/25 bg-[linear-gradient(180deg,rgba(226,247,236,0.95)_0%,rgba(205,240,222,0.98)_100%)] text-[#173727]"
          : "text-[var(--ow-text)]"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.22em] ${
          props.tone === "accent" ? "text-[#17603c]" : "text-[var(--ow-muted)]"
        }`}
      >
        {props.label}
      </p>
      <p className="mt-3 text-2xl font-semibold">{props.value}</p>
    </div>
  );
}

export function Panel(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="ow-cut-panel ow-appear ow-grid-surface p-5 text-[var(--ow-text)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="ow-title text-sm font-semibold uppercase text-slate-950">{props.title}</h3>
          {props.description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--ow-muted)]">{props.description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}
