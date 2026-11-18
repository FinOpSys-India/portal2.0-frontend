"use client";

import * as React from "react";

import type { UnreadThread } from "@/lib/chat";
import { customerApi, type Workspace } from "@/lib/customer";
import {
  newSince,
  onServiceTab,
  outsideInactive,
  viewerId,
  withService,
  type ServiceTab,
} from "@/lib/portal";

/** The two lists a service row holds, by URL segment. */
export type ServicePage = "projects" | "files";

type Row = { service: string | null; createdAt: string; by: string | null };

type Loaded = {
  workspaceId: string;
  viewer: string;
  rows: Record<ServicePage, Row[]>;
  /** `tab:page` to the instant the reader last opened that list. */
  seen: Record<string, string>;
};

/*
 * A floor between loads. The bell's first sweep lands a second after this
 * hook's own first load, and would otherwise fetch both lists twice.
 */
const MIN_GAP_MS = 20_000;

/*
 * ponytail: "last opened" lives in this browser, because the backend keeps no
 * record of what a reader has seen (Pratibha #12). So a phone and a laptop
 * count separately, clearing site data resets it, and it trusts this machine's
 * clock against the server's. Replace `readSeen` / `writeSeen` with that
 * endpoint when it exists. A timestamp per list is all that is stored.
 */
const storageKey = (workspaceId: string) => `portal:seen:${workspaceId}`;

function readSeen(workspaceId: string): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey(workspaceId)) ?? "{}",
    );
    return stored && typeof stored === "object"
      ? (stored as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function writeSeen(workspaceId: string, seen: Record<string, string>) {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(seen));
  } catch {
    // Private mode or a full disk: the numbers reset on reload, nothing more.
  }
}

/**
 * The numbers beside the customer's sidebar rows.
 *
 * Projects and Documents under a service: what someone else added since the
 * reader last opened that list. The first time a browser sees a list its
 * baseline is "now", so a new device starts at nothing rather than at every
 * file the company has ever been sent. Opening the list clears it.
 *
 * Connect: this company's unread chat, the same figure the bell adds up.
 *
 * Fetched in the browser, on the bell's clock, rather than in the layout: the
 * frame is not held up for a number, and a file sent while the reader sits on
 * another page shows up without a reload.
 */
export function useNewCounts(workspace: Workspace, tabs: ServiceTab[]) {
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [threads, setThreads] = React.useState<UnreadThread[]>([]);

  const lastAt = React.useRef(0);
  const viewer = React.useRef<string | null>(null);

  const id = workspace.id;
  // A frozen company opens nothing, so it has nothing to count.
  const frozen = !!workspace.inactive;
  const keys = tabs
    .flatMap((tab) => [`${tab}:projects`, `${tab}:files`])
    .join();

  const load = React.useCallback(() => {
    if (frozen || Date.now() - lastAt.current < MIN_GAP_MS) return;
    lastAt.current = Date.now();

    Promise.all([
      customerApi.projects(id),
      customerApi.files(id),
      viewer.current ?? viewerId(),
    ])
      .then(([projects, files, me]) => {
        viewer.current = me;
        // A list this browser has never opened starts counting from now.
        const now = new Date().toISOString();
        const seen = readSeen(id);
        for (const key of keys.split(",")) seen[key] ??= now;
        writeSeen(id, seen);

        setLoaded({
          workspaceId: id,
          viewer: me,
          seen,
          rows: {
            projects: projects
              .filter((p) => !p.inactive)
              .map((p) => ({
                service: p.service,
                createdAt: p.createdAt,
                by: p.creatorId,
              })),
            files: withService(outsideInactive(files, projects), projects).map(
              (f) => ({
                service: f.service,
                createdAt: f.createdAt,
                by: f.ownerId,
              }),
            ),
          },
        });
      })
      // Swallowed, as the bell's sweep is: no numbers, not an error boundary.
      .catch(() => {});
  }, [id, frozen, keys]);

  // On mount, and at once for the company switched to: its numbers should not
  // wait out the rest of a bell tick.
  React.useEffect(() => {
    lastAt.current = 0;
    load();
  }, [load]);

  const onBell = React.useCallback(
    (next: UnreadThread[]) => {
      setThreads(next);
      load();
    },
    [load],
  );

  /**
   * The reader opened a list (`tab:page`). Written straight to storage, so a
   * visit made before the lists have loaded is there when they do.
   */
  const onVisit = React.useCallback(
    (key: string) => {
      const at = new Date().toISOString();
      writeSeen(id, { ...readSeen(id), [key]: at });
      setLoaded((current) =>
        current?.workspaceId === id
          ? { ...current, seen: { ...current.seen, [key]: at } }
          : current,
      );
    },
    [id],
  );

  // Another company's numbers are never shown while this one's load.
  const current = loaded?.workspaceId === id ? loaded : null;

  return {
    onBell,
    onVisit,
    unread: threads
      .filter((t) => t.companyId === id)
      .reduce((sum, t) => sum + t.unread, 0),
    added: (tab: ServiceTab, page: ServicePage): number => {
      const seen = current?.seen[`${tab}:${page}`];
      if (!current || !seen) return 0;
      return newSince(
        current.rows[page].filter((row) => onServiceTab(row, tab)),
        seen,
        current.viewer,
      );
    },
  };
}
