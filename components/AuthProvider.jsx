'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';

const AuthContext = createContext({ user: null, profile: null, loading: true, configured: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabase(), []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return null;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
    setProfile(data || null);
    return data || null;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const loadProfile = async (authUser) => {
      setUser(authUser || null);
      if (!authUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (data?.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(data || null);
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => loadProfile(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const value = { user, profile, loading, configured: Boolean(supabase), supabase, refreshProfile };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
