"use client";

import { Check, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PillOption = { id: string; name: string };

/**
 * The words in front of the pill, in every portal that scopes to a company.
 *
 * Shared rather than written beside each pill: the bar reads the same whether
 * the reader is a customer on their own companies or a manager on their book,
 * and a pill with no label is a brand-coloured button that says a company name
 * and nothing about what pressing it does.
 *
 * Hidden below `sm` — the bar there is the menu trigger, the pill, the bell and
 * the avatar, with no room for prose.
 */
export function SwitchLabel() {
  return (
    <span className="hidden text-sm text-muted-foreground sm:inline">
      Switch Company <span aria-hidden>&rarr;</span>
    </span>
  );
}

/**
 * Brand pill that switches the thing a portal is scoped to — a company for a
 * customer, a client company for a manager.
 *
 * Selecting navigates rather than setting state, so the URL always records
 * which company is on screen and a reload cannot silently show a different
 * one's data.
 */
export function WorkspacePill({
  current,
  options,
  onSelect,
  label = "Workspace",
  menuLabel = "Switch Company",
  variant = "default",
  unpaid = [],
}: {
  current: PillOption;
  options: PillOption[];
  onSelect: (id: string) => void;
  label?: string;
  menuLabel?: string;
  /** Outline for a pill inside the page — the brand fill belongs to the bar. */
  variant?: "default" | "outline";
  /**
   * Options that still owe a subscription. Tagged here as they are in the
   * workspace picker and the Company table, because this is the third way into
   * a company and a switcher that looks identical for a draft and a live
   * account is how someone lands on an empty-looking portal. Where the tag
   * leads is `onSelect`'s business, not this component's.
   */
  unpaid?: string[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          aria-label={label}
          className="rounded-full"
        >
          <span className="max-w-40 truncate">{current.name}</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => onSelect(option.id)}
          >
            <span className="flex-1 truncate">{option.name}</span>
            {unpaid.includes(option.id) ? (
              <Badge variant="destructive">Payment pending</Badge>
            ) : null}
            {option.id === current.id ? (
              <Check className="size-4" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
