import Link from "next/link";

import { palette } from "./palette";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: palette.navy }} className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm text-white/70 sm:flex-row sm:justify-between sm:px-6">
        <nav className="flex items-center gap-4" aria-label="Legal">
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
        <p>&copy; {year} {"{{LEGAL_ENTITY_NAME}}"}. All rights reserved.</p>
      </div>
    </footer>
  );
}
