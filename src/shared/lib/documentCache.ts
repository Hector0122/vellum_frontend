import ReactNativeBlobUtil from 'react-native-blob-util';
import { API_URL, getToken } from './api';

/**
 * Local file cache for non-EPUB documents (PDF, Markdown). Deliberately a
 * sibling of epubCache.ts rather than a generalization of it — see
 * design.md's "keep the EPUB path completely unchanged" goal in
 * openspec/changes/add-multi-format-documents. Same on-disk strategy
 * (Documents/<kind>_cache/<bookId>.<ext>), parameterized by file extension
 * instead of hardcoding `.epub`.
 */

const CACHE_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/document_cache`;

export type CacheableFileType = 'pdf' | 'md';

function cachePath(bookId: string, fileType: CacheableFileType): string {
  return `${CACHE_DIR}/${bookId}.${fileType}`;
}

export async function isDocumentCached(
  bookId: string,
  fileType: CacheableFileType,
): Promise<boolean> {
  try {
    return await ReactNativeBlobUtil.fs.exists(cachePath(bookId, fileType));
  } catch {
    return false;
  }
}

export async function getCachedDocumentPath(
  bookId: string,
  fileType: CacheableFileType,
): Promise<string | null> {
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cachePath(bookId, fileType));
    if (!exists) return null;
    return cachePath(bookId, fileType);
  } catch {
    return null;
  }
}

export async function downloadAndCacheDocument(
  bookId: string,
  fileType: CacheableFileType,
): Promise<string> {
  const token = await getToken();
  const url = `${API_URL}/api/books/${bookId}/file?token=${token}`;
  const path = cachePath(bookId, fileType);

  try {
    await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);
  } catch {}

  const res = await ReactNativeBlobUtil.config({ path }).fetch('GET', url, {
    Authorization: `Bearer ${token}`,
  });

  const status = res.respInfo?.status ?? 0;
  if (status >= 200 && status < 300) {
    return path;
  }

  throw new Error(`Download failed with status ${status}`);
}

export async function removeCachedDocument(
  bookId: string,
  fileType: CacheableFileType,
): Promise<void> {
  try {
    await ReactNativeBlobUtil.fs.unlink(cachePath(bookId, fileType));
  } catch {}
}

/** Reads a cached Markdown file's text content (Markdown is rendered from
 * text, not a native view given a file URI, unlike PDF/EPUB). */
export async function readCachedMarkdown(bookId: string): Promise<string | null> {
  try {
    const path = cachePath(bookId, 'md');
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (!exists) return null;
    return await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}
