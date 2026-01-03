import { useState, useEffect } from 'react';
import NotificationView from './components/NotificationView';
import SettingsView from './components/SettingsView';
import { CustomAlertProvider, showCustomAlert } from './components/CustomAlert';
import { CustomConfirmProvider } from './components/CustomConfirm';
import { getApiBaseUrl } from './services/api';
import './App.css';

type ViewType = 'notification' | 'settings';

function App() {
  // URL 파라미터에서 view 확인
  const getInitialView = (): ViewType => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    return viewParam === 'settings' ? 'settings' : 'notification';
  };

  const [currentView, setCurrentView] = useState<ViewType>(getInitialView());

  // URL 변경 함수
  const navigateToView = async (view: ViewType) => {
    const url = new URL(window.location.href);
    if (view === 'settings') {
      url.searchParams.set('view', 'settings');
    } else {
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
    setCurrentView(view);
    
    // 백엔드에 현재 뷰 상태 전달
    try {
      const apiUrl = await getApiBaseUrl();
      await fetch(`${apiUrl}/api/window/set-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ view }),
      });
    } catch (error) {
      console.error('뷰 상태 업데이트 실패:', error);
    }
  };

  useEffect(() => {
    // URL 파라미터 변경 감지
    const handlePopState = async () => {
      const view = getInitialView();
      setCurrentView(view);
      // 백엔드에 현재 뷰 상태 전달
      try {
        const apiUrl = await getApiBaseUrl();
        await fetch(`${apiUrl}/api/window/set-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ view }),
        });
      } catch (error) {
        console.error('뷰 상태 업데이트 실패:', error);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  useEffect(() => {
    // 초기 뷰 상태를 백엔드에 전달
    const setInitialView = async () => {
      const view = getInitialView();
      try {
        const apiUrl = await getApiBaseUrl();
        await fetch(`${apiUrl}/api/window/set-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ view }),
        });
      } catch (error) {
        console.error('초기 뷰 상태 업데이트 실패:', error);
      }
    };
    setInitialView();
  }, []);


  useEffect(() => {
    // window.alert를 커스텀 alert로 오버라이드
    const originalAlert = window.alert;
    (window as any).alert = (message: string) => {
      showCustomAlert(String(message));
    };

    return () => {
      // 컴포넌트 언마운트 시 원래 alert 복원
      window.alert = originalAlert;
    };
  }, []);

  return (
    <div className="app-container">
      <CustomAlertProvider />
      <CustomConfirmProvider />
      {currentView === 'notification' && <NotificationView onNavigateToSettings={() => navigateToView('settings')} />}
      {currentView === 'settings' && <SettingsView onNavigateBack={() => navigateToView('notification')} />}
    </div>
  );
}

export default App;
