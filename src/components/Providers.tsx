"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { SiteProvider } from "@/context/SiteContext";
import { MemberProvider } from "@/context/MemberContext";
import { initAnalytics } from "@/lib/firebase";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => { initAnalytics().catch(() => undefined); }, []);
  return (
    <SiteProvider>
      <AuthProvider>
        <MemberProvider>{children}</MemberProvider>
      </AuthProvider>
    </SiteProvider>
  );
}
