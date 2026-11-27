"use client";

import * as React from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  /**
   * Params the URL must carry for this row to be lit, on top of the path. The
   * customer's service rows share one path and differ only in `?service=`.
   * Not read off `href`: the manager's rows carry `?company=` there, and must
   * stay lit without it.
   */
  query?: Record<string, string>;
  /**
   * A number beside the row: something under it is new or unread. `label` is
   * the word a screen reader hears after it ("3 unread").
   */
  badge?: { count: number; label: string };
};

export type NavItem = NavLink & {
  icon: LucideIcon;
  /** Pages under this row, drawn indented beneath it. */
  children?: NavLink[];
};

/**
 * Whether the reader is on a nav row, or with `under` on a page beneath it.
 * A prefix match, so a detail page keeps its section lit, and on the path
 * only: see `query` above for the rows that need more.
 *
 * Reads `useSearchParams`, so whatever calls this sits inside a Suspense
 * boundary: the build refuses the hook outside one. Every portal page is
 * rendered per request, where the hook answers on the server and the boundary
 * never shows its fallback.
 */
function useOnRow() {
  const pathname = usePathname();
  const search = useSearchParams();
  return (item: NavLink, under = false) =>
    pathname.startsWith(`${item.href.split("?")[0]}${under ? "/" : ""}`) &&
    Object.entries(item.query ?? {}).every(
      ([key, value]) => search.get(key) === value,
    );
}

/** Inverted on the lit row, where the row itself is the solid purple. */
function NavBadge({ badge }: { badge: NavLink["badge"] }) {
  if (!badge?.count) return null;
  return (
    <span className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[5px] bg-primary px-1 text-[0.6875rem] leading-none font-medium tabular-nums text-primary-foreground group-data-[active=true]/menu-button:bg-primary-foreground group-data-[active=true]/menu-button:text-primary">
      {badge.count > 99 ? "99+" : badge.count}
      <span className="sr-only"> {badge.label}</span>
    </span>
  );
}

/*
 * Which rows the reader has folded shut, by label, so a row folded on one
 * company stays folded on the next. Kept in this browser: it is a view
 * preference, and nothing else reads it.
 */
const FOLDED_KEY = "portal:nav-folded";

function parseFolded(raw: string): string[] {
  try {
    const labels: unknown = JSON.parse(raw);
    return Array.isArray(labels)
      ? labels.filter((label): label is string => typeof label === "string")
      : [];
  } catch {
    return [];
  }
}

function NavMenu({ nav }: { nav: NavItem[] }) {
  const onRow = useOnRow();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // The server has no storage to read, so it renders every row open.
  const stored = React.useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(FOLDED_KEY) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  // What was toggled here, for a browser whose storage refuses the write.
  const [changed, setChanged] = React.useState<string | null>(null);
  const folded = parseFolded(changed ?? stored);

  function toggle(label: string) {
    const next = JSON.stringify(
      folded.includes(label)
        ? folded.filter((other) => other !== label)
        : [...folded, label],
    );
    try {
      localStorage.setItem(FOLDED_KEY, next);
    } catch {}
    setChanged(next);
  }

  return (
    <SidebarMenu>
      {nav.map((item) => {
        const shut = !!item.children && folded.includes(item.label);
        // Its pages are out of sight, folded shut or on the collapsed rail, so
        // the row speaks for them: it is lit when one of them is, and carries
        // their numbers added up.
        const alone = shut || collapsed;
        const badges = [item, ...(item.children ?? [])].flatMap((row) =>
          row.badge?.count ? [row.badge] : [],
        );
        const total = badges.reduce((sum, badge) => sum + badge.count, 0);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={
                item.children
                  ? alone && item.children.some((child) => onRow(child))
                  : onRow(item)
              }
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon aria-hidden />
                <span>{item.label}</span>
                {/* On the rail the number is clipped with the label, and a
                    screen reader still hears it; the dot below is what shows. */}
                <NavBadge
                  badge={
                    !item.children
                      ? item.badge
                      : alone && total > 0
                        ? { count: total, label: badges[0].label }
                        : undefined
                  }
                />
              </Link>
            </SidebarMenuButton>
            {collapsed && total > 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 right-0 size-2 rounded-xs bg-primary ring-2 ring-sidebar"
              />
            ) : null}
            {item.children ? (
              <button
                type="button"
                // Named a menu action so the row beside it leaves room.
                data-sidebar="menu-action"
                onClick={() => toggle(item.label)}
                aria-expanded={!shut}
                aria-label={`${shut ? "Show" : "Hide"} ${item.label} pages`}
                className="absolute top-2 right-0.5 flex size-7 items-center justify-center rounded-md text-sidebar-foreground ring-sidebar-ring outline-hidden transition-colors duration-150 group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-data-[active=true]/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:hover:bg-primary-foreground/15"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 transition-transform duration-150",
                    shut && "-rotate-90",
                  )}
                />
              </button>
            ) : null}
            {item.children && !shut ? (
              <SidebarMenuSub>
                {item.children.map((child) => (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton asChild isActive={onRow(child)}>
                      <Link href={child.href}>
                        <span>{child.label}</span>
                        <NavBadge badge={child.badge} />
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/**
 * The frame every portal shares: side menu for navigation, top bar for
 * whatever controls that portal needs.
 *
 * Extracted once the third portal appeared. Admin, customer and manager were
 * otherwise the same 150 lines with a different array in the middle, which is
 * how three navigations quietly drift apart.
 */
export function PortalShell({
  home,
  groupLabel,
  nav,
  headerRight,
  children,
}: {
  /** Where the logo links to. */
  home: string;
  /** Heading above the nav. Omit for a bare menu. */
  groupLabel?: string;
  nav: NavItem[];
  /** Controls pinned to the right of the top bar. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-16 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Link
              href={home}
              className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 group-data-[collapsible=icon]:hidden"
            >
              <Image
                src="/brand/logo.svg"
                alt="FinOpSys"
                width={132}
                height={40}
                priority
                className="h-7 w-auto"
              />
            </Link>
            {/* Collapsed rail is only 3rem: the trigger takes the logo's place
                so there is still a way back out. */}
            <SidebarTrigger className="hidden md:flex" />
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              {groupLabel ? (
                <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <React.Suspense>
                  <NavMenu nav={nav} />
                </React.Suspense>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <LogoutButton />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>
        <FitSidebarToWidth />
        <LiveRefresh />

        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-6">
            {/* Mobile sidebar is a sheet, so its own trigger is unreachable
                once it closes. Desktop keeps the trigger in the menu. */}
            <SidebarTrigger className="-ml-1 md:hidden" />
            <React.Suspense>
              <BackSlot nav={nav} />
            </React.Suspense>
            <div className="ml-auto flex items-center gap-3">{headerRight}</div>
          </header>

          {/* `flex-1` so the content area owns the rest of the viewport rather
              than only the height of what is in it — a page that wants a
              full-height column (a side rail, a chat pane) can then ask for
              `h-full` and get something real to measure against. Capped at
              100rem and centered: on a 2560 monitor a two-column card put a
              label 1,100px from its value. */}
          <div className="mx-auto w-full max-w-[100rem] flex-1 p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

const REFRESH_MS = 60_000;
const MIN_GAP_MS = 20_000;

/**
 * Re-reads the page now and then, so a change someone else made (a company
 * set Inactive, a project reassigned) reaches a screen that is already open.
 *
 * POLLING, NOT A PUSH CHANNEL (Nov 27). Status changes are rare and the server
 * already refuses work on anything inactive, so a minute's lag is cosmetic;
 * pushing these tables over Supabase would need a second copy of the
 * company-scope rules there. Chat, which has to be instant, keeps its socket.
 *
 * Same clock as `LiveBell`: only while the tab is visible, catching up at once
 * when it is shown again, with a floor between refreshes. `router.refresh()`
 * keeps client state, so a half-typed form or an open dialog survives it.
 */
function LiveRefresh() {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    // The page was just rendered from fresh data, so the first refresh waits.
    let lastAt = Date.now();

    const refresh = () => {
      if (Date.now() - lastAt < MIN_GAP_MS) return;
      lastAt = Date.now();
      router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        timer ??= setInterval(refresh, REFRESH_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}

const NARROW = "(max-width: 1023px)";

function subscribeNarrow(onChange: () => void) {
  const mql = window.matchMedia(NARROW);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Folds the sidebar to its icon rail below 1024px and opens it again above.
 *
 * At 768 the open sidebar took 256px of a tablet's width. Only crossing the
 * breakpoint changes it, so opening the rail by hand on a tablet sticks.
 */
function FitSidebarToWidth() {
  const { setOpen } = useSidebar();
  const narrow = React.useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  const fit = React.useEffectEvent((isNarrow: boolean) => setOpen(!isNarrow));

  React.useEffect(() => fit(narrow), [narrow]);

  return null;
}

/**
 * Ends the session properly.
 *
 * This was `<Link href="/">` — a navigation, nothing more. The access cookie
 * stayed put and the 30-day refresh cookie was never revoked, so the back
 * button returned you to a working portal and the next `/auth/refresh` minted a
 * fresh session for someone who had "logged out". On a shared machine that is
 * the whole of the problem.
 *
 * `router.replace`, not `push`: the portal must not be one Back press away once
 * the session is gone.
 */
function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onLogout() {
    setPending(true);
    // `api.logout` swallows a failed revoke and clears the local cookie either
    // way, so this cannot leave the user stuck on a dead button.
    await api.logout();
    router.replace("/login");
    // The portal pages are server-rendered against the old cookie; without this
    // the cached RSC payload can paint one more time before the redirect lands.
    router.refresh();
  }

  return (
    <SidebarMenuButton
      onClick={onLogout}
      disabled={pending}
      tooltip="Log Out"
      aria-label="Log Out"
    >
      <LogOut aria-hidden />
      <span>{pending ? "Signing out…" : "Log Out"}</span>
    </SidebarMenuButton>
  );
}

/**
 * Inner pages go back to the nav section they live under, so the top bar
 * derives the back link instead of every detail page repeating one. Longest
 * match wins; sections carry ?company= that the link has to keep. A row with
 * pages under it stands aside for them: the page is what was left.
 */
function BackSlot({ nav }: { nav: NavItem[] }) {
  const onRow = useOnRow();
  const back = nav
    .flatMap((item): NavLink[] => item.children ?? [item])
    .filter((item) => onRow(item, true))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return back ? <BackLink href={back.href} label={back.label} /> : null;
}

/**
 * Pill link back to a section, rendered in the top bar.
 *
 * Reads "Back" — the section name lives in the sidebar, lit, right next to it.
 * The destination stays in `aria-label` so it is not lost to screen readers.
 */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border pr-3.5 pl-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/25 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Back
    </Link>
  );
}

/** Page title with an optional action on the right. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    // items-center, not items-start: with no subheading the title is a single
    // line, so the action should sit level with it.
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
