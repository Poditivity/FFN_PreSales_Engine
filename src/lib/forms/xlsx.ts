// Minimal, dependency-free .xlsx (SpreadsheetML) writer.
//
// An xlsx file is a ZIP of XML parts. We only need a small slice of the spec —
// multiple sheets, a styled frozen header row, column widths, autofilter and
// text/number cells — so instead of pulling in a ~1MB spreadsheet library we
// emit the parts directly and store them in an uncompressed ZIP.
//
// Public API:
//   buildXlsx([{ name, columns, rows }]) -> Blob
//   downloadBlob(blob, filename)
//
// A column is { header, width?, style? } and a row is an array of values.
// Values may be a primitive (string/number/null) or { v, style } to override
// the column style for one cell. See STYLE for the available style keys.

// ---- Style ids, matching the cellXfs order in styles.xml below -------------
export const STYLE = {
  DEFAULT: 0,
  HEADER: 1,
  WRAP: 2,
  NUMBER: 3,
  PERCENT: 4,
  BOLD: 5,
  MUTED: 6,
  TITLE: 7,
} as const;

export interface XlsxColumn {
  header: string;
  width?: number;
  style?: number;
}

export type CellValue = string | number | null | undefined;
/** A primitive, or `{ v, style }` to override the column style for one cell. */
export type XlsxCell = CellValue | { v: CellValue; style?: number };
export type XlsxRow = XlsxCell[];

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxRow[];
}

// ---- XML helpers -----------------------------------------------------------

// Characters below 0x20 (other than tab/LF/CR) are illegal in XML 1.0 and make
// Excel refuse to open the file, so they are dropped rather than escaped.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function esc(value: unknown): string {
  return String(value)
    .replace(CONTROL_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 0 -> A, 25 -> Z, 26 -> AA ...
export function colName(index: number): string {
  let n = index;
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

// Excel rejects these characters in a sheet name and caps it at 31 chars.
function safeSheetName(name: string | undefined, fallback: string): string {
  const cleaned = String(name || fallback).replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || fallback).slice(0, 31);
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// ---- Sheet part ------------------------------------------------------------

function cellXml(ref: string, value: CellValue, style: number): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") {
    return style ? `<c r="${ref}"${s}/>` : "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  // Inline strings keep every sheet self-contained (no sharedStrings part).
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml({ columns, rows }: { columns: XlsxColumn[]; rows: XlsxRow[] }): string {
  const cols = columns
    .map((c, i) => {
      const width = c.width || 16;
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const headerCells = columns
    .map((c, i) => cellXml(`${colName(i)}1`, c.header ?? "", STYLE.HEADER))
    .join("");

  const bodyRows = rows
    .map((row, r) => {
      const rowNum = r + 2;
      const cells = columns
        .map((col, i) => {
          const raw = row[i];
          const isWrapped = raw !== null && typeof raw === "object";
          const value = isWrapped ? raw.v : raw;
          const style = isWrapped && raw.style !== undefined ? raw.style : col.style || STYLE.DEFAULT;
          return cellXml(`${colName(i)}${rowNum}`, value, style);
        })
        .join("");
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join("");

  const lastCol = colName(Math.max(columns.length - 1, 0));
  const lastRow = rows.length + 1;
  const dimension = `<dimension ref="A1:${lastCol}${lastRow}"/>`;
  // Freeze the header row so it stays visible while scrolling a long list.
  const view =
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    "</sheetView></sheetViews>";
  const autoFilter = rows.length ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : "";

  return (
    `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    dimension +
    view +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1" ht="24" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>` +
    autoFilter +
    "</worksheet>"
  );
}

// ---- Static parts ----------------------------------------------------------

const STYLES_XML =
  `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="0.0%"/>' +
  '<numFmt numFmtId="165" formatCode="0.##"/>' +
  "</numFmts>" +
  '<fonts count="5">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><sz val="11"/><color rgb="FF6B6B73"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F2430"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="2">' +
  "<border><left/><right/><top/><bottom/><diagonal/></border>" +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>' +
  "</borders>" +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="8">' +
  // 0 DEFAULT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top"/></xf>' +
  // 1 HEADER
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
  '<alignment vertical="center" wrapText="1"/></xf>' +
  // 2 WRAP
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
  '<alignment vertical="top" wrapText="1"/></xf>' +
  // 3 NUMBER
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1">' +
  '<alignment vertical="top" horizontal="right"/></xf>' +
  // 4 PERCENT
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1">' +
  '<alignment vertical="top" horizontal="right"/></xf>' +
  // 5 BOLD
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1">' +
  '<alignment vertical="top"/></xf>' +
  // 6 MUTED
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1">' +
  '<alignment vertical="top"/></xf>' +
  // 7 TITLE
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const ROOT_RELS =
  `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return (
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>"
  );
}

function workbookXml(names: string[]): string {
  const sheets = names
    .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  return (
    `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets}</sheets></workbook>`
  );
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join("");
  return (
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    rels +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

// ---- ZIP (store, no compression) -------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// MS-DOS packed date/time, as required by the ZIP local/central headers.
function dosDateTime(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

function zipStore(files: { name: string; data: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.data);
    return { nameBytes, dataBytes, crc: crc32(dataBytes) };
  });

  const LOCAL_HEADER = 30;
  const CENTRAL_HEADER = 46;
  const EOCD = 22;

  let localSize = 0;
  let centralSize = 0;
  entries.forEach((e) => {
    localSize += LOCAL_HEADER + e.nameBytes.length + e.dataBytes.length;
    centralSize += CENTRAL_HEADER + e.nameBytes.length;
  });

  const buffer = new Uint8Array(localSize + centralSize + EOCD);
  const view = new DataView(buffer.buffer);
  let offset = 0;
  const offsets: number[] = [];

  entries.forEach((e) => {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // version needed
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 filenames
    view.setUint16(offset + 8, 0, true); // stored
    view.setUint16(offset + 10, time, true);
    view.setUint16(offset + 12, date, true);
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.dataBytes.length, true);
    view.setUint32(offset + 22, e.dataBytes.length, true);
    view.setUint16(offset + 26, e.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // no extra field
    offset += LOCAL_HEADER;
    buffer.set(e.nameBytes, offset);
    offset += e.nameBytes.length;
    buffer.set(e.dataBytes, offset);
    offset += e.dataBytes.length;
  });

  const centralStart = offset;
  entries.forEach((e, i) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // version made by
    view.setUint16(offset + 6, 20, true); // version needed
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, time, true);
    view.setUint16(offset + 14, date, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.dataBytes.length, true);
    view.setUint32(offset + 24, e.dataBytes.length, true);
    view.setUint16(offset + 28, e.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // extra
    view.setUint16(offset + 32, 0, true); // comment
    view.setUint16(offset + 34, 0, true); // disk
    view.setUint16(offset + 36, 0, true); // internal attrs
    view.setUint32(offset + 38, 0, true); // external attrs
    view.setUint32(offset + 42, offsets[i], true);
    offset += CENTRAL_HEADER;
    buffer.set(e.nameBytes, offset);
    offset += e.nameBytes.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return buffer;
}

// ---- Public API ------------------------------------------------------------

/**
 */
export function buildXlsx(sheets: XlsxSheet[]): Blob {
  const list: XlsxSheet[] = sheets.length ? sheets : [{ name: "Sheet1", columns: [], rows: [] }];
  // Excel refuses to open a workbook with duplicate sheet names.
  const used = new Set();
  const names = list.map((s, i) => {
    let name = safeSheetName(s.name, `Sheet${i + 1}`);
    let n = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` ${n++}`;
      name = name.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });

  const files = [
    { name: "[Content_Types].xml", data: contentTypesXml(list.length) },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: workbookXml(names) },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(list.length) },
    { name: "xl/styles.xml", data: STYLES_XML },
    ...list.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: sheetXml({ columns: s.columns || [], rows: s.rows || [] }),
    })),
  ];

  return new Blob([zipStore(files) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
