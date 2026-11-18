"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { FormAlert } from "@/components/auth/form-alert";
import {
  CHOOSE_TRIGGER,
  EmptyFace,
  Face,
  Handover,
  Settle,
  Side,
  splitInactive,
} from "@/components/portal/handover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
 *
 * EVERY LINE IS A PICKER (17 Nov): the manager changes a specialist whenever
 * the work calls for it, and must when the admin made one Inactive. Per
 * company, never per project — the company's open projects follow.
 */
export function AssignCompanySpecialist({
  companyId,
  companyName,
  assigned,
  label,
  previewLines,
}: {
  companyId: string;
  companyName: string;
  /** Who holds the company's lines today. Named in place of the button — a
   * staffed company should say WHO, not offer the verb again — while staying
   * the dialog's trigger, so restaffing is still one click. */
  assigned: string[];
  /** Overrides the trigger's text, e.g. "Reassign" on the Needs Reassignment banner. */
  label?: string;
  /** TEMPORARY, for /reassign-preview: sample lines instead of the server's, and Save writes nothing. */
  previewLines?: StaffingLine[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lines, setLines] = React.useState<StaffingLine[] | null>(null);
  const [picked, setPicked] = React.useState<Record<string, number>>({});
  // The option highlighted in an open list: that line's avatar follows it.
  const [browsing, setBrowsing] = React.useState<{ code: string; id: number } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  // Loaded on open, not with the page: this is one dialog on one row, and the
  // reader opens it far less often than they load the table.
  React.useEffect(() => {
    if (!open) return;
    let live = true;

    (previewLines ? Promise.resolve(previewLines) : managerApi.staffing(companyId))
      .then((rows) => {
        if (!live) return;
        setLines(rows);
        // Whoever holds each line today, so the form opens showing the current
        // staffing rather than three empty selects over a company that is
        // already staffed. An Inactive holder is not offered, so their line
        // opens empty and has to be filled before Save.
        setPicked(
          Object.fromEntries(
            rows
              .filter((row) => row.assigned !== null && row.replacing === null)
              .map((row) => [row.code, row.assigned as number]),
          ),
        );
      })
      .catch((err: unknown) => {
        if (!live) return;
        setFailure(
          err instanceof Error ? err.message : "Could not load the services.",
        );
        // Resolved, not left null: null is what draws the spinner, so without
        // this the dialog showed "Loading services…" turning for ever beneath
        // the very message saying the load had failed.
        setLines([]);
      });

    return () => {
      live = false;
    };
  }, [open, companyId, previewLines]);

  const missing = (lines ?? []).some((line) => !picked[line.code]);

  async function save() {
    setFailure(null);
    setSaving(true);
    try {
      if (!previewLines) await managerApi.assignCompanySpecialists(companyId, picked);
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
        {assigned.length > 0 && !label ? (
          // The names ARE the control, with ⇕ — the same as admin's
          // Accounting Manager cell (17 Nov).
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Reassign specialists, now ${assigned.join(", ")}`}
            title="Reassign Specialists"
            className="relative z-10 font-normal"
          >
            {assigned.join(", ")}
            <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
          </Button>
        ) : (
          <Button
            variant={label ? "outline" : "ghost"}
            size="sm"
            className={
              label ? "relative z-10" : "relative z-10 text-primary hover:text-primary"
            }
          >
            {label ?? (
              <>
                <Plus className="size-3.5" aria-hidden />
                Assign
              </>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {assigned.length > 0
              ? `Reassign Specialists for ${companyName}`
              : `Assign Specialists to ${companyName}`}
          </DialogTitle>
          <DialogDescription>
            The company’s open projects move to whoever you choose. Completed
            projects keep their specialist.
          </DialogDescription>
        </DialogHeader>

        {lines === null ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Spinner className="size-4" aria-label="Loading services" />
            Loading services…
          </p>
        ) : lines.length === 0 ? (
          // Silent when the load failed: `FormAlert` below already says so, and
          // "nothing to staff" would be a claim about the company made from an
          // answer that never arrived.
          failure ? null : (
            <p className="py-2 text-sm text-muted-foreground">
              No active services on this company, so there is nothing to staff.
            </p>
          )
        ) : (
          <div className="space-y-4">
            {lines.map((line) => {
              // Before → after per service (17 Nov). The holder is named from
              // the line's own options, or `replacing` when they are Inactive.
              const holder =
                line.replacing ??
                line.options.find((o) => o.userId === line.assigned)?.name ??
                null;
              const was = holder ? splitInactive(holder) : null;
              const chosen = picked[line.code];
              const changed = chosen !== undefined && chosen !== line.assigned;
              const shownId =
                browsing?.code === line.code ? browsing.id : chosen;
              const shown = line.options.find((o) => o.userId === shownId);
              return (
                <div key={line.code} className="space-y-2">
                  <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {line.name}
                  </p>
                  <Handover
                    compact
                    ready={changed}
                    from={
                      <Side
                        compact
                        avatar={
                          was ? (
                            <Face
                              compact
                              name={was.name}
                              src={line.holderAvatarUrl}
                              dimmed={changed}
                            />
                          ) : (
                            <EmptyFace compact />
                          )
                        }
                      >
                        <span className="max-w-full truncate text-sm font-medium">
                          {was?.name ?? "Nobody yet"}
                        </span>
                        {was?.inactive ? (
                          <span className="text-xs text-destructive">(inactive)</span>
                        ) : null}
                      </Side>
                    }
                    to={
                      <Side
                        compact
                        avatar={
                          <Settle key={shown?.userId ?? "nobody"}>
                            {shown ? (
                              <Face
                                compact
                                name={shown.name}
                                src={shown.avatarUrl}
                                ringed={changed && browsing?.code !== line.code}
                              />
                            ) : (
                              <EmptyFace compact />
                            )}
                          </Settle>
                        }
                      >
                        <Select
                          value={chosen?.toString() ?? ""}
                          onValueChange={(value) =>
                            setPicked((prev) => ({
                              ...prev,
                              [line.code]: Number(value),
                            }))
                          }
                          onOpenChange={(next) => !next && setBrowsing(null)}
                          disabled={line.options.length === 0 || saving}
                        >
                          <SelectTrigger
                            aria-label={`${line.name} specialist`}
                            className={CHOOSE_TRIGGER}
                          >
                            <SelectValue
                              placeholder={
                                line.options.length === 0 ? "None available" : "Choose"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent position="popper" align="center">
                            {line.options.map((option) => (
                              <SelectItem
                                key={option.userId}
                                value={String(option.userId)}
                                onFocus={() =>
                                  setBrowsing({ code: line.code, id: option.userId })
                                }
                              >
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Side>
                    }
                  />
                </div>
              );
            })}
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
