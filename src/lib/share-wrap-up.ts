"use client";

/**
 * Phase A.10 — wrap-up share helper.
 *
 * Captures the given element as a PNG and either:
 *   - Opens the OS share sheet via the Web Share API (mobile / modern
 *     browsers), or
 *   - Downloads the file directly (desktop / unsupported browsers).
 *
 * The PNG dimensions track the element's rendered size, so each
 * wrap-up "page" exports at exactly the resolution the user sees.
 *
 * The `html-to-image` import is dynamic so this module stays out of the
 * server bundle.
 */

export async function shareElementAsPng(
  el: HTMLElement,
  opts: { filename?: string; title?: string; text?: string } = {},
): Promise<{ shared: boolean; downloaded: boolean }> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(el, {
    // Background colour reads from the live theme tokens — the element
    // itself paints its background, but `html-to-image` will use this
    // when the element is transparent.
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    pixelRatio: 2,
    cacheBust: true,
  });
  const filename = opts.filename ?? `locomate-${Date.now()}.png`;

  // Convert data URL -> Blob -> File for the share API.
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: opts.title,
        text: opts.text,
      });
      return { shared: true, downloaded: false };
    } catch {
      // User cancelled / share rejected — fall through to download.
    }
  }

  // Download fallback: anchor + click + revoke.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { shared: false, downloaded: true };
}
