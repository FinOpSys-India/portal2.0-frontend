import { redirect } from "next/navigation";

/** 1.0 lands admins on the customer list; /admin does the same. */
export default function AdminIndexPage() {
  redirect("/admin/customers");
}
