import Link from 'next/link';
import ReportSubmissionPanel from '../../../components/ReportSubmissionPanel';

const pretestPdf = '/modules/modul-1-dasar-pengukuran-besaran-listrik.pdf';
const modulePdf = '/modules/modul-instrumentasi-pengukuran-listrik-2025-2026.pdf';
const modules = [
  'Pre-test – Dasar Pengukuran Besaran Listrik',
  'Pengukuran Analog',
  'Pengukuran Digital',
  'Pengukuran Daya 1 Fasa',
  'Kualitas Daya dan Pengukuran Daya 3 Fasa',
  'Pengukuran Tingkat Pencahayaan',
  'Pengukuran Resistansi Pentanahan',
  'Pengukuran Konsumsi Energi'
];

function readerHref(moduleNumber, title) {
  const src = moduleNumber === 1 ? pretestPdf : modulePdf;
  return `/reader?track=idp&module=${moduleNumber}&src=${encodeURIComponent(src)}&title=${encodeURIComponent(title)}`;
}

export default function Page() {
  return <section className="section module-layout">
    <aside className="sidebar liquid">
      <div className="eyebrow">Practicum</div>
      <Link className="side-link" href="/practicum/rl">Rangkaian Listrik</Link>
      <Link className="side-link" href="/practicum/idp">Instrumentation & Measurement</Link>
      <Link className="side-link" href="/practicum/t3">High Voltage & High Current</Link>
      <br/>
      <Link className="side-link" href={readerHref(1, modules[0])}>Tracked Pre-test Module</Link>
      <Link className="side-link" href={readerHref(2, modules[1])}>Tracked Modules 2–8</Link>
      <a className="side-link" href="https://www.youtube.com/@ttplftui" target="_blank">YouTube Playlist</a>
      <Link className="side-link" href="/portal">Student Dashboard</Link>
    </aside>
    <div>
      <h1 className="title">Instrumentation & Measurement</h1>
      <p className="subtitle">Module 1 is a pre-test schedule placeholder. If the pre-test becomes online, students will be directed to EMAS. Modules 2–8 are all present and can receive individual report assignments from the attendance sheet.</p>
      <div className="module-grid">{modules.map((module, index) => <div className="module-card" key={module}>
        <div className="num">Module {index + 1}</div>
        <h3>{module}</h3>
        <p>{index === 0 ? 'Pre-test resources and schedule. No report upload is enabled here.' : 'Review the instrument, measurement procedure, and related TTPL video before lab.'}</p>
        <Link className="chip" href={readerHref(index + 1, module)}>Read PDF</Link>
        <a className="chip" href="https://www.youtube.com/@ttplftui" target="_blank">Video</a>
      </div>)}</div>
      <ReportSubmissionPanel track="idp" />
    </div>
  </section>;
}
