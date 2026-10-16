import { highlight } from "@/core/search";

/** Hebt Suchtreffer im Text hervor. */
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  return (
    <>
      {highlight(text, q).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded-[4px] bg-[color-mix(in_oklab,var(--amber)_28%,transparent)] px-0.5 text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
