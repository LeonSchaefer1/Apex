// Einheitlicher Zugang zu Claude – über den Kanzlei-Server (Anthropic API) oder die Artefakt-Laufzeit.
import { getBackend } from "@/lib/backend";
import { useAiStatus, fallbackAufDemo, type KiQuelle } from "./status";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export class DemoModus extends Error {
  constructor() {
    super("demo");
  }
}

export function aktuelleQuelle(): KiQuelle {
  return useAiStatus.getState().quelle;
}

const PERMANENT = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

function sampleErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code && PERMANENT.has(code)) {
    fallbackAufDemo();
    return "Die Live-KI wurde in dieser Ansicht nicht freigegeben – AnwaltApex nutzt jetzt die Demo-KI.";
  }
  if (code === "rate_limited") return "Die KI ist gerade ausgelastet. Bitte versuchen Sie es in einer Minute erneut.";
  if (code === "cancelled") return "abgebrochen";
  return (e as { message?: string })?.message ?? "Die KI ist gerade nicht erreichbar.";
}

/** Freitext von Claude. Im Demo-Modus wirft die Funktion `DemoModus` – Aufrufer nutzen dann die Offline-Logik. */
export async function llmText(opts: {
  system: string;
  messages: LlmMessage[];
  onText?: (text: string) => void;
  signal?: AbortSignal;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<string> {
  const quelle = aktuelleQuelle();
  if (quelle === "demo") throw new DemoModus();
  if (quelle === "artefakt") {
    const sample = useAiStatus.getState().sample;
    if (!sample) throw new DemoModus();
    const turns = [{ role: "user" as const, content: `${opts.system}\n\n---\n\n${opts.messages[0]?.content ?? ""}` }, ...opts.messages.slice(1)];
    try {
      const r = await sample(turns, {
        onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
        signal: opts.signal,
        modelTier: opts.effort === "high" ? "complex" : opts.effort === "low" ? "quick" : "default",
        cache: false,
      });
      return r.text;
    } catch (e) {
      throw new Error(sampleErrorText(e));
    }
  }
  let acc = "";
  const res = await getBackend().aiStream!(
    { system: opts.system, messages: opts.messages, effort: opts.effort, maxTokens: opts.maxTokens },
    (delta) => {
      acc += delta;
      opts.onText?.(acc);
    },
    opts.signal,
  );
  return res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") || acc;
}

/** JSON von Claude (tolerant geparst). */
export async function llmJson<T>(opts: Parameters<typeof llmText>[0]): Promise<T> {
  const text = await llmText({ ...opts, system: `${opts.system}\n\nAntworte ausschließlich mit gültigem JSON ohne Erläuterungen davor oder danach.` });
  return parseJsonTolerant<T>(text);
}

export function parseJsonTolerant<T>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("Die KI-Antwort enthielt kein auswertbares Ergebnis.");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

/**
 * Agent mit Werkzeugen (Funktionen dieser App). Artefakt: native Tool-Unterstützung der Laufzeit.
 * Server: Werkzeug-Schleife im Browser, Claude-Aufrufe über den Server-Proxy.
 */
export async function llmAgent(opts: {
  system: string;
  messages: LlmMessage[];
  tools: AgentTool[];
  onText?: (text: string) => void;
  onTool?: (name: string, input: Record<string, unknown>) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const quelle = aktuelleQuelle();
  if (quelle === "demo") throw new DemoModus();

  if (quelle === "artefakt") {
    const sample = useAiStatus.getState().sample;
    if (!sample) throw new DemoModus();
    const turns = [{ role: "user" as const, content: opts.system }, ...opts.messages];
    try {
      const r = await sample(turns, {
        onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
        signal: opts.signal,
        modelTier: "default",
        tools: opts.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          execute: async (input: Record<string, unknown>) => {
            opts.onTool?.(t.name, input);
            return await t.execute(input);
          },
        })),
      });
      return r.text;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "tools_unavailable") {
        return llmText({ system: opts.system, messages: opts.messages, onText: opts.onText, signal: opts.signal });
      }
      throw new Error(sampleErrorText(e));
    }
  }

  // Server: manuelle Werkzeug-Schleife
  type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown; [k: string]: unknown };
  const msgs: { role: "user" | "assistant"; content: string | Block[] }[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const apiTools = opts.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  let shown = "";
  for (let runde = 0; runde < 6; runde++) {
    let rundeText = "";
    const res = await getBackend().aiStream!(
      { system: opts.system, messages: msgs, tools: apiTools, effort: "low" },
      (delta) => {
        rundeText += delta;
        opts.onText?.((shown ? shown + "\n\n" : "") + rundeText);
      },
      opts.signal,
    );
    if (rundeText) shown = (shown ? shown + "\n\n" : "") + rundeText;
    const toolUses = res.content.filter((b) => b.type === "tool_use") as Block[];
    if (res.stop_reason !== "tool_use" || !toolUses.length) break;
    msgs.push({ role: "assistant", content: res.content as Block[] });
    const results: Block[] = [];
    for (const tu of toolUses) {
      const tool = opts.tools.find((t) => t.name === tu.name);
      const input = (tu.input ?? {}) as Record<string, unknown>;
      opts.onTool?.(tu.name ?? "", input);
      try {
        const out = tool ? await tool.execute(input) : { fehler: "Unbekanntes Werkzeug" };
        results.push({ type: "tool_result", tool_use_id: tu.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 12000) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err instanceof Error ? err.message : String(err) });
      }
    }
    msgs.push({ role: "user", content: results });
  }
  return shown;
}
