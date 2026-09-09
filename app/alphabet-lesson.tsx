"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const LETTERS = ["a", "b", "c", "d", "e"] as const;

const TILE_COLORS = [
  "bg-rose-200 text-rose-700",
  "bg-amber-200 text-amber-700",
  "bg-emerald-200 text-emerald-700",
  "bg-sky-200 text-sky-700",
  "bg-violet-200 text-violet-700",
];

// Shown after "Next": one draggable card per letter
const SAMPLES = [
  { letter: "A", word: "Apple", emoji: "🍎" },
  { letter: "B", word: "Bike", emoji: "🚲" },
  { letter: "C", word: "Cat", emoji: "🐱" },
  { letter: "D", word: "Dog", emoji: "🐶" },
  { letter: "E", word: "Egg", emoji: "🥚" },
];

// Faint letters drifting behind the start screen
const FLOATING_LETTERS = [
  {
    ch: "A",
    top: "10%",
    left: "7%",
    size: "clamp(3rem, 11vw, 8rem)",
    dur: "7s",
    delay: "0s",
    color: "text-rose-400/20",
  },
  {
    ch: "E",
    top: "58%",
    left: "24%",
    size: "clamp(3.5rem, 14vw, 9rem)",
    dur: "9s",
    delay: "-2s",
    color: "text-violet-400/25",
  },
  {
    ch: "C",
    top: "18%",
    left: "74%",
    size: "clamp(3.5rem, 13vw, 9rem)",
    dur: "8s",
    delay: "-4s",
    color: "text-emerald-400/20",
  },
  {
    ch: "B",
    top: "68%",
    left: "12%",
    size: "clamp(2.5rem, 9vw, 6rem)",
    dur: "10s",
    delay: "-1s",
    color: "text-amber-400/25",
  },
  {
    ch: "D",
    top: "70%",
    left: "78%",
    size: "clamp(2.5rem, 10vw, 6.5rem)",
    dur: "8.5s",
    delay: "-5s",
    color: "text-sky-400/20",
  },
  {
    ch: "D",
    top: "6%",
    left: "44%",
    size: "clamp(1.75rem, 5vw, 3rem)",
    dur: "6.5s",
    delay: "-3s",
    color: "text-sky-400/20",
  },
  {
    ch: "A",
    top: "84%",
    left: "46%",
    size: "clamp(1.75rem, 5vw, 3rem)",
    dur: "7.5s",
    delay: "-1.5s",
    color: "text-rose-400/20",
  },
  {
    ch: "C",
    top: "38%",
    left: "5%",
    size: "clamp(1.75rem, 5vw, 3rem)",
    dur: "11s",
    delay: "-6s",
    color: "text-emerald-400/20",
  },
  {
    ch: "B",
    top: "52%",
    left: "88%",
    size: "clamp(1.75rem, 5vw, 3rem)",
    dur: "9.5s",
    delay: "-4s",
    color: "text-amber-400/25",
  },
];

function FloatingLetters() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {FLOATING_LETTERS.map((f, i) => (
        <span
          key={i}
          className={`float-letter absolute font-display font-bold select-none ${f.color}`}
          style={{
            top: f.top,
            left: f.left,
            fontSize: f.size,
            animationDuration: f.dur,
            animationDelay: f.delay,
          }}
        >
          {f.ch}
        </span>
      ))}
    </div>
  );
}

// Timeline
const FADE_OUT_MS = 500; // start screen fades away (matches its CSS duration)
const REVEAL_STAGGER_MS = 450; // gap between each letter sliding up
const REVEAL_SETTLE_MS = 550; // matches the CSS transition duration
const PAUSE_BEFORE_AUDIO_MS = 2000; // beat after the letters are all up
const GAP_BETWEEN_LETTERS_MS = 1000; // silence between each spoken letter
const MAX_AUDIO_MS = 6000; // safety cap if an audio file never fires ended/error
const MAX_TTS_MS = 3500; // safety cap for speech synthesis (some browsers skip onend)

// Candidate locations for a letter's recorded clip, tried in order. Drop the
// file in /public as letter-a.mp3 (or .wav), or in /public/audio/ — any of
// these work. If none load, the lesson falls back to the browser voice.
const clipSources = (letter: string) => [
  `/audio/letter-${letter}.mp3`,
  `/audio/letter-${letter}.wav`,
  `/letter-${letter}.mp3`,
  `/letter-${letter}.wav`,
];

// One <audio> element for the whole lesson. Reusing a single element that was
// first played inside a click handler keeps it "unlocked" for the later,
// gesture-less plays (Safari/iOS in particular only unlock the element you
// actually played from a user gesture).
let sharedAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

// Fallback voice: if there's no working /letter-x.wav, have the browser say the
// letter out loud. Works with no assets at all.
function speakWithTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return resolve();
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
      setTimeout(finish, MAX_TTS_MS);
    } catch {
      resolve();
    }
  });
}

function stopTTS() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

// Play a list of clips back-to-back through the shared element.
function playClips(sources: string[]) {
  const audio = getAudio();
  if (!audio) return;
  let i = 0;
  const next = () => {
    if (i >= sources.length) {
      audio.onended = null;
      return;
    }
    audio.onended = next;
    audio.volume = 1;
    audio.src = sources[i++];
    try {
      audio.currentTime = 0;
    } catch {}
    audio.play().catch(next);
  };
  next();
}

function stopClips() {
  if (sharedAudio) {
    sharedAudio.onended = null;
    try {
      sharedAudio.pause();
    } catch {}
  }
}

type Phase =
  "idle" | "revealing" | "pausing" | "speaking" | "done" | "samples" | "score";

// A picture card that can be dragged with a mouse or a finger onto its letter.
function SampleCard({
  index,
  emoji,
  label,
  letter,
  matched,
  locked,
  onDrop,
}: {
  index: number;
  emoji: string;
  label: string;
  letter: string;
  matched: boolean;
  locked: boolean;
  onDrop: (letter: string, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState(false);
  const startRef = useRef({ px: 0, py: 0, x: 0, y: 0 });
  const draggingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80 + index * 90);
    return () => clearTimeout(t);
  }, [index]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (matched || locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { px: e.clientX, py: e.clientY, x: drag.x, y: drag.y };
    draggingRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const s = startRef.current;
    setDrag({ x: s.x + (e.clientX - s.px), y: s.y + (e.clientY - s.py) });
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const r = e.currentTarget.getBoundingClientRect();
    onDrop(letter, r.left + r.width / 2, r.top + r.height / 2);
  };

  return (
    <div
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        transform: `translate(${drag.x}px, ${drag.y}px) scale(${
          matched ? 0.3 : shown ? 1 : 0.9
        })`,
        opacity: matched ? 0 : locked ? 0.35 : shown ? 1 : 0,
        filter: locked ? "grayscale(0.9)" : undefined,
        transition: dragging
          ? "none"
          : "transform 220ms ease, opacity 220ms ease, filter 220ms ease",
        touchAction: "none",
        pointerEvents: matched || locked ? "none" : "auto",
      }}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-white text-2xl shadow-lg select-none sm:h-16 sm:w-16 sm:text-3xl lg:h-20 lg:w-20 lg:text-4xl ${
        locked
          ? "cursor-not-allowed border-zinc-200"
          : dragging
            ? "z-30 cursor-grabbing border-zinc-200 shadow-2xl"
            : "z-20 cursor-grab border-amber-400 ring-4 ring-amber-200"
      }`}
    >
      <span aria-hidden>{emoji}</span>
    </div>
  );
}

export default function AlphabetLesson() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [leaving, setLeaving] = useState(false); // start screen is fading out
  const [revealedCount, setRevealedCount] = useState(0);
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [wrong, setWrong] = useState<string | null>(null); // letter flashing red
  const [fading, setFading] = useState(false); // a screen is fading out
  const [entering, setEntering] = useState(false); // start screen fading back in

  const runRef = useRef(0); // bumped on every start()/replay to cancel a run in flight
  const finishRef = useRef<(() => void) | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tileRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const openSamples = useCallback(() => {
    setMatched({});
    setWrong(null);
    setPhase("samples");
    // Cue the first card once its pop-in has settled.
    timeoutsRef.current.push(
      setTimeout(() => playClips([`/audio/drag-${LETTERS[0]}.mp3`]), 500),
    );
  }, []);

  const backToStart = useCallback(() => {
    stopClips();
    stopTTS();
    setFading(true); // fade the score board out
    timeoutsRef.current.push(
      setTimeout(() => {
        runRef.current += 1; // cancel any run still in flight
        finishRef.current?.();
        finishRef.current = null;
        setMatched({});
        setWrong(null);
        setLeaving(false);
        setFading(false);
        setRevealedCount(0);
        setSpeakingIndex(-1);
        setEntering(true); // start screen mounts hidden...
        setPhase("idle");
        // ...then fades in once that hidden state has painted
        timeoutsRef.current.push(setTimeout(() => setEntering(false), 60));
      }, 350),
    );
  }, []);

  // Finish: fade the drag screen out, then swap to the score board.
  const finishToScore = useCallback(() => {
    stopClips();
    setFading(true);
    timeoutsRef.current.push(
      setTimeout(() => {
        setFading(false);
        setPhase("score");
      }, 350),
    );
  }, []);

  // A picture card was dropped. Over the matching tile -> lock it in + chime.
  // Over a different tile -> flash that tile red for a moment.
  const handleSampleDrop = useCallback(
    (letter: string, x: number, y: number) => {
      const key = letter.toLowerCase();
      const correctIdx = LETTERS.indexOf(key as (typeof LETTERS)[number]);
      const over = (el: HTMLSpanElement | null, pad: number) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return (
          x >= r.left - pad &&
          x <= r.right + pad &&
          y >= r.top - pad &&
          y <= r.bottom + pad
        );
      };

      if (over(tileRefs.current[correctIdx], 28)) {
        setMatched((m) => ({ ...m, [key]: true }));
        const myIdx = SAMPLES.findIndex((s) => s.letter.toLowerCase() === key);
        const nextLetter = SAMPLES[myIdx + 1]?.letter.toLowerCase();
        // "correct" chime, then unlock + cue the next card.
        playClips(
          nextLetter
            ? ["/audio/correct.mp3", `/audio/drag-${nextLetter}.mp3`]
            : ["/audio/correct.mp3"],
        );
        return;
      }

      const wrongIdx = tileRefs.current.findIndex(
        (el, i) => i !== correctIdx && over(el, 0),
      );
      if (wrongIdx !== -1) {
        const wl = LETTERS[wrongIdx];
        setWrong(wl);
        timeoutsRef.current.push(
          setTimeout(() => setWrong((w) => (w === wl ? null : w)), 700),
        );
      }
    },
    [],
  );

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutsRef.current.push(setTimeout(resolve, ms));
      }),
    [],
  );

  const stopAudio = useCallback(() => {
    finishRef.current?.();
    finishRef.current = null;
    stopClips();
    stopTTS();
  }, []);

  const speak = useCallback((letter: string) => {
    return new Promise<void>((resolve) => {
      const audio = getAudio();
      const spoken = letter.toUpperCase();
      const sources = clipSources(letter);
      let sourceIndex = 0;
      let awaitingResult = false;
      let settled = false;

      const cap = setTimeout(() => finish(), MAX_AUDIO_MS);
      timeoutsRef.current.push(cap);

      const cleanup = () => {
        clearTimeout(cap);
        audio?.removeEventListener("ended", onEnded);
        audio?.removeEventListener("error", handleFailure);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      // Every candidate file failed -> let the browser say the letter instead.
      const fallbackToVoice = () => {
        if (settled) return;
        cleanup();
        void speakWithTTS(spoken).then(finish);
      };
      const tryNextSource = () => {
        if (settled) return;
        if (!audio || sourceIndex >= sources.length) return fallbackToVoice();
        awaitingResult = true;
        audio.volume = 1;
        audio.src = sources[sourceIndex++];
        try {
          audio.currentTime = 0;
        } catch {}
        audio.play().catch(handleFailure);
      };
      const handleFailure = () => {
        if (settled || !awaitingResult) return;
        awaitingResult = false;
        tryNextSource();
      };
      const onEnded = () => {
        awaitingResult = false;
        finish();
      };

      finishRef.current = () => {
        cleanup();
        stopTTS();
        finish();
      };

      if (!audio) {
        fallbackToVoice();
        return;
      }
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", handleFailure);
      tryNextSource();
    });
  }, []);

  const start = useCallback(async () => {
    runRef.current += 1;
    const run = runRef.current;
    const alive = () => runRef.current === run;

    stopAudio();

    // Unlock playback while we still have the click's user gesture. Prime the
    // <audio> element (play the first clip silently, then rewind) and nudge
    // speech synthesis with a silent utterance so the fallback voice is allowed
    // to speak later without a fresh gesture.
    const audio = getAudio();
    if (audio) {
      audio.volume = 0;
      audio.src = clipSources(LETTERS[0])[0];
      audio
        .play()
        .then(() => {
          if (alive()) audio.pause();
        })
        .catch(() => {});
    }
    try {
      const synth = window.speechSynthesis;
      if (synth) {
        const warmup = new SpeechSynthesisUtterance(" ");
        warmup.volume = 0;
        synth.speak(warmup);
      }
    } catch {}

    // Fade the start screen away before the letters begin.
    if (phase === "idle") {
      setLeaving(true);
      await wait(FADE_OUT_MS);
      if (!alive()) return;
    }

    setRevealedCount(0);
    setSpeakingIndex(-1);
    setMatched({});
    setWrong(null);
    setFading(false);
    setEntering(false);
    setPhase("revealing");

    for (let i = 0; i < LETTERS.length; i++) {
      if (!alive()) return;
      setRevealedCount(i + 1);
      await wait(REVEAL_STAGGER_MS);
    }
    await wait(REVEAL_SETTLE_MS);

    if (!alive()) return;
    setPhase("pausing");
    await wait(PAUSE_BEFORE_AUDIO_MS);

    if (!alive()) return;
    setPhase("speaking");
    for (let i = 0; i < LETTERS.length; i++) {
      if (!alive()) return;
      setSpeakingIndex(i);
      await speak(LETTERS[i]);
      if (!alive()) return;
      if (i < LETTERS.length - 1) await wait(GAP_BETWEEN_LETTERS_MS);
    }

    if (!alive()) return;
    setSpeakingIndex(-1);
    await wait(400);
    if (!alive()) return;
    setPhase("done");
  }, [phase, wait, speak, stopAudio]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      runRef.current += 1;
      timeouts.forEach(clearTimeout);
      stopClips();
      stopTTS();
    };
  }, []);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden bg-white px-4 py-8 text-center sm:gap-16 sm:px-6 sm:py-16">
      {phase === "idle" ? (
        <div
          className={`transition-opacity duration-500 ease-out ${
            leaving || entering ? "opacity-0" : "opacity-100"
          }`}
        >
          <FloatingLetters />

          <div className="relative z-10 flex flex-col items-center gap-6">
            <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Let&apos;s learn A to E
            </h1>
            <p className="max-w-md text-lg text-zinc-600">
              Press the button and watch the letters appear.
            </p>
            <button
              type="button"
              onClick={start}
              className="font-display cursor-pointer rounded-full bg-zinc-900 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              Start lesson
            </button>
          </div>
        </div>
      ) : phase === "score" ? (
        (() => {
          const score = SAMPLES.reduce(
            (n, s) => n + (matched[s.letter.toLowerCase()] ? 1 : 0),
            0,
          );
          const message =
            score === SAMPLES.length
              ? "Perfect! You got them all."
              : score >= 3
                ? "Well done!"
                : "Good try , play again!";
          return (
            <div
              className={`transition-opacity duration-300 ${
                fading ? "opacity-0" : "opacity-100"
              }`}
            >
              <FloatingLetters />

              <div className="fade-in relative z-10 flex flex-col items-center gap-6">
                <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                  Great job!
                </h1>
                <p className="font-display text-6xl font-bold text-emerald-500">
                  {score} / {SAMPLES.length}
                </p>
                <p
                  className="text-2xl tracking-[0.2em]"
                  aria-label={`${score} out of ${SAMPLES.length} stars`}
                >
                  {"★".repeat(score)}
                  <span className="text-zinc-300">
                    {"★".repeat(SAMPLES.length - score)}
                  </span>
                </p>

                <p className="text-lg text-zinc-600">{message}</p>
                <button
                  type="button"
                  onClick={backToStart}
                  className="font-display cursor-pointer rounded-full bg-zinc-900 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
                >
                  Back to start
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <div
          className={`flex flex-col items-center gap-16 transition-opacity duration-300 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-6">
            {/* reserved so the letters don't move when the prompt appears */}
            <div className="flex min-h-8 items-center sm:min-h-9">
              {phase === "samples" && (
                <p className="font-display text-lg font-semibold text-zinc-700 sm:text-2xl">
                  Drag each picture to its letter!
                </p>
              )}
            </div>
            <div
              role="group"
              aria-label="Letters A to E"
              className="flex items-start gap-1 sm:gap-3 lg:gap-5"
            >
              {LETTERS.map((letter, i) => {
                const revealed = i < revealedCount;
                const speaking = i === speakingIndex;
                const isMatched = phase === "samples" && matched[letter];
                const translateY = !revealed
                  ? "translate-y-20 sm:translate-y-28"
                  : speaking
                    ? "-translate-y-2 sm:-translate-y-3"
                    : "translate-y-0";
                const color =
                  phase === "samples"
                    ? matched[letter]
                      ? "border-4 border-emerald-500 bg-emerald-50 text-emerald-600"
                      : wrong === letter
                        ? "border-4 border-red-500 bg-red-50 text-red-600"
                        : "border-4 border-dashed border-zinc-300 bg-white text-zinc-400"
                    : TILE_COLORS[i];
                const emoji = SAMPLES.find(
                  (s) => s.letter.toLowerCase() === letter,
                )?.emoji;
                return (
                  <div
                    key={letter}
                    className="flex flex-col items-center gap-2"
                  >
                    <span
                      ref={(el) => {
                        tileRefs.current[i] = el;
                      }}
                      className={[
                        "font-display flex h-14 w-14 items-center justify-center rounded-xl text-3xl font-bold",
                        "transition-all duration-500 ease-out sm:h-20 sm:w-20 sm:rounded-2xl sm:text-4xl lg:h-28 lg:w-28 lg:rounded-3xl lg:text-6xl",
                        color,
                        translateY,
                        revealed ? "opacity-100" : "opacity-0",
                        speaking
                          ? "scale-110 shadow-xl ring-4 ring-zinc-900/10"
                          : "scale-100",
                      ].join(" ")}
                    >
                      {letter.toUpperCase()}
                    </span>
                    {/* reserved so the row height never changes as icons appear */}
                    <span
                      className="flex min-h-8 items-center text-2xl sm:min-h-10 sm:text-4xl"
                      aria-hidden
                    >
                      {isMatched && emoji ? (
                        <span className="pop-in">{emoji}</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* reserved so the letters don't move when the buttons appear */}
          <div className="flex min-h-12 items-center sm:min-h-14">
            {(phase === "done" ||
              (phase === "samples" &&
                SAMPLES.every((s) => matched[s.letter.toLowerCase()]))) && (
              <div className="pop-up relative z-40 flex gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={start}
                  className="font-display cursor-pointer rounded-full border-2 border-zinc-900 px-5 py-2 text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 sm:px-7 sm:py-2.5 sm:text-lg"
                >
                  Replay
                </button>
                <button
                  type="button"
                  onClick={phase === "samples" ? finishToScore : openSamples}
                  className="font-display cursor-pointer rounded-full bg-zinc-900 px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-zinc-700 sm:px-7 sm:py-2.5 sm:text-lg"
                >
                  {phase === "samples" ? "Finish" : "Next"}
                </button>
              </div>
            )}
          </div>

          {phase === "samples" &&
            (() => {
              // First unmatched card is the only draggable one.
              const activeIndex = SAMPLES.findIndex(
                (s) => !matched[s.letter.toLowerCase()],
              );
              return (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-wrap items-center justify-center gap-2 px-4 sm:bottom-6 lg:inset-x-auto lg:right-8 lg:bottom-auto lg:top-24 lg:flex-col lg:flex-nowrap lg:gap-4 lg:px-0">
                  {SAMPLES.map((s, i) => (
                    <SampleCard
                      key={s.letter}
                      index={i}
                      emoji={s.emoji}
                      letter={s.letter}
                      label={`${s.letter} for ${s.word}`}
                      matched={!!matched[s.letter.toLowerCase()]}
                      locked={activeIndex !== -1 && i > activeIndex}
                      onDrop={handleSampleDrop}
                    />
                  ))}
                </div>
              );
            })()}
        </div>
      )}
    </main>
  );
}
