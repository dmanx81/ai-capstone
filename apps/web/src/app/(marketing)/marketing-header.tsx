import Link from "next/link";

import { palette } from "./palette";

export function MarketingHeader() {
  return (
    <header
      className="sticky top-0 z-10 border-b border-white/10"
      style={{ backgroundColor: palette.navy }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: palette.signalBlue }}
        >
          {/* tend-mark.svg is drawn in navy for use on light backgrounds; on
              this navy header a small light chip keeps it visible without
              modifying the shared brand asset. */}
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, not a next/image candidate */}
            <img src="/brand/tend-mark.svg" alt="" className="h-4 w-4" />
          </span>
          <span className="font-[var(--font-marketing-display)] text-lg font-bold tracking-tight text-white">
            Tend
          </span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-4" aria-label="Account">
          <Link
            href="/auth/login"
            className="rounded px-3 py-2 text-sm font-medium text-white/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: palette.signalBlue }}
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: palette.signalBlue, outlineColor: palette.white }}
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
