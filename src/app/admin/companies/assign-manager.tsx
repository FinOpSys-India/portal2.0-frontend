"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, TriangleAlert } from "lucide-react";

import {
  CHOOSE_TRIGGER,
  EmptyFace,
  Face,
  Handover,
  Settle,
  Side,
  splitInactive,
} from "@/components/portal/handover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { adminApi, type ManagerOption } from "@/lib/admin";

/**
 * Assign the accounting manager on a company, or Reassign it (`replacing`).
 *
 * Admin owns this, replacement included (Sir, Q15; 17 Nov): whenever the
 * admin chooses, and always once the manager is Inactive. `PUT` replaces;
 * nothing here unassigns (`DELETE`), so a company is never left without one.
 * Everything under the company moves to the new manager.
 *
 * A first assignment waits until the company is live — see `disabled`.
 */
export function AssignManager({
  companyId,
  companyName,
  managers,
  disabled,
  replacing,
  replacingAvatarUrl,
  label,
  preview = false,
}: {
  companyId: string;
  /** TEMPORARY, for /reassign-preview: Save writes nothing. */
  preview?: boolean;
  /** Under the popup's title, so it says which company. */
  companyName?: string;
  managers: ManagerOption[];
  /** The manager being replaced, as the table names them. */
  replacing?: string;
  replacingAvatarUrl?: string | null;
  /**
   * The trigger's text. Unset, a Reassign trigger is the manager's NAME with
   * a ⇕ (17 Nov), which reads as "choose from a list": one quiet control per row instead of a name and a
   * button. The banner passes "Reassign", where it is the call to action.
   */
  label?: string;
  /**
   * Greys the button out — for a company that is not live yet. Disabled rather
   * than absent: the row's Status chip says why, and a cell that simply emptied
   * itself would read as "this company needs no manager" instead of "not yet".
   */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [manager, setManager] = React.useState("");
  // The option highlighted while the list is open: the right-hand avatar
  // follows it, so each one can be seen before it is picked (17 Nov).
  const [browsing, setBrowsing] = React.useState<string | null>(null);
  const shown = managers.find((m) => String(m.userId) === (browsing ?? manager));
  const current = replacing ? splitInactive(replacing) : null;
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function onSave() {
    if (!manager) {
      setFailure("Pick a manager first.");
      return;
    }
    setFailure(null);
    setPending(true);
    try {
      const { canceledMeetings } = preview
        ? { canceledMeetings: 0 }
        : await adminApi.assignManager(companyId, Number(manager));
      setOpen(false);
      setManager("");
      const canceled =
        canceledMeetings === 0
          ? ""
          : ` ${canceledMeetings} upcoming ${canceledMeetings === 1 ? "meeting was" : "meetings were"} canceled.`;
      toast.success(
        `${managers.find((m) => String(m.userId) === manager)?.name ?? "Accounting Manager"} now manages this company.${canceled}`,
      );
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Sits above the row link, so it needs its own stacking context to stay
          clickable. */}
      {replacing && !label ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`Reassign accounting manager, now ${replacing}`}
          title="Reassign"
          className="relative z-10 -mx-2 font-normal"
        >
          {replacing}
          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      ) : label ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="relative z-10"
        >
          {label}
        </Button>
      ) : disabled ? (
        // Says why, where a greyed-out button did not — and a blank cell
        // would read as "this company needs no manager".
        <span className="text-sm text-muted-foreground">Awaiting payment</span>
      ) : (
        // `+` adds, ⇕ changes (17 Nov): text-sized like the names
        // around it, so the column reads as one list.
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="relative z-10 -mx-2 text-primary hover:text-primary"
        >
          <Plus className="size-3.5" aria-hidden />
          Assign
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setManager("");
            setBrowsing(null);
            setFailure(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {/* A tinted band, matching the footer's; the company rides beside
              the title as a chip. */}
          <DialogHeader className="-mx-4 -mt-4 flex-row flex-wrap items-center rounded-t-xl border-b bg-muted/50 p-4 pr-12">
            <DialogTitle>
              {replacing ? "Reassign Accounting Manager" : "Assign Accounting Manager"}
            </DialogTitle>
            {companyName ? (
              <DialogDescription asChild>
                <Badge variant="secondary">{companyName}</Badge>
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {/* Before → after: who has it now, and who will (17 Nov). */}
          <Handover
            ready={Boolean(manager)}
            from={
              <Side
                label={replacing ? "Current Accounting Manager" : undefined}
                avatar={
                  current ? (
                    <Face
                      name={current.name}
                      src={replacingAvatarUrl}
                      dimmed={Boolean(manager)}
                    />
                  ) : (
                    <EmptyFace />
                  )
                }
              >
                <span className="text-sm font-medium">
                  {current?.name ?? "No accounting manager"}
                </span>
                {current?.inactive ? (
                  <span className="text-xs text-muted-foreground">(inactive)</span>
                ) : null}
              </Side>
            }
            to={
              <Side
                label={replacing ? "New Accounting Manager" : undefined}
                avatar={
                  // Keyed by person, so each one browsed to settles in fresh.
                  <Settle key={shown?.userId ?? "nobody"}>
                    {shown ? (
                      <Face
                        name={shown.name}
                        src={shown.avatarUrl}
                        ringed={Boolean(manager) && !browsing}
                      />
                    ) : (
                      <EmptyFace />
                    )}
                  </Settle>
                }
              >
                <Select
                  value={manager}
                  onValueChange={(value) => {
                    setManager(value);
                    setFailure(null);
                  }}
                  onOpenChange={(next) => !next && setBrowsing(null)}
                >
                  <SelectTrigger
                    aria-label="New accounting manager"
                    className={CHOOSE_TRIGGER}
                  >
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent position="popper" align="center">
                    {/* The VALUE is the user id — that is what the write takes.
                        Never the manager being replaced. */}
                    {managers
                      .filter((m) => m.name !== replacing)
                      .map((m) => (
                        <SelectItem
                          key={m.userId}
                          value={String(m.userId)}
                          onFocus={() => setBrowsing(String(m.userId))}
                        >
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Side>
            }
          />

          {replacing ? (
            // Tinted by urgency (17 Nov): red when the manager is Inactive and
            // the company has nobody, amber when an active one is swapped.
            <p
              role="note"
              className={
                current?.inactive
                  ? "flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  : "flex gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              }
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              The company’s projects, specialists and documents move to them,
              and the customer starts a new chat with them. Upcoming meetings
              the current manager set up for this company are canceled, and
              everyone invited is told by email.
            </p>
          ) : null}

          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          {/* Two equal halves across the popup (17 Nov). */}
          <DialogFooter className="grid grid-cols-2">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !manager} onClick={onSave}>
              {pending ? <Spinner className="size-4" /> : null}
              {replacing ? "Reassign" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

