/**
 * The assistant boundary. Run: npx tsx src/lib/assistant.test.ts
 *
 * Rows are shaped like the routes we asked for in backend list #10; nothing
 * here is read off Pratibha's code yet. Pure functions only: the parts of the
 * chat that can be wrong without erroring.
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

// A reply's documents map like a Documents row, and open through their project.
const reply = toAssistantMessage({
  id: 7,
  role: "ASSISTANT",
  text: "I found 1 document.",
  searchedCount: 142,
  documents: [
    {
      id: 31,
      projectId: null,
      fileName: "2023 Federal Return.pdf",
      sizeBytes: 1200,
      uploadedBy: { id: 4, firstName: "Anita", lastName: "Rao" },
      createdAt: "2024-03-14T10:00:00.000Z",
      project: { id: 9, projectName: "2023 Tax Return" },
      service: "Tax",
    },
  ],
});
assert.equal(reply.role, "assistant");
assert.equal(reply.searched, 142);
assert.deepEqual(
  { ...reply.documents[0], uploadedAt: "" },
  {
    id: "31",
    projectId: "9",
    name: "2023 Federal Return.pdf",
    project: "2023 Tax Return",
    service: "Tax",
    owner: "Anita Rao",
    uploadedAt: "",
    size: 1200,
  },
);

// The customer's own message: no documents, no count, whatever the server omits.
const mine = toAssistantMessage({ id: 6, role: "USER", text: "tax 2023" });
assert.deepEqual(
  [mine.role, mine.documents, mine.searched],
  ["user", [], null],
);

console.log("assistant: ok");
