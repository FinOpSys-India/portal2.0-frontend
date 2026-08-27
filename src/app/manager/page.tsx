import { redirect } from "next/navigation";

/** Managers land on the project queue — the thing they act on. */
export default function ManagerIndexPage() {
  redirect("/manager/projects");
}
