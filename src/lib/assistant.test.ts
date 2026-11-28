/**
 * The assistant boundary. Run: npx tsx src/lib/assistant.test.ts
 *
 * Rows are shaped like Pratibha's `/ai-assistant` samples (list #10, Nov 27).
 * Pure functions only: the parts of the chat that can be wrong without erroring.
 */
import assert from "node:assert/strict";

import { historyGroups, historyWhen, toAssistantMessage } from "./assistant";

const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h).toISOString();
const now = new Date(2026, 10, 26, 9); // Thu Nov 26, 9 AM local

// Grouped by calendar day, not by hours: 11 PM yesterday is Yesterday at 9 AM.
const groups = historyGroups(
  [
    { id: "old", title: "Old", updatedAt: at(2026, 10, 1) },
    { id: "late", title: "Late", updatedAt: at(2026, 11, 25, 23) },
    { id: "week", title: "Week", updatedAt: at(2026, 11, 19) },
    { id: "eight", title: "Eight", updatedAt: at(2026, 11, 18) },
    { id: "early", title: "Early", updatedAt: at(2026, 11, 26, 1) },
    { id: "now", title: "Now", updatedAt: at(2026, 11, 26, 8) },
  ],
  now,
);
assert.deepEqual(
  groups.map((g) => [g.group, g.conversations.map((c) => c.id)]),
  [
    ["Today", ["now", "early"]],
    ["Yesterday", ["late"]],
    ["Previous 7 Days", ["week"]],
    ["Older", ["eight", "old"]],
  ],
);
assert.deepEqual(historyGroups([], now), []);

// Today shows the clock; earlier days the date, with the year only once it differs.
assert.match(historyWhen(at(2026, 11, 26, 8), now), /^8:00\sAM$/);
assert.equal(historyWhen(at(2026, 11, 24), now), "Nov 24");
assert.equal(historyWhen(at(2025, 12, 30), now), "Dec 30, 2025");

// A reply's documents map like a Documents row, take the service off the
// project, and open through it. These rows carry no uploader yet.
const reply = toAssistantMessage({
  id: "6",
  role: "assistant",
  content: "Here are your Payroll documents. Found 3 documents.",
  total: 3,
  documents: [
    {
      id: 15,
      projectId: null,
      fileName: "US_SAMPLE_12.pdf",
      sizeBytes: 44869,
      createdAt: "2026-10-13T10:47:43.630Z",
      project: { id: 18, projectName: "p2", service: "Payroll" },
    },
  ],
});
assert.equal(reply.role, "assistant");
assert.equal(reply.found, 3);
assert.deepEqual(
  { ...reply.documents[0], uploadedAt: "" },
  {
    id: "15",
    projectId: "18",
    name: "US_SAMPLE_12.pdf",
    project: "p2",
    service: "Payroll",
    owner: "",
    uploadedAt: "",
    size: 44869,
  },
);

// The customer's own message: no documents, no count, whatever the server omits.
const mine = toAssistantMessage({ id: "5", role: "user", content: "payroll", total: 0 });
assert.deepEqual([mine.role, mine.text, mine.documents, mine.found], ["user", "payroll", [], null]);

console.log("assistant: ok");
