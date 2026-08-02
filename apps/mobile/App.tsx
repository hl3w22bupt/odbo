import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AntiAddictionModal } from './src/components/AntiAddictionModal';
import { LoadingView } from './src/components/LoadingView';
import { NavigationProvider, useNavigation } from './src/navigation/NavigationContext';
import { CharacterSelectScreen } from './src/screens/CharacterSelectScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MembersScreen } from './src/screens/MembersScreen';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import { SessionProvider, useSession } from './src/store/SessionContext';
import { ToastProvider } from './src/store/ToastContext';

/** 根据当前路由与登录态渲染对应页面 */
function RootGate() {
  const { isReady, isAuthenticated } = useAuth();
  const { current, reset } = useNavigation();
  const prevAuthRef = useRef(false);

  // 登录成功后回到首页，避免登出后重新登录停留在深层路由
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      reset('home', undefined);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, reset]);

  if (!isReady) return <LoadingView text="心伴AI 启动中…" />;
  if (!isAuthenticated) return <LoginScreen />;

  switch (current.name) {
    case 'login':
      return <LoginScreen />;
    case 'home':
      return <HomeScreen />;
    case 'characters':
      return <CharacterSelectScreen mode={current.params.mode} />;
    case 'chat':
      return (
        <ChatScreen
          mode={current.params.mode}
          conversationId={current.params.conversationId}
          characters={current.params.characters}
        />
      );
    case 'members':
      return <MembersScreen />;
    default:
      return <HomeScreen />;
  }
}

/** 全局合规浮层：防沉迷弹窗 */
function ComplianceOverlay() {
  const { antiAddictionBlocked, dismissAntiAddiction, status, compliance } = useSession();
  const reason = status?.antiAddiction.reason ?? compliance?.antiAddiction.blockReason ?? null;
  const message = status?.antiAddiction.message ?? compliance?.antiAddiction.blockMessage ?? null;
  return <AntiAddictionModal visible={antiAddictionBlocked} onClose={dismissAntiAddiction} reason={reason} message={message} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <SessionProvider>
            <NavigationProvider>
              <StatusBar style="auto" />
              <RootGate />
              <ComplianceOverlay />
            </NavigationProvider>
          </SessionProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
