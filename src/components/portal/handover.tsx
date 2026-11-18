"use client";

import * as React from "react";
import { ArrowRight, UserRound, type LucideIcon } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { cn } from "@/lib/utils";

/**
 * The popups' one design language (17 Nov): what it is now → what it becomes,
 * each side an avatar with its caption below. Reassign, Make Inactive and
 * Delete all draw it, so a confirmation reads the same everywhere.
 *
 * Motion is a handover and stays small: the arrow points once there is an
 * "after", and the incoming side settles in. `motion-safe` drops it for anyone
 * who asked their system for less.
 */
export function Handover({
  from,
  to,
  ready,
  tone = "primary",
  compact = false,
}: {
  from: React.ReactNode;
  to: React.ReactNode;
  /** There is an "after" to point at: the arrow takes the tone. */
  ready: boolean;
  tone?: "primary" | "destructive" | "muted";
  /** A row inside a list (one per service) rather than the popup's centerpiece. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-center",
        compact ? "gap-2" : "gap-4 py-3",
      )}
    >
      {from}
      <ArrowRight
        aria-hidden
        className={cn(
          "shrink-0 transition-[color,transform] duration-300",
          compact ? "mt-2 size-4" : "mt-5 size-5",
          !ready
            ? "text-muted-foreground"
            : cn(
                "motion-safe:translate-x-0.5",
                tone === "destructive"
                  ? "text-destructive"
                  : tone === "muted"
                    ? "text-muted-foreground"
                    : "text-primary",
              ),
        )}
      />
      {to}
    </div>
  );
}

/** One side: an avatar with its caption centered below. */
export function Side({
  label,
  avatar,
  children,
  compact = false,
}: {
  /** Which side this is ("Current Accounting Manager"), over the avatar. */
  label?: string;
  avatar: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center text-center",
        compact ? "w-32 gap-1" : "w-40 gap-2",
      )}
    >
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}
      {avatar}
      <div className="flex max-w-full flex-col items-center">{children}</div>
    </div>
  );
}

/** A person's avatar at the popup's size, optionally dimmed as the outgoing side. */
export function Face({
  name,
  src,
  dimmed = false,
  ringed = false,
  compact = false,
}: {
  name: string;
  src?: string | null;
  dimmed?: boolean;
  /** The settled choice: a soft ring says "this one". */
  ringed?: boolean;
  compact?: boolean;
}) {
  return (
    <InitialsAvatar
      name={name}
      src={src}
      className={cn(
        "rounded-2xl transition-[opacity,filter,box-shadow] duration-300",
        compact ? "size-9 text-xs" : "size-14 text-base",
        dimmed && "opacity-50 grayscale",
        ringed && "ring-2 ring-primary/25 ring-offset-2 ring-offset-popover",
      )}
    />
  );
}

/** Nobody (or nothing) yet: a dashed circle where the avatar will be. */
export function EmptyFace({
  icon: Icon = UserRound,
  tone = "muted",
  compact = false,
}: {
  icon?: LucideIcon;
  tone?: "muted" | "destructive";
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-2xl border-2 border-dashed",
        compact ? "size-9" : "size-14",
        tone === "destructive"
          ? "border-destructive/40 text-destructive"
          : "border-muted-foreground/30 text-muted-foreground/60",
      )}
    >
      <Icon className={compact ? "size-4" : "size-6"} aria-hidden />
    </span>
  );
}

/**
 * Settles its child in: fade and a slight zoom. Keyed by the caller on what it
 * shows, so each new person browsed to settles in fresh.
 */
export function Settle({
  children,
  delay = false,
}: {
  children: React.ReactNode;
  /** Wait a beat, for the "after" of a popup that has just opened. */
  delay?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 motion-safe:duration-200 motion-safe:ease-out",
        delay && "motion-safe:fill-mode-backwards motion-safe:delay-150",
      )}
    >
      {children}
    </span>
  );
}

/** The quiet "Choose ⌄" under the empty side: no box until hovered. */
export const CHOOSE_TRIGGER =
  "-my-1 h-auto max-w-full border-transparent px-2 py-1 font-medium shadow-none hover:bg-accent data-placeholder:font-normal dark:bg-transparent";

/** "Jane Doe (inactive)" as the name and the flag, so the initials stay JD. */
export function splitInactive(name: string) {
  const inactive = name.endsWith(" (inactive)");
  return {
    name: inactive ? name.slice(0, -" (inactive)".length) : name,
    inactive,
  };
}
