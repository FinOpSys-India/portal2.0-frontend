"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AVATAR_ACCEPT,
  MAX_AVATAR_LABEL,
  avatarApi,
  avatarProblem,
} from "@/lib/avatar";

/**
 * The profile picture on a profile card: shown, replaced, removed.
 *
 * `POST /users/me/avatar` and its DELETE existed with no caller anywhere, so
 * every portal drew an initials circle and there was no way to be anything but
 * initials. The endpoint is keyed by the session alone, so this one component
 * serves all three portals that have a profile screen.
 *
 * OPTIMISTIC ON THE WAY IN. The picked file is rendered from a local object URL
 * before the request finishes — an avatar upload where the picture appears a
 * second after the spinner stops reads as a failure that then un-failed. The
 * server's own URL replaces it on success, and the preview is revoked either
 * way so a rejected file does not sit there looking accepted.
 */
export function AvatarUpload({
  name,
  avatarUrl,
}: {
  /** Drives the initials fallback and the alt text. */
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  /*
   * What this component wrote, tagged with the prop it was standing in FOR.
   *
   * The server value arrives as a prop and `router.refresh()` replaces it a
   * moment after every write, so the local answer must yield to the prop as
   * soon as the prop moves — otherwise a picture changed in another tab, or an
   * upload the server rejected after the fact, would stay on screen forever.
   * Comparing the tag does that during render, with no effect to sync them and
   * no cascading re-render.
   */
  const [own, setOwn] = React.useState<{
    for: string | null;
    url: string | null;
  } | null>(null);

  const url = own && own.for === avatarUrl ? own.url : avatarUrl;

  // Object URLs are a document-lifetime allocation, not a value: without this
  // every replaced picture leaks its blob for as long as the tab is open.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function pick(file: File) {
    const problem = avatarProblem(file);
    if (problem) {
      setFailure(problem);
      return;
    }

    const local = URL.createObjectURL(file);
    setPreview(local);
    setFailure(null);
    setPending(true);
    try {
      setOwn({ for: avatarUrl, url: await avatarApi.upload(file) });
      // The header's account menu draws the same picture from a server
      // component, so the frame has to be told as well as this card.
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not upload that.");
    } finally {
      setPreview(null);
      setPending(false);
    }
  }

  async function remove() {
    setFailure(null);
    setPending(true);
    try {
      await avatarApi.remove();
      setOwn({ for: avatarUrl, url: null });
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not remove that.");
    } finally {
      setPending(false);
    }
  }

  const shown = preview ?? url;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {shown ? (
          // A plain <img>: the URL is a public bucket on a host that is not
          // configured in next.config, and next/image would refuse it at
          // runtime rather than at build time.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt={`${name}'s profile picture`}
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <InitialsAvatar name={name} className="size-20 text-xl" />
        )}

        {/* The control sits on the picture rather than beside it — that is
            where people look for it, and it keeps the card's column narrow. */}
        <Button
          type="button"
          size="icon-sm"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="absolute -right-1 -bottom-1 rounded-full shadow-sm"
        >
          {pending ? (
            <Spinner className="size-4" />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
          <span className="sr-only">
            {url ? "Change your profile picture" : "Add a profile picture"}
          </span>
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared first: picking the same file twice in a row fires no
            // change event otherwise, and the second attempt is lost.
            event.target.value = "";
            if (file) pick(file);
          }}
        />
      </div>

      {url ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-xs text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60"
        >
          Remove photo
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to {MAX_AVATAR_LABEL}.
        </p>
      )}

      {failure ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
