import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { Toast } from './src/shared/components/Toast';
import { useSyncQueue } from './src/shared/hooks/useSyncQueue';

function SyncQueueProvider() {
  useSyncQueue();
  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" translucent={false} backgroundColor="#12121A" />
        <SyncQueueProvider />
        <AppNavigator />
        <Toast />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
