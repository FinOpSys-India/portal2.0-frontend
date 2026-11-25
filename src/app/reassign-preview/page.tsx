"use client";

// TEMPORARY: the reassign screens with sample people, since nobody can be made
// Inactive until Pratibha's #5 lands. Real components; nothing is saved.
// Delete with the `preview` / `previewLines` props once checked.
import * as React from "react";

import { AssignManager } from "@/app/admin/companies/assign-manager";
import { AssignCompanySpecialist } from "@/components/manager/assign-company-specialist";
import {
  NeedsReassignment,
  ReassignNotice,
  ReassignmentBanner,
} from "@/components/portal/reassignment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ManagerOption } from "@/lib/admin";
import type { StaffingLine } from "@/lib/manager";
import type { Reassignment } from "@/lib/portal";

const MANAGERS: ManagerOption[] = [
  { userId: 1, name: "Sarah Kim", avatarUrl: null },
  { userId: 2, name: "Omar Haddad", avatarUrl: null },
  { userId: 3, name: "Lena Fischer", avatarUrl: null },
  { userId: 4, name: "Jane Doe", avatarUrl: null },
];

const option = (userId: number, name: string) => ({
  userId,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@finopsys.ai`,
  avatarUrl: null,
});

const LINES: StaffingLine[] = [
  {
    code: "BOOKKEEPING",
    name: "Bookkeeping",
    assigned: 11,
    replacing: "Priya Shah (inactive)",
    holderAvatarUrl: null,
    options: [option(12, "Diego Ruiz"), option(13, "Hana Ito"), option(14, "Ben Carter")],
  },
  {
    code: "PAYROLL",
    name: "Payroll",
    assigned: 21,
    replacing: null,
    holderAvatarUrl: null,
    options: [option(21, "Al Bo"), option(22, "Maya Singh"), option(23, "Tom Price")],
  },
  {
    code: "TAX",
    name: "Tax",
    assigned: null,
    replacing: null,
    holderAvatarUrl: null,
    options: [option(31, "Chen Wei"), option(32, "Ruth Adler")],
  },
];

const ADMIN_ITEMS: Reassignment[] = [
  {
    companyId: "1",
    company: "Beta LLC",
    detail: "Mark Lee (inactive)",
    people: [{ name: "Mark Lee (inactive)", avatarUrl: null }],
  },
  {
    companyId: "2",
    company: "Northwind Traders",
    detail: "Mark Lee (inactive)",
    people: [{ name: "Mark Lee (inactive)", avatarUrl: null }],
  },
];

const AM_ITEMS: Reassignment[] = [
  {
    companyId: "3",
    company: "Acme Inc",
    detail: "Bookkeeping · Priya Shah (inactive)",
    people: [{ name: "Priya Shah (inactive)", avatarUrl: null }],
  },
  {
    companyId: "4",
    company: "Gamma Co",
    detail: "Bookkeeping, Payroll · Priya Shah (inactive); Tax · Sam Ortiz (inactive)",
    people: [
      { name: "Priya Shah (inactive)", avatarUrl: null },
      { name: "Sam Ortiz (inactive)", avatarUrl: null },
    ],
  },
];

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border px-4 py-3 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default function ReassignPreview() {
  const [notice, setNotice] = React.useState<{ who: "admin" | "am"; n: number } | null>(null);

  function show(who: "admin" | "am") {
    try {
      sessionStorage.removeItem("reassign-seen");
    } catch {}
    setNotice((prev) => ({ who, n: (prev?.n ?? 0) + 1 }));
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-10 p-8">
      <div>
        <h1 className="text-xl font-semibold">Reassign Preview</h1>
        <p className="text-sm text-muted-foreground">
          The real components with sample people. Nothing here is saved.
        </p>
      </div>

      <Section
        title="1. Admin → Companies, Accounting Manager column"
        note="Click a name with ⇕ to open Reassign Accounting Manager."
      >
        <div className="rounded-xl border bg-card">
          <Cell label="Acme Inc">
            <AssignManager companyId="p1" companyName="Acme Inc" managers={MANAGERS} replacing="Jane Doe" preview />
          </Cell>
          <Cell label="Beta LLC">
            <NeedsReassignment>
              <AssignManager
                companyId="p2"
                companyName="Beta LLC"
                managers={MANAGERS}
                replacing="Mark Lee (inactive)"
                preview
              />
            </NeedsReassignment>
          </Cell>
          <Cell label="Gamma Co">
            <AssignManager companyId="p3" companyName="Gamma Co" managers={MANAGERS} preview />
          </Cell>
          <Cell label="Delta Corp">
            <AssignManager companyId="p4" companyName="Delta Corp" managers={MANAGERS} disabled preview />
          </Cell>
        </div>
      </Section>

      <Section title="2. Admin → Company Details banner" note="Shown when the company's accounting manager is inactive.">
        <ReassignmentBanner detail="Mark Lee (inactive)">
          <AssignManager
            companyId="p2"
            companyName="Beta LLC"
            managers={MANAGERS}
            replacing="Mark Lee (inactive)"
            label="Reassign"
            preview
          />
        </ReassignmentBanner>
      </Section>

      <Section
        title="3. AM → Companies, Assigned Specialists column"
        note="Bookkeeping's specialist is inactive, Payroll is staffed, Tax has nobody yet."
      >
        <div className="rounded-xl border bg-card">
          <Cell label="Acme Inc">
            <span className="flex flex-wrap items-center gap-2">
              <AssignCompanySpecialist
                companyId="p5"
                companyName="Acme Inc"
                assigned={["Priya Shah (inactive)", "Al Bo"]}
                previewLines={LINES}
              />
              <Badge variant="destructive">Needs Reassignment</Badge>
            </span>
          </Cell>
          <Cell label="Gamma Co">
            <AssignCompanySpecialist companyId="p6" companyName="Gamma Co" assigned={[]} previewLines={LINES} />
          </Cell>
        </div>
      </Section>

      <Section title="4. AM → Company Details banner" note="Shown when a specialist on the company is inactive.">
        <ReassignmentBanner detail="Bookkeeping · Priya Shah (inactive)">
          <AssignCompanySpecialist
            companyId="p5"
            companyName="Acme Inc"
            assigned={["Priya Shah (inactive)", "Al Bo"]}
            label="Reassign"
            previewLines={LINES}
          />
        </ReassignmentBanner>
      </Section>

      <Section
        title="5. Reminder after sign-in"
        note="Appears once per browser session while anything needs reassigning."
      >
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => show("admin")}>
            Show Admin Reminder
          </Button>
          <Button variant="outline" onClick={() => show("am")}>
            Show Accounting Manager Reminder
          </Button>
        </div>
      </Section>

      {notice ? (
        notice.who === "admin" ? (
          <ReassignNotice
            key={notice.n}
            title="Reassign Accounting Managers"
            description="These companies’ accounting manager is inactive. Assign each one a new accounting manager."
            items={ADMIN_ITEMS}
            hrefBase="/reassign-preview#"
          />
        ) : (
          <ReassignNotice
            key={notice.n}
            title="Reassign Specialists"
            description="A specialist on these companies is inactive. Choose a new specialist for each service; the company’s open projects move to them."
            items={AM_ITEMS}
            hrefBase="/reassign-preview#"
          />
        )
      ) : null}
    </main>
  );
}
