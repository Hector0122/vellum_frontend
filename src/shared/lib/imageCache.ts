import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

const CACHE_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/image_cache`;

async function ensureCacheDir(): Promise<void> {
  const exists = await ReactNativeBlobUtil.fs.isDir(CACHE_DIR);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);
  }
}

function sanitizeFileName(url: string): string {
  return url.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
}

export async function getCachedImageUri(uri: string): Promise<string | null> {
  const fileName = sanitizeFileName(uri);
  const filePath = `${CACHE_DIR}/${fileName}`;
  const exists = await ReactNativeBlobUtil.fs.exists(filePath);
  if (exists) {
    return Platform.OS === 'ios' ? filePath : `file://${filePath}`;
  }
  return null;
}

export async function cacheImage(uri: string): Promise<string> {
  await ensureCacheDir();
  const fileName = sanitizeFileName(uri);
  const filePath = `${CACHE_DIR}/${fileName}`;

  const exists = await ReactNativeBlobUtil.fs.exists(filePath);
  if (exists) {
    return Platform.OS === 'ios' ? filePath : `file://${filePath}`;
  }

  const res = await ReactNativeBlobUtil.config({
    path: filePath,
    fileCache: true,
  }).fetch('GET', uri);

  const localPath = Platform.OS === 'ios' ? res.path() : `file://${res.path()}`;
  return localPath;
}

export async function clearImageCache(): Promise<void> {
  const exists = await ReactNativeBlobUtil.fs.isDir(CACHE_DIR);
  if (exists) {
    await ReactNativeBlobUtil.fs.unlink(CACHE_DIR);
  }
}
