/**
 * Export filenames. Run: npx tsx src/lib/export.test.ts
 *
 * Both functions here are string handling whose failure mode is quiet: a bad
 * name does not throw, it saves a file called something wrong — or, on Windows,
 * does not save at all. Neither is visible from the code that calls them.
 */
import assert from "node:assert/strict";

import { safeFilename } from "./export";
import { filenameFromDisposition } from "./http";

/* ------------------------------------------------- Content-Disposition -- */

assert.equal(filenameFromDisposition(null), null);
assert.equal(filenameFromDisposition("attachment"), null);

assert.equal(
  filenameFromDisposition('attachment; filename="projects.csv"'),
  "projects.csv",
);

/* Unquoted, which is legal and which servers do send. */
assert.equal(
  filenameFromDisposition("attachment; filename=projects.csv"),
  "projects.csv",
);

/*
 * THE CASE WORTH THE FILE: both forms present. `filename*` carries the charset
 * and is the real name; the plain one is the ASCII fallback beside it. Taking
 * the fallback is how "Zürich Q3.csv" arrives called "Zurich Q3.csv".
 */
assert.equal(
  filenameFromDisposition(
    "attachment; filename=\"Zurich Q3.csv\"; filename*=UTF-8''Z%C3%BCrich%20Q3.csv",
  ),
  "Zürich Q3.csv",
);

/* A malformed escape falls back rather than throwing mid-download. */
assert.equal(
  filenameFromDisposition("attachment; filename=\"ok.csv\"; filename*=UTF-8''%E0%A4%A"),
  "ok.csv",
);

/* A server naming a path does not get to choose where this lands. */
assert.equal(
  filenameFromDisposition('attachment; filename="../../etc/passwd"'),
  "passwd",
);

/* ------------------------------------------------------- safeFilename -- */

assert.equal(safeFilename("Acme Books", "projects"), "Acme Books");

/* Slashes make a path, on both platforms. */
assert.equal(safeFilename("Q3 / Payroll", "projects"), "Q3 Payroll");

/* The characters Windows refuses outright. */
assert.equal(safeFilename('a:b*c?d"e<f>g|h', "projects"), "a b c d e f g h");

/* Windows strips trailing dots and spaces on save, silently renaming the file.
   Doing it here means the name is what it says it is. */
assert.equal(safeFilename("report .", "projects"), "report");

/* Whitespace collapses rather than surviving as a run. */
assert.equal(safeFilename("  Acme    Books  ", "projects"), "Acme Books");

/* A name that is ENTIRELY illegal falls back instead of producing "" — an
   empty `download` attribute makes the browser invent its own name, which is
   usually the last path segment of the URL ("export"). */
assert.equal(safeFilename("///", "projects"), "projects");
assert.equal(safeFilename("", "projects"), "projects");

console.log("export: ok");
