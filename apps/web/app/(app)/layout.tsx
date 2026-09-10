"use client";

import { AppShell } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, session } = useRequireAuth();
  if (loading || !session?.organization) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-3 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
