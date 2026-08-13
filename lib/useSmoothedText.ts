import { useCallback, useEffect, useRef, useState } from "react";

const BASE_CHARS_PER_SEC = 72;
const BACKLOG_THRESHOLD = 120;
const MAX_CATCHUP_MULT = 6;

/**
 * Decouples network text from on-screen rendering. Uses fractional character
 * accumulation and soft word-boundary snapping for a steady, non-chunky reveal.
 */
export function useSmoothedText() {
  const [displayedText, setDisplayedText] = useState("");
  const pendingRef = useRef("");
  const displayedLenRef = useRef(0);
  const charAccRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const streamDoneRef = useRef(false);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  const snapToWordBoundary = (text: string, pos: number) => {
    if (pos >= text.length) return pos;
    const next = text.slice(pos, pos + 8);
    const space = next.search(/[\s\n]/);
    if (space > 0 && space <= 4) return pos + space;
    return pos;
  };

  const tick = useCallback(
    (now: number) => {
      const pending = pendingRef.current;
      const displayed = displayedLenRef.current;
      const backlog = pending.length - displayed;

      if (backlog <= 0) {
        stopLoop();
        return;
      }

      const last = lastFrameRef.current ?? now;
      const dt = Math.min(now - last, 32) / 1000;
      lastFrameRef.current = now;

      let rate = BASE_CHARS_PER_SEC;
      if (backlog > BACKLOG_THRESHOLD) {
        const mult = Math.min(MAX_CATCHUP_MULT, backlog / BACKLOG_THRESHOLD);
        rate *= mult;
      }

      charAccRef.current += rate * dt;
      let chars = Math.floor(charAccRef.current);
      if (chars < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      charAccRef.current -= chars;

      let target = Math.min(pending.length, displayed + chars);
      if (backlog > 20 && target < pending.length) {
        const snapped = snapToWordBoundary(pending, target);
        if (snapped > displayed) target = snapped;
      }

      displayedLenRef.current = target;
      setDisplayedText(pending.slice(0, target));
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopLoop]
  );

  const ensureLoop = useCallback(() => {
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const push = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      pendingRef.current += chunk;
      ensureLoop();
    },
    [ensureLoop]
  );

  const finish = useCallback(() => {
    streamDoneRef.current = true;
    ensureLoop();
  }, [ensureLoop]);

  const reset = useCallback(() => {
    stopLoop();
    pendingRef.current = "";
    displayedLenRef.current = 0;
    charAccRef.current = 0;
    streamDoneRef.current = false;
    setDisplayedText("");
  }, [stopLoop]);

  const isCaughtUp = useCallback(() => {
    return displayedLenRef.current >= pendingRef.current.length;
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  return { displayedText, push, finish, reset, isCaughtUp };
}
