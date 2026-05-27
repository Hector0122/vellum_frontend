import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/shared/lib/api';

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const EPUB_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';

interface EpubReaderProps {
  bookId: string;
  initialCfi?: string | null;
  data?: string | null;
  highlights?: { location: string; color: string }[];
  fontSize?: number;
  fontFamily?: string;
  onProgress?: (percent: number, cfi: string) => void;
  onReady?: () => void;
  onError?: (msg: string) => void;
  onTapped?: () => void;
  onSelected?: (cfiRange: string, text: string) => void;
}

export function EpubReader({ bookId, initialCfi, data, highlights, fontSize = 1, fontFamily = 'system-ui', onProgress, onReady, onError, onTapped, onSelected }: EpubReaderProps) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    webviewRef.current?.injectJavaScript(
      `window.__setFont && window.__setFont(${fontSize}, ${JSON.stringify(fontFamily)}); true;`,
    );
  }, [fontSize, fontFamily]);

  useEffect(() => {
    if (highlights && highlights.length > 0) {
      const encoded = JSON.stringify(highlights);
      webviewRef.current?.injectJavaScript(`window.__applyHighlights && window.__applyHighlights(${encoded}); true;`);
    }
  }, [highlights]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_access_token');
        if (!token || cancelled) return;

        const proxyUrl = `${API_URL}/api/books/${bookId}/file?token=${token}`;

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <script src="${JSZIP_CDN}"></script>
  <script src="${EPUB_CDN}"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;overflow:hidden}
    #viewer{width:100%;height:100%}
    .hidden{display:none!important}
    .loader{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-family:sans-serif;font-size:14px;z-index:100}
  </style>
</head>
<body>
  <p class="loader" id="loader">Loading book...</p>
  <div id="viewer"></div>
  <script>
    var INITIAL_CFI = ${initialCfi ? JSON.stringify(initialCfi) : 'null'};
    var BOOK_DATA = ${data ? JSON.stringify(data) : 'null'};
    var FONT_SIZE = ${fontSize};
    var FONT_FAMILY = ${JSON.stringify(fontFamily)};
    (function(){
      var loader = document.getElementById('loader');

      function post(type, payload) {
        var obj = { type: type };
        if (payload) Object.assign(obj, payload);
        try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
      }

      function loadBook(buffer) {
        if (typeof ePub === 'undefined') {
          post('error', { msg: 'ePub not loaded' });
          return;
        }

        var book = ePub(buffer);
        window.__rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          manager: 'default',
        });

        window.__setFont = function(size, family) {
          var views = window.__rendition.getViews();
          views.forEach(function(view) {
            var doc = view.document;
            if (!doc) return;
            var style = doc.getElementById('__vellum_font');
            if (!style) {
              style = doc.createElement('style');
              style.id = '__vellum_font';
              doc.head.appendChild(style);
            }
            style.textContent = 'body { font-size: ' + (size * 100) + '% !important; font-family: ' + family + ' !important; }';
          });
        };

        window.__rendition.hooks.content.register(function(doc) {
          var style = doc.createElement('style');
          style.id = '__vellum_font';
          style.textContent = 'body { font-size: ' + (FONT_SIZE * 100) + '% !important; font-family: ' + FONT_FAMILY + ' !important; }';
          doc.head.appendChild(style);
        });

        book.ready.then(function(){
          loader.classList.add('hidden');
          post('ready', { totalChapters: book.spine.length });
        }, function(e){
          post('error', { msg: 'book.ready failed: ' + (e && e.message || e) });
        });

        window.__rendition.display(INITIAL_CFI || undefined).then(function(){
          window.__rendition.on('relocated', function(location){
            if (location && location.start) {
              post('location', {
                index: location.start.index,
                percentage: location.start.percentage,
                cfi: location.start.cfi,
              });
            }
          });

          window.__rendition.on('tapped', function(){
            post('tapped');
          });

          window.__rendition.on('selected', function(cfiRange, contents){
            var text = contents.window.getSelection().toString().trim();
            if (text) {
              post('selected', { cfiRange: cfiRange, text: text.substring(0, 500) });
            }
          });

          window.__applyHighlights = function(list) {
            var rendition = window.__rendition;
            if (!rendition || !list) return;
            list.forEach(function(h) {
              try {
                rendition.annotations.highlight(h.location, {}, function() {
                  var mark = rendition.annotations._marks.slice(-1)[0];
                  if (mark && mark.setStyle) {
                    mark.setStyle('fill', h.color || '#FFD700');
                  }
                });
              } catch(e) {}
            });
          };
        }, function(e){
          post('error', { msg: 'rendition.display failed: ' + (e && e.message || e) });
        });
      }

      if (BOOK_DATA) {
        try {
          var raw = atob(BOOK_DATA);
          var bytes = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          loadBook(bytes.buffer);
        } catch(e) {
          post('error', { msg: 'Failed to decode cached book: ' + (e && e.message || e) });
        }
      } else {
        fetch("${proxyUrl}")
          .then(function(r){
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.arrayBuffer();
          })
          .then(function(buffer){
            loadBook(buffer);
          })
          .catch(function(e){
            loader.textContent = 'Error: ' + (e && e.message ? e.message : String(e));
            post('error', { msg: e && e.message ? e.message : String(e) });
          });
      }
    })();
  </script>
</body>
</html>`;

        if (cancelled) return;
        setHtml(htmlContent);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleGesture = useCallback((event: any) => {
    const { translationX, translationY, state } = event.nativeEvent;
    if (state === GestureState.END) {
      if (Math.abs(translationX) > 60 && Math.abs(translationX) > Math.abs(translationY)) {
        const js = translationX > 0
          ? 'window.__rendition && window.__rendition.prev()'
          : 'window.__rendition && window.__rendition.next()';
        webviewRef.current?.injectJavaScript(js);
      }
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready' && !readyRef.current) {
        readyRef.current = true;
        onReady?.();
      } else if (msg.type === 'location') {
        onProgress?.(Math.round(msg.percentage), msg.cfi || '');
      } else if (msg.type === 'tapped') {
        onTapped?.();
      } else if (msg.type === 'selected') {
        onSelected?.(msg.cfiRange, msg.text);
      } else if (msg.type === 'error') {
        setError(msg.msg || 'Unknown WebView error');
        onError?.(msg.msg || 'Unknown WebView error');
      }
    } catch {}
  }, [onProgress, onReady, onError, onTapped, onSelected]);

  return (
    <View style={styles.container}>
      {!html && !error && (
        <View style={styles.center}>
          <ActivityIndicator color="#4A4AE9" size="large" />
          <Text style={styles.stepText}>Preparing reader...</Text>
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
      {html && (
        <PanGestureHandler
          onGestureEvent={handleGesture}
          onHandlerStateChange={handleGesture}
          activeOffsetX={[-20, 20]}
          failOffsetY={[-20, 20]}
        >
          <View style={styles.webview}>
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
        </PanGestureHandler>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121A' },
  webview: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepText: { color: '#B0B0CC', fontSize: 14 },
  errorText: { color: '#FF6B6B', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
