import Link from 'next/link';
import ReportSubmissionPanel from '../../../components/ReportSubmissionPanel';

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

export default function Page() {
  return <section className="section module-layout">
    <aside className="sidebar liquid">
      <div className="eyebrow">Practicum</div>
      <Link className="side-link" href="/practicum/rl">Rangkaian Listrik</Link>
      <Link className="side-link" href="/practicum/idp">Instrumentation & Measurement</Link>
      <Link className="side-link" href="/practicum/t3">High Voltage & High Current</Link>
      <br/>
      <a className="side-link" href="/modules/modul-1-dasar-pengukuran-besaran-listrik.pdf" target="_blank">Pre-test Module</a>
      <a className="side-link" href="/modules/modul-instrumentasi-pengukuran-listrik-2025-2026.pdf" target="_blank">Modules 2–8 PDF</a>
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
        <a className="chip" href={index === 0 ? '/modules/modul-1-dasar-pengukuran-besaran-listrik.pdf' : '/modules/modul-instrumentasi-pengukuran-listrik-2025-2026.pdf'} target="_blank">PDF</a>
        <a className="chip" href="https://www.youtube.com/@ttplftui" target="_blank">Video</a>
      </div>)}</div>
      <ReportSubmissionPanel track="idp" />
    </div>
  </section>;
}
