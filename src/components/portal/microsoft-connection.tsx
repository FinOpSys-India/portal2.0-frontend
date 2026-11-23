"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Video } from "lucide-react";

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
import { toast } from "@/components/ui/toast";
import { meetingsApi, type MicrosoftStatus } from "@/lib/meetings";

/**
 * The manager's Microsoft (Teams) connection: their own finopsys.ai account,
 * connected once, so the portal can create Teams meetings on their calendar
 * and customers can book their free times. Nothing when the status could not
 * be read.
 */
export function MicrosoftConnection({ status }: { status: MicrosoftStatus | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  if (!status) return null;

  async function connect() {
    setBusy(true);
    try {
      window.location.assign(await meetingsApi.microsoftConnectUrl());
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Microsoft sign-in isn’t available right now.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await meetingsApi.disconnectMicrosoft();
      toast.success("Microsoft disconnected.");
      setConfirming(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Microsoft couldn’t be disconnected.");
    } finally {
      setBusy(false);
    }
  }

  const text = !status.configured
    ? "Teams isn’t set up on this server yet. You can still schedule with your own meeting link."
    : status.connected
      ? `Connected as ${status.accountEmail ?? "your Microsoft account"}. New meetings go on your Outlook calendar.`
      : "Connect your finopsys.ai Microsoft account to create Teams meetings and let customers book your free times.";

  return (
    <section
      aria-label="Microsoft Teams connection"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
        <Video className="size-5" />
      </span>
      <div className="grid min-w-0 flex-[1_1_16rem] gap-0.5">
        <span className="text-sm font-medium">Microsoft Teams</span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </div>
      {!status.configured ? (
        <Badge variant="secondary">Not Set Up</Badge>
      ) : status.connected ? (
        <>
          <Badge variant="secondary" className="border-transparent bg-[#dcfce7] text-[#166534]">
            Connected
          </Badge>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            Disconnect
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={busy} onClick={connect}>
          Connect Microsoft
        </Button>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Disconnect Microsoft?</DialogTitle>
            <DialogDescription>
              You can’t create Teams meetings, and customers can’t see your free times, until you connect again.
              Meetings already scheduled stay on your calendar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Stay Connected
            </Button>
            <Button variant="destructive" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * Microsoft sends the manager back here with `?microsoft=<result>`. Say how
 * it went once, then take the parameter off the address so a reload or a
 * bookmark does not say it again.
 */
export function MicrosoftReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const result = params.get("microsoft");

  React.useEffect(() => {
    if (!result) return;
    if (result === "connected") toast.success("Microsoft connected.");
    else toast.error("Microsoft wasn’t connected. Try again.");
    const next = new URLSearchParams(params.toString());
    next.delete("microsoft");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [result, params, pathname, router]);

  return null;
}
