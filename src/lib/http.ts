/**
 * The fetch layer every portal boundary sits on.
 *
 * Three things happen here that used not to, and each was a silent failure
 * against the real backend rather than a missing feature:
 *
 *   1. THE ENVELOPE IS UNWRAPPED. Every backend response is
 *      `{ success, message, data }` on the way out and
 *      `{ success: false, error: { code, message, ... } }` on the way in.
 *      This layer used to hand the whole envelope back typed as `T`, so every
 *      caller received the wrapper where it expected the payload. Nothing threw
 *      — the shapes just quietly disagreed.
 *
 *   2. AUTHORIZATION IS ATTACHED. Nearly every route wants a Bearer token.
 *      On the client the proxy adds it (see src/proxy.ts); on the server there
 *      is no proxy in the path, so it is read from the cookie jar here.
 *
 *   3. A 401 REFRESHES ONCE AND RETRIES. Access tokens are short-lived and the
 *      refresh token is a 30-day HttpOnly cookie. Without this, every session
 *      ends at the first token expiry regardless of how long the user has left.
 *
 * Isomorphic on purpose: the same `get`/`post` serve async server components
 * and client event handlers, so a boundary function does not have to know which
 * side it is being called from. The two differ only in transport, below.
 */

import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  LIVE,
  backendUrl,
} from "@/lib/backend";

/**
 * Kept as the mock switch every boundary already branches on, so `if (!BASE)`
 * keeps meaning "no backend configured — answer from the fixture".
 */
export const BASE = LIVE ? "/api" : undefined;

const onServer = typeof window === "undefined";

/** A failed request, carrying the backend's own error code for callers that branch on it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* --------------------------------------------------------------- cookies -- */

/**
 * Read a cookie on whichever side we are running.
 *
 * `next/headers` is imported dynamically rather than at module scope: this file
 * is also pulled into client components, and a static import of a server-only
 * module there is a build error.
 */
async function readCookie(name: string): Promise<string | undefined> {
  if (onServer) {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(name)?.value;
  }
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

/* -------------------------------------------------------------- requests -- */

/**
 * Absolute backend URL on the server, same-origin proxy path in the browser.
 *
 * A server component has no origin to resolve `/api/...` against, so it calls
 * the backend directly. The browser goes through the proxy, which is what keeps
 * the session cookies same-origin.
 */
function url(path: string): string {
  return onServer ? backendUrl(path) : `/api${path}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  // In the browser the proxy attaches this; adding it twice would be harmless
  // but pointless, and the cookie is the proxy's job to read.
  if (!onServer) return {};
  const token = await readCookie(ACCESS_TOKEN_COOKIE);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Unwrap `{ success, data }`, or throw the backend's own error.
 *
 * On a 5xx the backend REPLACES its message with a fixed "An unexpected error
 * occurred." unless the deployment opts into error details, so the one line the
 * user sees is the same whether the database fell over or the mail provider
 * refused the OTP — two different problems that read identically and neither of
 * which can be told apart from the screen. The `code` survives that masking
 * (`OTP_DELIVERY_UNAVAILABLE` vs `INTERNAL_ERROR`), so it is appended: a server
 * error is exactly the case where the user is going to be asked what it said.
 */
async function unwrap<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let body: { data?: unknown; message?: string; error?: { code?: string; message?: string } } | null =
    null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const error = body?.error;
    // A non-JSON body (gateway HTML, an empty 304, a truncated response) leaves
    // `body` null and both message fields undefined — the old fallback then said
    // only "Request failed." and threw the status away, which is exactly the case
    // where the status is the whole diagnosis. Always carry it.
    const message =
      error?.message ?? body?.message ?? `Request failed (HTTP ${res.status}).`;
    // ponytail: temporary diagnostic — log the raw body when it is not the
    // expected envelope, so a non-JSON failure names itself once instead of
    // hiding behind "Request failed." Remove after the /manager 4xx is pinned.
    if (!body) {
      console.error(
        `[http] non-JSON ${res.status} ${res.url} :: ${raw.slice(0, 300) || "<empty>"}`,
      );
    }
    throw new ApiError(
      res.status >= 500 && error?.code ? `${message} (${error.code})` : message,
      res.status,
      error?.code,
    );
  }

  // `data` is absent on the handful of routes that answer with a bare success;
  // returning the envelope in that case is more useful than returning undefined.
  return (body?.data ?? body) as T;
}

/**
 * One refresh at a time.
 *
 * Three requests failing 401 together must not fire three rotations: the
 * backend rotates the refresh token on every call, so the second and third
 * would present a token the first had already spent and be treated as replay —
 * which revokes the whole family and logs the user out. They share this promise
 * instead.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const csrf = await readCookie(CSRF_COOKIE);
      const res = await fetch(url("/auth/refresh"), {
        method: "POST",
        headers: csrf ? { [CSRF_HEADER]: csrf } : {},
        credentials: "include",
      });
      if (!res.ok) return false;

      const body = await res.json().catch(() => null);
      const token = body?.data?.accessToken;
      if (!token) return false;

      storeAccessToken(token, body.data.expiresInSeconds);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this one all see the same
      // result before a fresh attempt becomes possible.
      queueMicrotask(() => {
        refreshing = null;
      });
    }
  })();

  return refreshing;
}

/**
 * Park the access token where both sides can reach it.
 *
 * NOT HttpOnly, and that is the trade being made: a server component has to be
 * able to read it, and it can only read cookies the browser sends. The refresh
 * token — the credential actually worth stealing, good for 30 days — stays
 * HttpOnly and untouchable in the backend's own cookie. This one expires in
 * minutes and is replaceable.
 */
export function storeAccessToken(token: string, expiresInSeconds?: number) {
  if (onServer) return;
  const maxAge = expiresInSeconds ?? 900;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearAccessToken() {
  if (onServer) return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * The single request path. `retry` is spent on the one refresh attempt, so a
 * 401 that survives a fresh token surfaces to the caller instead of looping.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const csrf = await readCookie(CSRF_COOKIE);

  const res = await fetch(url(path), {
    ...init,
    headers: {
      ...(await authHeaders()),
      // Sent on every write rather than only on /auth/*: it is ignored where it
      // is not required, and this way a route that starts checking it does not
      // need a change here.
      ...(csrf && init.method && init.method !== "GET"
        ? { [CSRF_HEADER]: csrf }
        : {}),
      ...init.headers,
    },
    credentials: "include",
  });

  // A server component cannot write the refreshed cookie back to the browser,
  // so only the client refreshes and retries.
  if (res.status === 401 && retry && !onServer && (await refreshSession())) {
    return request<T>(path, init, false);
  }

  /*
   * ON THE SERVER, AN UNAUTHENTICATED READ IS A REDIRECT, NOT AN ERROR.
   *
   * Every portal page is a server component that fetches through here, and a
   * 401 used to become a thrown ApiError with nothing to catch it: signing out,
   * letting a token lapse, or simply opening /admin/customers in a fresh tab
   * produced a stack trace reading "Authentication required." rather than the
   * login screen.
   *
   * It belongs here rather than in each layout because the layouts do not do
   * the fetching — the pages under them do, and there are dozens. This is the
   * one place all of them pass through.
   *
   * `redirect` throws its own control-flow signal, which must propagate: it is
   * deliberately raised outside the try/catch that `getOrNull` and the
   * boundaries wrap around calls, and nothing here swallows it.
   */
  if (res.status === 401 && onServer) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  return unwrap<T>(res);
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

/**
 * `get`, but a missing record answers `null` instead of throwing.
 *
 * Every detail boundary is typed `Promise<X | null>` and every detail page calls
 * `notFound()` when it gets one — a contract that held against the mocks, where
 * a missing row is `undefined` from an array lookup, and held nowhere else. The
 * backend answers a missing record with a 404, `unwrap` turns that into a thrown
 * `ApiError`, and the null branch was therefore dead code: a mistyped id in the
 * URL produced an unhandled error instead of the 404 page written for it.
 *
 * ONLY 404. A 403 must keep throwing — "you may not see this" rendered as "this
 * does not exist" is a real answer replaced by a wrong one, and it would hide a
 * permissions bug behind a plausible-looking empty page.
 */
export async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await get<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * `headers` exists for `Idempotency-Key`, which the backend reads off the
 * HEADER and nowhere else. Sending it in the body is not merely ignored: every
 * write validator calls `rejectUnknown`, so an extra body field is a 400.
 */
export function post<T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/**
 * Multipart upload. No Content-Type header — the browser writes the boundary,
 * and setting one by hand produces a body the server cannot parse.
 *
 * Only `POST /users/me/avatar` takes a body like this on the real backend.
 * Documents, chat attachments and email attachments do NOT — they run the
 * signed-URL handshake below.
 */
export function postForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: form });
}

/* --------------------------------------------------------------- uploads -- */

/** What the backend hands back per file from any `.../upload-url` endpoint. */
export interface UploadTicket {
  key: string;
  uploadUrl: string;
  fileName?: string;
}

/**
 * The MIME type for an extension the browser would not name.
 *
 * `File.type` is empty surprisingly often — Windows reports nothing for `.doc`,
 * `.xls` and `.csv` unless Office is installed, and `.heic` is unrecognised on
 * most desktops. The fallback used to be `application/octet-stream`, which the
 * backend's allowlist does not contain, so those uploads died at the FIRST call
 * with a 415 saying the file type was unsupported — about a `.doc`, on a form
 * that advertises `.doc`.
 *
 * Keys mirror `EXTENSION_BY_MIME` in the backend's utils/documentTypes.js.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** What the browser calls a file, or what its extension says when it will not say. */
export function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  // Still octet-stream when the extension is unknown too: the server refuses it
  // either way, and guessing further would be inventing a claim about bytes we
  // have not looked at.
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** What a `.../upload-url` request describes, one entry per file. */
export function describeFile(file: File) {
  return {
    fileName: file.name,
    mimeType: mimeTypeOf(file),
    sizeBytes: file.size,
  };
}

/**
 * Step two of every upload: PUT the bytes straight at storage.
 *
 * Deliberately NOT through `request()`. The signed URL points at Supabase, not
 * at the backend, and attaching our Authorization header to it would send the
 * session token to a third-party host — the signature in the query string is
 * the whole credential.
 */
export async function putSigned(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    // The SAME type the ticket declared. The confirm step asks storage what it
    // actually holds and checks it, so sending octet-stream here after
    // declaring application/msword would be caught as a mismatch — by the check
    // that exists to catch a .exe claiming to be a PDF.
    headers: { "Content-Type": mimeTypeOf(file) },
    body: file,
  });

  if (!res.ok) {
    throw new ApiError(
      `Upload of ${file.name} failed.`,
      res.status,
      "UPLOAD_FAILED",
    );
  }
}

/**
 * The whole three-step handshake, which is identical for documents, chat
 * attachments and email attachments — only the two endpoints differ.
 *
 * Files are PUT concurrently but the confirm is one call for the batch, because
 * that is what the backend accepts and what makes the set arrive atomically:
 * confirming per file would leave a half-recorded selection behind on a failure
 * midway.
 */
export async function uploadViaSignedUrls<T>(
  ticketPath: string,
  confirmPath: string,
  companyId: string | number,
  files: File[],
): Promise<T> {
  const { uploads } = await post<{ uploads: UploadTicket[] }>(ticketPath, {
    companyId: Number(companyId),
    files: files.map(describeFile),
  });

  await Promise.all(uploads.map((t, i) => putSigned(t.uploadUrl, files[i])));

  return post<T>(confirmPath, {
    companyId: Number(companyId),
    files: uploads.map((t, i) => ({ key: t.key, fileName: files[i].name })),
  });
}

/* ------------------------------------------------------------ pagination -- */

/**
 * The backend pages with `limit`/`offset` everywhere. Nothing accepts `?page=`,
 * which is what these boundaries used to send — silently ignored, so every
 * request returned page one.
 */
export function pageQuery(page: number, size: number): string {
  return `limit=${size}&offset=${Math.max(0, (page - 1) * size)}`;
}
