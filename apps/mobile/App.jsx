import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const appUrl = process.env.EXPO_PUBLIC_BASE_URL || '';
function validUrl(value) { try { return new URL(value).protocol === 'https:'; } catch { return false; } }

export default function App() {
  const web = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      web.current?.goBack(); return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const configured = validUrl(appUrl);
  const origin = configured ? new URL(appUrl).origin : '';
  return <SafeAreaProvider><SafeAreaView style={styles.root} edges={['top', 'bottom']}><StatusBar style="dark" />
    {!configured || error ? <View style={styles.center}><View style={styles.mark}><Text style={styles.markText}>T</Text></View><Text style={styles.title}>{configured ? 'A little pause in the connection.' : 'Your world is almost ready.'}</Text><Text style={styles.description}>{configured ? 'Check your internet connection and try again.' : 'Set EXPO_PUBLIC_BASE_URL to your deployed HTTPS Texa web URL, then rebuild this app.'}</Text>{configured && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setError(false); setLoading(true); web.current?.reload(); }}><Text style={styles.buttonText}>Reconnect</Text></TouchableOpacity>}</View> : <>
      <WebView ref={web} source={{ uri: appUrl }} style={styles.web} originWhitelist={['https://*']} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled={false} mixedContentMode="never" allowsBackForwardNavigationGestures onNavigationStateChange={state => setCanGoBack(state.canGoBack)} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={() => { setError(true); setLoading(false); }} onHttpError={event => { if (event.nativeEvent.statusCode >= 500) { setError(true); setLoading(false); } }} onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank') return true;
        try { const target = new URL(request.url); if (target.origin === origin) return true; if (['https:', 'mailto:', 'tel:'].includes(target.protocol)) Linking.openURL(request.url).catch(() => {}); } catch { /* reject malformed navigation */ }
        return false;
      }} />
      {loading && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color="#7655d9" size="large" /></View>}
    </>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#f8f9fb' }, web: { flex: 1, backgroundColor: '#f8f9fb' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }, mark: { backgroundColor: '#7655d9', width: 70, height: 70, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }, markText: { color: 'white', fontSize: 42, fontWeight: '800' }, title: { fontSize: 24, color: '#665176', textAlign: 'center', marginBottom: 15 }, description: { color: '#a18caf', fontSize: 14, lineHeight: 24, textAlign: 'center' }, button: { backgroundColor: '#7655d9', borderRadius: 9, paddingHorizontal: 24, paddingVertical: 14, marginTop: 25 }, buttonText: { color: '#fff', fontWeight: '600' }, loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8f9fb', justifyContent: 'center', alignItems: 'center' } });
