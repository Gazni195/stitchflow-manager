import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { session, loading };
}

export function useRequireAuth() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (loading) return;
    if (!session && pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [session, loading, pathname, navigate]);
  return { session, loading };
}
