"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/auth/fields";
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
import { adminApi, type ManagerOption } from "@/lib/admin";

/**
 * Assigns an accounting manager to a company. The only write admin has over
 * company data — everything else on a company comes from the customer.
 */
export function AssignManager({
  companyId,
  managers,
}: {
  companyId: string;
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [manager, setManager] = React.useState("");
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
      await adminApi.assignManager(companyId, Number(manager));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Assign
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign accounting manager</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="manager">Accounting manager</Label>
          <Select value={manager} onValueChange={setManager}>
            <SelectTrigger
              id="manager"
              className="h-11 w-full rounded-lg px-3.5 text-sm data-[size=default]:h-11"
            >
              <SelectValue placeholder="Select a manager" />
            </SelectTrigger>
            <SelectContent>
              {/* The VALUE is the user id — that is what the write takes.
                  Selecting by display name meant the id had to be looked up
                  again afterwards, by an email nobody had. */}
              {managers.map((m) => (
                <SelectItem key={m.userId} value={String(m.userId)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </div>

        {/* Same 44px full-width action the invite dialogs use — this one is
            not inside a form, hence the explicit type. */}
        <SubmitButton type="button" onClick={onSave} pending={pending}>
          Save
        </SubmitButton>
      </DialogContent>
    </Dialog>
  );
}
