'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, CalendarClock, Gauge, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const text = {
  en: {
    eyebrow: 'High voltage · measurement · power systems', titleA: 'Precision under', titleB: 'pressure.',
    lead: 'TTPL turns electrical theory into careful practice through circuits, instrumentation, measurement, and high-voltage safety.',
    practicum: 'Open practicum', portal: 'Student portal', lab: 'Explore virtual lab',
    season: 'Practicum 2026/2027', seasonText: 'One place for modules, tracked reading, schedules, attendance-based report access, and submission deadlines.',
    tracks: 'Three disciplines. One practicum standard.', tracksText: 'Choose a track to open its modules, preparation resources, videos, and submission workflow.',
    rl: 'Rangkaian Listrik', rlText: 'Circuit analysis from mesh and node methods through AC and three-phase systems.',
    idp: 'Instrumentation & Measurement', idpText: 'Use instruments correctly and understand the measurements behind every reading.',
    t3: 'High Voltage & High Current', t3Text: 'Study generation, measurement, insulation, impulse, and safety at high voltage.',
    standard: 'Built for the way TTPL actually works.', standardText: 'A public laboratory identity on the outside and a focused operational workspace for students and assistants inside.',
    prep: 'Prepare', prepText: 'Read modules, review videos, and see the planned schedule before entering the lab.',
    attend: 'Attend', attendText: 'Assistants record actual attendance and QnA scores for the session.',
    submit: 'Submit', submitText: 'Attendance opens the correct report upload until the following day at 23:59 WIB.',
    people: 'The people behind TTPL.', peopleText: 'A laboratory is built through careful teaching, reliable operations, and students who learn to respect every measurement.',
    updates: 'See laboratory updates', crew: 'Meet the team'
  },
  id: {
    eyebrow: 'Tegangan tinggi · pengukuran · sistem tenaga', titleA: 'Presisi dalam', titleB: 'tekanan.',
    lead: 'TTPL mengubah teori kelistrikan menjadi praktik yang teliti melalui rangkaian, instrumentasi, pengukuran, dan keselamatan tegangan tinggi.',
    practicum: 'Buka praktikum', portal: 'Portal mahasiswa', lab: 'Jelajahi lab virtual',
    season: 'Praktikum 2026/2027', seasonText: 'Satu tempat untuk modul, pelacakan membaca, jadwal, akses laporan berbasis kehadiran, dan deadline pengumpulan.',
    tracks: 'Tiga bidang. Satu standar praktikum.', tracksText: 'Pilih praktikum untuk membuka modul, materi persiapan, video, dan alur pengumpulan.',
    rl: 'Rangkaian Listrik', rlText: 'Analisis rangkaian dari mesh dan node hingga sistem AC dan tiga fasa.',
    idp: 'Instrumentasi & Pengukuran', idpText: 'Gunakan instrumen dengan benar dan pahami pengukuran di balik setiap pembacaan.',
    t3: 'Tegangan & Arus Tinggi', t3Text: 'Pelajari pembangkitan, pengukuran, isolasi, impuls, dan keselamatan tegangan tinggi.',
    standard: 'Dibangun sesuai cara kerja TTPL.', standardText: 'Identitas laboratorium untuk publik dan ruang kerja yang fokus untuk mahasiswa serta asisten.',
    prep: 'Persiapan', prepText: 'Baca modul, tinjau video, dan lihat jadwal sebelum masuk lab.',
    attend: 'Kehadiran', attendText: 'Asisten mencatat kehadiran aktual dan nilai QnA pada sesi tersebut.',
    submit: 'Pengumpulan', submitText: 'Kehadiran membuka laporan yang tepat hingga hari berikutnya pukul 23.59 WIB.',
    people: 'Orang-orang di balik TTPL.', peopleText: 'Laboratorium dibangun melalui pengajaran yang teliti, operasi yang andal, dan mahasiswa yang menghargai setiap pengukuran.',
    updates: 'Lihat kegiatan laboratorium', crew: 'Kenali tim'
  },
  zh: {
    eyebrow: '高电压 · 电测量 · 电力系统', titleA: '压力之下，', titleB: '保持精确。',
    lead: 'TTPL 通过电路、仪器、测量与高电压安全，把电气理论转化为严谨实践。',
    practicum: '进入实验课', portal: '学生入口', lab: '探索虚拟实验室',
    season: '2026/2027 实验课', seasonText: '模块、阅读记录、时间表、基于出勤的报告权限和提交截止日期集中在一个平台。',
    tracks: '三个方向，同一个实验标准。', tracksText: '选择课程，查看模块、准备材料、视频和提交流程。',
    rl: '电路实验', rlText: '从网孔与节点分析到交流和三相系统。',
    idp: '仪器与电测量', idpText: '正确使用仪器，并理解每次读数背后的测量原理。',
    t3: '高电压与大电流', t3Text: '学习高电压的产生、测量、绝缘、冲击与安全。',
    standard: '按照 TTPL 的真实工作方式设计。', standardText: '对外是清晰的实验室形象，对内是学生与助教高效工作的空间。',
    prep: '准备', prepText: '进入实验室前阅读模块、复习视频并查看计划。',
    attend: '出勤', attendText: '助教记录实际出勤与当日 QnA 分数。',
    submit: '提交', submitText: '出勤后开放对应报告，截止至次日 23:59 WIB。',
    people: 'TTPL 背后的团队。', peopleText: '严谨教学、可靠运营与尊重每一次测量的学生，共同塑造实验室。',
    updates: '查看实验室动态', crew: '认识团队'
  }
};

const tracks = [
  { key: 'rl', href: '/practicum/rl', code: 'RL', image: '/assets/ttpl-slide-1.jpg' },
  { key: 'idp', href: '/practicum/idp', code: 'IDP', image: '/assets/ttpl-slide-3.jpg' },
  { key: 't3', href: '/practicum/t3', code: 'T3', image: '/assets/ttpl-slide-4.jpg' }
];

export default function HomeClient({ current }) {
  const [lang, setLang] = useState('en');
  useEffect(() => {
    const sync = () => setLang(document.documentElement.dataset.lang || 'en');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    sync();
    return () => observer.disconnect();
  }, []);
  const t = text[lang] || text.en;

  return <div className="home-rebuild">
    <section className="home-hero">
      <img className="home-hero-image" src="/assets/hero_pylons.jpg" alt="Electrical transmission structures"/>
      <div className="home-hero-shade"/>
      <div className="home-hero-content">
        <div className="home-kicker"><span/><b>{t.eyebrow}</b></div>
        <h1>{t.titleA}<br/><em>{t.titleB}</em></h1>
        <p>{t.lead}</p>
        <div className="home-actions">
          <Link className="btn" href="/practicum">{t.practicum}<ArrowRight size={18}/></Link>
          <Link className="btn ghost" href="/login">{t.portal}</Link>
          <Link className="text-link" href="/virtual-lab">{t.lab}<ArrowRight size={16}/></Link>
        </div>
      </div>
      <div className="home-hero-mark"><img src="/assets/ttpl-logo.png" alt="TTPL UI"/><span>Laboratorium TTPL</span></div>
      <div className="home-signal" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    </section>

    <section className="home-season section">
      <div className="home-season-copy"><span className="section-index">01</span><div><div className="eyebrow">{t.season}</div><h2>{t.seasonText}</h2></div></div>
      <div className="home-season-actions">
        <Link href="/practicum"><BookOpenCheck/><span><b>Modules</b><small>Tracked resources</small></span><ArrowRight/></Link>
        <Link href="/portal"><CalendarClock/><span><b>Schedule</b><small>Attendance & deadlines</small></span><ArrowRight/></Link>
        <Link href="/virtual-lab"><Gauge/><span><b>Virtual Lab</b><small>Practice first</small></span><ArrowRight/></Link>
      </div>
    </section>

    <section className="section home-tracks-section">
      <div className="section-heading"><div><span className="section-index">02</span><div className="eyebrow">Practicum</div></div><h2>{t.tracks}</h2><p>{t.tracksText}</p></div>
      <div className="home-track-grid">
        {tracks.map((track) => <Link className="home-track" href={track.href} key={track.key}>
          <img src={track.image} alt=""/><div className="home-track-overlay"/>
          <span>{track.code}</span><h3>{t[track.key]}</h3><p>{t[`${track.key}Text`]}</p><b>Explore track <ArrowRight size={17}/></b>
        </Link>)}
      </div>
    </section>

    <section className="section home-standard">
      <div className="home-standard-intro"><span className="section-index">03</span><div className="eyebrow">Operating system</div><h2>{t.standard}</h2><p>{t.standardText}</p></div>
      <div className="home-flow">
        <article><span>01</span><BookOpenCheck/><h3>{t.prep}</h3><p>{t.prepText}</p></article>
        <article><span>02</span><ShieldCheck/><h3>{t.attend}</h3><p>{t.attendText}</p></article>
        <article><span>03</span><Zap/><h3>{t.submit}</h3><p>{t.submitText}</p></article>
      </div>
    </section>

    <section className="section home-people">
      <div className="home-people-image"><img src="/people/current-team-announcement.jpg" alt="TTPL assistant team announcement"/></div>
      <div className="home-people-copy"><Sparkles/><div className="eyebrow">TTPL community</div><h2>{t.people}</h2><p>{t.peopleText}</p><div className="home-name-list">{current.map((name) => <span key={name}>{name}</span>)}</div><div className="btn-row"><Link className="btn" href="/assistants">{t.crew}<ArrowRight size={17}/></Link><Link className="btn ghost" href="/works">{t.updates}</Link></div></div>
    </section>
  </div>;
}
