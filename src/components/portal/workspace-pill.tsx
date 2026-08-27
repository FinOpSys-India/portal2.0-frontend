"use client";

import { Check, ChevronDown } from "lucide-react";

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
  menuLabel = "Switch workspace",
  variant = "default",
}: {
  current: PillOption;
  options: PillOption[];
  onSelect: (id: string) => void;
  label?: string;
  menuLabel?: string;
  /** Outline for a pill inside the page — the brand fill belongs to the bar. */
  variant?: "default" | "outline";
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
            {option.id === current.id ? (
              <Check className="size-4" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
