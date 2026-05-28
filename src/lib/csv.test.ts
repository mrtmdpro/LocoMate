import { describe, test, expect } from "vitest";
import { csvCell, buildCsv } from "./csv";

describe("csvCell", () => {
  test("returns plain strings unchanged when no escaping is required", () => {
    expect(csvCell("Hello")).toBe("Hello");
    expect(csvCell("Nguyễn Văn Anh")).toBe("Nguyễn Văn Anh");
  });

  test("wraps cells containing commas in quotes", () => {
    expect(csvCell("Walk, Old Quarter")).toBe('"Walk, Old Quarter"');
  });

  test("doubles internal quotes and wraps the whole cell", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  test("wraps cells containing newlines", () => {
    expect(csvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(csvCell("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
  });

  test("neutralises formula injection with = prefix", () => {
    // `=cmd|'/C calc'!A1` would execute on Excel open; we prefix with a
    // single quote per OWASP guidance. The cell still quotes because it
    // now also contains a comma-equivalent trigger.
    expect(csvCell("=cmd|'/C calc'!A1")).toBe("'=cmd|'/C calc'!A1");
  });

  test("neutralises formula injection with + / - / @ prefixes", () => {
    expect(csvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  test("neutralises tab prefix (formula trigger but not a CSV reserved char)", () => {
    // Tab is a formula-injection trigger, so we prefix with an apostrophe.
    // Tab alone does NOT require RFC 4180 double-quote wrapping (only `,`,
    // `"`, and newlines do), so the output is the neutralised cell without
    // surrounding quotes.
    expect(csvCell("\ttricky")).toBe("'\ttricky");
  });

  test("neutralises CR prefix AND applies RFC 4180 quoting (CR is a reserved char)", () => {
    // CR IS a CSV reserved char -> the cell gets both the formula-prefix
    // apostrophe AND the surrounding double quotes.
    expect(csvCell("\rtricky")).toBe('"\'\rtricky"');
  });

  test("does not falsely neutralise hyphen inside a normal name", () => {
    // Only the LEADING char matters for formula detection.
    expect(csvCell("Anne-Marie")).toBe("Anne-Marie");
  });
});

describe("buildCsv", () => {
  const header = ["Name", "Amount", "Status"];

  test("prefixes the output with a UTF-8 BOM so Excel on Windows renders diacritics", () => {
    const csv = buildCsv(header, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  test("uses CRLF line endings per RFC 4180", () => {
    const csv = buildCsv(header, [
      ["Alice", 100, "paid"],
      ["Bob", 200, "refunded"],
    ]);
    // After the BOM + header, the body lines should be CRLF-separated.
    expect(csv).toContain("\r\nAlice,100,paid");
    expect(csv).toContain("\r\nBob,200,refunded");
  });

  test("numbers render without quoting, strings escape as needed", () => {
    const csv = buildCsv(header, [["Walk, Old Quarter", 500_000, "succeeded"]]);
    expect(csv).toContain('"Walk, Old Quarter",500000,succeeded');
  });

  test("handles empty rows list (header-only CSV)", () => {
    const csv = buildCsv(header, []);
    // BOM + header line + \r\n + empty body
    expect(csv).toBe("\uFEFFName,Amount,Status\r\n");
  });

  test("end-to-end: a malicious traveler name cannot smuggle a formula", () => {
    const csv = buildCsv(header, [[`=HYPERLINK("https://evil.example","Click")`, 100, "paid"]]);
    // The formula cell must start with a single quote AFTER the opening
    // double quote. This is the injection-neutralisation guarantee.
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""Click"")"`);
  });
});
