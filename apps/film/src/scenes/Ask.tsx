import { Icon } from "@ledgerline/ui";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { AnswerBody, Reading, ToolOverride } from "../../../web/components/app/chat/Message";
import { CONVERSATIONS, TOOLS } from "../../../web/components/landing/aiSamples";
import { Aurora, Chapter, Typed, Words } from "../lib/fx";
import { backOut, clamp, expoOut, prog, spring, useT } from "../lib/time";

/** The chat's tools answered from the sample company's real results, as the homepage does. */
export function SampleTools({ children, delay = 700 }: { children: ReactNode; delay?: number }) {
  const tools = useMemo(
    () => Object.fromEntries(Object.entries(TOOLS).map(([name, data]) => [name, () => new Promise((r) => setTimeout(() => r(data), delay))])),
    [delay],
  );
  return <ToolOverride.Provider value={tools}>{children}</ToolOverride.Provider>;
}

function Key({ label, down, wide }: { label: string; down: number; wide?: boolean }) {
  return (
    <span
      className={`ask-key${wide ? " is-wide" : ""}`}
      style={{
        transform: `translateY(${down * 14}px)`,
        boxShadow: `0 ${22 - down * 16}px 0 #0b100e, 0 ${40 - down * 20}px 60px -10px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.08), 0 0 ${down * 60}px rgba(69,192,143,${down * 0.5})`,
      }}
    >
      {label}
    </span>
  );
}

const CONVO = CONVERSATIONS[0];
const QUESTION = CONVO.question;
const AT = { type: 3.0, send: 5.2, bubble: 5.3, step1: 5.7, step2: 6.4, write: 7.4 };
const PROSE_CPS = 170;
const UI_CPS = 900;

/**
 * The Ask window answering its question, timed from its own start (typing at 3 s, the answer from 7.4 s). The film
 * and the shorts both use it.
 */
export function AskWindow() {
  const t = useT();
  const [prose, ui] = useMemo(() => {
    const at = CONVO.answer.indexOf("```ui");
    return [CONVO.answer.slice(0, at).trimEnd(), CONVO.answer.slice(at)];
  }, []);
  const proseChars = clamp(Math.floor((t - AT.write) * PROSE_CPS), 0, prose.length);
  const uiStart = AT.write + prose.length / PROSE_CPS + 0.3;
  const uiChars = clamp(Math.floor((t - uiStart) * UI_CPS), 0, ui.length);
  const done = uiChars >= ui.length;
  const content = proseChars < prose.length ? prose.slice(0, proseChars) : `${prose}\n\n${ui.slice(0, uiChars)}`;
  const steps = CONVO.steps.slice(0, t >= AT.step2 ? 2 : t >= AT.step1 ? 1 : 0).map(([tool, label]) => ({ tool, label }));
  const phase = done ? "done" : t >= AT.write ? "writing" : t >= AT.step1 ? "reading" : "thinking";

  const scroller = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, el.scrollHeight - el.clientHeight);
    pos.current += (target - pos.current) * 0.08;
    el.scrollTop = pos.current;
  });

  return (
    <div className="ask-zoom">
      <div className="lp-ask-window ask-window">
        <div className="lp-ask-head">
          <span className="ll-ask-orb" aria-hidden />
          <div>
            <strong>Ask Ledgerline</strong>
            <span>Kestrel Joinery Ltd</span>
          </div>
        </div>
        <SampleTools>
          <div className="lp-ask-scroll" ref={scroller}>
            {t >= AT.bubble ? (
              <div className="ll-ask-thread">
                <div className="ll-ask-q">{QUESTION}</div>
                <div className="ll-ask-a">
                  <Reading steps={steps} phase={phase} />
                  {proseChars > 0 ? <AnswerBody content={content} live={!done} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        </SampleTools>
        <div className={`lp-ask-composer ask-composer${t > AT.type - 0.3 && t < AT.send ? " is-typing" : ""}`}>
          <span className={t >= AT.type && t < AT.send ? "ask-typed" : undefined}>
            {t >= AT.type && t < AT.send ? <Typed text={QUESTION} at={AT.type} cps={22} /> : "Ask a follow-up…"}
          </span>
          <span className="lp-ask-send" style={{ transform: `scale(${t > AT.send - 0.1 && t < AT.send + 0.12 ? 0.85 : 1})` }}>
            <Icon name="arrow-up" size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** 39–55s: Ctrl J, a question in plain English, and the answer with its chart, drawn from the books. */
export function Ask() {
  const t = useT();
  const p1 = spring(t, 0.95, { stiffness: 500, damping: 22 }) * (1 - spring(t, 1.35, { stiffness: 300, damping: 20 }));
  const p2 = spring(t, 1.1, { stiffness: 500, damping: 22 }) * (1 - spring(t, 1.45, { stiffness: 300, damping: 20 }));
  const keysOut = prog(t, 2.0, 2.6);
  const win = prog(t, 2.2, 3.0, expoOut);
  const out = prog(t, 15.5, 16);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out }}>
      <Aurora strength={0.9} hue="forecast" />
      <Chapter n="03" name="Ask Ledgerline" at={2.3} />
      {keysOut < 1 ? (
        <div className="t-center" style={{ opacity: 1 - keysOut, transform: `scale(${1 + keysOut * 0.6})`, filter: `blur(${keysOut * 14}px)` }}>
          <div className="ask-keys" style={{ transform: `scale(${0.9 + backOut(clamp(t / 0.6)) * 0.1})`, opacity: prog(t, 0, 0.3) }}>
            <Key label="Ctrl" down={p1} wide />
            <span className="ask-plus">+</span>
            <Key label="J" down={p2} />
          </div>
          <div className="t-mono ask-anywhere" style={{ opacity: prog(t, 0.5, 1.0) }}>
            On any page
          </div>
        </div>
      ) : null}

      <div className="ask-left" style={{ opacity: win }}>
        <div className="t-mid">
          <Words text="Ask about your business." at={2.6} stagger={0.07} />
        </div>
        <div className="t-mid ask-second">
          <Words text="Get the answer *and the chart.*" at={3.3} stagger={0.08} />
        </div>
        <ul className="ask-points">
          {[
            ["search", "It reads only the parts of your books it needs."],
            ["statement", "Charts and tiles are filled from your figures, never typed by the model."],
            ["lock", "Your questions and its answers are kept privately for you."],
          ].map(([icon, text], i) => (
            <li
              key={text}
              style={{
                opacity: prog(t, 9.5 + i * 0.6, 10.1 + i * 0.6),
                transform: `translateX(${(1 - prog(t, 9.5 + i * 0.6, 10.3 + i * 0.6, expoOut)) * -30}px)`,
              }}
            >
              <span>
                <Icon name={icon as never} size={20} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="ask-pos" style={{ opacity: win, transform: `translateY(${(1 - win) * 120}px) rotateY(${(1 - win) * -14}deg)` }}>
        <AskWindow />
      </div>
    </div>
  );
}
