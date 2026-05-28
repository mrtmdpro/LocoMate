/**
 * CSV export helpers for client-generated downloads.
 *
 * Three subtle requirements:
 *   1. Formula injection: Excel / Sheets evaluate cells starting with
 *      `=`, `+`, `-`, `@`, `\t`, or `\r` as formulas. Anything derived from
 *      user input (traveler displayName, experience title, etc.) must be
 *      neutralised -- otherwise a hostile traveler can craft a name that
 *      runs code on the host's machine when they open the CSV.
 *   2. UTF-8 BOM: Excel on Windows opens BOM-less UTF-8 as Windows-1252,
 *      which mangles Vietnamese diacritics. Every CSV we produce for
 *      Vietnamese hosts needs `\uFEFF` at the start.
 *   3. Line endings: RFC 4180 specifies CRLF; Excel honours that on Windows.
 *      Mixed LF / CRLF across the file breaks some CSV parsers.
 */

/** Cells starting with any of these are interpreted as formulas by Excel / Sheets. */
const FORMULA_INJECTION = /^[=+\-@\t\r]/;

/**
 * Escape a single CSV field per RFC 4180 rules + neutralise formula
 * injection. The neutralisation step prefixes a single apostrophe which
 * Excel treats as a literal string marker; the apostrophe is stripped on
 * display but prevents formula evaluation.
 */
export function csvCell(raw: string): string {
  const safe = FORMULA_INJECTION.test(raw) ? `'${raw}` : raw;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Build a CSV string from a header row + N body rows. Each body row is
 * rendered as already-escaped cells; numeric cells can be passed through
 * without escaping because they never need quoting.
 */
export function buildCsv(header: string[], rows: Array<Array<string | number>>): string {
  const escape = (cell: string | number) => (typeof cell === "number" ? String(cell) : csvCell(cell));
  const headerLine = header.map(escape).join(",");
  const bodyLines = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  return `\uFEFF${headerLine}\r\n${bodyLines}`;
}

/**
 * Trigger a download of the given CSV in the browser. Safe to call in SSR
 * (guards `typeof window`); no-op on the server.
 */
export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
