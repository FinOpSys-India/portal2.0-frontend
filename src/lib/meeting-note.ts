/**
 * The marker a meeting note carries in chat, on its own so the chat previews
 * (contact list, bell) can hide it without importing the meetings module.
 * Written by `meetingNote` in lib/meetings.
 */

export type MeetingEvent =
  | "scheduled"
  | "requested"
  | "accepted"
  | "declined"
  | "canceled"
  | "withdrawn";

const MARKER =
  /\s*\[\[meeting:(\d+):(scheduled|requested|accepted|declined|canceled|withdrawn)\]\]\s*$/;

/** A note `meetingNote` wrote, or null. Anything else in a thread is just text. */
export function parseMeetingNote(
  body: string,
): { meetingId: string; event: MeetingEvent; text: string } | null {
  const match = MARKER.exec(body);
  if (!match) return null;
  return {
    meetingId: match[1],
    event: match[2] as MeetingEvent,
    text: body.slice(0, match.index),
  };
}

/** A message body as a one-line preview shows it: a meeting note without its marker. */
export function previewText(body: string): string {
  return parseMeetingNote(body)?.text ?? body;
}
