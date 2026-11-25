import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { landingPathForRole } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE } from "@/lib/backend";
import { roleFromToken } from "@/lib/session";

/**
 * The backend's own address for meetings. It sends the browser here after
 * "Connect Microsoft" (`?microsoft=<result>`, the default return address) and
 * links here from the "meeting requested" email (`?companyId=&meetingId=`).
 * Both are for the accounting manager, whose page is /manager/meetings.
 *
 * Only `microsoft` is carried over: that page lists every company's meetings
 * and reads no company or meeting from the address. Anyone else goes home.
 * The proxy has already sent a visitor without a session to sign in.
 */
export default async function MeetingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ microsoft?: string }>;
}) {
  const role = roleFromToken((await cookies()).get(ACCESS_TOKEN_COOKIE)?.value);
  if (role !== "ACCOUNTING_MANAGER") redirect(role ? landingPathForRole(role) : "/login");

  const { microsoft } = await searchParams;
  redirect(
    microsoft
      ? `/manager/meetings?microsoft=${encodeURIComponent(microsoft)}`
      : "/manager/meetings",
  );
}
