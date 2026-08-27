import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SilkBackdrop } from "@/components/auth/silk-backdrop";
import { cn } from "@/lib/utils";

/**
 * Panel copy, lifted verbatim from 1.0's artwork PNGs.
 *
 * In 1.0 these words were pixels baked into a 3MB image — unselectable,
 * untranslatable, invisible to screen readers, blurry on retina. Same words,
 * now real text on a CSS gradient.
 */
export const AUTH_PANELS = {
  login: {
    title: "Streamline Your Financial Operations",
    body: "Manage bookkeeping, payroll, and taxes all in one place. Get real-time insights and stay compliant with automated workflows.",
    backdrop: "silk",
  },
  signup: {
    title: "Join Thousands of Growing Businesses",
    body: "Simplify your financial management with our comprehensive suite of tools. From bookkeeping to tax filing, we've got you covered.",
  },
  otp: {
    title: "Almost There!",
    body: "Verify your email to unlock all features and start managing your finances with confidence. Your security is our priority.",
  },
  forgotPassword: {
    title: "Secure Account Recovery",
    body: "Your account security matters to us. We'll help you regain access quickly and safely with our verified recovery process.",
  },
} as const;

export type AuthPanel = {
  title: string;
  body: string;
  /** `silk` swaps the photo for the animated shader. Defaults to the photo. */
  backdrop?: "photo" | "silk";
};

export type Step = { title: string; description: string };

/**
 * 1.0's sidebar claims two steps, but a plan step follows the second and then
 * payment — so the tracker under-promises how much is left. Counted honestly.
 */
export const ONBOARDING_STEPS: Step[] = [
  { title: "Your details", description: "Who you are and how to reach you." },
  { title: "Your company", description: "The business we'll be working on." },
  { title: "Your plan", description: "Pick the services you need." },
];

/**
 * Opacity of a step by how far it sits from the active one, so the list fades
 * out in both directions instead of splitting into a hard on/off pair.
 * Floored so a distant step is still legible rather than invisible.
 */
function stepOpacity(distance: number): number {
  return distance === 0 ? 1 : Math.max(0.22, 1 - distance * 0.42);
}

/**
 * Two columns: form card on the left, brand panel on the right.
 *
 * The panel is decorative and collapses below `lg` — on a phone the form gets
 * the whole screen rather than being pushed under a hero. Pages supply
 * content only; all page padding and widths live here.
 */
export function AuthShell({
  children,
  footer,
  panel,
  step,
  width = "default",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  panel?: AuthPanel;
  /** Renders a step tracker in the panel instead of the marketing copy. */
  /** Which onboarding step is current, if this screen is part of that flow. */
  step?: number;
  /** `wide` is for the plan step, which is a two-column comparison. */
  width?: "default" | "wide";
}) {
  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-3">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:col-span-2">
        {/* Below lg the panel is gone, so the form column carries the logo. */}
        <Link
          href="/"
          className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 lg:hidden"
        >
          <Image
            src="/brand/logo.svg"
            alt="FinOpSys"
            width={132}
            height={40}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          {/* 31.2rem = 26rem + 20%. Shared by every page in the shell so the
              form column stays the same width across auth and onboarding. */}
          <div
            className={cn(
              "w-full",
              width === "wide" ? "max-w-5xl" : "max-w-[31.2rem]",
            )}
          >
            {children}

            {footer ? (
              <div className="mt-8 text-sm text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} FinOpSys
        </p>
      </div>

      {panel ? <AuthPanel {...panel} step={step} /> : null}
    </div>
  );
}

/**
 * The brand column: an inset rounded slab on the left, photo under a brand
 * gradient with the copy sitting at the bottom.
 *
 * Photo is `public/brand/panel.jpg` — Unsplash, free for commercial use, no
 * attribution required. Deliberately a workspace rather than a face: the
 * Unsplash licence covers the photo, not the likeness of anyone in it.
 *
 * The gradient is not decoration. It is what keeps white text legible over an
 * image whose brightness we do not control.
 */
function AuthPanel({
  title,
  body,
  backdrop = "photo",
  step,
}: AuthPanel & { step?: number }) {
  return (
    <div className="hidden p-3 lg:order-first lg:block">
      <div className="relative h-full overflow-hidden rounded-3xl bg-[#2c1a72]">
        {backdrop === "silk" ? (
          <SilkBackdrop color="#7f56d9" />
        ) : (
          <>
            <Image
              src="/brand/panel.jpg"
              alt=""
              fill
              priority
              sizes="34vw"
              className="object-cover"
            />
            {/* Brand wash over the photo. */}
            <div className="absolute inset-0 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--primary),transparent_25%)_0%,color-mix(in_oklch,#2563eb,transparent_35%)_45%,color-mix(in_oklch,#2c1a72,transparent_20%)_100%)] mix-blend-multiply" />
          </>
        )}

        {/* Scrim so the copy keeps contrast over either backdrop. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,10,50,0.88)_0%,rgba(20,10,50,0.3)_50%,rgba(20,10,50,0.35)_100%)]" />

        <div className="relative flex h-full flex-col p-8 xl:p-10">
          <Link
            href="/"
            className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40"
          >
            {/* The mark is #141414 + #7939EF; both vanish on a dark photo, so
                it renders monochrome white here. Swap for a real white variant
                if brand ships one. */}
            <Image
              src="/brand/logo.svg"
              alt="FinOpSys"
              width={132}
              height={40}
              priority
              className="h-8 w-auto brightness-0 invert"
            />
          </Link>

          {step !== undefined ? (
            // Absolutely centred rather than flowing after the logo, which
            // would push the list down by half the logo's height.
            <div className="absolute inset-0 flex items-center p-8 xl:p-10">
              <StepList current={step} />
            </div>
          ) : (
            <div className="mt-auto" aria-hidden>
              <p className="text-2xl/tight font-semibold tracking-tight text-balance text-white">
                {title}
              </p>
              <p className="mt-3 text-sm/relaxed text-pretty text-white/75">
                {body}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Card heading. One type ramp for all six pages: 24px semibold title over a
 * 14px muted line.
 */
export function AuthHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight text-balance">
        {title}
      </h1>
      {children ? (
        <p className="text-sm text-pretty text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}

/**
 * Step tracker for the panel, centred vertically. Everything but the active
 * step fades by distance, so the list reads as a position on a path rather
 * than a set of on/off items.
 *
 * `aria-hidden`: the form column already states which step this is, and a
 * screen reader reading the whole list on every page would be noise.
 */
function StepList({ current }: { current: number }) {
  const items = ONBOARDING_STEPS;
  return (
    <ol aria-hidden className="w-full space-y-6">
      {items.map((step, index) => {
        const distance = Math.abs(index - current);
        const active = index === current;

        return (
          <li
            key={step.title}
            style={{ opacity: stepOpacity(distance) }}
            className="flex gap-4 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                active
                  ? "border-white bg-white text-[#2c1a72]"
                  : "border-white/40 text-white",
              )}
            >
              {index + 1}
            </span>

            <span className="pt-1">
              <span
                className={cn(
                  "block text-base font-semibold text-white",
                  active && "text-lg",
                )}
              >
                {step.title}
              </span>
              <span className="mt-0.5 block text-sm/relaxed text-white/75">
                {step.description}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Back-to-login chip. A real link rather than a router.push button, so
 * middle-click and open-in-new-tab behave as expected.
 */
export function BackToLogin() {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card pr-3.5 pl-2.5",
        "text-sm font-medium text-muted-foreground",
        "transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "hover:border-primary/25 hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
      )}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      Back to login
    </Link>
  );
}

/** Text link. Same treatment everywhere so nothing looks hand-placed. */
export function AuthLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xs font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
        className,
      )}
    >
      {children}
    </Link>
  );
}
