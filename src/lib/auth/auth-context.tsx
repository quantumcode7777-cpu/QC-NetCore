"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { ProfileRow, OrganizationRow } from "@/types/database.types";

interface AuthContextType {
  user: SupabaseAuthUser | null;
  profile: ProfileRow | null;
  organization: OrganizationRow | null;
  isLoading: boolean;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organization: null,
  isLoading: true,
  isDemoMode: false,
  enterDemoMode: () => {},
  exitDemoMode: () => {},
  signOut: async () => {},
  refreshAuth: async () => {},
});

const DEMO_COOKIE_NAME = "gtech_demo_mode";

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const matches = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)")
  );
  return matches ? decodeURIComponent(matches[1]) : null;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const supabase = createSupabaseBrowserClient();

  const loadUserData = async (authUser: SupabaseAuthUser) => {
    try {
      setUser(authUser);

      // Fetch user profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (profileData && !profileErr) {
        setProfile(profileData);

        // Fetch organization
        const { data: orgData } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profileData.organization_id)
          .single();

        if (orgData) {
          setOrganization(orgData);
        }
      }
    } catch (err) {
      console.error("[G-Tech Auth] Error loading profile:", err);
    }
  };

  const refreshAuth = async () => {
    setIsLoading(true);
    try {
      // Check if URL has ?demo=true or cookie is set
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const hasDemoQuery = urlParams?.get("demo") === "true";
      const hasDemoCookie = getCookie(DEMO_COOKIE_NAME) === "true";

      if (hasDemoQuery || hasDemoCookie) {
        setIsDemoMode(true);
        if (hasDemoQuery) setCookie(DEMO_COOKIE_NAME, "true");
        setUser(null);
        setProfile(null);
        setOrganization(null);
        setIsLoading(false);
        return;
      }

      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setIsDemoMode(false);
        deleteCookie(DEMO_COOKIE_NAME);
        await loadUserData(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setOrganization(null);
      }
    } catch (err) {
      console.error("[G-Tech Auth] Error initializing auth session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setIsDemoMode(false);
          deleteCookie(DEMO_COOKIE_NAME);
          await loadUserData(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setOrganization(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const enterDemoMode = () => {
    setCookie(DEMO_COOKIE_NAME, "true");
    setIsDemoMode(true);
    setUser(null);
    setProfile(null);
    setOrganization(null);
    router.push("/dashboard?demo=true");
  };

  const exitDemoMode = () => {
    deleteCookie(DEMO_COOKIE_NAME);
    setIsDemoMode(false);
    router.replace("/");
  };

  const signOut = async () => {
    deleteCookie(DEMO_COOKIE_NAME);
    setIsDemoMode(false);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOrganization(null);
    router.replace("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organization,
        isLoading,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
