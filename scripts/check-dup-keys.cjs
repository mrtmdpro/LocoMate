// Audit: find duplicate JSON keys *within the same parent object*. This is
// what next-intl silently truncates -- the bug that hid the second
// `home.chapter` block. Uses a custom tokenizer to track sibling keys per
// brace level so we only flag real collisions, not coincidental same-named
// keys in unrelated objects.
const fs = require("fs");
const path = require("path");

function findDupes(text) {
  const dupes = [];
  // Stack of { path: string, keys: Set<string> } per nested object.
  const stack = [{ path: "$", keys: new Set() }];
  let i = 0;
  const n = text.length;

  function skipWs() {
    while (i < n && /\s/.test(text[i])) i++;
  }

  function readString() {
    // Assumes text[i] === '"'. Returns the raw key string.
    if (text[i] !== '"') return null;
    i++;
    let out = "";
    while (i < n) {
      const c = text[i];
      if (c === "\\") {
        out += text[i] + text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        i++;
        return out;
      }
      out += c;
      i++;
    }
    return out;
  }

  while (i < n) {
    const c = text[i];
    if (c === "{") {
      stack.push({ path: stack[stack.length - 1].path, keys: new Set() });
      i++;
      continue;
    }
    if (c === "}") {
      stack.pop();
      i++;
      continue;
    }
    if (c === "[") {
      // Arrays don't have keyed siblings; push a sentinel so brace
      // tracking still works.
      stack.push({ path: stack[stack.length - 1].path + "[]", keys: new Set() });
      i++;
      continue;
    }
    if (c === "]") {
      stack.pop();
      i++;
      continue;
    }
    if (c === '"') {
      // Could be a key or a value. Save position to compute line later.
      const startIdx = i;
      const startLine = text.slice(0, i).split("\n").length;
      const key = readString();
      skipWs();
      if (text[i] === ":") {
        // It's a key.
        const top = stack[stack.length - 1];
        if (top.keys.has(key)) {
          dupes.push({ key, parentPath: top.path, line: startLine });
        } else {
          top.keys.add(key);
        }
        // Update path so nested object errors show their lineage.
        stack[stack.length - 1] = {
          path: top.path + "." + key,
          keys: top.keys,
        };
        // Don't reset; rewind for next iteration to consume the colon
        // and value normally.
        // (path tracking is approximate but enough for the report.)
        // No need to skip value tokens — we just keep scanning.
        i++; // consume ':'
        continue;
      }
      // Not a key, it was a string value -- already consumed.
      void startIdx;
      continue;
    }
    i++;
  }
  return dupes;
}

function scan(file) {
  const text = fs.readFileSync(file, "utf8");
  const dupes = findDupes(text);
  console.log("=== " + path.basename(file) + " ===");
  if (dupes.length === 0) {
    console.log("  no in-object duplicate keys.");
    return;
  }
  for (const d of dupes) {
    console.log(
      "  duplicate key " +
        JSON.stringify(d.key) +
        " inside " +
        d.parentPath +
        " (line " +
        d.line +
        ")",
    );
  }
}

scan(path.join(__dirname, "..", "messages", "vi.json"));
scan(path.join(__dirname, "..", "messages", "en.json"));
