"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { managerApi, type StaffingLine } from "@/lib/manager";

/**
 * Company-level specialist assignment — the only assignment surface a manager
 * has, now that a project's specialist is derived from the company's staffing.
 *
 * THE LINES COME FROM THE SERVER, on open, rather than from the row's
 * `activeServices` labels. The write endpoint decides which services are active,
 * who is eligible for each (the specialist's role must match the service), and
 * that EVERY active line must be filled in one submission — a form built on the
 * client's own reading of those rules offered choices the save then refused, and
 * refused them wholesale, so nothing was written at all.
 */
export function AssignCompanySpecialist({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lines, setLines] = React.useState<StaffingLine[] | null>(null);
  const [picked, setPicked] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  // Loaded on open, not with the page: this is one dialog on one row, and the
  // reader opens it far less often than they load the table.
  React.useEffect(() => {
    if (!open) return;
    let live = true;

    managerApi
      .staffing(companyId)
      .then((rows) => {
        if (!live) return;
        setLines(rows);
        // Whoever holds each line today, so the form opens showing the current
        // staffing rather than three empty selects over a company that is
        // already staffed.
        setPicked(
          Object.fromEntries(
            rows
              .filter((row) => row.assigned !== null)
              .map((row) => [row.code, row.assigned as number]),
          ),
        );
      })
      .catch((err: unknown) =>
        setFailure(
          err instanceof Error ? err.message : "Could not load the services.",
        ),
      );

    return () => {
      live = false;
    };
  }, [open, companyId]);

  const missing = (lines ?? []).some((line) => !picked[line.code]);

  async function save() {
    setFailure(null);
    setSaving(true);
    try {
      await managerApi.assignCompanySpecialists(companyId, picked);
      setSaved(true);
      router.refresh();
      // Long enough to read the confirmation, short enough not to be a wait.
      setTimeout(() => setOpen(false), 1200);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLines(null);
          setPicked({});
          setSaved(false);
          setFailure(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {/* relative z-10 keeps the trigger above the row's own click target. */}
        <Button variant="outline" size="sm" className="relative z-10">
          Assign Specialist
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign specialists to {companyName}</DialogTitle>
        </DialogHeader>

        {lines === null ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Spinner className="size-4" aria-label="Loading services" />
            Loading services…
          </p>
        ) : lines.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No active services on this company, so there is nothing to staff.
          </p>
        ) : (
          <div className="space-y-4">
            {lines.map((line) => (
              <div key={line.code} className="space-y-2">
                <Label htmlFor={`staff-${line.code}`}>
                  {line.name} Specialist
                </Label>

                <Select
                  value={picked[line.code]?.toString() ?? ""}
                  onValueChange={(value) =>
                    setPicked((prev) => ({ ...prev, [line.code]: Number(value) }))
                  }
                  disabled={line.options.length === 0 || saving}
                >
                  <SelectTrigger id={`staff-${line.code}`} className="w-full">
                    <SelectValue
                      placeholder={
                        line.options.length === 0
                          ? `No ${line.name.toLowerCase()} specialist available`
                          : "Select your specialist"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {line.options.map((option) => (
                      <SelectItem
                        key={option.userId}
                        value={String(option.userId)}
                      >
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <FormAlert>{failure}</FormAlert>

        {saved ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-medium text-primary"
          >
            <Check className="size-4" aria-hidden />
            Specialists assigned.
          </p>
        ) : null}

        {lines !== null && lines.length > 0 ? (
          <Button
            type="button"
            onClick={save}
            // Every active line, or the backend refuses the whole submission.
            disabled={saving || saved || missing}
          >
            {saving ? <Spinner className="size-4" aria-label="Saving" /> : "Save"}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
