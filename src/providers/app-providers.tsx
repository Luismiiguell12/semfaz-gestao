"use client";

import * as React from "react";
import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  );
}
