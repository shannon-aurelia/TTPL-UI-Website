import Link from "next/link";
import { REPORT_GROUPS } from "../../../lib/practicum";

const pdf = "/modules/modul-rangkaian-listrik-2025-2026.pdf";
const modules = [
  "Pre-test – Dasar Rangkaian Listrik",
  "Dasar Kelistrikan dan Analisis Mesh",
  "Linearitas dan Analisis Node",
  "Analisis Superposisi dan Thevenin",
  "Analisis Norton",
  "Rangkaian Kutub Empat",
  "Rangkaian AC",
  "Rangkaian Tiga Fasa",
];

function readerHref(moduleNumber, title) {
  return `/reader?track=rl&module=${moduleNumber}&src=${encodeURIComponent(pdf)}&title=${encodeURIComponent(title)}`;
}

export default function Page() {
  return (
    <section className="section module-layout">
      <aside className="sidebar liquid">
        <div className="eyebrow">Practicum</div>
        <Link className="side-link" href="/practicum/rl">
          Rangkaian Listrik
        </Link>
        <Link className="side-link" href="/practicum/idp">
          Instrumentation & Measurement
        </Link>
        <Link className="side-link" href="/practicum/t3">
          High Voltage & High Current
        </Link>
        <br />
        <Link className="side-link" href={readerHref(1, modules[0])}>
          Tracked PDF Module
        </Link>
        <a
          className="side-link"
          href="https://www.youtube.com/@ttplftui/playlists"
          target="_blank"
        >
          YouTube Playlist
        </a>
        <Link className="side-link" href="/portal">
          Student Dashboard
        </Link>
      </aside>
      <div>
        <h1 className="title">Rangkaian Listrik</h1>
        <p className="subtitle">
          Module 1 is an offline pre-test. Modules 2&3 and 4&5 are grouped,
          while Modules 6, 7, and 8 are individual. Report files are submitted
          through EMAS3.
        </p>
        <div className="module-grid">
          {modules.map((module, index) => (
            <div className="module-card" key={module}>
              <div className="num">Module {index + 1}</div>
              <h3>{module}</h3>
              <p>
                {index === 0
                  ? "Offline pre-test. Review the module and wait for the schedule imported from the practicum sheet."
                  : "Open the tracked module reader and official TTPL video before the practicum session."}
              </p>
              <Link className="chip" href={readerHref(index + 1, module)}>
                Read PDF
              </Link>
              <a
                className="chip"
                href="https://www.youtube.com/@ttplftui/playlists"
                target="_blank"
              >
                Video
              </a>
            </div>
          ))}
        </div>
        <div className="timeline-wrap report-map">
          <div className="eyebrow">Module grouping</div>
          <h2>RL practicum groups.</h2>
          <div className="report-group-grid">
            {REPORT_GROUPS.rl.map((group) => (
              <div className="report-group-card" key={group.id}>
                <b>{group.title}</b>
                <span>Modules {group.modules.join(" & ")}</span>
                <p>
                  {group.submission
                    ? "Attendance and QnA are recorded here; submit the report through EMAS3."
                    : group.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
