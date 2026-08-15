'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import ReadingAnalyticsPanel from '../../components/ReadingAnalyticsPanel';
import './reading.css';

export default function ReadingAnalyticsPage() {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const isStaff = ['assistant', 'admin'].includes(profile?.role);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && profile?.role === 'student') router.replace('/portal');
  }, [loading, user, profile, router]);

  if (loading) return <section className="section"><h1 className="title">Loading reading analytics...</h1></section>;
  if (!configured) return <section className="section"><h1 className="title">Database connection unavailable.</h1></section>;
  if (!user || !isStaff) return null;

  return <section className="section reading-analytics-page">
    <Link className="reading-back" href={profile.role === 'admin' ? '/admin' : '/assistant-dashboard'}><ArrowLeft size={17}/> Back to dashboard</Link>
    <ReadingAnalyticsPanel />
  </section>;
}
