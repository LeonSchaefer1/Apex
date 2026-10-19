import { highlight } from "@/core/search";

/** Hebt Suchtreffer im Text hervor. */
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>;
  return (
    <>
      {highlight(text, q).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded-[2px] bg-[var(--selection)] px-0.5 text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
