// IST (Asia/Kolkata) wall-clock helpers. IST has a fixed +05:30 offset with no
// daylight saving, so this is plain arithmetic and needs no timezone library.
// Ported from build-fellowship's app/src/lib/ist.js: every submission time in
// the Submissions tab goes through utcToIST so the two products read the same.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** A UTC ISO timestamp as `{ date: "YYYY-MM-DD", time: "HH:MM" }` in IST. */
export function utcToIST(iso: string): { date: string; time: string } {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const stamp = shifted.toISOString();
  return { date: stamp.slice(0, 10), time: stamp.slice(11, 16) };
}

/** "2026-09-21 01:30 IST": one deterministic string, so server and browser render the same text. */
export function formatIST(iso: string): string {
  const { date, time } = utcToIST(iso);
  return `${date} ${time} IST`;
}
