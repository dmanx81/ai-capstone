import Link from "next/link";

import { palette } from "./palette";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: palette.navy }} className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: palette.signalBlue }}
          >
            {/* tend-mark.svg is drawn in navy for use on light backgrounds; on
                this navy footer a small light chip keeps it visible without
                modifying the shared brand asset. */}
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, not a next/image candidate */}
              <img src="/brand/tend-mark.svg" alt="" className="h-3.5 w-3.5" />
            </span>
            <span className="font-[var(--font-marketing-display)] text-base font-bold tracking-tight text-white">
              Tend
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-sm text-white/70" aria-label="Legal">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/impressum" className="hover:text-white">
              Impressum
            </Link>
          </nav>
        </div>

        <p className="text-center text-sm text-white/50 sm:text-left">
          &copy; {year} {"{{LEGAL_ENTITY_NAME}}"}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
