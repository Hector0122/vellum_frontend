import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const EPUB_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';

interface EpubReaderProps {
  fileUrl: string;
  onProgress?: (percent: number) => void;
  onReady?: () => void;
}

export function EpubReader({ fileUrl, onProgress, onReady }: EpubReaderProps) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready' && !readyRef.current) {
        readyRef.current = true;
        onReady?.();
      } else if (data.type === 'location') {
        onProgress?.(Math.round(data.percentage));
      }
    } catch {}
  }, [onProgress, onReady]);

  useEffect(() => {
    return () => {
      if (webviewRef.current) {
        try {
          webviewRef.current.postMessage('close');
        } catch {}
      }
    };
  }, []);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="${EPUB_CDN}"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#12121A;overflow:hidden}
    #viewer{width:100vw;height:100vh}
    .hidden{display:none!important}
    .loader{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#666680;font-family:sans-serif;font-size:14px}
  </style>
</head>
<body>
  <p class="loader" id="loader">Loading book...</p>
  <div id="viewer"></div>
  <script>
    (function(){
      var viewer = document.getElementById('viewer');
      var loader = document.getElementById('loader');

      try {
        var book = ePub("${fileUrl}");
        var rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100vh',
          spread: 'none',
          flow: 'paginated',
          manager: 'continuous',
        });

        book.ready.then(function(){
          loader.classList.add('hidden');
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ready',
              totalChapters: book.spine.length,
            }));
          } catch(e){}
        });

        rendition.display().then(function(){
          rendition.on('relocated', function(location){
            if (location && location.start) {
              try {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'location',
                  index: location.start.index,
                  percentage: location.start.percentage,
                  cfi: location.start.cfi,
                }));
              } catch(e){}
            }
          });

          rendition.on('tapped', function(){
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tapped' }));
            } catch(e){}
          });
        });
      } catch(e) {
        loader.textContent = 'Failed to load book';
      }
    })();
  </script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121A' },
  webview: { flex: 1, backgroundColor: '#12121A' },
});
