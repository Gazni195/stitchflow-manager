// Report output: print, PDF, Excel and CSV.
//
// Every action renders from the same `columns` + `rows` pair the on-screen
// table uses, so what you see is exactly what you export. PDF reuses the
// browser's print pipeline ("Save as PDF") rather than pulling in a PDF
// engine that would have to run in the Worker runtime.
import type { ReportColumn, ReportRow } from "./definitions";

function cell(row: ReportRow, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/* --------------------------------- CSV -------------------------------- */

export function toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(cell(r, c.key))).join(","));
  return [head, ...body].join("\r\n");
}

export function exportCsv(title: string, columns: ReportColumn[], rows: ReportRow[]) {
  download(
    new Blob(["\uFEFF" + toCsv(columns, rows)], { type: "text/csv;charset=utf-8;" }),
    `${slugify(title)}-${stamp()}.csv`,
  );
}

/* -------------------------------- Excel ------------------------------- */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Excel-readable HTML workbook (.xls). Keeps the export dependency-free and
 * opens natively in Excel, Numbers and Google Sheets.
 */
export function exportExcel(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  subtitle?: string,
) {
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body>
<table border="1">
<thead>
<tr><th colspan="${columns.length}" style="font-size:14pt;text-align:left">${escapeHtml(title)}</th></tr>
${subtitle ? `<tr><td colspan="${columns.length}">${escapeHtml(subtitle)}</td></tr>` : ""}
<tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>
</thead>
<tbody>
${rows
  .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(cell(r, c.key))}</td>`).join("")}</tr>`)
  .join("\n")}
</tbody></table></body></html>`;
  download(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `${slugify(title)}-${stamp()}.xls`,
  );
}

/* --------------------------- Print / Export PDF ------------------------ */

function printableDocument(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  subtitle?: string,
): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f1a2e;margin:28px}
  h1{font-size:20px;margin:0 0 4px}
  p.meta{margin:0 0 18px;color:#6b6580;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #e3e0ec;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f4f1fb;color:#4c1d95;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:10px}
  tr:nth-child(even) td{background:#fbfaff}
  td.num,th.num{text-align:right}
  footer{margin-top:16px;color:#8b85a1;font-size:10px}
  @page{margin:14mm}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(subtitle ?? "")}${subtitle ? " · " : ""}${rows.length} row${rows.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleString()}</p>
<table>
<thead><tr>${columns
    .map((c) => `<th class="${c.align === "right" ? "num" : ""}">${escapeHtml(c.label)}</th>`)
    .join("")}</tr></thead>
<tbody>
${rows
  .map(
    (r) =>
      `<tr>${columns
        .map((c) => `<td class="${c.align === "right" ? "num" : ""}">${escapeHtml(cell(r, c.key))}</td>`)
        .join("")}</tr>`,
  )
  .join("\n")}
</tbody></table>
<footer>StitchFlow Manager — Fawri Lifestyle</footer>
</body></html>`;
}

function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new document a tick to lay out before the print dialog opens.
  setTimeout(() => win.print(), 250);
  return true;
}

/** Print the report (the same dialog also offers "Save as PDF"). */
export function printReport(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  subtitle?: string,
): boolean {
  return openPrintWindow(printableDocument(title, columns, rows, subtitle));
}

/** Export as PDF via the browser's print-to-PDF destination. */
export function exportPdf(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  subtitle?: string,
): boolean {
  return printReport(title, columns, rows, subtitle);
}
