/**
 * Minimal ZIP writer (STORE method — no compression). MP4 is already
 * compressed, so storing adds zero processing time while bundling all clips
 * into a single download. No dependencies.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { date: number; time: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function createZip(entries: ZipEntry[]): Blob {
  const now = dosDateTime(new Date());
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);   // local file header signature
    local.setUint16(4, 20, true);            // version needed
    local.setUint16(6, 0x0800, true);        // flags: UTF-8 names
    local.setUint16(8, 0, true);             // method: store
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);         // compressed size (= size, stored)
    local.setUint32(22, size, true);         // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);            // extra length

    const localHeader = new Uint8Array(local.buffer);
    parts.push(localHeader, nameBytes, entry.data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);      // central dir signature
    cen.setUint16(4, 20, true);              // version made by
    cen.setUint16(6, 20, true);              // version needed
    cen.setUint16(8, 0x0800, true);          // flags
    cen.setUint16(10, 0, true);              // method
    cen.setUint16(12, now.time, true);
    cen.setUint16(14, now.date, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, offset, true);         // local header offset
    central.push(new Uint8Array(cen.buffer), nameBytes);

    offset += localHeader.length + nameBytes.length + size;
  }

  const centralSize = central.reduce((s, p) => s + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);       // end of central dir signature
  eocd.setUint16(8, entries.length, true);   // entries on this disk
  eocd.setUint16(10, entries.length, true);  // total entries
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);          // central dir offset

  return new Blob([...parts, ...central, new Uint8Array(eocd.buffer)], {
    type: 'application/zip',
  });
}
