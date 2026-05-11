"use client"

import dynamic from "next/dynamic"

const GWDAppShell = dynamic(
  () => import("@/components/gwd/app-shell").then((mod) => mod.GWDAppShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    ),
  },
)

export default function Page() {
  return <GWDAppShell />
}
