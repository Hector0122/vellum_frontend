import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { getCachedImageUri, cacheImage } from '@/shared/lib/imageCache';

interface CachedImageProps {
  uri: string;
  style?: any;
}

function CachedImageInner({ uri, style }: CachedImageProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cached = await getCachedImageUri(uri);
      if (cached && mounted) {
        setLocalUri(cached);
        return;
      }
      try {
        const path = await cacheImage(uri);
        if (mounted) setLocalUri(path);
      } catch {
        if (mounted) setLocalUri(uri);
      }
    })();

    return () => { mounted = false; };
  }, [uri]);

  return (
    <Image
      source={{ uri: localUri || uri, cache: 'force-cache' }}
      style={style}
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
