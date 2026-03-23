'use client';

import { useState, useEffect } from 'react';
import type { PhraseItem } from '@/lib/api';
import { DEFAULT_CALLBELL_MAKERS } from '@/lib/callbellMakers';
import styles from './PhraseModal.module.css';

interface PhraseModalProps {
  mode: 'add' | 'edit';
  phrase: PhraseItem | null;
  onSave: (data: Partial<PhraseItem>) => void | Promise<void>;
  onClose: () => void;
}

export default function PhraseModal({ mode, phrase, onSave, onClose }: PhraseModalProps) {
  const [text, setText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [color, setColor] = useState('#000000');
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(10);
  const [image, setImage] = useState('');
  const [makerId, setMakerId] = useState('');
  const [modelId, setModelId] = useState('');
  const [bellCodesStr, setBellCodesStr] = useState('');

  useEffect(() => {
    if (phrase) {
      setText(phrase.text || '');
      setIsEnabled(phrase.isEnabled ?? true);
      setColor(phrase.color || '#000000');
      setAutoCloseEnabled(Boolean(phrase.autoCloseEnabled));
      setAutoCloseSeconds(Number(phrase.autoCloseSeconds ?? 10));
      setImage(String(phrase.image ?? phrase.imageUrl ?? ''));
      setMakerId(String(phrase.makerId ?? ''));
      setModelId(String(phrase.modelId ?? ''));
      setBellCodesStr(Array.isArray(phrase.bellCodes) ? phrase.bellCodes.join(', ') : '');
    } else {
      setText('');
      setIsEnabled(true);
      setColor('#000000');
      setAutoCloseEnabled(false);
      setAutoCloseSeconds(10);
      setImage('');
      setMakerId('');
      setModelId('');
      setBellCodesStr('');
    }
  }, [phrase]);

  const currentModels = makerId ? DEFAULT_CALLBELL_MAKERS.find((m) => m.id === makerId)?.models ?? [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      alert('문구를 입력해주세요.');
      return;
    }
    const bellCodes = bellCodesStr
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    try {
      await Promise.resolve(
        onSave({
          text: text.trim(),
          isEnabled,
          color,
          autoCloseEnabled,
          autoCloseSeconds: Math.max(1, Math.min(3600, autoCloseSeconds || 10)),
          image: image.trim() || undefined,
          makerId: makerId || undefined,
          modelId: modelId || undefined,
          bellCodes,
        })
      );
    } catch {
      /* 부모에서 alert 후 reject — 모달 유지 */
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{mode === 'add' ? '문구 추가' : '문구 수정'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>문구</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="알림 문구를 입력하세요"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
                활성화
              </label>
            </div>
            <div className={styles.formGroup}>
              <label>색상</label>
              <div className={styles.colorWrap}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                <span className={styles.colorValue}>{color}</span>
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={autoCloseEnabled}
                  onChange={(e) => setAutoCloseEnabled(e.target.checked)}
                />
                자동 꺼짐
              </label>
            </div>
            <div className={styles.formGroup}>
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

          <div className={styles.formGroup}>
            <label>이미지 파일명 (setid JSON 기준)</label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="예: photo.png"
            />
            <p className={styles.hint}>업로드/다운로드 시 해당 파일명으로 이미지가 관리됩니다.</p>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>호출벨 회사명</label>
              <select
                value={makerId}
                onChange={(e) => {
                  setMakerId(e.target.value);
                  setModelId('');
                }}
              >
                <option value="">선택 안 함</option>
                {DEFAULT_CALLBELL_MAKERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>모델 명</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!makerId}
              >
                <option value="">선택 안 함</option>
                {currentModels.map((mo) => (
                  <option key={mo.id} value={mo.id}>
                    {mo.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>벨 코드 (쉼표 구분)</label>
            <textarea
              value={bellCodesStr}
              onChange={(e) => setBellCodesStr(e.target.value)}
              placeholder="예: crcv.assist, custom.code"
              rows={2}
            />
            <p className={styles.hint}>에이전트에서는 물리 벨 등록으로 추가할 수 있습니다.</p>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              취소
            </button>
            <button type="submit" className={styles.saveBtn}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
