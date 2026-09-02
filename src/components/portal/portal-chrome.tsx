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

/**
 * Notification bell.
 *
 * The count is a real value, not decoration — there is no notifications
 * backend yet, so it stays 0 and no badge renders. A hardcoded "1" is the kind
 * of thing that ships and then nobody can explain why clicking it does
 * nothing.
 */
export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <button
      type="button"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
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
  );
}

/** Avatar menu: who you are signed in as, plus the way out. */
export function AccountMenu({
  user,
  profileHref,
}: {
  user: { name: string; email: string };
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
          <InitialsAvatar name={user.name} />
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
