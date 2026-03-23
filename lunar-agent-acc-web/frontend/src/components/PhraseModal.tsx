import { useState, useEffect, useRef } from 'react';
import type { Phrase, CallBellMaker } from '../services/phrases';
import { getCallBellMakers } from '../services/phrases';
import { showCustomAlert } from './CustomAlert';
import { getApiBaseUrl } from '../services/api';
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
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(10);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [makers, setMakers] = useState<CallBellMaker[]>([]);
  const [makerId, setMakerId] = useState<string>('');
  const [modelId, setModelId] = useState<string>('');
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
        setAutoCloseEnabled(Boolean((phrase as any).autoCloseEnabled));
        setAutoCloseSeconds(Number((phrase as any).autoCloseSeconds ?? 10));
        setImageUrl(String((phrase as any).imageUrl ?? ''));
        setMakerId(String((phrase as any).makerId ?? ''));
        setModelId(String((phrase as any).modelId ?? ''));
      }
    }
  }, [phrase]);

  useEffect(() => {
    getCallBellMakers().then(setMakers).catch(() => setMakers([]));
  }, []);

  const currentModels = makerId ? (makers.find((m) => m.id === makerId)?.models ?? []) : [];

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
      bellCodes: finalBellCodes,
      autoCloseEnabled,
      autoCloseSeconds: Math.max(1, Math.min(3600, Number(autoCloseSeconds) || 10)),
      imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
      makerId: makerId.trim() || null,
      modelId: modelId.trim() || null,
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
      <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
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

          <div className="form-group form-group-row">
            <div className="form-group-item">
              <label>
                <input
                  type="checkbox"
                  checked={autoCloseEnabled}
                  onChange={(e) => setAutoCloseEnabled(e.target.checked)}
                />
                자동 꺼짐
              </label>
            </div>
            <div className="form-group-item">
              <label>자동 꺼짐(초)</label>
              <input
                type="number"
                min={1}
                max={3600}
                value={autoCloseSeconds}
                onChange={(e) => setAutoCloseSeconds(parseInt(e.target.value || '10', 10))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>이미지 첨부 (문구별)</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                disabled={uploading || !phrase?.uid}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  // 같은 파일 다시 선택 가능하도록 초기화
                  e.currentTarget.value = '';
                  if (!f) return;
                  if (!phrase?.uid) {
                    await showCustomAlert('이미지는 문구 UID가 생성된 후에 첨부할 수 있습니다. (문구를 먼저 생성하세요)');
                    return;
                  }

                  setUploading(true);
                  try {
                    const apiUrl = await getApiBaseUrl();
                    const fd = new FormData();
                    fd.append('file', f);

                    const res = await fetch(`${apiUrl}/api/phrases/${encodeURIComponent(phrase.uid)}/image`, {
                      method: 'POST',
                      body: fd
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(data.message || '이미지 업로드에 실패했습니다.');
                    }
                    setImageUrl(String(data.imageUrl || ''));
                    await showCustomAlert('이미지가 저장되었습니다.');
                  } catch (err: any) {
                    await showCustomAlert(err?.message || '이미지 업로드에 실패했습니다.');
                  } finally {
                    setUploading(false);
                  }
                }}
              />

              <button
                type="button"
                disabled={uploading || !phrase?.uid || !imageUrl}
                onClick={async () => {
                  if (!phrase?.uid) return;
                  setUploading(true);
                  try {
                    const apiUrl = await getApiBaseUrl();
                    const res = await fetch(`${apiUrl}/api/phrases/${encodeURIComponent(phrase.uid)}/image`, {
                      method: 'DELETE'
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.message || '이미지 삭제에 실패했습니다.');
                    setImageUrl('');
                    await showCustomAlert('이미지가 삭제되었습니다.');
                  } catch (err: any) {
                    await showCustomAlert(err?.message || '이미지 삭제에 실패했습니다.');
                  } finally {
                    setUploading(false);
                  }
                }}
                style={{
                  padding: '8px 12px',
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                이미지 제거
              </button>
            </div>

            <div style={{ marginTop: '10px' }}>
              <div style={{ color: '#8E8E93', fontSize: '12px', marginBottom: '8px' }}>
                저장 위치: exe 폴더의 `data/phrase_images/{phrase?.uid ?? "uid"}/...` (로컬 DB 방식)
              </div>
              <div style={{ width: '180px', height: '180px', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: '#8E8E93', fontSize: '12px' }}>첨부된 이미지 없음</div>
                )}
              </div>
            </div>
          </div>

          <div className="form-group form-group-row">
            <div className="form-group-item">
              <label>호출벨 회사명</label>
              <select
                value={makerId}
                onChange={(e) => {
                  setMakerId(e.target.value);
                  setModelId('');
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #E5E5EA' }}
              >
                <option value="">선택 안 함</option>
                {makers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group-item">
              <label>모델 명</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #E5E5EA' }}
                disabled={!makerId}
              >
                <option value="">선택 안 함</option>
                {currentModels.map((mo) => (
                  <option key={mo.id} value={mo.id}>{mo.name}</option>
                ))}
              </select>
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

