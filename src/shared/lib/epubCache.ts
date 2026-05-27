import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

const CACHE_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/epub_cache`;

function cachePath(bookId: string) {
  return `${CACHE_DIR}/${bookId}.epub`;
}

export async function isEpubCached(bookId: string): Promise<boolean> {
  try {
    return await ReactNativeBlobUtil.fs.exists(cachePath(bookId));
  } catch {
    return false;
  }
}

export async function getCachedEpubBase64(bookId: string): Promise<string | null> {
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(cachePath(bookId));
    if (!exists) return null;
    return await ReactNativeBlobUtil.fs.readFile(cachePath(bookId), 'base64');
  } catch {
    return null;
  }
}

export async function downloadAndCache(bookId: string): Promise<string> {
  const token = await AsyncStorage.getItem('auth_access_token');
  const url = `${API_URL}/api/books/${bookId}/file?token=${token}`;

  await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);

  await ReactNativeBlobUtil.config({
    path: cachePath(bookId),
  }).fetch('GET', url, {
    Authorization: `Bearer ${token}`,
  });

  const base64 = await ReactNativeBlobUtil.fs.readFile(cachePath(bookId), 'base64');
  return base64;
}

export async function removeCachedEpub(bookId: string) {
  try {
    await ReactNativeBlobUtil.fs.unlink(cachePath(bookId));
  } catch {}
}
