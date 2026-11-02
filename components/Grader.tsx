"use client";

import { useEffect, useRef, useState } from "react";
import { PRACTICE_TYPES, SOUTH_BAY_CITIES, cityFromAddress } from "@/lib/practice-types";
import type { PracticeType, Report } from "@/lib/types";
import { CheckIcon, SparkleIcon } from "./icons";
import PracticeSearch, { type PickedPlace } from "./PracticeSearch";
import ReportView from "./ReportView";
import ScoreRing from "./ScoreRing";

type View = "start" | "quiz" | "scan" | "report";

export interface Lead {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
}

const EMPTY_LEAD: Lead = { firstName: "", lastName: "", role: "", email: "", phone: "" };
const ROLES = ["Owner / doctor", "Office manager", "Marketing", "Other"];

function newToken() {
  try {
    return crypto.randomUUID();
  } catch {
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

export default function Grader() {
  const [view, setView] = useState<View>("start");
  const [practiceName, setPracticeName] = useState("");
  const [city, setCity] = useState<string>(SOUTH_BAY_CITIES[0]);
  const [practiceType, setPracticeType] = useState<PracticeType | "">("");
  const [lead, setLead] = useState<Lead>(EMPTY_LEAD);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [configured, setConfigured] = useState(true);

  // Created on the client only, so server and browser renders match.
  useEffect(() => setSessionToken(newToken()), []);

  const go = (v: View) => {
    setView(v);
    setError("");
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    setPracticeType("");
    setStep(1);
    setReport(null);
    setPicked(null);
    setPracticeName("");
    setSessionToken(newToken());
    go("start");
  };

  if (view === "start") {
    return (
      <StartView
        practiceName={practiceName}
        picked={picked}
        sessionToken={sessionToken}
        city={city}
        error={error}
        onName={(v) => {
          setPracticeName(v);
          setError("");
        }}
        onPick={(p) => {
          setPicked(p);
          setPracticeName(p.name);
          setError("");
          const c = cityFromAddress(p.detail);
          if (c) setCity(c);
        }}
        onConfigured={setConfigured}
        onCity={setCity}
        onSubmit={() => {
          if (!practiceName.trim()) return setError("Enter your practice name to start.");
          if (configured && !(picked && picked.name === practiceName))
            return setError("Pick your practice from the list so we scan the right Google listing.");
          setStep(1);
          go("quiz");
        }}
      />
    );
  }

  if (view === "quiz") {
    const next = () => {
      if (step === 1 && !practiceType) return setError("Pick the option closest to your practice.");
      if (step === 2) {
        if (!lead.firstName.trim()) return setError("Add your first name.");
        if (!lead.role) return setError("Choose your role.");
      }
      if (step === 3) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) return setError("Enter a valid email, like name@practice.com.");
        if (lead.phone.replace(/\D/g, "").length < 10) return setError("Enter a 10-digit mobile number.");
        return go("scan");
      }
      setError("");
      setStep(step + 1);
    };
    const back = () => {
      if (step === 1) return go("start");
      setError("");
      setStep(step - 1);
    };
    return (
      <QuizView
        step={step}
        practiceName={practiceName.trim()}
        practiceType={practiceType}
        lead={lead}
        error={error}
        onType={(t) => {
          setPracticeType(t);
          setError("");
        }}
        onLead={(patch) => setLead((l) => ({ ...l, ...patch }))}
        onBack={back}
        onNext={next}
      />
    );
  }

  if (view === "scan" && practiceType) {
    return (
      <ScanView
        practiceName={practiceName.trim()}
        city={city}
        practiceType={practiceType}
        placeId={picked && picked.name === practiceName ? picked.placeId : undefined}
        sessionToken={sessionToken}
        onDone={(r) => {
          setReport(r);
          // A session token covers one autocomplete + details pair.
          setSessionToken(newToken());
          go("report");
        }}
        onError={(msg, badListing) => {
          // A listing problem sends them back to search; anything else lets them retry.
          if (badListing) {
            setPicked(null);
            setSessionToken(newToken());
            setView("start");
          } else {
            setStep(3);
            setView("quiz");
          }
          setError(msg);
        }}
      />
    );
  }

  if (view === "report" && report) {
    return <ReportView report={report} firstName={lead.firstName.trim()} onAgain={reset} />;
  }

  return null;
}

/* ---------- Start ---------- */

function StartView(props: {
  practiceName: string;
  picked: PickedPlace | null;
  sessionToken: string;
  city: string;
  error: string;
  onName: (v: string) => void;
  onPick: (p: PickedPlace) => void;
  onConfigured: (c: boolean) => void;
  onCity: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="view">
      <div className="hero">
        <div>
          <div className="eyebrow">Free practice grader</div>
          <h1>See how patients find you online.</h1>
          <p className="lede">
            Enter your practice name and get your online health score in under a minute. We check your Google ranking,
            website, reviews, and AI search.
          </p>
          <form
            className="lookup"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              props.onSubmit();
            }}
          >
            <div className="row2">
              <div className="field">
                <label htmlFor="in-name">Practice name</label>
                <PracticeSearch
                  value={props.practiceName}
                  picked={props.picked}
                  sessionToken={props.sessionToken}
                  onType={props.onName}
                  onPick={props.onPick}
                  onConfigured={props.onConfigured}
                />
              </div>
              <label htmlFor="in-city">
                City
                <select id="in-city" value={props.city} onChange={(e) => props.onCity(e.target.value)}>
                  {SOUTH_BAY_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            {props.error && <p className="err" role="alert">{props.error}</p>}
            <button className="btn btn-primary" type="submit">
              Grade my practice
            </button>
          </form>
          <ul className="promises">
            <li><CheckIcon color="#0E6B75" />How you rank when patients search &quot;dentist near me&quot;</li>
            <li><CheckIcon color="#0E6B75" />What&apos;s slowing down or breaking your website</li>
            <li><CheckIcon color="#0E6B75" />Which nearby practices are winning patients, and why</li>
          </ul>
        </div>
        <aside className="preview" aria-label="Example report">
          <span className="pill">Example report</span>
          <div className="pcard">
            <div className="mini">
              <ScoreRing score={59} small />
              <div className="mini-stack">
                <span className="grade g-needs-work">Needs work</span>
                <strong>9 problems found</strong>
              </div>
            </div>
            <div className="mini-cats">
              <div><span>Google search</span><b>13/25</b></div>
              <div><span>Website</span><b>17/25</b></div>
              <div><span>Reviews &amp; listings</span><b>18/25</b></div>
              <div><span>AI search</span><b>11/25</b></div>
            </div>
          </div>
          <div className="ai-chip">
            <SparkleIcon />
            <span>Includes your AI search visibility</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ---------- Quiz ---------- */

function QuizView(props: {
  step: number;
  practiceName: string;
  practiceType: PracticeType | "";
  lead: Lead;
  error: string;
  onType: (t: PracticeType) => void;
  onLead: (patch: Partial<Lead>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { step, lead } = props;
  return (
    <section className="view">
      <div className="card">
        <div className="steps">
          <span>Step {step} of 3</span>
          <div className="bar"><i style={{ width: `${(step / 3) * 100}%` }} /></div>
        </div>

        {step === 1 && (
          <div className="step">
            <h2>What kind of practice is {props.practiceName}?</h2>
            <div className="chips">
              {(Object.keys(PRACTICE_TYPES) as PracticeType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={props.practiceType === t}
                  onClick={() => props.onType(t)}
                >
                  {PRACTICE_TYPES[t].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step">
            <h2>Who should we send the report to?</h2>
            <div className="row2">
              <label htmlFor="in-first">
                First name
                <input id="in-first" autoComplete="given-name" value={lead.firstName} onChange={(e) => props.onLead({ firstName: e.target.value })} />
              </label>
              <label htmlFor="in-last">
                Last name
                <input id="in-last" autoComplete="family-name" value={lead.lastName} onChange={(e) => props.onLead({ lastName: e.target.value })} />
              </label>
            </div>
            <label htmlFor="in-role">
              Your role
              <select id="in-role" value={lead.role} onChange={(e) => props.onLead({ role: e.target.value })}>
                <option value="">Choose one</option>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="step">
            <h2>Where should the full report go?</h2>
            <label htmlFor="in-email">
              Email
              <input id="in-email" type="email" autoComplete="email" value={lead.email} onChange={(e) => props.onLead({ email: e.target.value })} />
            </label>
            <label htmlFor="in-phone">
              Mobile phone
              <input id="in-phone" type="tel" autoComplete="tel" value={lead.phone} onChange={(e) => props.onLead({ phone: e.target.value })} />
            </label>
            <p className="fine">
              By continuing you agree that South Coast Marketing may contact you about your report. Message and data rates may apply.
            </p>
          </div>
        )}

        {props.error && <p className="err" role="alert">{props.error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={props.onBack}>Back</button>
          <button type="button" className="btn btn-primary" onClick={props.onNext}>
            {step === 3 ? "See my score" : "Continue"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Scan ---------- */

function ScanView(props: {
  practiceName: string;
  city: string;
  practiceType: PracticeType;
  placeId?: string;
  sessionToken: string;
  onDone: (r: Report) => void;
  onError: (msg: string, badListing: boolean) => void;
}) {
  const t = PRACTICE_TYPES[props.practiceType];
  const items = [
    `Finding ${props.practiceName} on Google Maps`,
    "Checking your Google Business Profile",
    "Loading your website on a phone",
    "Reading your reviews",
    `Comparing nearby ${t.plural}`,
    `Asking AI assistants about ${props.city} ${t.noun}s`,
  ];
  const [progress, setProgress] = useState(0);
  const result = useRef<Report | null>(null);
  const failed = useRef<{ msg: string; badListing: boolean } | null>(null);
  const finished = useRef(false);
  const step = useRef(0);

  // Start the scan once.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practiceName: props.practiceName,
        city: props.city,
        practiceType: props.practiceType,
        placeId: props.placeId,
        sessionToken: props.sessionToken,
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed.current = {
            msg: data.error || "We couldn't finish the scan. Try again in a minute.",
            badListing: res.status === 400,
          };
          return;
        }
        result.current = data as Report;
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError")
          failed.current = { msg: "We couldn't finish the scan. Check your connection and try again.", badListing: false };
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step through the checklist; hold on the last item until the scan returns.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let doneTimer: number | undefined;
    const timer = window.setInterval(() => {
      if (finished.current) return;
      if (failed.current) {
        finished.current = true;
        window.clearInterval(timer);
        props.onError(failed.current.msg, failed.current.badListing);
        return;
      }
      if (step.current < items.length - 1) {
        step.current += 1;
        setProgress(step.current);
        return;
      }
      if (result.current) {
        finished.current = true;
        window.clearInterval(timer);
        setProgress(items.length);
        const r = result.current;
        doneTimer = window.setTimeout(() => props.onDone(r), reduce ? 0 : 350);
      }
    }, reduce ? 80 : 620);
    return () => {
      window.clearInterval(timer);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="view scan" aria-live="polite">
      <h2>Scanning {props.practiceName}</h2>
      <p className="note">This takes a few seconds.</p>
      <ul>
        {items.map((label, i) => (
          <li key={label} className={i < progress ? "done" : i === progress ? "active" : ""}>
            <span className="dot" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
