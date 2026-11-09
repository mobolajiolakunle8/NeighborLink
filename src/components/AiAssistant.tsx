"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ASSISTANT_GREETING, ASSISTANT_SUGGESTIONS, answerQuestion, logAssistantTurn, type AssistantReply } from "@/lib/ai-assistant";
import { Spinner } from "./ui";

interface Turn { id: number; role: "user" | "assistant"; text: string; links?: AssistantReply["links"]; suggestions?: string[] }

let turnId = 0;
function nextId() { turnId += 1; return turnId; }

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    { id: nextId(), role: "assistant", text: ASSISTANT_GREETING.answer, links: ASSISTANT_GREETING.links, suggestions: ASSISTANT_GREETING.suggestions },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { firebaseUser } = useAuth();

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [turns, thinking]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const clean = question.trim();
    if (!clean || thinking) return;
    setInput("");
    setTurns(t => [...t, { id: nextId(), role: "user", text: clean }]);
    setThinking(true);
    // Brief delay so the reply reads as a considered answer rather than an instant echo.
    await new Promise(r => setTimeout(r, 420));
    const reply = answerQuestion(clean);
    setThinking(false);
    setTurns(t => [...t, { id: nextId(), role: "assistant", text: reply.answer, links: reply.links, suggestions: reply.suggestions }]);
    void logAssistantTurn({ question: clean, answer: reply.answer, intent: reply.intent, links: reply.links, pagePath: pathname || "/", uid: firebaseUser?.uid ?? null });
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void ask(input); }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="nl-assistant-panel"
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 left-5 z-[60] flex items-center gap-2 rounded-full bg-forest py-3 pl-3 pr-4 text-cream shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-gold"
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gold text-forest">
          {open ? <X size={17} aria-hidden /> : <MessageCircleQuestion size={18} aria-hidden />}
          {!open && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-gold ring-2 ring-forest" aria-hidden />}
        </span>
        <span className="hidden text-sm font-extrabold sm:inline">{open ? "Close" : "Ask NeighbourLink"}</span>
      </button>

      <div
        id="nl-assistant-panel"
        ref={panelRef}
        role="dialog"
        aria-label="NeighbourLink assistant"
        aria-hidden={!open}
        className={`fixed bottom-20 left-3 right-3 z-[60] flex max-h-[75vh] origin-bottom-left flex-col overflow-hidden rounded-3xl border border-line bg-cream shadow-2xl transition-all duration-300 sm:left-5 sm:w-[380px] ${
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <header className="flex items-center gap-3 border-b border-line bg-forest px-4 py-3 text-cream">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-forest"><Bot size={19} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight">NeighbourLink guide</p>
            <p className="text-[11px] text-sage/80">Navigation & FAQ assistant</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full p-1.5 transition hover:bg-white/10"><X size={17} aria-hidden /></button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Conversation">
          {turns.map(turn => (
            <div key={turn.id} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${turn.role === "user" ? "rounded-br-sm bg-forest text-cream" : "rounded-bl-sm border border-line bg-white text-forest"}`}>
                {turn.role === "assistant" && <p className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-bronze"><Sparkles size={11} aria-hidden /> Guide</p>}
                <p className="whitespace-pre-wrap">{turn.text}</p>
                {turn.links && turn.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {turn.links.map(l => (
                      <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)} className="inline-flex items-center rounded-full bg-sage px-2.5 py-1 text-xs font-bold text-forest transition hover:bg-gold-soft">{l.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2.5 text-sm text-muted">
                <Spinner /> Thinking…
              </div>
            </div>
          )}
        </div>

        {turns.at(-1)?.suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5 border-t border-line bg-white px-4 py-2.5">
            {turns.at(-1)!.suggestions!.map(s => (
              <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-forest transition hover:border-forest hover:bg-sage">{s}</button>
            ))}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line bg-white p-3">
          <label className="sr-only" htmlFor="nl-assistant-input">Ask the assistant</label>
          <input
            id="nl-assistant-input"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask how the site works…"
            className="input !rounded-full !py-2.5 !text-sm"
            autoComplete="off"
          />
          <button type="submit" disabled={!input.trim() || thinking} aria-label="Send question" className="btn-primary !p-3">{thinking ? <Spinner /> : <Send size={17} />}</button>
        </form>
      </div>
    </>
  );
}
