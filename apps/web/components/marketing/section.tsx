import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-xs text-muted-foreground", className)}>
      <span className="size-1.5 rounded-[1px] bg-current" aria-hidden />
      {children}
    </p>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16 border-t", className)}>
      <Container className="py-20 sm:py-28">
        <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4 lg:pt-2">{eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}</div>
          <div className="lg:col-span-8">
            <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05]">
              {title}
            </h2>
            {description ? (
              <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {children ? <div className="mt-14 sm:mt-16">{children}</div> : null}
      </Container>
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section>
      <Container className="pb-16 pt-16 sm:pb-20 sm:pt-24">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-6xl sm:leading-[1.02]">
          {title}
        </h1>
        {description ? (
          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
      </Container>
    </section>
  );
}
