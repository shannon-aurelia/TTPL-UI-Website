import Link from "next/link";

const pdf = "/modules/modul-teknik-tegangan-arus-tinggi-2022.pdf";
const modules = [
  "Pengantar Teknik Tegangan dan Arus Tinggi",
  "Pembangkitan dan Pengukuran Tegangan Tinggi AC",
  "Pembangkitan dan Pengukuran Tegangan Tinggi DC",
  "Pembangkitan dan Pengukuran Tegangan Tinggi Impuls",
  "Pengujian Isolasi Udara AC",
  "Pengujian Isolasi Zat Cair",
  "Pengujian Isolasi Zat Padat",
  "Post-test",
];

function readerHref(moduleNumber, title) {
  return `/reader?track=t3&module=${moduleNumber}&src=${encodeURIComponent(pdf)}&title=${encodeURIComponent(title)}`;
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
          href="https://www.youtube.com/@ttplftui"
          target="_blank"
        >
          YouTube Playlist
        </a>
        <Link className="side-link" href="/portal">
          Student Dashboard
        </Link>
      </aside>
      <div>
        <h1 className="title">High Voltage & High Current</h1>
        <p className="subtitle">
          Modules, videos, rules, and pre-test/post-test checkpoints for this
          track. Report files are submitted through EMAS3.
        </p>
        <div className="module-grid">
          {modules.map((module, index) => (
            <div className="module-card" key={module}>
              <div className="num">Module {index + 1}</div>
              <h3>{module}</h3>
              <p>
                Open the tracked PDF module and watch the related TTPL video
                before lab.
              </p>
              <Link className="chip" href={readerHref(index + 1, module)}>
                Read PDF
              </Link>
              <a
                className="chip"
                href="https://www.youtube.com/@ttplftui"
                target="_blank"
              >
                Video
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
