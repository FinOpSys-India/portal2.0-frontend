"use client";

import * as React from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Single input treatment for the module. 40px, 8px radius, neutral border,
 * brand ring on keyboard focus only.
 */
/**
 * Boxed inputs, sized off the Sellora reference: 48px tall, 12px radius,
 * roomy horizontal padding. Bigger than the shadcn default on purpose — an
 * auth form has four controls on screen and can afford the weight.
 *
 * Focus thickens the edge rather than only recolouring it. Once --input was
 * darkened to clear 3:1, a 1px purple border sat at 1.52:1 against the grey
 * one it replaced — the same brightness, so the state change was invisible
 * without colour vision. 1px border + 1px ring reads as a 2px brand edge.
 * Still not the old 3px halo, which looked like a second border.
 */
const CONTROL = [
  "h-11 rounded-lg border border-input bg-card px-3.5 text-sm shadow-none",
  "transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
  "hover:border-primary/35",
  "focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring",
  "aria-invalid:border-destructive aria-invalid:ring-0",
  "disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg disabled:opacity-100",
].join(" ");

/** Leading icon inside a control. Decorative — the label already names it. */
function LeadingIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
    />
  );
}

/** Label text plus the required marker. */
function LabelText({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <>
      {children}
      {required ? (
        <span className="text-destructive" aria-hidden>
          *
        </span>
      ) : null}
    </>
  );
}

/**
 * Wrapper every auth form sits in. Deliberately open — no border, no shadow,
 * no fill. With underlined inputs there is nothing left to enclose, and a
 * card outline around an already-open form just draws a second box.
 *
 * It still owns the vertical rhythm so no page re-decides it.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="space-y-8">{children}</div>;
}

type BaseProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Leading icon inside the control. */
  icon?: LucideIcon;
  /** Renders the `*` marker. Validation still comes from the schema. */
  required?: boolean;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  icon,
  required,
  numeric,
  className,
  ...props
}: BaseProps<T> &
  Omit<React.ComponentProps<"input">, "name"> & {
    /** Strip everything that is not a digit as the user types. */
    numeric?: boolean;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelText required={required}>{label}</LabelText>
          </FormLabel>
          <div className="relative">
            {icon ? <LeadingIcon icon={icon} /> : null}
            <FormControl>
              <Input
                {...field}
                {...props}
                // Filtering on change rather than blocking keystrokes: a
                // blocked keypress gives no feedback, and it would also
                // discard a pasted number that happens to carry formatting.
                onChange={
                  numeric
                    ? (event) =>
                        field.onChange(event.target.value.replace(/\D/g, ""))
                    : field.onChange
                }
                className={cn(CONTROL, icon && "pl-10", className)}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Multi-line twin of TextField. Same control treatment, no leading icon. */
export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  className,
  ...props
}: BaseProps<T> & Omit<React.ComponentProps<"textarea">, "name">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelText required={required}>{label}</LabelText>
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              {...props}
              // CONTROL minus its fixed height — a textarea grows. Everything
              // else carries over so it matches the inputs beside it.
              className={cn(
                CONTROL.replace("h-11 ", ""),
                "min-h-24 py-2.5",
                className,
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 1.0 renders two stacked inputs here — a masked one and a plain-text twin —
 * and toggles which is visible. That is a Bubble artifact, not a feature.
 *
 * The toggle announces its state so a screen-reader user knows when the
 * password is exposed on screen.
 */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  icon,
  required,
  className,
  ...props
}: BaseProps<T> & Omit<React.ComponentProps<"input">, "name">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelText required={required}>{label}</LabelText>
          </FormLabel>
          <div className="relative">
            {icon ? <LeadingIcon icon={icon} /> : null}
            <FormControl>
              <Input
                {...field}
                {...props}
                type={visible ? "text" : "password"}
                className={cn(CONTROL, icon && "pl-10", "pr-11", className)}
              />
            </FormControl>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              disabled={props.disabled}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              // Focus is a ring, not a colour swap: muted and primary are the
              // same luminance, so recolouring the icon alone left a 1.02:1
              // focus indicator — invisible, and a 2.4.7 failure.
              className="absolute inset-y-px right-px flex w-11 items-center justify-center rounded-r-[calc(var(--radius-lg)-1px)] text-muted-foreground transition-colors duration-150 hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              {visible ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  icon,
  required,
  placeholder,
  options,
  disabled,
}: BaseProps<T> & {
  placeholder?: string;
  /**
   * Plain strings where the label is the value — the country and role lists.
   * Objects where they differ, e.g. a person shown by name but stored by
   * email.
   */
  options: readonly string[] | readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  const items = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <LabelText required={required}>{label}</LabelText>
          </FormLabel>
          <div className="relative">
            {icon ? <LeadingIcon icon={icon} /> : null}
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger
                  className={cn(
                    "h-11 w-full rounded-lg border-input bg-card px-3.5 text-sm shadow-none",
                    "transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    "hover:border-primary/35 data-[state=open]:border-primary",
                    "focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring",
                    "aria-invalid:border-destructive aria-invalid:ring-0",
                    "data-[size=default]:h-11",
                    icon && "pl-10",
                  )}
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-72">
                {items.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Read-only value shown as a field — the invited address, mostly. */
export function StaticField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <div className="relative">
        {icon ? <LeadingIcon icon={icon} /> : null}
        <div
          className={cn(
            "flex h-11 items-center rounded-lg border border-input bg-disabled-bg px-3.5 text-sm text-muted-foreground",
            icon && "pl-10",
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-width primary action. The label stays put while pending — the spinner
 * is absolutely positioned and the text fades, so the button never changes
 * width mid-click.
 */
export function SubmitButton({
  className,
  pending,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button
      type="submit"
      className={cn("relative h-11 w-full rounded-lg text-sm font-semibold", className)}
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      <span
        className={cn(
          "transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          pending && "opacity-0",
        )}
      >
        {children}
      </span>
      {pending ? (
        <Spinner className="absolute size-4" aria-label="Working" />
      ) : null}
    </Button>
  );
}
