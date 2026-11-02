"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface PickedPlace {
  placeId: string;
  name: string;
  detail: string;
}

interface Suggestion {
  placeId: string;
  name: string;
  detail: string;
}

/**
 * Practice name field with Google autocomplete.
 * When Google isn't configured it behaves like a plain text field.
 */
export default function PracticeSearch(props: {
  value: string;
  picked: PickedPlace | null;
  sessionToken: string;
  onType: (v: string) => void;
  onPick: (p: PickedPlace) => void;
  onConfigured: (configured: boolean) => void;
}) {
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const reqId = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  // Debounced lookup while typing; skipped once a suggestion is picked.
  useEffect(() => {
    const q = props.value.trim();
    if (props.picked && props.picked.name === props.value) return;
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const id = ++reqId.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: q, sessionToken: props.sessionToken }),
        });
        const data = await res.json();
        if (id !== reqId.current) return;
        props.onConfigured(data.configured !== false);
        if (data.configured === false) return;
        setUnavailable(!res.ok);
        setItems(data.suggestions ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        if (id === reqId.current) setUnavailable(true);
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  // Close when clicking elsewhere.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: Suggestion) => {
    reqId.current++; // ignore any lookup still in flight
    props.onPick(s);
    setOpen(false);
    setItems([]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && (items.length > 0 || props.value.trim().length >= 2);

  return (
    <div className="search" ref={box}>
      <input
        id="in-name"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Start typing your practice name"
        value={props.value}
        onChange={(e) => props.onType(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKey}
      />
      {showList && (
        <div className="suggest">
          <ul id={listId} role="listbox" aria-label="Matching practices">
            {items.map((s, i) => (
              <li
                key={s.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <b>{s.name}</b>
                <span>{s.detail}</span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="empty" role="presentation">
                {unavailable ? "Search is unavailable right now. Try again in a minute." : "No South Bay matches yet. Keep typing."}
              </li>
            )}
          </ul>
          <p className="powered">Results from Google</p>
        </div>
      )}
      {props.picked && props.picked.name === props.value && (
        <p className="picked">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {props.picked.detail || "Found on Google"}
        </p>
      )}
    </div>
  );
}
