'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, Globe2, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from './AuthProvider';

const copy = {
  en: { practicum: 'Practicum', lab: 'Virtual Lab', works: 'Lab updates', assistants: 'People', news: 'News', contact: 'Contact', login: 'Sign in', portal: 'My portal', admin: 'Admin desk', light: 'Light', dark: 'Dark', menu: 'Menu', tagline: 'Surging W⚡th Voltage' },
  id: { practicum: 'Praktikum', lab: 'Lab Virtual', works: 'Kegiatan Lab', assistants: 'Tim', news: 'Berita', contact: 'Kontak', login: 'Masuk', portal: 'Portal saya', admin: 'Meja admin', light: 'Terang', dark: 'Gelap', menu: 'Menu', tagline: 'Surging W⚡th Voltage' },
  zh: { practicum: '实验课', lab: '虚拟实验室', works: '实验室动态', assistants: '团队', news: '新闻', contact: '联系', login: '登录', portal: '我的入口', admin: '管理台', light: '浅色', dark: '深色', menu: '菜单', tagline: 'Surging W⚡th Voltage' }
};

const routes = [
  ['/practicum', 'practicum'],
  ['/virtual-lab', 'lab'],
  ['/works', 'works'],
  ['/assistants', 'assistants'],
  ['/news', 'news'],
  ['/contact', 'contact']
];

export default function Shell({ children }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ttpl-lang');
    const systemLanguage = (navigator.language || 'en').toLowerCase();
    setLang(saved || (systemLanguage.startsWith('zh') ? 'zh' : systemLanguage.startsWith('id') ? 'id' : 'en'));
    setTheme(localStorage.getItem('ttpl-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    localStorage.setItem('ttpl-lang', lang);
    localStorage.setItem('ttpl-theme', theme);
  }, [lang, theme]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const t = copy[lang] || copy.en;
  const isStaff = profile?.role === 'admin' || profile?.role === 'assistant';
  const dashboardHref = isStaff ? '/admin' : '/portal';
  const dashboardLabel = isStaff ? t.admin : t.portal;

  return <>
    <div className="liquid-bg" aria-hidden="true"><span/><span/><span/></div>
    <header className="site-header" id="top">
      <nav className="nav" aria-label="Primary navigation">
        <Link href="/" className="brand" aria-label="TTPL UI home">
          <img src="/assets/ttpl-logo.png" alt=""/>
          <span><b>TTPL UI</b><small>{t.tagline}</small></span>
        </Link>
        <div className={`navlinks ${menuOpen ? 'open' : ''}`}>
          {routes.map(([href, key]) => <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}>{t[key]}</Link>)}
        </div>
        <div className="nav-actions">
          <button className="nav-icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? t.light : t.dark} mode`} title={theme === 'dark' ? t.light : t.dark}>
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === 'dark' ? t.light : t.dark}</span>
          </button>
          <label className="select-wrap" aria-label="Language">
            <Globe2 size={17}/><select value={lang} onChange={(event) => setLang(event.target.value)}><option value="en">EN</option><option value="id">ID</option><option value="zh">中文</option></select><ChevronDown size={14}/>
          </label>
          <Link className="login-btn" href={user ? dashboardHref : '/login'}>{user ? dashboardLabel : t.login}</Link>
          <button className="mobile-menu-button" aria-expanded={menuOpen} aria-label={t.menu} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </nav>
    </header>
    <main className="site-main">{children}</main>
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-brand"><img src="/assets/ttpl-logo.png" alt=""/><span><b>TTPL UI</b><small>{t.tagline}</small></span></Link>
        <p>Department of Electrical Engineering, Faculty of Engineering, Universitas Indonesia, Depok.</p>
      </div>
      <div className="footer-links">
        <a href="mailto:laboratorium.ttpl@gmail.com">laboratorium.ttpl@gmail.com</a>
        <a href="https://www.instagram.com/lttpl.ui" target="_blank" rel="noreferrer">Instagram @lttpl.ui</a>
        <Link href="/practicum">Practicum portal</Link>
      </div>
      <small>© 2026 Laboratorium Tegangan Tinggi dan Pengukuran Listrik UI</small>
    </footer>
  </>;
}
