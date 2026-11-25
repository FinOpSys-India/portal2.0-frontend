// TEMPORARY: the three popup styles offered on 17 Nov, redrawn as the
// Reassign Accounting Manager popup so they can be compared. Static; delete
// once one is picked.
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronDown,
  FileText,
  FolderKanban,
  MessageSquare,
  UserRound,
  Users,
} from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function Card({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid content-start gap-3">
      <h2 className="text-sm font-semibold">
        {label}. {name}
      </h2>
      <div className="grid gap-4 overflow-hidden rounded-xl bg-popover p-4 text-sm shadow-lg ring-1 ring-foreground/10">
        {children}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <div className="-mx-4 -mb-4 flex justify-end gap-2 border-t bg-muted/50 p-4">
      <Button variant="outline">Cancel</Button>
      <Button>Reassign</Button>
    </div>
  );
}

function Choose() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-muted-foreground">
      Choose
      <ChevronDown className="size-4" aria-hidden />
    </span>
  );
}

const MOVES = [
  { icon: FolderKanban, text: "Open projects move to the new manager" },
  { icon: Users, text: "Specialists stay on the company" },
  { icon: FileText, text: "Documents move with the company" },
  { icon: MessageSquare, text: "The customer starts a new chat" },
];

export default function PopupStyles() {
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Popup Styles</h1>
        <p className="text-sm text-muted-foreground">
          The three styles from 17 Nov, each drawn as Reassign Accounting Manager. Not clickable.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* A. Icon + checklist */}
        <Card label="A" name="Icon + Checklist">
          <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <ArrowRightLeft className="size-5" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h3 className="text-lg font-semibold">Reassign Accounting Manager</h3>
            <span className="flex items-center gap-2">
              <InitialsAvatar name="Pratibha Yadav" className="size-6 text-[10px]" />
              Pratibha Yadav
              <Badge variant="secondary">Adani Power</Badge>
            </span>
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">New Accounting Manager</span>
            <Choose />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              What Happens
            </span>
            {MOVES.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {text}
              </span>
            ))}
          </div>
          <Footer />
        </Card>

        {/* B. Before → after */}
        <Card label="B" name="Before → After">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold">Reassign Accounting Manager</h3>
            <span className="text-muted-foreground">Adani Power</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="grid w-32 justify-items-center gap-2 rounded-xl border p-3">
              <InitialsAvatar name="Pratibha Yadav" className="size-12 text-sm" />
              <span className="text-center font-medium">Pratibha Yadav</span>
            </div>
            <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
            <div className="grid w-32 justify-items-center gap-2 rounded-xl border border-dashed p-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserRound className="size-5" aria-hidden />
              </span>
              <Choose />
            </div>
          </div>
          <p className="text-center text-muted-foreground">
            Moves: projects · documents · new customer chat
          </p>
          <Footer />
        </Card>

        {/* C. Color band */}
        <Card label="C" name="Color Band">
          <div className="-mx-4 -mt-4 flex items-center gap-3 border-b bg-blue-50 p-4 dark:bg-blue-950/40">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ArrowRightLeft className="size-4" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h3 className="text-base font-semibold">Reassign Accounting Manager</h3>
              <Badge variant="secondary" className="w-fit">
                Adani Power
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Current</span>
              <span className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                <InitialsAvatar name="Pratibha Yadav" className="size-5 text-[9px]" />
                Pratibha Yadav
              </span>
            </div>
            <ArrowRight className="mb-2 size-4 text-muted-foreground" aria-hidden />
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">New</span>
              <Choose />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid content-start gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kept</span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" aria-hidden /> Completed work
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" aria-hidden /> Specialists
              </span>
            </div>
            <div className="grid content-start gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Changes</span>
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="size-4 text-blue-600" aria-hidden /> Open projects
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="size-4 text-blue-600" aria-hidden /> Documents
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-4 text-blue-600" aria-hidden /> New chat
              </span>
            </div>
          </div>
          <Footer />
        </Card>
      </div>
    </main>
  );
}
