// TEMPORARY: compare icons for the compact Active/Inactive button. Delete once picked.
import {
  Ban,
  CircleCheck,
  CircleDot,
  CirclePause,
  CirclePlay,
  CirclePower,
  CircleSlash,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Moon,
  Pause,
  Play,
  Power,
  PowerOff,
  Snowflake,
  SquarePower,
  Sun,
  ToggleLeft,
  ToggleRight,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const OPTIONS: { key: string; name: string; on: LucideIcon; off: LucideIcon }[] = [
  { key: "A", name: "Power (old)", on: Power, off: Power },
  { key: "B", name: "Power / Power Off", on: Power, off: PowerOff },
  { key: "C", name: "Circle Power", on: CirclePower, off: CirclePower },
  { key: "D", name: "Square Power", on: SquarePower, off: SquarePower },
  { key: "E", name: "Toggle icon", on: ToggleRight, off: ToggleLeft },
  { key: "F", name: "Circle Pause / Play", on: CirclePause, off: CirclePlay },
  { key: "G", name: "Pause / Play", on: Pause, off: Play },
  { key: "H", name: "Check / Slash", on: CircleCheck, off: CircleSlash },
  { key: "I", name: "Check / Ban", on: CircleCheck, off: Ban },
  { key: "J", name: "Dot / Slash", on: CircleDot, off: CircleSlash },
  { key: "K", name: "Eye / Eye Off", on: Eye, off: EyeOff },
  { key: "L", name: "Sun / Snowflake", on: Sun, off: Snowflake },
  { key: "M", name: "Sun / Moon", on: Sun, off: Moon },
  { key: "N", name: "Lock Open / Lock", on: LockOpen, off: Lock },
];

function Row({ label, Icon, inactive }: { label: string; Icon: LucideIcon; inactive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border px-4 py-2.5 last:border-0">
      <span className={inactive ? "text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title={inactive ? "Make Active" : "Make Inactive"}
          className={inactive ? "text-muted-foreground" : "text-primary"}
        >
          <Icon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </span>
    </div>
  );
}

function MiniSwitch({ inactive }: { inactive: boolean }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent">
      <span className={`relative h-4 w-7 rounded-full ${inactive ? "bg-muted-foreground/30" : "bg-primary"}`}>
        <span className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow ${inactive ? "" : "translate-x-3"}`} />
      </span>
    </span>
  );
}

function SwitchRow({ label, inactive }: { label: string; inactive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border px-4 py-2.5 last:border-0">
      <span className={inactive ? "text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className="flex items-center gap-1">
        <MiniSwitch inactive={inactive} />
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 aria-hidden />
        </Button>
      </span>
    </div>
  );
}

export default function IconPreview() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-1 text-xl font-semibold">Active / Inactive Icon Options</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each card shows an active row and an inactive row, as they sit in the Actions column next to Delete.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONS.map(({ key, name, on, off }) => (
          <section key={key} className="overflow-hidden rounded-xl border border-border bg-card">
            <h2 className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
              {key}. {name}
            </h2>
            <Row label="Acme Inc" Icon={on} inactive={false} />
            <Row label="Beta LLC (inactive)" Icon={off} inactive />
          </section>
        ))}
        <section className="overflow-hidden rounded-xl border-2 border-primary bg-card">
          <h2 className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
            O. Mini switch (now live)
          </h2>
          <SwitchRow label="Acme Inc" inactive={false} />
          <SwitchRow label="Beta LLC (inactive)" inactive />
        </section>
      </div>
    </main>
  );
}
