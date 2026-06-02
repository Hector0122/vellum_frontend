import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
} from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/shared/lib/api';
import { colors } from '@/shared/theme/colors';

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const EPUB_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';

interface EpubReaderProps {
  bookId: string;
  initialCfi?: string | null;
  data?: string | null;
  highlights?: { location: string; color: string }[];
  fontSize?: number;
  fontFamily?: string;
  onProgress?: (
    percent: number,
    cfi: string,
    chapterPct: number,
    chapterIndex: number,
  ) => void;
  onReady?: (totalChapters: number) => void;
  onError?: (msg: string) => void;
  onTapped?: () => void;
  onSelected?: (cfiRange: string, text: string) => void;
  onToc?: (chapters: TocChapter[]) => void;
  onWordCount?: (words: number) => void;
  onChapterText?: (text: string) => void;
}

export interface EpubReaderHandle {
  goToChapter: (href: string) => void;
  goToCfi: (cfi: string) => void;
  getChapterText: () => void;
}

interface TocChapter {
  label: string;
  href: string;
  depth: number;
}

export const EpubReader = React.forwardRef<EpubReaderHandle, EpubReaderProps>(
  function EpubReader(
    {
      bookId,
      initialCfi,
      data,
      highlights,
      fontSize = 1,
      fontFamily = 'system-ui',
      onProgress,
      onReady,
      onError,
      onTapped,
      onSelected,
      onToc,
      onWordCount,
      onChapterText,
    }: EpubReaderProps,
    ref,
  ) {
    const webviewRef = useRef<WebView>(null);
    const readyRef = useRef(false);
    const [html, setHtml] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      goToChapter: (href: string) => {
        const js = `
try {
  if (typeof window.__goToChapter === 'function') {
    window.__goToChapter(${JSON.stringify(href)});
  } else {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug',msg:'__goToChapter not defined'}));
  }
} catch(e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug',msg:'goToChapter error: '+e.message}));
}
true;`;
        webviewRef.current?.injectJavaScript(js);
      },
      goToCfi: (cfi: string) => {
        webviewRef.current?.injectJavaScript(
          `window.__rendition && window.__rendition.display(${JSON.stringify(
            cfi,
          )}); true;`,
        );
      },
      getChapterText: () => {
        webviewRef.current?.injectJavaScript(
          `try{var f=document.querySelector('iframe');var t=f&&f.contentDocument?f.contentDocument.body.textContent||'':'';window.ReactNativeWebView.postMessage(JSON.stringify({type:'chapterText',text:t.slice(0,15000)}))}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'chapterText',text:''}))};true;`,
        );
      },
    }), []);

    useEffect(() => {
      webviewRef.current?.injectJavaScript(
        `window.__setFont ? window.__setFont(${fontSize}, ${JSON.stringify(
          fontFamily,
        )}) : false; true;`,
      );
  }, [fontSize, fontFamily]);

  useEffect(() => {
      if (highlights && highlights.length > 0) {
        const encoded = JSON.stringify(highlights);
        webviewRef.current?.injectJavaScript(
          `window.__applyHighlights && window.__applyHighlights(${encoded}); true;`,
        );
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
    html,body{height:100%;overflow:hidden;background:#F5ECD7}
    #viewer{width:100%;height:100%;position:relative;will-change:transform,opacity}
    #viewer.flip-out-fwd{animation:flipOutFwd 0.15s cubic-bezier(0.4,0,0.2,1) forwards}
    #viewer.flip-in-fwd{animation:flipInFwd 0.25s cubic-bezier(0.2,0.9,0.3,1.1) forwards}
    #viewer.flip-out-bwd{animation:flipOutBwd 0.15s cubic-bezier(0.4,0,0.2,1) forwards}
    #viewer.flip-in-bwd{animation:flipInBwd 0.25s cubic-bezier(0.2,0.9,0.3,1.1) forwards}
    @keyframes flipOutFwd{0%{opacity:1;transform:translateX(0) scale(1)}100%{opacity:0.3;transform:translateX(-12%) scale(0.96)}}
    @keyframes flipInFwd{0%{opacity:0.4;transform:translateX(14%) scale(0.97)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes flipOutBwd{0%{opacity:1;transform:translateX(0) scale(1)}100%{opacity:0.3;transform:translateX(12%) scale(0.96)}}
    @keyframes flipInBwd{0%{opacity:0.4;transform:translateX(-14%) scale(0.97)}100%{opacity:1;transform:translateX(0) scale(1)}}
    .hidden{display:none!important}
    .tap-hint{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(0,0,0,0.25);font-family:sans-serif;font-size:12px;z-index:100;animation:fadeHint 4s forwards}
    @keyframes fadeHint{0%,60%{opacity:1}100%{opacity:0}}
    .loader{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#999;font-family:sans-serif;font-size:14px;z-index:100}
  </style>
</head>
<body>
  <p class="loader" id="loader">Loading book...</p>
  <div id="viewer"></div>
  <p class="tap-hint" id="tapHint">Tap for options</p>
  <script>
    var INITIAL_CFI = ${initialCfi ? JSON.stringify(initialCfi) : 'null'};
    var BOOK_DATA = ${data ? JSON.stringify(data) : 'null'};
    var FONT_SIZE = ${fontSize};
    var FONT_FAMILY = ${JSON.stringify(fontFamily)};
    (function(){
      var loader = document.getElementById('loader');
      var tapHint = document.getElementById('tapHint');

      if (tapHint) {
        setTimeout(function() { if (tapHint) tapHint.remove(); }, 4000);
      }

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
          var allIframes = document.querySelectorAll('iframe');
          for (var i = 0; i < allIframes.length; i++) {
            try {
              var doc = allIframes[i].contentDocument || allIframes[i].contentWindow.document;
              if (!doc) continue;
              var style = doc.getElementById('__vellum_font');
              if (!style) {
                style = doc.createElement('style');
                style.id = '__vellum_font';
                doc.head.appendChild(style);
              }
              style.textContent = 'body { font-size: ' + (size * 100) + '% !important; font-family: ' + family + ' !important; }';
            } catch(e) {}
          }
        };

        window.__playPageFlipSound = function() {
          try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var sampleRate = ctx.sampleRate;

            function makeNoiseBuffer(dur, freq, vol) {
              var len = sampleRate * dur;
              var buf = ctx.createBuffer(1, len, sampleRate);
              var d = buf.getChannelData(0);
              var pnoise = 0;
              for (var i = 0; i < len; i++) {
                var t = i / sampleRate;
                pnoise += (Math.random() * 2 - 1 - pnoise) * 0.02;
                var env = Math.exp(-t * 25) - Math.exp(-t * 120);
                d[i] = pnoise * env * vol;
              }
              return buf;
            }

            // Layer 1: paper rustle (mid-freq filtered noise)
            var buf1 = makeNoiseBuffer(0.12, 2000, 0.15);
            var src1 = ctx.createBufferSource();
            src1.buffer = buf1;
            var f1 = ctx.createBiquadFilter();
            f1.type = 'bandpass';
            f1.frequency.value = 1800;
            f1.Q.value = 1.5;
            src1.connect(f1);
            f1.connect(ctx.destination);

            // Layer 2: soft thump (low freq)
            var buf2 = ctx.createBuffer(1, sampleRate * 0.04, sampleRate);
            var d2 = buf2.getChannelData(0);
            for (var i = 0; i < buf2.length; i++) {
              var t = i / sampleRate;
              d2[i] = Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 60) * 0.1;
            }
            var src2 = ctx.createBufferSource();
            src2.buffer = buf2;
            src2.connect(ctx.destination);

            src1.start();
            src2.start();
            setTimeout(function() { ctx.close(); }, 200);
          } catch(e) {}
        };

        window.__pageFlip = function(direction) {
          if (!window.__rendition) return;
          var viewer = document.getElementById('viewer');
          var outClass = direction > 0 ? 'flip-out-fwd' : 'flip-out-bwd';
          var inClass = direction > 0 ? 'flip-in-fwd' : 'flip-in-bwd';
          if (viewer) viewer.className = outClass;
          setTimeout(function() {
            window.__playPageFlipSound();
            var nav = direction > 0 ? window.__rendition.next() : window.__rendition.prev();
            nav.then(function() {
              if (viewer) {
                viewer.className = inClass;
                setTimeout(function() { if (viewer) viewer.className = ''; }, 300);
              }
            }).catch(function() {
              if (viewer) viewer.className = '';
            });
          }, 120);
        };

        window.__rendition.hooks.content.register(function(doc) {
          var style = doc.createElement('style');
          style.id = '__vellum_font';
          style.textContent = 'body { font-size: ' + (FONT_SIZE * 100) + '% !important; font-family: ' + FONT_FAMILY + ' !important; }';
          doc.head.appendChild(style);

          doc.addEventListener('click', function(e) {
            var sel = doc.defaultView && doc.defaultView.getSelection();
            if (!sel || sel.toString().trim() === '') {
              try { window.parent.ReactNativeWebView.postMessage(JSON.stringify({type: 'tapped'})); } catch(ex) {}
            }
          });

          try {
            var words = doc.body.textContent.trim().split(/\s+/).length;
            window.__chapterWords = words;
            post('wordcount', { words: words });
          } catch(ex) {}
        });

        var totalChapters = 0;

        function extractToc(items, depth) {
          if (depth === undefined) depth = 0;
          var result = [];
          for (var i = 0; i < items.length; i++) {
            var label = items[i].label || '';
            label = label.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            if (!label) label = 'Chapter';
            result.push({ label: label, href: items[i].href, depth: depth });
            if (items[i].subitems && items[i].subitems.length) {
              result = result.concat(extractToc(items[i].subitems, depth + 1));
            }
          }
          return result;
        }

        book.ready.then(function(){
          totalChapters = book.spine.length;
          loader.classList.add('hidden');
          post('ready', { totalChapters: totalChapters });
            try {
              var toc = book.navigation && book.navigation.toc;
              if (toc && toc.length) {
                var flat = extractToc(toc);
                console.log('[TOC] extracted:', JSON.stringify(flat).slice(0, 500));
                post('toc', { chapters: flat });
              }
            } catch(e) {}
        }).catch(function(e){
          post('error', { msg: 'book.ready failed: ' + (e && e.message || e) });
        });

        window.__goToChapter = function(href) {
          if (window.__rendition && window.__rendition.book) {
            var spine = window.__rendition.book.spine;
            var len = spine.length;
            for (var i = 0; i < len; i++) {
              var item = spine.get ? spine.get(i) : spine[i];
              if (!item) continue;
              var sHref = item.href;
              if (sHref === href || sHref.endsWith(href) || href.endsWith(sHref)) {
                window.__rendition.display(i);
                return;
              }
            }
            post('debug', { msg: 'goToChapter: no match for ' + href });
          }
        };

        window.__rendition.display(INITIAL_CFI || undefined).then(function(){
          window.__rendition.on('relocated', function(location){
            if (location && location.start) {
              var overallPct = totalChapters > 0
                ? (location.start.index + location.start.percentage) / totalChapters
                : 0;
              post('location', {
                index: location.start.index,
                percentage: overallPct,
                chapterPct: location.start.percentage,
                cfi: location.start.cfi,
              });

              try {
                var iframe = document.querySelector('iframe');
                if (iframe && iframe.contentDocument) {
                  var text = iframe.contentDocument.body.textContent || '';
                  var words = text.trim().split(/\\s+/).filter(function(w) { return w.length > 0; }).length;
                  if (words > 0) {
                    post('wordcount', { words: words });
                  }
                }
              } catch(ex) {}
            }
          });

          window.__rendition.on('tapped', function(){
            post('tapped');
          });

          window.__rendition.on('selected', function(cfiRange, contents){
            try {
              var text = contents.window.getSelection().toString().trim();
              if (text && text.length >= 9) {
                post('selected', { cfiRange: cfiRange, text: text.substring(0, 500) });
              }
            } catch(e) {
              post('error', { msg: 'selected handler: ' + (e && e.message || e) });
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
        }).catch(function(e){
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

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookId]);

    const panGesture = useMemo(
      () =>
        Gesture.Pan()
          .runOnJS(true)
          .activeOffsetX([-20, 20])
          .failOffsetY([-20, 20])
          .onEnd(event => {
            if (Math.abs(event.translationX) > 60) {
              const js =
                event.translationX > 0
                  ? 'window.__pageFlip ? window.__pageFlip(-1) : (window.__rendition ? window.__rendition.prev().catch(function(){}) : false); true;'
                  : 'window.__pageFlip ? window.__pageFlip(1) : (window.__rendition ? window.__rendition.next().catch(function(){}) : false); true;';
              webviewRef.current?.injectJavaScript(js);
            }
          }),
      [],
    );

    const doubleTapGesture = useMemo(
      () =>
        Gesture.Tap()
          .numberOfTaps(2)
          .runOnJS(true)
          .onEnd(() => {
            onTapped?.();
          }),
      [onTapped],
    );

    // Combine pan and double-tap gestures - they should be able to run simultaneously
    // Pan for page swiping, double-tap for opening overlay
    const composedGesture = useMemo(
      () => Gesture.Simultaneous(panGesture, doubleTapGesture),
      [panGesture, doubleTapGesture],
    );

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === 'ready' && !readyRef.current) {
            readyRef.current = true;
            onReady?.(msg.totalChapters ?? 0);
            webviewRef.current?.injectJavaScript(
              `setTimeout(function(){try{var f=document.querySelector('iframe');if(f&&f.contentDocument){var t=f.contentDocument.body.textContent||'';var w=t.trim().split(/\\s+/).filter(function(x){return x.length>0}).length;if(w>0){window.ReactNativeWebView.postMessage(JSON.stringify({type:'wordcount',words:w}))}}}catch(e){};true;},300);`,
            );
          } else if (msg.type === 'location') {
            if (__DEV__)
              console.log(
                '[EpubReader] location msg:',
                msg.percentage,
                msg.cfi,
              );
            const pct = Math.round(msg.percentage * 100);
            onProgress?.(
              pct,
              msg.cfi || '',
              msg.chapterPct ?? 0,
              msg.index ?? 0,
            );
          } else if (msg.type === 'tapped') {
            onTapped?.();
          } else if (msg.type === 'toc') {
            if (__DEV__)
              console.log(
                '[EpubReader] toc:',
                msg.chapters?.length,
                'chapters',
              );
            onToc?.(msg.chapters);
          } else if (msg.type === 'debug') {
            if (__DEV__) console.log('[WebView]', msg.msg);
          } else if (msg.type === 'selected') {
            onSelected?.(msg.cfiRange, msg.text);
          } else if (msg.type === 'wordcount') {
            onWordCount?.(msg.words);
          } else if (msg.type === 'chapterText') {
            onChapterText?.(msg.text || '');
          } else if (msg.type === 'error') {
            setError(msg.msg || 'Unknown WebView error');
            onError?.(msg.msg || 'Unknown WebView error');
          }
        } catch (err: any) {
          if (__DEV__) {
            console.warn(
              '[EpubReader] Failed to parse message:',
              err,
              event.nativeEvent.data,
            );
          }
        }
      },
      [
        onProgress,
        onReady,
        onError,
        onTapped,
        onSelected,
        onToc,
        onWordCount,
        onChapterText,
      ],
    );

    return (
      <View style={styles.container}>
        {!html && !error && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.stepText}>Preparing reader...</Text>
          </View>
        )}
        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}
        {html && (
          <GestureDetector gesture={composedGesture}>
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
          </GestureDetector>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  webview: { flex: 1, backgroundColor: '#F5ECD7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepText: { color: colors.textSecondary, fontSize: 14 },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
