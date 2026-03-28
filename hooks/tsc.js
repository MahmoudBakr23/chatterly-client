#!/usr/bin/env node

// ─── hooks/tsc.js ────────────────────────────────────────────────────────────
// PostToolUse hook — runs after Claude writes or edits any TypeScript file.
//
// How it works:
//   1. Claude Code pipes a JSON event to stdin describing the tool that just ran.
//   2. We parse tool_input.file_path to check if it's a .ts / .tsx file.
//   3. If so, we run `tsc --noEmit` across the full project (not just the
//      edited file — see below for why full-project is required).
//   4. If tsc exits non-zero we print the errors to stdout and exit(1) so that
//      Claude Code surfaces them in the session and Claude can fix them inline.
//
// Why full-project and not just the edited file:
//   - TypeScript resolves the entire module graph regardless of which file you
//     pass on the CLI, so "single-file" checking is not meaningfully scoped.
//   - More importantly: editing a shared type in types/index.ts will break its
//     consumers (store/, services/, components/), not the type file itself.
//     Checking only the edited file would produce zero output — a false pass.
//   - Full-project `tsc --noEmit` is the only reliable way to catch cross-file
//     breakage introduced by the edit Claude just made.
//
// Performance note:
//   tsconfig.json has `"incremental": true` which writes a .tsbuildinfo cache.
//   Subsequent runs only re-check changed files, so the full-project check is
//   fast in practice (typically <2 s after the first cold run).

"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

// ── 1. Read stdin ─────────────────────────────────────────────────────────────
// Claude Code pipes the PostToolUse event as a single JSON blob on stdin.
// We accumulate all chunks before parsing.
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});

process.stdin.on("end", () => {
  // ── 2. Parse the event ──────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    // Malformed stdin — don't block the tool, just exit cleanly.
    process.exit(0);
  }

  const filePath = event?.tool_input?.file_path ?? "";

  // ── 3. Guard — only care about TypeScript files ────────────────────────────
  if (!/\.(tsx?)$/.test(filePath)) {
    process.exit(0);
  }

  // ── 4. Run tsc --noEmit from the project root ──────────────────────────────
  // __dirname is hooks/, so project root is one level up.
  const projectRoot = path.resolve(__dirname, "..");

  // Use spawnSync so we can capture both stdout and stderr before deciding
  // what to do. `pipe` on stdio lets us forward selectively.
  const result = spawnSync("npx", ["tsc", "--noEmit"], {
    cwd: projectRoot,
    encoding: "utf8",
    // Allow up to 60 s for a cold incremental build on a large project.
    timeout: 60_000,
  });

  // ── 5. Report results ──────────────────────────────────────────────────────
  if (result.status === 0) {
    // Clean — nothing to say, exit silently.
    process.exit(0);
  }

  // Errors found — print them so Claude Code surfaces them in the session.
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  process.stdout.write(
    "\n[tsc hook] TypeScript errors detected after editing " + filePath + ":\n\n" + output + "\n",
  );

  // Exit 1 signals Claude Code that the hook found a problem.
  // Claude will read the output and fix the type errors before moving on.
  process.exit(1);
});
