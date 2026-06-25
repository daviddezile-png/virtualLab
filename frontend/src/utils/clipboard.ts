// Robust copy-to-clipboard helper.
//
// `navigator.clipboard` only exists in *secure* contexts (HTTPS or localhost).
// Teachers often reach the lab over a plain-HTTP LAN address, where
// `navigator.clipboard` is `undefined` and calling `.writeText()` throws
// synchronously — so a naive `.catch()` never fires and the UI wrongly reports
// success. This helper tries the modern API first and falls back to the legacy
// `document.execCommand('copy')` textarea trick, returning whether the copy
// actually succeeded.

export async function copyToClipboard(text: string): Promise<boolean> {
  // Preferred path: async Clipboard API (secure contexts only).
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or unavailable — fall through to the legacy path.
    }
  }

  // Fallback: hidden textarea + execCommand('copy'). Works on http:// origins.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Keep it off-screen and out of the layout/scroll flow.
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
