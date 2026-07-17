'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Instagram, Twitter, Linkedin, ArrowRight, ArrowUpRight, 
  Compass, Sparkles, Cpu, ShieldCheck, ImageIcon 
} from 'lucide-react';

const bgOptions = [
  { name: 'Generative Tower', path: '/background-options/ChatGPT Image Jul 15, 2026, 01_37_01 AM.png' },
  { name: 'Winston Chen', path: '/background-options/winston-chen-fid75YDSpss-unsplash.jpg' },
  { name: 'Tao Yuan', path: '/background-options/tao-yuan-7f-xdAmHhwM-unsplash.jpg' },
  { name: 'Thomas Despeyroux', path: '/background-options/thomas-despeyroux-Dh5pUa2PwrY-unsplash.jpg' }
];

const stMap = {
  en: {
    followUs: 'Follow us',
    navAbout: 'About',
    navFocus: 'Focus',
    navSpark: 'Simulator',
    navAssistants: 'Assistants',
    scrollDown: 'scroll down',
    heroSub: 'HIGH VOLTAGE • MEASUREMENT • POWER SYSTEMS',
    heroTitle: 'Danger meets precision.',
    heroDesc: 'TTPL is where circuits are handled carefully, instruments are read properly, and high voltage stops being just a number.',
    startPracticum: 'Start practicum',
    openLab: 'Open virtual lab',
    whatsUp: "What's up at TTPL",
    profileSub: 'IDENTITY & PROFILE',
    profileTitle: 'TTPL profile.',
    profileDesc: 'Laboratorium Tegangan Tinggi dan Pengukuran Listrik is a teaching laboratory focused on high voltage, electrical measurement, and power-system practicum culture.',
    aboutLab: 'About the laboratory',
    aboutLabText: 'TTPL supports students through practicum, teaching preparation, measurement culture, and high-voltage safety awareness.',
    focusSub: 'FOCUS & MISSION',
    focusTitle: 'What TTPL does',
    focusDesc: 'We train students in safety standards, electromagnetic field simulations, electrical measurement protocols, and high-voltage safety controls.',
    focusWhat: 'What TTPL does',
    focusWhatText: 'Electrical circuits, instrumentation, electrical measurement, high-voltage testing, and power-system learning media.',
    missionTitle: 'Safer, clearer, better',
    missionDesc: 'Build practical skill, keep safety visible, make learning media easier to access, and support students before, during, and after practicum.',
    visionTitle: 'Excellent practicum culture',
    visionDesc: 'To become a trusted electrical engineering teaching laboratory for high-voltage and measurement competence.',
    valuesTitle: 'Precision with responsibility',
    valuesDesc: 'Careful measurement, technical curiosity, teamwork, communication, and respect for every instrument in the lab.',
    readProfile: 'Read full profile',
    launchConsole: 'Launch Virtual console'
  },
  id: {
    followUs: 'Ikuti kami',
    navAbout: 'Profil',
    navFocus: 'Fokus',
    navSpark: 'Simulator',
    navAssistants: 'Asisten',
    scrollDown: 'gulir ke bawah',
    heroSub: 'TEGANGAN TINGGI • PENGUKURAN LSTRIK • SISTEM TENAGA',
    heroTitle: 'Bahaya bertemu presisi.',
    heroDesc: 'TTPL adalah tempat sirkuit ditangani dengan hati-hati, instrumen dibaca dengan benar, dan tegangan tinggi bukan sekadar angka.',
    startPracticum: 'Mulai praktikum',
    openLab: 'Buka lab virtual',
    whatsUp: 'Ada apa di TTPL',
    profileSub: 'IDENTITAS & PROFIL',
    profileTitle: 'Profil TTPL.',
    profileDesc: 'Laboratorium Tegangan Tinggi dan Pengukuran Listrik adalah laboratorium pengajaran yang berfokus pada tegangan tinggi, pengukuran listrik, dan budaya praktikum sistem tenaga.',
    aboutLab: 'Tentang laboratorium',
    aboutLabText: 'TTPL mendukung mahasiswa melalui praktikum, persiapan mengajar, budaya pengukuran, dan kesadaran keselamatan tegangan tinggi.',
    focusSub: 'FOKUS & MISI',
    focusTitle: 'Apa yang TTPL lakukan',
    focusDesc: 'Kami melatih mahasiswa dalam standar keselamatan kerja, simulasi medan elektromagnetik, protokol pengukuran listrik, dan kontrol keselamatan tegangan tinggi.',
    focusWhat: 'Apa yang TTPL lakukan',
    focusWhatText: 'Sirkuit listrik, instrumentasi, pengukuran listrik, pengujian tegangan tinggi, dan media pembelajaran sistem tenaga listrik.',
    missionTitle: 'Lebih aman, jelas, baik',
    missionDesc: 'Membangun keterampilan praktis, menjaga keselamatan tetap terlihat, membuat media pembelajaran lebih mudah diakses, dan mendukung mahasiswa sebelum, selama, dan setelah praktikum.',
    visionTitle: 'Budaya praktikum unggul',
    visionDesc: 'Menjadi laboratorium pengajaran teknik elektro yang tepercaya untuk kompetensi tegangan tinggi dan pengukuran.',
    valuesTitle: 'Presisi dengan tanggung jawab',
    valuesDesc: 'Pengukuran yang teliti, keingintahuan teknis, kerja sama tim, komunikasi, dan rasa hormat terhadap setiap instrumen di laboratorium.',
    readProfile: 'Baca profil lengkap',
    launchConsole: 'Luncurkan Konsol Virtual'
  },
  zh: {
    followUs: '关注我们',
    navAbout: '简介',
    navFocus: '方向',
    navSpark: '模拟器',
    navAssistants: '助教',
    scrollDown: '向下滚动',
    heroSub: '高电压 • 电测量 • 电力系统',
    heroTitle: '危险遇见精度。',
    heroDesc: 'TTPL 是学生严谨分析电路、正确使用仪器，并真正理解高电压意义的实验室。',
    startPracticum: '进入实验课',
    openLab: '打开虚拟实验室',
    whatsUp: 'TTPL最新动态',
    profileSub: '身份与简介',
    profileTitle: 'TTPL 简介。',
    profileDesc: '高电压与电测量实验室专注于高电压、电测量和电力系统实验教学文化。',
    aboutLab: '实验室介绍',
    aboutLabText: 'TTPL 通过实验课、助教训练、测量文化和高电压安全意识支持学生。',
    focusSub: '方向与使命',
    focusTitle: 'TTPL 方向',
    focusDesc: '我们训练学生的安全意识、电磁场仿真模拟、电测量规范和高电压安全控制。',
    focusWhat: 'TTPL 实验内容',
    focusWhatText: '电路、仪器、电测量、高电压测试和电力系统学习媒体。',
    missionTitle: '更安全，更清晰，更好',
    missionDesc: '培养实践技能、保持安全警示、使学习媒体易于访问，并在实验前后提供充足支持。',
    visionTitle: '优秀的实验课文化',
    visionDesc: '成为高电压与电测量领域值得信赖的教学实验室。',
    valuesTitle: '有责任感的精确',
    valuesDesc: '精确 of 测量、技术好奇心、团队协作、沟通以及对实验室每件仪器的尊重。',
    readProfile: '阅读完整简介',
    launchConsole: '启动虚拟控制台'
  }
};

export default function HomeClient({ current, alumni }) {
  // --- LANGUAGE SYNC WITH Shell.jsx GLOBAL STATE ---
  const [lang, setLang] = useState('en');
  useEffect(() => {
    const syncLang = () => {
      const currentLang = document.documentElement.dataset.lang || 'en';
      setLang(currentLang);
    };

    const observer = new MutationObserver(syncLang);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    
    syncLang(); // Initial load
    return () => observer.disconnect();
  }, []);

  const st = stMap[lang] || stMap.en;

  // --- SCROLL Viewport Tracking ---
  const [activeSection, setActiveSection] = useState('hero');
  useEffect(() => {
    const sections = ['hero', 'profile', 'tracks', 'works'];
    const observers = sections.map((secId) => {
      const element = document.getElementById(secId);
      if (!element) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(secId);
          }
        },
        {
          root: null,
          rootMargin: '-30% 0px -30% 0px',
          threshold: 0.1,
        }
      );

      observer.observe(element);
      return { observer, element };
    });

    return () => {
      observers.forEach((obs) => {
        if (obs) obs.observer.unobserve(obs.element);
      });
    };
  }, []);

  const scrollToSection = (secId) => {
    const element = document.getElementById(secId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(secId);
    }
  };

  // --- BACKGROUND PICKER STATE ---
  const [bgIndex, setBgIndex] = useState(0);
  const [showBgMenu, setShowBgMenu] = useState(false);

  return (
    <div className="relative min-h-screen text-white font-sans overflow-x-hidden antialiased">
      
      {/* FULL-PAGE BACKGROUND — only active on the landing page */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', transition: 'opacity 0.5s ease'
      }}>
        <img
          src={bgOptions[bgIndex].path}
          key={bgIndex}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            opacity: 0.38,
            filter: 'saturate(0.45) contrast(1.15) brightness(0.85)',
            userSelect: 'none'
          }}
        />
        {/* Top and bottom fade to match site bg */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, var(--bg) 0%, transparent 18%, transparent 82%, var(--bg) 100%)'
        }} />
      </div>
      
      {/* LEFT SIDEBAR RAIL */}
      <div className="left-rail" id="left-social-rail">
        <a href="https://instagram.com" target="_blank" rel="noreferrer" className="rail-link" title="Instagram">
          <Instagram size={16} />
        </a>
        <a href="https://twitter.com" target="_blank" rel="noreferrer" className="rail-link" title="Twitter">
          <Twitter size={16} />
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="rail-link" title="LinkedIn">
          <Linkedin size={16} />
        </a>
      </div>

      {/* BACKGROUND PICKER WIDGET (Bottom Left) */}
      <div style={{ position: 'fixed', bottom: 32, left: 32, zIndex: 70 }}>
        {showBgMenu && (
          <div style={{ 
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 16, 
            background: 'rgba(8, 27, 42, 0.75)', backdropFilter: 'blur(32px)', 
            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, padding: 16, 
            display: 'flex', flexDirection: 'column', gap: 8, width: 220,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--mint)', fontWeight: 900, marginBottom: 4, padding: '0 8px' }}>
              Change Background
            </div>
            {bgOptions.map((bg, idx) => (
              <button 
                key={idx} 
                onClick={() => { setBgIndex(idx); setShowBgMenu(false); }}
                style={{
                  background: bgIndex === idx ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none', padding: '10px 14px', borderRadius: 12, color: '#fff', 
                  textAlign: 'left', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => { if(bgIndex !== idx) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseOut={(e) => { if(bgIndex !== idx) e.currentTarget.style.background = 'transparent' }}
              >
                {bg.name}
              </button>
            ))}
          </div>
        )}
        <button 
          onClick={() => setShowBgMenu(!showBgMenu)}
          style={{
            width: 58, height: 58, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
            background: showBgMenu ? 'var(--cyan)' : 'rgba(255,255,255,0.11)', 
            backdropFilter: 'blur(24px)', color: showBgMenu ? '#000' : '#fff',
            display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all 0.25s',
            boxShadow: '0 12px 30px rgba(0,0,0,0.2)'
          }}
          title="Change Background"
        >
          <ImageIcon size={22} />
        </button>
      </div>

      {/* RIGHT SIDEBAR RAIL */}
      <div className="right-rail" id="right-timeline-rail">
        <button onClick={() => scrollToSection('hero')} className={`nav-btn ${activeSection === 'hero' ? 'active' : ''}`}>
          <span className="label">Top</span>
          <span className="num">Start</span>
          <div className="bar-container">
            <div className="bar-line" />
            {activeSection === 'hero' && <div className="active-dot" />}
          </div>
        </button>

        <button onClick={() => scrollToSection('profile')} className={`nav-btn ${activeSection === 'profile' ? 'active' : ''}`}>
          <span className="label">{st.navAbout}</span>
          <span className="num">01</span>
          <div className="bar-container">
            <div className="bar-line" />
            {activeSection === 'profile' && <div className="active-dot" />}
          </div>
        </button>

        <button onClick={() => scrollToSection('tracks')} className={`nav-btn ${activeSection === 'tracks' ? 'active' : ''}`}>
          <span className="label">{st.navSpark}</span>
          <span className="num">02</span>
          <div className="bar-container">
            <div className="bar-line" />
            {activeSection === 'tracks' && <div className="active-dot" />}
          </div>
        </button>

        <button onClick={() => scrollToSection('works')} className={`nav-btn ${activeSection === 'works' ? 'active' : ''}`}>
          <span className="label">{st.whatsUp}</span>
          <span className="num">03</span>
          <div className="bar-container">
            <div className="bar-line" />
            {activeSection === 'works' && <div className="active-dot" />}
          </div>
        </button>
      </div>

      {/* MAIN LAYOUT WRAPPER */}
      <main className="relative z-10">

        {/* SECTION 00: IMMERSIVE HERO */}
        <section 
          id="hero" 
          style={{ 
            position: 'relative', 
            minHeight: '100vh', 
            width: '100vw', 
            left: '50%', 
            right: '50%', 
            marginLeft: '-50vw', 
            marginRight: '-50vw', 
            marginTop: '-110px',
            overflow: 'hidden', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0' 
          }}
        >
          {/* Centered grid container */}
          <div style={{ 
            width: 'min(1460px, 92vw)', 
            margin: '0 auto', 
            display: 'grid', 
            gridTemplateColumns: '1.1fr 0.9fr', 
            gap: '54px', 
            alignItems: 'center', 
            position: 'relative', 
            zIndex: 10 
          }}>
            
            {/* Left Column Copy */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <div className="eyebrow" data-i18n="home.eyebrow">{st.heroSub}</div>
              <h1 style={{ fontSize: 'clamp(44px, 5.5vw, 92px)', fontWeight: '900', lineHeight: '1.05', letterSpacing: '-0.02em', margin: '24px 0' }}>
                <span data-i18n="home.titleA">Danger meets</span><br />
                <span className="gradient-text" data-i18n="home.titleB">precision.</span>
              </h1>
              <p className="lead" style={{ maxWidth: '580px', fontSize: '18px', opacity: 0.8, lineHeight: '1.75' }} data-i18n="home.lead">
                {st.heroDesc}
              </p>
              <div className="btn-row" style={{ marginTop: 32 }}>
                <Link className="btn" href="/practicum">{st.startPracticum}</Link>
                <Link className="btn ghost" href="/virtual-lab">{st.openLab}</Link>
                <Link className="btn ghost" href="/works">{st.whatsUp}</Link>
              </div>
            </div>

            {/* Right Column — glowing logo */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img 
                src="/assets/ttpl-logo.png" 
                alt="TTPL UI Logo" 
                style={{ 
                  width: 'min(260px, 60%)', 
                  height: 'auto', 
                  objectFit: 'contain', 
                  filter: 'drop-shadow(0 0 35px rgba(32, 231, 255, 0.45)) drop-shadow(0 0 10px rgba(81, 255, 197, 0.25))',
                  animation: 'orb 6s ease-in-out infinite'
                }} 
              />
            </div>

          </div>
        </section>

        {/* TICKER */}
        <div className="ticker">
          <div>UNLEASH YOUR POWER • RANGKAIAN LISTRIK • INSTRUMENTASI & PENGUKURAN • TEKNIK TEGANGAN DAN ARUS TINGGI • </div>
          <div>UNLEASH YOUR POWER • RANGKAIAN LISTRIK • INSTRUMENTASI & PENGUKURAN • TEKNIK TEGANGAN DAN ARUS TINGGI • </div>
        </div>

        {/* SECTION 01: PROFILE SECTION */}
        <section id="profile" className="section" style={{ scrollMarginTop: 80 }}>
          <div className="split-section">
            <div className="bg-number">01</div>
            
            <div className="col-left text-left">
              <div className="eyebrow">{st.profileSub}</div>
              <h2 className="title" style={{ margin: '16px 0', fontSize: 'clamp(32px, 4vw, 54px)' }} data-i18n="profile.title">
                {st.profileTitle}
              </h2>
              <p className="subtitle" style={{ fontSize: 16, margin: '20px 0' }} data-i18n="profile.lead">
                {st.profileDesc}
              </p>

              <div className="grid two" style={{ marginTop: 28 }}>
                <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
                  <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', letterSpacing: '0.15em' }}>
                    <Compass size={14} /> {st.aboutLab}
                  </div>
                  <p style={{ fontSize: 13.5, marginTop: 8 }} data-i18n="profile.aboutText">
                    {st.aboutLabText}
                  </p>
                </div>

                <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
                  <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', letterSpacing: '0.15em' }}>
                    <Sparkles size={14} /> {st.visionTitle}
                  </div>
                  <p style={{ fontSize: 13.5, marginTop: 8 }}>
                    {st.visionDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-right">
              {/* IMAGE FRAME WITH SHIMMER AND DETAILS */}
              <div className="image-frame">
                <img src="/assets/ttpl-slide-2.jpg" alt="High Voltage Lab Equipment" />
                <div className="image-frame-overlay" />
                <div className="image-frame-details">
                  <div>
                    <span className="label-tag">Tegangan Tinggi</span>
                    <span className="title-text">High Voltage</span>
                  </div>
                  <span className="spec-badge">TTPL</span>
                </div>
              </div>
            </div>
          </div>

          {/* BLUE-GREEN LAB CREW */}
          <div className="liquid" style={{ marginTop: 60, padding: 34 }}>
            <div className="eyebrow" data-i18n="home.crew">People behind the lab</div>
            <h2 className="title" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', margin: '14px 0' }} data-i18n="home.people">
              Blue-green lab crew.
            </h2>
            <p className="subtitle" style={{ fontSize: 15 }} data-i18n="home.peopleText">
              {st.profileDesc}
            </p>

            <div className="people-rail" style={{ marginTop: 24 }}>
              <div className="people-track">
                {[...alumni, ...alumni].map((a, i) => (
                  <div className="person" key={i}>
                    <img src={a[2]} alt={a[0]} />
                    <b>{a[0]}<br /><small>{a[1]}</small></b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: TRACKS SECTION */}
        <section id="tracks" className="section" style={{ scrollMarginTop: 80 }}>
          <div className="split-section reverse">
            <div className="bg-number" style={{ left: 'auto', right: '-20px' }}>02</div>

            <div className="col-left">
              {/* IMAGE FRAME WITH SHIMMER AND DETAILS */}
              <div className="image-frame">
                <img src="/assets/ttpl-slide-3.jpg" alt="Measurement Instruments" />
                <div className="image-frame-overlay" />
                <div className="image-frame-details">
                  <div>
                    <span className="label-tag">Pengukuran Listrik</span>
                    <span className="title-text">Measurement</span>
                  </div>
                  <span className="spec-badge">TTPL</span>
                </div>
              </div>
            </div>

            <div className="col-right text-left">
              <div className="eyebrow">{st.focusSub}</div>
              <h2 className="title" style={{ margin: '16px 0', fontSize: 'clamp(32px, 4vw, 54px)' }} data-i18n="profile.focus">
                {st.focusTitle}
              </h2>
              <p className="subtitle" style={{ fontSize: 16, margin: '20px 0' }}>
                {st.focusDesc}
              </p>

              <div className="grid two" style={{ marginTop: 28 }}>
                <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
                  <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', letterSpacing: '0.15em' }}>
                    <Cpu size={14} /> {st.focusWhat}
                  </div>
                  <p style={{ fontSize: 13.5, marginTop: 8 }} data-i18n="profile.focusText">
                    {st.focusWhatText}
                  </p>
                </div>

                <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
                  <div className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center', letterSpacing: '0.15em' }}>
                    <ShieldCheck size={14} /> {st.missionTitle}
                  </div>
                  <p style={{ fontSize: 13.5, marginTop: 8 }}>
                    {st.missionDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* THREE PRACTICUM TRACKS */}
          <div className="liquid" style={{ marginTop: 60, padding: 34 }}>
            <div className="eyebrow" data-i18n="home.tracks">Three practicum tracks.</div>
            <h2 className="title" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', margin: '14px 0' }} data-i18n="home.tracks">
              Three practicum tracks.
            </h2>
            <p className="subtitle" style={{ fontSize: 15 }} data-i18n="home.tracksText">
              Each track has modules, videos, rules, pre-test, post-test, timeline, and submission checkpoints.
            </p>

            <div className="grid" style={{ marginTop: 28 }}>
              <Link href="/practicum/rl" className="track-card">
                <span className="eyebrow">TTPL Track • RL</span>
                <h3 data-i18n="tracks.rl">Rangkaian Listrik</h3>
                <p data-i18n="tracks.rlText">Mesh, node, superposition, Thevenin, Norton, two-port, AC, and three-phase.</p>
                <span className="chip" data-i18n="common.pdf">PDF Module</span>
                <span className="chip" data-i18n="common.videos">Videos</span>
                <span className="chip" data-i18n="common.prepost">Pre/Post</span>
              </Link>

              <Link href="/practicum/idp" className="track-card">
                <span className="eyebrow">TTPL Track • IDP</span>
                <h3 data-i18n="tracks.idp">Instrumentation & Measurement</h3>
                <p data-i18n="tracks.idpText">Analog and digital instruments, power, power quality, illumination, grounding, and energy.</p>
                <span className="chip" data-i18n="common.pdf">PDF Module</span>
                <span className="chip" data-i18n="common.videos">Videos</span>
                <span className="chip" data-i18n="common.prepost">Pre/Post</span>
              </Link>

              <Link href="/practicum/t3" className="track-card">
                <span className="eyebrow">TTPL Track • T3</span>
                <h3 data-i18n="tracks.t3">High Voltage & High Current</h3>
                <p data-i18n="tracks.t3Text">AC/DC high voltage, impulse waveform, air insulation, liquid insulation, and solid insulation.</p>
                <span className="chip" data-i18n="common.pdf">PDF Module</span>
                <span className="chip" data-i18n="common.videos">Videos</span>
                <span className="chip" data-i18n="common.prepost">Pre/Post</span>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 03: WORKS & NEWS */}
        <section id="works" className="section" style={{ scrollMarginTop: 80 }}>
          
          <div className="liquid" style={{ padding: 34 }}>
            <div className="eyebrow" data-i18n="home.clients">Clients & collaborators</div>
            <h2 className="title" style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', margin: '14px 0' }}>
              What's up at TTPL.
            </h2>
            <p className="subtitle" style={{ fontSize: 15 }} data-i18n="home.clientsText">
              A living space for TTPL updates, lab improvements, virtual tools, student media, assistant activities, and project-based collaboration.
            </p>
            <div className="rainbow-line" />
            <div className="client-strip">
              <div className="client">Learning Media</div>
              <div className="client">Measurement Study</div>
              <div className="client">Instrument Training</div>
              <div className="client">Power-System Education</div>
            </div>
            <div className="btn-row" style={{ marginTop: 24 }}>
              <Link className="btn" href="/works">Open updates page <ArrowUpRight size={14} /></Link>
              <Link className="btn ghost" href="/contact">Contact TTPL</Link>
            </div>
          </div>

          {/* BATCH 2024 ASSISTANTS & NEWS */}
          <div className="grid two" style={{ marginTop: 30 }}>
            <div className="card" style={{ padding: 34, textAlign: 'left' }}>
              <div className="eyebrow">Current crew</div>
              <h2>Batch 2024 assistants</h2>
              <p style={{ marginTop: 14 }}>{current.join(' • ')}</p>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Official individual portraits are intentionally left as placeholders until the lab publishes them.</p>
            </div>
            
            <div className="card" style={{ padding: 34, textAlign: 'left' }}>
              <div className="eyebrow" data-i18n="home.news">News & updates</div>
              <h2>The seal is broken.</h2>
              <p style={{ marginTop: 14 }}>Welcome to the newest TTPL assistants and the next practicum season.</p>
              <Link className="btn ghost" href="/news" style={{ marginTop: 20 }}>View news</Link>
            </div>
          </div>
        </section>

      </main>

    </div>
  );
}
