/**
 * excel-generator.ts — Generates eBay Bulk Upload Excel template
 *
 * Creates a .xlsx-compatible file using the OOXML format (no external deps).
 * The output matches eBay's official "eBay-prefill-listing-template" format:
 *   Column A: Custom Label (SKU) — ASIN
 *   Column B: Item Photo URL
 *   Column C: Title
 *   Column D: Product ID (ASIN)
 *   Column E: Product ID Type ("ASIN")
 *
 * Upload to: https://www.ebay.com/sh/reports/uploads
 */

export interface BulkUploadRow {
  asin: string;
  title?: string;
  imageUrl?: string;
  price?: number;
}

/**
 * Escape a string for XML/CSV use inside an Excel cell
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate the shared strings XML part
 */
function buildSharedStrings(strings: string[]): string {
  const items = strings
    .map(s => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${items}
</sst>`;
}

/**
 * Build a cell reference like A1, B2, etc.
 */
function cellRef(col: number, row: number): string {
  const colLetter = String.fromCharCode(64 + col); // 1=A, 2=B, etc.
  return `${colLetter}${row}`;
}

/**
 * Build a shared-string cell (type="s")
 */
function sCell(ref: string, idx: number): string {
  return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
}

/**
 * Build the worksheet XML
 */
function buildWorksheet(rows: BulkUploadRow[], ssMap: Map<string, number>): string {
  const dataRows: string[] = [];

  // Header row (row 1) — matches eBay template format
  const headers = [
    '#INFO',
    'Version=1.0.0',
    '',
    'Template=eBay-taxonomy-mapping-template_US',
    '',
  ];
  const infoRow = headers.map((h, i) => {
    const ref = cellRef(i + 1, 1);
    const idx = ssMap.get(h) ?? 0;
    return sCell(ref, idx);
  }).join('');
  dataRows.push(`<row r="1">${infoRow}</row>`);

  // Column header row (row 2)
  const colHeaders = [
    'Custom Label (SKU)',
    'Item Photo URL',
    'Title',
    'Product ID',
    'Product ID Type',
  ];
  const headerRow = colHeaders.map((h, i) => {
    const ref = cellRef(i + 1, 2);
    const idx = ssMap.get(h) ?? 0;
    return sCell(ref, idx);
  }).join('');
  dataRows.push(`<row r="2">${headerRow}</row>`);

  // Data rows starting at row 3
  rows.forEach((row, rowIdx) => {
    const r = rowIdx + 3;
    const cells: string[] = [];

    // A: Custom Label (ASIN as SKU)
    const asinIdx = ssMap.get(row.asin) ?? 0;
    cells.push(sCell(cellRef(1, r), asinIdx));

    // B: Item Photo URL
    const imgUrl = row.imageUrl || '';
    const imgIdx = ssMap.get(imgUrl) ?? 0;
    cells.push(sCell(cellRef(2, r), imgIdx));

    // C: Title
    const title = row.title || '';
    const titleIdx = ssMap.get(title) ?? 0;
    cells.push(sCell(cellRef(3, r), titleIdx));

    // D: Product ID (ASIN)
    const asinIdIdx = ssMap.get(row.asin) ?? 0;
    cells.push(sCell(cellRef(4, r), asinIdIdx));

    // E: Product ID Type
    const typeIdx = ssMap.get('ASIN') ?? 0;
    cells.push(sCell(cellRef(5, r), typeIdx));

    dataRows.push(`<row r="${r}">${cells.join('')}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    ${dataRows.join('\n    ')}
  </sheetData>
</worksheet>`;
}

/**
 * Minimal ZIP implementation for XLSX (OOXML is a ZIP archive)
 * Uses the ZIP local file header format.
 */

function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function uint16LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function uint32LE(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** Simple CRC32 */
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  offset: number;
}

function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const entries: ZipEntry[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = strToBytes(file.name);
    const data = strToBytes(file.content);
    const crc = crc32(data);
    const size = data.length;

    // Local file header
    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      uint16LE(20),       // version needed
      uint16LE(0),        // flags
      uint16LE(0),        // compression (stored)
      uint16LE(0),        // mod time
      uint16LE(0),        // mod date
      uint32LE(crc),      // crc32
      uint32LE(size),     // compressed size
      uint32LE(size),     // uncompressed size
      uint16LE(nameBytes.length),
      uint16LE(0),        // extra field length
      nameBytes,
      data
    );

    entries.push({ name: file.name, data, offset });
    parts.push(localHeader);
    offset += localHeader.length;
  }

  // Central directory
  const centralParts: Uint8Array[] = [];
  for (const entry of entries) {
    const nameBytes = strToBytes(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    centralParts.push(concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      uint16LE(20),       // version made by
      uint16LE(20),       // version needed
      uint16LE(0),        // flags
      uint16LE(0),        // compression
      uint16LE(0),        // mod time
      uint16LE(0),        // mod date
      uint32LE(crc),
      uint32LE(size),
      uint32LE(size),
      uint16LE(nameBytes.length),
      uint16LE(0),        // extra
      uint16LE(0),        // comment
      uint16LE(0),        // disk start
      uint16LE(0),        // internal attr
      uint32LE(0),        // external attr
      uint32LE(entry.offset),
      nameBytes
    ));
  }

  const centralDir = concat(...centralParts);
  const centralDirSize = centralDir.length;
  const centralDirOffset = offset;

  // End of central directory
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    uint16LE(0),          // disk number
    uint16LE(0),          // disk with central dir
    uint16LE(entries.length),
    uint16LE(entries.length),
    uint32LE(centralDirSize),
    uint32LE(centralDirOffset),
    uint16LE(0)           // comment length
  );

  return concat(...parts, centralDir, eocd);
}

/**
 * Generate an eBay bulk upload Excel (.xlsx) file from a list of ASINs.
 * Returns a Blob that can be downloaded by the user.
 */
export function generateBulkUploadXlsx(rows: BulkUploadRow[]): Blob {
  // Collect all unique strings for the shared strings table
  const allStrings: string[] = [
    '#INFO',
    'Version=1.0.0',
    '',
    'Template=eBay-taxonomy-mapping-template_US',
    'Custom Label (SKU)',
    'Item Photo URL',
    'Title',
    'Product ID',
    'Product ID Type',
    'ASIN',
  ];

  // Add row data strings
  for (const row of rows) {
    if (!allStrings.includes(row.asin)) allStrings.push(row.asin);
    if (row.title && !allStrings.includes(row.title)) allStrings.push(row.title);
    if (row.imageUrl && !allStrings.includes(row.imageUrl)) allStrings.push(row.imageUrl);
  }

  // Build shared strings map
  const ssMap = new Map<string, number>();
  allStrings.forEach((s, i) => ssMap.set(s, i));

  // Build XML parts
  const sharedStringsXml = buildSharedStrings(allStrings);
  const worksheetXml = buildWorksheet(rows, ssMap);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="eBay-prefill-listing-template" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  // Build ZIP
  const zipBytes = buildZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/sharedStrings.xml', content: sharedStringsXml },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml },
  ]);

  return new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Trigger a browser download of the generated Excel file
 */
export function downloadBulkUploadTemplate(rows: BulkUploadRow[], filename?: string): void {
  const blob = generateBulkUploadXlsx(rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `syndrax-bulk-upload-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
