/**
 * Save the page on screen as one self-contained HTML file: the title, every chart, table and statement,
 * styled exactly as in the app, with the fonts embedded so it looks the same offline or attached to an
 * email. Charts are SVG, so they stay sharp at any zoom; hover details are left out because the file has
 * no scripts.
 */

const SKIP = [
  "script",
  "noscript",
  "input[type=file]",
  ".no-print",
  "[data-export=skip]",
  ".ll-ctip",
  ".ll-tip",
  ".ll-ch-cross",
  ".ll-topbar-r",
  ".ll-skel",
].join(",");

const STATIC_CSS = `
body { background: var(--bg); }
.ll-export { display: block; min-height: 100vh; padding: 8px; }
.ll-export > .ll-main { margin: 0 auto; width: var(--ll-export-width); max-width: 100%; min-height: 0; }
.ll-export .ll-topbar { position: static; backdrop-filter: none; -webkit-backdrop-filter: none; }
.ll-export .ll-ch-reveal, .ll-export .ll-ch-grow { animation: none !important; }
.ll-export button, .ll-export a { pointer-events: none; }
.ll-export-mast { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 32px; border-bottom: 1px solid var(--rule); font-size: 12.5px; color: var(--ink-muted); }
.ll-export-mast strong { color: var(--ink); font-weight: 600; }
.ll-export-foot { padding: 0 32px 28px; font-size: 12px; color: var(--ink-subtle); }
@media print { .ll-export { padding: 0; } .ll-export > .ll-main { border: 0; width: auto; } }
`;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function dataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Latin fonts only: the app's text never needs the Cyrillic or Vietnamese subsets. */
function wantedFont(rule: CSSFontFaceRule) {
  const range = rule.style.getPropertyValue("unicode-range");
  return !range || /U\+0+-0*FF\b/i.test(range) || /U\+0000-00FF/i.test(range);
}

/** Every same-origin stylesheet on the page, with its fonts inlined as data URLs. */
export async function collectCss(): Promise<string> {
  const parts: string[] = [];
  const fonts = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode as Element | null;
    if (owner?.hasAttribute?.("data-emotion")) continue; // Clerk's widgets aren't on exported pages
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin
    }
    const base = sheet.href ?? location.href;
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule && !wantedFont(rule)) continue;
      let text = rule.cssText;
      if (rule instanceof CSSFontFaceRule) {
        for (const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const abs = new URL(m[1], base).href;
          if (!fonts.has(abs)) fonts.set(abs, (await dataUrl(abs)) ?? abs);
          text = text.replace(m[0], `url("${fonts.get(abs)}")`);
        }
      }
      parts.push(text);
    }
  }
  return parts.join("\n");
}

export interface HtmlExport {
  filename: string;
  /** What the page is, e.g. "Profit and loss". */
  title: string;
  organisation?: string;
  /** e.g. "Actuals to September 2026". */
  basis?: string;
}

/** Build the HTML document for the page currently on screen. */
export async function pageHtml({ title, organisation, basis }: Omit<HtmlExport, "filename">): Promise<string> {
  const main = document.querySelector<HTMLElement>(".ll-main");
  if (!main) throw new Error("Nothing to export on this page.");
  const width = Math.round(main.getBoundingClientRect().width);
  const clone = main.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(SKIP).forEach((el) => el.remove());
  // Form controls keep what's on screen.
  const live = main.querySelectorAll<HTMLInputElement>("input");
  clone.querySelectorAll<HTMLInputElement>("input").forEach((input, i) => {
    const value = live[i]?.value;
    if (value !== undefined) input.setAttribute("value", value);
    input.setAttribute("disabled", "");
  });

  const now = new Date();
  const stamp = now.toLocaleString("en-IE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const mast = document.createElement("div");
  mast.className = "ll-export-mast";
  mast.innerHTML = `<span><strong>Ledgerline</strong>${organisation ? ` · ${escapeHtml(organisation)}` : ""}</span><span>${basis ? `${escapeHtml(basis)} · ` : ""}Exported ${escapeHtml(stamp)}</span>`;
  clone.prepend(mast);
  const foot = document.createElement("div");
  foot.className = "ll-export-foot";
  foot.textContent = "Figures are in euro. Charts are static copies of the app's interactive charts; open Ledgerline to drill into any figure.";
  clone.append(foot);

  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  const css = await collectCss();
  return `<!doctype html>
<html lang="en" class="${escapeHtml(root.className)}"${theme ? ` data-theme="${escapeHtml(theme)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Ledgerline">
<title>${escapeHtml(title)}${organisation ? ` · ${escapeHtml(organisation)}` : ""}</title>
<style>${css}</style>
<style>${STATIC_CSS}</style>
</head>
<body class="${escapeHtml(document.body.className)}">
<div class="ll-export" style="--ll-export-width: ${width}px">${clone.outerHTML}</div>
</body>
</html>
`;
}

export async function exportPageHtml(options: HtmlExport) {
  download(options.filename, await pageHtml(options), "text/html;charset=utf-8");
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Profit and loss", "Kestrel Joinery Ltd", "2026-09" → "kestrel-joinery-ltd-profit-and-loss-2026-09" */
export function exportName(title: string, organisation?: string, period?: string) {
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [organisation, title, period].filter(Boolean).map((s) => slug(s!)).join("-");
}
