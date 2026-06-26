/**
 * OPFS (Origin Private File System) service.
 * Handles reading and writing of large media files (multi-GB videos)
 * without loading them into memory.
 */

export interface OPFSFileEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

const OPENCLIP_DIR = 'openclip-files';

async function getRootDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPENCLIP_DIR, { create: true });
}

/**
 * Browser-imposed OPFS quota was hit. Caller can show a clean UI banner
 * instead of digging through a raw DOMException.
 */
export class OpfsQuotaError extends Error {
  /** Size of the file we tried to write, in bytes. */
  readonly tryingToWrite: number;
  /** Bytes currently used by the origin (best-effort). */
  readonly used: number;
  /** Bytes quota for the origin (best-effort, may be 0 if unknown). */
  readonly quota: number;
  constructor(tryingToWrite: number, used: number, quota: number) {
    super('OPFS storage quota exceeded');
    this.name = 'OpfsQuotaError';
    this.tryingToWrite = tryingToWrite;
    this.used = used;
    this.quota = quota;
  }
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  // Different browsers throw different shapes; cover them all.
  if (e.name === 'QuotaExceededError') return true;
  if (e.code === 22) return true; // legacy DOMException QUOTA_EXCEEDED_ERR
  return !!e.message && /quota/i.test(e.message);
}

/**
 * Ask the browser to mark this origin as persistent so its OPFS data isn't
 * evicted when disk gets tight. Safe to call multiple times; idempotent.
 * Returns true if persistent storage is now granted.
 */
export async function opfsRequestPersistent(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Write a File or Blob to OPFS under a given ID.
 * Uses chunked writes so progress can be reported for large files. Quota
 * failures are surfaced as OpfsQuotaError so callers can show actionable UI.
 */
export async function opfsWriteFile(
  id: string,
  file: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const dir = await getRootDir();
  const fileHandle = await dir.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();

  const CHUNK = 64 * 1024 * 1024; // 64 MB chunks
  let offset = 0;
  const total = file.size;

  try {
    while (offset < total) {
      const end = Math.min(offset + CHUNK, total);
      const chunk = file.slice(offset, end);
      const buf = await chunk.arrayBuffer();
      await writable.write({ type: 'write', position: offset, data: buf });
      offset = end;
      if (onProgress) onProgress(Math.round((offset / total) * 100));
    }
    await writable.close();
  } catch (err) {
    // Clean up the partial file so it doesn't sit there eating space.
    try { await writable.abort(); } catch { /* already closed */ }
    try { await dir.removeEntry(id); } catch { /* ignore */ }

    if (isQuotaError(err)) {
      let used = 0, quota = 0;
      try {
        const est = await navigator.storage?.estimate?.();
        used = est?.usage ?? 0;
        quota = est?.quota ?? 0;
      } catch { /* best-effort */ }
      throw new OpfsQuotaError(total, used, quota);
    }
    throw err;
  }
}

/**
 * Read a file from OPFS by ID. Returns a File object.
 */
export async function opfsReadFile(id: string): Promise<File> {
  const dir = await getRootDir();
  const fileHandle = await dir.getFileHandle(id);
  return fileHandle.getFile();
}

/**
 * Check if a file exists in OPFS.
 */
export async function opfsFileExists(id: string): Promise<boolean> {
  try {
    const dir = await getRootDir();
    await dir.getFileHandle(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in OPFS.
 */
export async function opfsGetFileSize(id: string): Promise<number> {
  try {
    const file = await opfsReadFile(id);
    return file.size;
  } catch {
    return 0;
  }
}

/**
 * Create a revocable blob: URL from an OPFS file.
 * The caller is responsible for calling URL.revokeObjectURL() when done.
 */
export async function opfsGetBlobUrl(id: string): Promise<string> {
  const file = await opfsReadFile(id);
  return URL.createObjectURL(file);
}

/**
 * Write raw bytes (Uint8Array or ArrayBuffer) to OPFS.
 */
export async function opfsWriteBytes(id: string, data: Uint8Array | ArrayBuffer): Promise<void> {
  const dir = await getRootDir();
  const fileHandle = await dir.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

/**
 * Read raw bytes from OPFS.
 */
export async function opfsReadBytes(id: string): Promise<Uint8Array> {
  const file = await opfsReadFile(id);
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Delete a file from OPFS.
 */
export async function opfsDeleteFile(id: string): Promise<void> {
  try {
    const dir = await getRootDir();
    await dir.removeEntry(id);
  } catch {
    // File didn't exist — ignore
  }
}

/**
 * Delete multiple files from OPFS.
 */
export async function opfsDeleteFiles(ids: string[]): Promise<void> {
  await Promise.all(ids.map(opfsDeleteFile));
}

/**
 * List all files stored in OPFS for OpenClip.
 */
export async function opfsListFiles(): Promise<OPFSFileEntry[]> {
  const dir = await getRootDir();
  const entries: OPFSFileEntry[] = [];
  for await (const [name, handle] of (dir as any).entries()) {
    if (handle.kind === 'file') {
      try {
        const file = await handle.getFile();
        entries.push({
          id: name,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        });
      } catch {
        // Skip inaccessible entries
      }
    }
  }
  return entries;
}

/**
 * Get approximate OPFS storage usage in bytes.
 */
export async function opfsGetStorageUsage(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return { used: 0, quota: 0 };
}

/**
 * Check if OPFS is supported in this browser.
 */
export function isOPFSSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'getDirectory' in navigator.storage
  );
}
