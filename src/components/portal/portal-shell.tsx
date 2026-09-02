"use client";

import * as React from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut, type LucideIcon } from "lucide-react";

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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

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
  const pathname = usePathname();

  // Inner pages go back to the nav section they live under, so the top bar
  // derives the back link instead of every detail page repeating one. Longest
  // match wins; sections carry ?company= that the link has to keep.
  const back = nav
    .filter((item) => pathname.startsWith(`${item.href.split("?")[0]}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

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
                <SidebarMenu>
                  {nav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        // Prefix match so a detail page keeps its section lit.
                        // Compared against the path only: manager nav hrefs
                        // carry ?company=, which would never prefix-match.
                        isActive={pathname.startsWith(item.href.split("?")[0])}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
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

        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-6">
            {/* Mobile sidebar is a sheet, so its own trigger is unreachable
                once it closes. Desktop keeps the trigger in the menu. */}
            <SidebarTrigger className="-ml-1 md:hidden" />
            {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
            <div className="ml-auto flex items-center gap-3">{headerRight}</div>
          </header>

          {/* `flex-1` so the content area owns the rest of the viewport rather
              than only the height of what is in it — a page that wants a
              full-height column (a side rail, a chat pane) can then ask for
              `h-full` and get something real to measure against. */}
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
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
      tooltip="Logout"
      aria-label="Logout"
    >
      <LogOut aria-hidden />
      <span>{pending ? "Signing out…" : "Logout"}</span>
    </SidebarMenuButton>
  );
}

/** Pill link back to a section, rendered in the top bar. */
function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border pr-3.5 pl-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/25 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

/** Page title with an optional action on the right. */
export function PageHeader({
  title,
  scope,
  description,
  action,
}: {
  title: string;
  /**
   * The company this page is narrowed to, named beside the title.
   *
   * The manager and specialist portals read ONE company at a time — there is no
   * all-companies view — so a bare "Projects" or "All Projects" over a filtered
   * table claims a breadth the screen does not have. The switcher in the top bar
   * says which company is active, but it is a pill in the far corner of the
   * chrome, and nothing in the reader's line of sight tied it to the rows.
   *
   * Inside the h1 rather than as a `description`: it is part of what the page
   * IS, and a screen reader announcing "Projects, Acme Ltd" is the whole point.
   * Muted, because the heading is still "Projects" — the company is which one,
   * not what.
   */
  scope?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    // items-center, not items-start: with no subheading the title is a single
    // line, so the action should sit level with it.
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {title}
          {scope ? (
            <span className="font-medium text-muted-foreground">
              {" · "}
              {scope}
            </span>
          ) : null}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
