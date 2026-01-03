import { useState, useEffect } from 'react';
import { getPhrases, createPhrase, updatePhrase, deletePhrase } from '../services/phrases';
import type { Phrase } from '../services/phrases';
import { getApiBaseUrl } from '../services/api';
import { showCustomAlert } from './CustomAlert';
import { showCustomConfirm } from './CustomConfirm';
import PhraseModal from './PhraseModal';
import SerialPortModal from './SerialPortModal';
import BellAddModal from './BellAddModal';
import '../styles/SettingsView.css';

interface SettingsViewProps {
  onNavigateBack: () => void;
}

function SettingsView({ onNavigateBack }: SettingsViewProps) {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
  const [phraseModalMode, setPhraseModalMode] = useState<'add' | 'edit'>('edit');
  const [isSerialPortModalOpen, setIsSerialPortModalOpen] = useState(false);
  const [isBellAddModalOpen, setIsBellAddModalOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentPhraseForBell, setCurrentPhraseForBell] = useState<Phrase | null>(null);

  useEffect(() => {
    loadPhrases();
    loadTTSEnabled();
  }, []);

  const loadTTSEnabled = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/tts/enabled`);
      if (response.ok) {
        const data = await response.json();
        setTtsEnabled(data.enabled ?? true);
      }
    } catch (error) {
      console.error('TTS 설정 로드 실패:', error);
    }
  };

  const handleToggleTTS = async () => {
    try {
      const apiUrl = await getApiBaseUrl();
      const newValue = !ttsEnabled;
      const response = await fetch(`${apiUrl}/api/tts/enabled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newValue),
      });
      if (response.ok) {
        setTtsEnabled(newValue);
      }
    } catch (error) {
      console.error('TTS 설정 변경 실패:', error);
    }
  };

  const loadPhrases = async () => {
    try {
      const data = await getPhrases();
      setPhrases(data.Phrases || []);
    } catch (error) {
      console.error('문구 로드 실패:', error);
    }
  };

  const handleAddPhrase = async () => {
    try {
      // uid를 먼저 생성(서버)하고, 문구는 빈칸으로 시작
      const created = await createPhrase({
        text: '',
        isEnabled: true,
        color: '#000000',
        bellCodes: []
      });

      // 생성된 uid로 바로 모달을 열어 벨등록 가능하게 함
      setSelectedPhrase(created);
      setPhraseModalMode('add');
      setIsPhraseModalOpen(true);

      // 목록에도 즉시 반영
      await loadPhrases();
    } catch (error) {
      console.error('문구(빈칸) 생성 실패:', error);
      await showCustomAlert('문구 추가에 실패했습니다.');
    }
  };

  const handleEditPhrase = (phrase: Phrase) => {
    setSelectedPhrase(phrase);
    setPhraseModalMode('edit');
    setIsPhraseModalOpen(true);
  };

  const handleDeletePhrase = async (uid: string) => {
    const phrase = phrases.find(p => p.uid === uid);
    
    // 기본 문구("crcv.assist" 벨코드)는 삭제 불가
    const defaultBellCode = "crcv.assist";
    const isDefaultPhrase = phrase?.bellCodes?.some(code => 
      code?.toLowerCase().trim() === defaultBellCode
    );
    
    if (isDefaultPhrase) {
      await showCustomAlert('불가능 합니다.');
      return;
    }
    
    const confirmed = await showCustomConfirm('이 문구를 삭제하시겠습니까?');
    if (confirmed) {
      try {
        await deletePhrase(uid);
        await loadPhrases();
      } catch (error: any) {
        console.error('문구 삭제 실패:', error);
        // 백엔드에서도 체크하므로 에러 메시지 표시
        const errorMessage = error?.response?.data?.error || '문구 삭제에 실패했습니다.';
        await showCustomAlert(errorMessage);
      }
    }
  };

  const handlePhraseSave = async (phraseData: Partial<Phrase>) => {
    try {
      // 최신 데이터 가져오기
      const allPhrases = await getPhrases();
      const currentPhrase = selectedPhrase 
        ? allPhrases.Phrases.find(p => p.uid === selectedPhrase.uid)
        : null;

      // 벨 코드는 최신 데이터 사용 (벨 등록 모달에서 추가된 벨 코드 반영)
      const phraseDataToSave = {
        ...phraseData,
        bellCodes: currentPhrase?.bellCodes || phraseData.bellCodes || []
      };

      if (selectedPhrase) {
        await updatePhrase(selectedPhrase.uid, phraseDataToSave);
      } else {
        await createPhrase(phraseDataToSave);
      }
      setIsPhraseModalOpen(false);
      setSelectedPhrase(null);
      await loadPhrases();
    } catch (error) {
      console.error('문구 저장 실패:', error);
      await showCustomAlert('문구 저장에 실패했습니다.');
    }
  };

  const handleBellAdd = async (bellCode: string) => {
    if (!currentPhraseForBell) return;
    
    const normalizedBellCode = bellCode.toLowerCase().trim();
    const defaultBellCode = "crcv.assist";
    const defaultUid = "90000001";
    
    // 기본 벨 코드는 기본 문구에만 할당 가능
    if (normalizedBellCode === defaultBellCode && currentPhraseForBell.uid !== defaultUid) {
      await showCustomAlert('기본 벨 코드(crcv.assist)는 기본 문구에만 할당할 수 있습니다.');
      return;
    }
    
    const allPhrases = await getPhrases();
    const currentPhrase = allPhrases.Phrases.find(p => p.uid === currentPhraseForBell.uid);
    
    if (!currentPhrase) {
      console.error('현재 문구를 찾을 수 없습니다.');
      return;
    }
    
    // 다른 문구에서 동일한 벨 코드 제거 (기본 벨 코드는 제외)
    const otherPhrases = allPhrases.Phrases.filter(p => p.uid !== currentPhrase.uid);
    for (const phrase of otherPhrases) {
      if (phrase.bellCodes?.some(c => c?.toLowerCase().trim() === normalizedBellCode)) {
        await updatePhrase(phrase.uid, {
          ...phrase,
          bellCodes: phrase.bellCodes.filter(c => c?.toLowerCase().trim() !== normalizedBellCode)
        });
      }
    }

    // 현재 문구에 벨 코드 추가
    const currentBellCodes = currentPhrase.bellCodes || [];
    if (!currentBellCodes.some(c => c?.toLowerCase().trim() === normalizedBellCode)) {
      await updatePhrase(currentPhrase.uid, {
        ...currentPhrase,
        bellCodes: [...currentBellCodes, normalizedBellCode]
      });
      
      // JSON에서 최신 데이터 다시 읽어서 갱신
      await loadPhrases();
      const updatedPhrases = await getPhrases();
      const updatedPhrase = updatedPhrases.Phrases.find(p => p.uid === currentPhrase.uid);
      
      if (updatedPhrase) {
        // 벨 등록 모달용 상태 업데이트
        setCurrentPhraseForBell(updatedPhrase);
        
        // 문구 수정 모달이 열려있으면 selectedPhrase도 업데이트하여 벨 개수 즉시 반영
        if (selectedPhrase && selectedPhrase.uid === updatedPhrase.uid) {
          setSelectedPhrase(updatedPhrase);
        }
      }
    }
  };

  const handleBellAddClick = (phrase: Phrase) => {
    setCurrentPhraseForBell(phrase);
    setIsBellAddModalOpen(true);
  };

  const handleBellRemoveAll = async () => {
    if (!selectedPhrase) return;
    
    const confirmed = await showCustomConfirm('등록된 모든 벨을 삭제하시겠습니까?');
    if (confirmed) {
      try {
        const allPhrases = await getPhrases();
        const currentPhrase = allPhrases.Phrases.find(p => p.uid === selectedPhrase.uid);
        if (!currentPhrase) {
          console.error('현재 문구를 찾을 수 없습니다.');
          return;
        }

        await updatePhrase(currentPhrase.uid, {
          text: currentPhrase.text,
          isEnabled: currentPhrase.isEnabled,
          color: currentPhrase.color,
          bellCodes: []
        });
        
        await loadPhrases();
        
        // 모달의 선택된 문구도 업데이트
        const updatedPhrases = await getPhrases();
        const updatedPhrase = updatedPhrases.Phrases.find(p => p.uid === selectedPhrase.uid);
        if (updatedPhrase) {
          setSelectedPhrase(updatedPhrase);
        }
      } catch (error) {
        console.error('벨 코드 전체 삭제 실패:', error);
        await showCustomAlert('벨 코드 전체 삭제에 실패했습니다.');
      }
    }
  };

  const handleNotificationTest = async (phrase: Phrase) => {
    try {
      const apiUrl = await getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // uid 기반 테스트 (벨 등록 전이어도 테스트 가능)
        body: JSON.stringify({ uid: phrase.uid }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        await showCustomAlert(`알림 테스트 실패: ${errorData.error || '알 수 없는 오류'}`);
        return;
      }
      
      // 알림 테스트 성공 시 알림 페이지로 전환 (뒤로가기처럼)
      onNavigateBack();
    } catch (error: any) {
      console.error('알림 테스트 실패:', error);
      await showCustomAlert(`알림 테스트 실패: ${error.message}`);
    }
  };

  const handleClose = async () => {
    // 창 닫기 API 호출
    try {
      const apiUrl = await getApiBaseUrl();
      await fetch(`${apiUrl}/api/window/hide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('창 닫기 실패:', error);
    }
  };

  const handleTTSTestClick = async (phrase: Phrase) => {
    if (!phrase.text?.trim()) {
      await showCustomAlert('테스트할 문구가 없습니다.');
      return;
    }

    try {
      const apiUrl = await getApiBaseUrl();
      // TTS 활성화 상태 확인
      const ttsResponse = await fetch(`${apiUrl}/api/tts/enabled`);
      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        if (!ttsData.enabled) {
          await showCustomAlert('TTS가 비활성화되어 있습니다.');
          return;
        }
      }

      // TTS 재생
      const response = await fetch(`${apiUrl}/api/tts/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: phrase.text }),
      });

      if (!response.ok) {
        throw new Error('TTS 재생 실패');
      }
    } catch (error) {
      console.error('TTS 테스트 실패:', error);
      await showCustomAlert('TTS 재생에 실패했습니다.');
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <button className="back-button" onClick={onNavigateBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>기능 설정</h1>
        <div className="header-actions">
          <button 
            className="serial-port-button"
            onClick={() => setIsSerialPortModalOpen(true)}
            title="시리얼 포트 설정"
          >
            시리얼포트 설정
          </button>
          <label className="tts-toggle-label">
            <span>TTS</span>
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={handleToggleTTS}
              className="tts-toggle-switch"
            />
          </label>
          <button 
            className="close-button"
            onClick={handleClose}
            title="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="section-header">
            <h2>문구 관리</h2>
            <button className="add-button" onClick={handleAddPhrase}>
              + 문구 추가
            </button>
          </div>

          <div className="phrases-list">
            {phrases.length === 0 ? (
              <div className="empty-state">
                <p>등록된 문구가 없습니다.</p>
                <button className="add-button" onClick={handleAddPhrase}>
                  첫 문구 추가하기
                </button>
              </div>
            ) : (
              phrases.map((phrase) => (
                <div key={phrase.uid || phrase.id} className="phrase-item">
                  <div className="phrase-content">
                    <div className="phrase-text">{phrase.text}</div>
                    <div className="phrase-meta">
                      <span className={`phrase-status ${phrase.isEnabled ? 'enabled' : 'disabled'}`}>
                        {phrase.isEnabled ? '활성' : '비활성'}
                      </span>
                      <span className="phrase-bell-codes">
                        벨 {phrase.bellCodes?.length || 0}개
                      </span>
                    </div>
                  </div>
                  <div className="phrase-actions">
                    {(() => {
                      const defaultBellCode = "crcv.assist";
                      const isDefaultPhrase = phrase.bellCodes?.some(code => 
                        code?.toLowerCase().trim() === defaultBellCode
                      );
                      
                      if (!isDefaultPhrase) {
                        // 기본 문구가 아닌 경우에만 벨 등록 버튼 표시
                        return (
                          <button 
                            className="bell-add-button"
                            onClick={() => handleBellAddClick(phrase)}
                            title="벨 등록"
                          >
                            벨 등록
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button 
                      className="notification-test-button"
                      onClick={() => handleNotificationTest(phrase)}
                      title="알림 테스트"
                    >
                      알림테스트
                    </button>
                    <button 
                      className="tts-test-button"
                      onClick={() => handleTTSTestClick(phrase)}
                      title="TTS 테스트"
                    >
                      TTS테스트
                    </button>
                    <button 
                      className="edit-button"
                      onClick={() => handleEditPhrase(phrase)}
                    >
                      수정
                    </button>
                    {(() => {
                      const defaultBellCode = "crcv.assist";
                      const isDefaultPhrase = phrase.bellCodes?.some(code => 
                        code?.toLowerCase().trim() === defaultBellCode
                      );
                      
                      if (isDefaultPhrase) {
                        // 기본 문구는 삭제 버튼만 숨김
                        return null;
                      }
                      
                      return (
                        <button 
                          className="delete-button"
                          onClick={() => handleDeletePhrase(phrase.uid)}
                        >
                          삭제
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isPhraseModalOpen && (
        <PhraseModal
          mode={phraseModalMode}
          phrase={selectedPhrase}
          onSave={handlePhraseSave}
          onClose={() => {
            setIsPhraseModalOpen(false);
            setSelectedPhrase(null);
            setPhraseModalMode('edit');
          }}
          onBellAdd={() => {
            if (selectedPhrase) {
              handleBellAddClick(selectedPhrase);
            }
          }}
          onBellRemoveAll={handleBellRemoveAll}
        />
      )}

      {isSerialPortModalOpen && (
        <SerialPortModal
          onClose={() => setIsSerialPortModalOpen(false)}
        />
      )}

      {isBellAddModalOpen && currentPhraseForBell && (
        <BellAddModal
          onAdd={(bellCode) => {
            handleBellAdd(bellCode);
          }}
          onClose={async () => {
            setIsBellAddModalOpen(false);
            setCurrentPhraseForBell(null);
            // 벨 등록 모달 닫을 때 문구 목록 갱신
            await loadPhrases();
          }}
        />
      )}


    </div>
  );
}

export default SettingsView;

