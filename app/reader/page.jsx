'use client';

import { useEffect, useState } from 'react';
import TrackedPdfReader from '../../components/TrackedPdfReader';

const allowedDocuments = new Set([
  '/modules/modul-rangkaian-listrik-2025-2026.pdf',
  '/modules/modul-1-dasar-pengukuran-besaran-listrik.pdf',
  '/modules/modul-instrumentasi-pengukuran-listrik-2025-2026.pdf',
  '/modules/modul-teknik-tegangan-arus-tinggi-2022.pdf'
]);

export default function ReaderPage() {
  const [params, setParams] = useState(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const track = search.get('track');
    const moduleNumber = Number(search.get('module'));
    const src = search.get('src');
    const title = search.get('title') || '';
    const valid = ['rl', 'idp', 't3'].includes(track) && moduleNumber >= 1 && moduleNumber <= 8 && allowedDocuments.has(src);
    setParams(valid ? { track, moduleNumber, src, title } : { invalid: true });
  }, []);

  if (!params) return <section className="section reader-state"><h1>Opening tracked module...</h1></section>;
  if (params.invalid) return <section className="section reader-state"><h1>Invalid module link.</h1><p>Open the module again from the TTPL practicum page.</p></section>;

  return <TrackedPdfReader {...params} />;
}
