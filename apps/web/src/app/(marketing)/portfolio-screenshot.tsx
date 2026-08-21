import fs from "fs";
import path from "path";

import Image from "next/image";

const SCREENSHOT_PUBLIC_PATH = "/screenshot-portfolio.png";
const SCREENSHOT_FILENAME = "screenshot-portfolio.png";

function screenshotExists(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", SCREENSHOT_FILENAME));
  } catch {
    return false;
  }
}

// Checked at request time so the build never depends on a human-supplied
// asset: renders the real screenshot only if the file actually exists on
// disk, otherwise a clearly-labeled placeholder. Never both, never a
// broken <Image> pointed at a missing file.
export function PortfolioScreenshot() {
  if (screenshotExists()) {
    return (
      <div className="overflow-hidden rounded-xl border border-black/10 shadow-sm">
        <Image
          src={SCREENSHOT_PUBLIC_PATH}
          alt="Portfolio view listing customer relationships ranked by health, renewal timing, and open risks, with the most urgent accounts surfaced first."
          width={1440}
          height={900}
          sizes="(min-width: 1024px) 960px, 100vw"
          className="h-auto w-full"
          priority={false}
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 bg-[#F5F7FA] px-6 text-center"
      role="img"
      aria-label="Portfolio screenshot placeholder -- product screenshot not yet supplied"
    >
      <p className="text-sm font-semibold text-gray-600">
        Portfolio screenshot pending
      </p>
      <p className="max-w-sm text-xs text-gray-500">
        Add <code className="rounded bg-white px-1 py-0.5">public/screenshot-portfolio.png</code>{" "}
        to replace this placeholder with the real product screenshot.
      </p>
    </div>
  );
}
