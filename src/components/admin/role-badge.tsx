import { Badge } from "@/components/ui/badge";
import type { CustomerRole } from "@/lib/admin";
import { cn } from "@/lib/utils";

/**
 * Customer role chip.
 *
 * Both variants are muted — a role is a label, not an alert, and a solid
 * purple chip on every Owner row pulls the eye away from the data. Owner
 * keeps a faint brand tint so the two are still separable at a glance.
 */
export function RoleBadge({ role }: { role: CustomerRole }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent font-medium",
        role === "Owner"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {role}
    </Badge>
  );
}
