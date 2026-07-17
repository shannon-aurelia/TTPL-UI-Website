'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';

const AuthContext = createContext({ user: null, profile: null, loading: true, configured: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabase(), []);

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
      setProfile(data || null);
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => loadProfile(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const value = { user, profile, loading, configured: Boolean(supabase), supabase };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
