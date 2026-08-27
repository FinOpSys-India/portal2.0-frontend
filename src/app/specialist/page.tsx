import { redirect } from "next/navigation";

/** Specialists land on their project list, the design's first nav item. */
export default function SpecialistIndexPage() {
  redirect("/specialist/projects");
}
