/**
 * The profile picture, for every portal.
 *
 * ONE MODULE RATHER THAN FOUR COPIES. `POST /users/me/avatar` is keyed by the
 * session and by nothing else — there is no role in the path, no company scope,
 * no id — so the manager, the specialist and the customer all make exactly the
 * same request. Splitting it across the three boundaries would be three
 * identical functions that can drift apart for no reason.
 *
 * MULTIPART, AND THE ONLY MULTIPART ROUTE ON THE BACKEND. Documents, chat
 * attachments and email attachments all run the signed-URL handshake instead,
 * because a serverless host will not carry their bytes. An avatar is capped at
 * 2 MB and goes through the API directly, which is why `postForm` exists.
 */

import { del, postForm } from "@/lib/http";

/**
 * The server's ceiling, not the design's — `UPLOAD_MAX_AVATAR_BYTES`, 2 MB by
 * default. Checked here so a 5 MB photo is refused before it is uploaded rather
 * than after multer aborts the stream.
 *
 * ponytail: hardcoded to the backend's default. The limit is not exposed on any
 * endpoint, so there is nothing to read it from; a deployment that raises it has
 * to move this too.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_AVATAR_LABEL = "2 MB";

/**
 * What the server will store. SVG is deliberately absent — it is a document
 * that can carry script, and these are served back from a public bucket.
 * Mirrors `EXTENSION_BY_MIME` in the backend's middlewares/uploadAvatar.js.
 */
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The `accept` attribute for the file input, in the same vocabulary. */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");

export const avatarApi = {
  /**
   * Replace the picture. Answers the whole updated profile; only the URL is
   * returned, because that is the one field the caller is about to render.
   *
   * The FIELD NAME MUST BE `avatar` — multer is configured `.single('avatar')`
   * and anything else arrives as an unexpected field, which it rejects.
   */
  async upload(file: File): Promise<string | null> {

    const form = new FormData();
    form.append("avatar", file);
    // No Content-Type header: the browser writes the multipart boundary, and
    // setting one by hand produces a body the parser cannot read. `postForm`
    // is the reason this does not go through `post`.
    const data = await postForm<{ avatarUrl: string | null }>(
      "/users/me/avatar",
      form,
    );
    return data.avatarUrl ?? null;
  },

  /** Back to no picture. Idempotent server-side — removing none is a success. */
  async remove(): Promise<void> {
    await del("/users/me/avatar");
  },
};

/**
 * Why a file is refused, or null when it is fine.
 *
 * Returns the reason rather than a boolean so the caller has something to show.
 * A courtesy, not a control: the server enforces both rules again, and anything
 * checked only in a browser is a suggestion.
 */
export function avatarProblem(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) {
    return "Pick a JPEG, PNG or WebP image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `That image is over ${MAX_AVATAR_LABEL}. Pick a smaller one.`;
  }
  return null;
}
