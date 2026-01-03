import { useState, useEffect, useRef } from 'react';
import type { Phrase } from '../services/phrases';
import { showCustomAlert } from './CustomAlert';
import '../styles/Modal.css';

interface PhraseModalProps {
  mode?: 'add' | 'edit';
  phrase: Phrase | null;
  onSave: (data: Partial<Phrase>) => void;
  onClose: () => void;
  onBellAdd?: () => void;
  onBellRemoveAll?: () => void;
}

function PhraseModal({ mode = 'edit', phrase, onSave, onClose, onBellAdd, onBellRemoveAll }: PhraseModalProps) {
  const [text, setText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [color, setColor] = useState('#000000');
  // phrase prop이 같은 uid로 갱신될 때(예: 벨 등록/목록 리프레시) 입력 중인 값이 덮어써지는 버그 방지
  const lastPhraseKeyRef = useRef<string | null>(null);
  // 기본 문구("crcv.assist" 벨코드) 확인
  const defaultBellCode = "crcv.assist";
  const isDefaultPhrase = phrase?.bellCodes?.some(code => 
    code?.toLowerCase().trim() === defaultBellCode
  );

  useEffect(() => {
    if (phrase) {
      const phraseKey = String((phrase as any).uid ?? (phrase as any).id ?? '');
      // uid/id가 바뀔 때만 초기화 (같은 문구를 편집하는 동안에는 사용자 입력 유지)
      if (lastPhraseKeyRef.current !== phraseKey) {
        lastPhraseKeyRef.current = phraseKey;
        setText(phrase.text || '');
        setIsEnabled(phrase.isEnabled ?? true);
        // #bd5ac4 색상 삭제: 해당 색상이면 기본값으로 변경
        const phraseColor = phrase.color || '#000000';
        setColor(phraseColor.toLowerCase() === '#bd5ac4' ? '#000000' : phraseColor);
      }
    }
  }, [phrase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      await showCustomAlert('문구를 입력해주세요.');
      return;
    }
    // #bd5ac4 색상 삭제: 저장 시 해당 색상이면 기본값으로 변경
    const finalColor = color.toLowerCase() === '#bd5ac4' ? '#000000' : color;
    
    // 기본 문구인 경우 벨 코드는 원래대로 유지, 그 외에는 기존 벨 코드 유지
    const finalBellCodes = phrase?.bellCodes || [];
    
    onSave({
      text: text.trim(),
      isEnabled,
      color: finalColor,
      bellCodes: finalBellCodes
    });
  };

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 드래그 시작 위치 저장
    if (e.target === e.currentTarget) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 오버레이 자체를 클릭했을 때만 닫기 (모달 컨텐츠 클릭/드래그는 무시)
    if (e.target === e.currentTarget && dragStartRef.current) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartRef.current.x, 2) + 
        Math.pow(e.clientY - dragStartRef.current.y, 2)
      );
      // 드래그 거리가 5px 미만일 때만 클릭으로 간주하고 닫기
      if (dragDistance < 5) {
        onClose();
      }
      dragStartRef.current = null;
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'add' ? '문구 추가' : '문구 수정'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>문구</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="알림 문구를 입력하세요"
              required
            />
          </div>

          <div className="form-group form-group-row">
            <div className="form-group-item">
              <label>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                활성화
              </label>
            </div>
            <div className="form-group-item">
              <label>색상</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>등록된 벨</label>
            <div className="bell-codes-info">
              {phrase?.bellCodes && phrase.bellCodes.length > 0 ? (
                <div className="bell-codes-list" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px' }}>벨 {phrase.bellCodes.length}개</span>
                  {onBellRemoveAll && !isDefaultPhrase && (
                    <button
                      type="button"
                      onClick={onBellRemoveAll}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ color: '#8E8E93', fontSize: '12px' }}>등록된 벨이 없습니다.</div>
              )}
              {isDefaultPhrase && (
                <div style={{ marginTop: '8px', color: '#8E8E93', fontSize: '12px' }}>
                  기본 문구의 벨은 벨 등록 버튼으로만 추가할 수 있습니다.
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            {onBellAdd && !isDefaultPhrase && (
              <button 
                type="button" 
                className="bell-add-button"
                onClick={onBellAdd}
              >
                벨 등록
              </button>
            )}
            <button type="button" className="cancel-button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="save-button">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PhraseModal;

