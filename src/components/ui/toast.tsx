"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "success" | "error";
type Item = { id: number; variant: Variant; message: string };

/*
 * A module-level store rather than a context.
 *
 * Every caller is an event handler in a dialog that closes on success — the
 * confirmation has to outlive the component that earned it, so it cannot be
 * owned by that component's state. A context would work but would make every
 * caller a consumer; a store lets `toast.success(...)` be called from anywhere
 * that already imports this file, dialog or not.
 */
let items: Item[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function push(variant: Variant, message: string) {
  // Newest three. A stack that grows without bound covers the page it is
  // reporting on, and nobody reads the fourth one.
  items = [...items, { id: nextId++, variant, message }].slice(-3);
  emit();
}

/**
 * Fire-and-forget confirmation, bottom right.
 *
 * Use it where the surface that did the work goes away — a dialog that closes
 * on success leaves nothing on screen to say the write landed. Where the form
 * STAYS open, the inline `FormAlert` is still the right place for a failure:
 * it sits next to the field that has to change, and a toast that repeats it
 * says the same thing twice.
 */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

/** Successes read and go; a failure is something to act on, so it lingers. */
const DURATION = { success: 4000, error: 7000 } as const;

export function Toaster() {
  const rows = React.useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => items,
    // Empty on the server and empty at hydration — nothing can have been
    // pushed before the first client render, so the two agree.
    () => items,
  );

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {rows.map(({ id, variant, message }) => {
        const Icon = variant === "success" ? CheckCircle2 : AlertCircle;

        return (
          <ToastPrimitive.Root
            key={id}
            duration={DURATION[variant]}
            // Radix animates the exit and reports it here; dropping any
            // earlier would cut the animation off mid-slide.
            onOpenChange={(open) => {
              if (!open) {
                items = items.filter((item) => item.id !== id);
                emit();
              }
            }}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 text-sm shadow-lg shadow-black/5",
              "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-2",
              // Swipe: follow the finger while it moves, snap back if the
              // gesture is abandoned, leave to the right if it is not.
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
            )}
          >
            <Icon
              className={cn(
                "mt-px size-4 shrink-0",
                variant === "success" ? "text-success" : "text-destructive",
              )}
              aria-hidden
            />
            <ToastPrimitive.Description className="min-w-0 flex-1 text-card-foreground">
              {message}
            </ToastPrimitive.Description>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              <X className="size-3.5" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}

      {/*
       * Bottom right, above the dialog layer (z-50) — a write can fail from
       * inside an open dialog, and a confirmation rendered underneath the
       * overlay is not a confirmation. `pointer-events-none` on the strip so
       * the empty space beside a toast does not swallow clicks on the page.
       */}
      <ToastPrimitive.Viewport className="pointer-events-none fixed right-0 bottom-0 z-100 flex w-full max-w-[min(100%,24rem)] flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
