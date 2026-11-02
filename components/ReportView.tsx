"use client";

import { useState } from "react";
import { PRACTICE_TYPES } from "@/lib/practice-types";
import { GRADE_LABEL, gradeOf } from "@/lib/scoring";
import type { Report } from "@/lib/types";
import { CheckIcon, CrossIcon } from "./icons";
import ScoreRing from "./ScoreRing";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function ReportView({
  report,
  firstName,
  onAgain,
}: {
  report: Report;
  firstName: string;
  onAgain: () => void;
}) {
  const t = PRACTICE_TYPES[report.practiceType];
  const overall = gradeOf(report.total, 100);
  const [booked, setBooked] = useState(false);

  return (
    <section className="view">
      <div className="summary">
        <ScoreRing score={report.total} on="navy" />
        <div>
          <span className={`grade g-${overall}`}>{GRADE_LABEL[overall]}</span>
          <h2>
            {firstName ? `${firstName}, we` : "We"} found {report.problems} problems with {report.practiceName}&apos;s online presence
          </h2>
          {report.address && <p className="addr">{report.address}</p>}
          <p className="money">
            Fixing them could bring in about <b>{report.missedPatientsPerMonth} more new patients a month</b>, worth roughly{" "}
            <b>{usd(report.missedRevenuePerYear)}</b> a year.*
          </p>
        </div>
      </div>

      <div className="cats">
        {report.categories.map((c) => {
          const g = gradeOf(c.score, 25);
          return (
            <button
              key={c.id}
              type="button"
              className="cat"
              onClick={() => document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth" })}
            >
              <span className="name">{c.name}</span>
              {c.sample && <span className="preview-tag">Preview</span>}
              <span className="score">
                {c.score}
                <small>/25</small>
              </span>
              <span className="meter">
                <i className={`m-${g}`} style={{ width: `${(c.score / 25) * 100}%` }} />
              </span>
              <span className={`grade g-${g}`}>{GRADE_LABEL[g]}</span>
            </button>
          );
        })}
      </div>

      {report.categories.map((c) => {
        const toFix = c.checks.filter((x) => !x.passed).length;
        const sorted = [...c.checks].sort((a, b) => Number(a.passed) - Number(b.passed));
        return (
          <div className="catblock" id={`cat-${c.id}`} key={c.id}>
            <div className="section-h">
              <h3>{c.name}</h3>
              <span>
                {c.score}/25 · {toFix} to fix
              </span>
            </div>
            {c.sample && report.source === "live" && (
              <p className="sample-note">
                Preview: these results are examples for now. Live {c.name} checks are coming in the next update.
              </p>
            )}
            <ul className="checks">
              {sorted.map((x) => (
                <li key={x.id}>
                  <span className={`mark ${x.passed ? "ok" : "no"}`} aria-label={x.passed ? "Passed" : "Needs fixing"}>
                    {x.passed ? <CheckIcon size={14} width={3} /> : <CrossIcon />}
                  </span>
                  <div>
                    <div className="t">{x.title}</div>
                    <div className="d">{x.detail}</div>
                  </div>
                  {x.value && <span className="v">{x.value}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="catblock">
        <div className="section-h">
          <h3>Who&apos;s beating you on Google</h3>
          <span>
            &quot;{report.searchPhrase}&quot; · {report.city}
          </span>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Map rank</th>
                <th>Practice</th>
                <th>Rating</th>
                <th>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {report.competitors.map((c) => (
                <tr key={`${c.rank}-${c.name}`} className={c.isYou ? "you" : ""}>
                  <td className="n">{c.rank ? `#${c.rank}` : "20+"}</td>
                  <td>
                    {c.name}
                    {c.isYou ? " (you)" : ""}
                  </td>
                  <td className="n">{typeof c.rating === "number" ? `${c.rating.toFixed(1)} ★` : "None"}</td>
                  <td className="n">{c.reviews ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.source === "sample" ? (
          <p className="note">These results are sample data. The live version pulls real map results for your search.</p>
        ) : (
          <p className="note">
            Map results from Google, searched from the center of {report.city}. Rank can shift with where a patient searches.
            {report.mapsUri && (
              <>
                {" "}
                <a href={report.mapsUri} target="_blank" rel="noopener noreferrer">
                  View your listing on Google Maps
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <div className="cta">
        <div>
          <h3>Want a hand fixing these?</h3>
          <p>Book a free 20-minute call. We&apos;ll walk through your report and show you what to fix first.</p>
        </div>
        <div>
          {booked ? (
            <p className="booked">Thanks! We&apos;ll reply within one business day to pick a time.</p>
          ) : (
            <button type="button" className="btn btn-white" onClick={() => setBooked(true)}>
              Book my free audit call
            </button>
          )}
        </div>
      </div>

      <p className="note">
        *Estimate based on an average first-year patient value of {usd(t.patientValue)} for {t.plural} and typical search
        volume in the South Bay.
      </p>
      <div>
        <button type="button" className="btn btn-ghost" onClick={onAgain}>
          Grade another practice
        </button>
      </div>
    </section>
  );
}
