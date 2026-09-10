"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

/** One row in the bell's list: a thread with something new in it. */
export interface Notification {
  /** The conversation id — stable, and what the row is keyed on. */
  id: string;
  /** Where clicking lands. Deep enough to open the thread, not just the inbox. */
  href: string;
  /** Which account this arrived on. Every row is tagged, because the list merges companies. */
  company: string;
  contact: string;
  preview: string;
  unread: number;
  /**
   * ALREADY WORDED — "Today", "Yesterday", a date. Formatted by the layout that
   * built the row, so this file (which every portal's chrome pulls into the
   * client bundle) does not import a date helper out of lib/manager.
   */
  when: string;
}

/**
 * Notification bell, and the list behind it.
 *
 * A COUNT ALONE IS A SCAVENGER HUNT. "3 unread" over a portal that scopes chat
 * by company AND by side of the account leaves the reader guessing both before
 * they find the message — so the badge opens the list it is counting: every
 * thread with something new, newest first, each tagged with the company it
 * arrived on, and each a link straight into that thread.
 *
 * The list is merged across companies, which is the one view chat has nowhere
 * else: every chat route requires `?companyId=`, so the inbox can only ever show
 * one account at a time. This is where a manager sees all of them at once.
 */
export function NotificationBell({ items = [] }: { items?: Notification[] }) {
  const count = items.reduce((sum, n) => sum + n.unread, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : "Notifications"
          }
          className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <Bell className="size-5" aria-hidden />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
            >
              {count}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-88 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span>New messages</span>
          {count > 0 ? (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {count} unread
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No new messages.
          </p>
        ) : (
          /* Capped, and the cap is stated. An unbounded dropdown scrolls off the
             viewport on a manager holding a busy book, and a list that silently
             stops is worse than one that says it did. */
          <ul className="max-h-96 overflow-y-auto">
            {items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <DropdownMenuItem asChild className="px-3 py-2.5">
                  <Link href={item.href} className="block cursor-pointer">
                    <span className="flex w-full items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.contact}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {item.when}
                      </span>
                    </span>

                    <span className="mt-0.5 flex w-full items-center gap-2">
                      {/* The company tag. Two people on two accounts can have
                          the same name, and the reply goes to whichever thread
                          this row opens. */}
                      <span className="max-w-[9rem] truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.company}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {item.preview || "Sent an attachment"}
                      </span>
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                        {item.unread}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        )}

        {items.length > 8 ? (
          <>
            <DropdownMenuSeparator className="my-0" />
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {items.length - 8} more not shown.
            </p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Avatar menu: who you are signed in as, plus the way out. */
export function AccountMenu({
  user,
  profileHref,
}: {
  user: { name: string; email: string; avatarUrl?: string | null };
  profileHref?: string;
}) {
  const router = useRouter();

  /*
   * A navigation is not a logout. This was `<Link href="/">`, which left the
   * access cookie in place and the 30-day refresh cookie unrevoked — so Back
   * returned a working portal and the next refresh minted a fresh session for
   * someone who had "logged out". Now that `/` IS the login screen, that link
   * would also claim the session had ended while it had not.
   *
   * `api.logout` clears the local cookie even when the revoke fails, and
   * `replace` keeps the portal off the Back stack.
   */
  async function onLogout() {
    await api.logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <InitialsAvatar name={user.name} src={user.avatarUrl} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref ? (
          <DropdownMenuItem asChild>
            <Link href={profileHref}>Profile</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="size-4" aria-hidden />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
