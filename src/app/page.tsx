import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/customer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "FinOpSys — Portals",
  description: "Pick a portal, or sign in to be taken to your own.",
};

type Portal = {
  id: string;
  label: string;
  role: string;
  blurb: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Landing page: the four portals, then sign-in.
 *
 * Replaces the dev switchboard that rendered all four in iframes behind a tab
 * strip. Iframes meant every portal loaded at once, none of them owned the
 * URL, and the browser back button did nothing — fine as a scratch tool, not a
 * page anyone should land on.
 *
 * The links are a shortcut past auth while the backend is mocked. Real entry
 * is Sign in: the session resolves a role and lands on the right portal by
 * itself, which is why no card asks anyone to pick their own role.
 */
export default async function HomePage() {
  // The one page a signed-out visitor is meant to reach, so the lookup behind
  // the Customer card's href has to survive having no session — unguarded, its
  // 401 crashed the portal picker itself. Nobody signed out has a workspace,
  // and the card falls through to the picker, which is where they belong.
  const [workspace] = await customerApi.workspaces().catch(() => []);

  const portals: Portal[] = [
    {
      id: "admin",
      label: "Admin",
      role: "Internal staff",
      blurb:
        "Customers, specialists, accounting managers and companies. Read-only apart from assigning a manager.",
      icon: ShieldCheck,
      href: "/admin/customers",
    },
    {
      id: "manager",
      label: "Accounting Manager",
      role: "Internal staff",
      blurb:
        "Projects across every assigned company, the task lists under them, and the client conversations.",
      icon: ClipboardList,
      href: "/manager/projects",
    },
    {
      id: "customer",
      label: "Customer",
      role: "Client",
      blurb:
        "Projects, documents, team and company details for each company you own.",
      icon: Building2,
      href: workspace ? `/customer/${workspace.id}/projects` : "/comany_select",
    },
    {
      id: "specialist",
      label: "Specialist",
      role: "Internal staff",
      blurb:
        "The projects routed to you, every task under them, and the line to your accounting manager.",
      icon: Wrench,
      href: "/specialist/projects",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-10">
        <Image
          src="/brand/logo.svg"
          alt="FinOpSys"
          width={132}
          height={40}
          priority
          className="h-8 w-auto"
        />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Portals</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Four portals share one login. Sign in and you land on yours — or open
          one directly while the backend is mocked.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {portals.map((portal) => (
          <li key={portal.id}>
            <PortalCard portal={portal} />
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-8">
        <Button asChild size="lg">
          <Link href="/login">
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Signing in resolves your role and takes you to the right portal.
        </p>
      </div>
    </main>
  );
}

function PortalCard({ portal }: { portal: Portal }) {
  const { icon: Icon, href } = portal;

  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{portal.label}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {portal.role}
          </span>
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {portal.blurb}
        </span>
      </span>

      <ArrowRight
        className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
        aria-hidden
      />
    </>
  );

  return (
    <Link
      href={href}
      className={cn(
        "flex h-full items-start gap-4 rounded-xl border border-border bg-card p-5 text-left",
        "group transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "hover:border-primary/30 hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
      )}
    >
      {body}
    </Link>
  );
}
