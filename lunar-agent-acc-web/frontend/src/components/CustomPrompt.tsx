import { useEffect, useRef, useState } from 'react';
import '../styles/CustomConfirm.css';

interface PromptQueueItem {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  password?: boolean;
  resolve: (result: string | null) => void;
}

let promptQueue: PromptQueueItem[] = [];
let setPromptState: ((item: PromptQueueItem | null) => void) | null = null;

export function showCustomPrompt(opts: Omit<PromptQueueItem, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    const item: PromptQueueItem = { ...opts, resolve };
    promptQueue.push(item);
    if (setPromptState) {
      setPromptState(promptQueue[0]);
    }
  });
}

export function CustomPromptProvider() {
  const [currentPrompt, setCurrentPrompt] = useState<PromptQueueItem | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPromptState = setCurrentPrompt;
    if (promptQueue.length > 0) {
      setCurrentPrompt(promptQueue[0]);
    }
    return () => {
      if (setPromptState === setCurrentPrompt) {
        setPromptState = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!currentPrompt) return;
    setValue(currentPrompt.defaultValue ?? '');
    // 다음 tick에 포커스
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [currentPrompt]);

  const closeWith = (result: string | null) => {
    const item = currentPrompt;
    if (!item) return;
    promptQueue.shift();
    setCurrentPrompt(promptQueue[0] ?? null);
    item.resolve(result);
  };

  if (!currentPrompt) return null;

  return (
    <div className="custom-confirm-overlay">
      <div className="custom-confirm-container">
        <div className="custom-confirm-content">
          {currentPrompt.title ? (
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
              {currentPrompt.title}
            </div>
          ) : null}
          <div className="custom-confirm-message">{currentPrompt.message}</div>
          <div style={{ marginTop: '12px' }}>
            <input
              ref={inputRef}
              type={currentPrompt.password ? 'password' : 'text'}
              value={value}
              placeholder={currentPrompt.placeholder ?? ''}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') closeWith(value);
                if (e.key === 'Escape') closeWith(null);
              }}
              className="cupertino-input"
            />
          </div>
        </div>
        <div className="custom-confirm-footer">
          <button className="custom-confirm-button confirm-button" onClick={() => closeWith(value)}>
            확인
          </button>
          <button className="custom-confirm-button cancel-button" onClick={() => closeWith(null)}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

