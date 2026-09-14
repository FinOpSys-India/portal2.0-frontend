"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A label on hover, for something the screen shows without room to say it.
 *
 * WHAT IT IS FOR: an avatar circle carrying two initials, a chip whose company
 * name is wider than its column, a `+3` standing in for three people. Each of
 * those is a shorthand, and the long form was reachable only by opening the
 * row — or not at all.
 *
 * CARRIES ITS OWN PROVIDER. Radix throws when a tooltip has none above it, and
 * these render inside tables that are Server Components as well as on screens
 * outside the portal shell (the workspace picker, the auth screens), so
 * depending on the shell's provider would be a crash waiting for the first
 * table that moves. Nested providers are fine — the shell keeps its own for the
 * sidebar.
 *
 * NOT AN ACCESSIBILITY DEVICE. A tooltip is a mouse affordance; the callers
 * here keep the same names in a visually hidden list, which is what a screen
 * reader and a keyboard actually reach.
 */
export function Hint({
  label,
  children,
}: {
  /** The long form. Nothing is rendered when it is empty. */
  label: string;
  children: React.ReactNode;
}) {
  if (!label) return children;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent sideOffset={6}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
