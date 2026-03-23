'use client';

import { useState, useEffect } from 'react';
import type { SerialPortEntry } from '@/lib/api';
import styles from './SerialPortModal.module.css';

interface SerialPortModalProps {
  port: SerialPortEntry | null;
  onSave: (entry: Omit<SerialPortEntry, 'id'> & { id?: string }) => void | Promise<void>;
  onClose: () => void;
}

const DEFAULT_ENTRY: Omit<SerialPortEntry, 'id'> = {
  portName: 'COM1',
  baudRate: 9600,
  autoConnect: true,
  secureEnabled: false,
  deviceSerialNumber: '00000000',
};

export default function SerialPortModal({ port, onSave, onClose }: SerialPortModalProps) {
  const [portName, setPortName] = useState('');
  const [baudRate, setBaudRate] = useState(9600);
  const [autoConnect, setAutoConnect] = useState(true);
  const [secureEnabled, setSecureEnabled] = useState(false);
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('00000000');

  useEffect(() => {
    if (port) {
      setPortName(port.portName || 'COM1');
      setBaudRate(port.baudRate ?? 9600);
      setAutoConnect(port.autoConnect ?? true);
      setSecureEnabled(port.secureEnabled ?? false);
      setDeviceSerialNumber(port.deviceSerialNumber ?? '00000000');
    } else {
      setPortName(DEFAULT_ENTRY.portName);
      setBaudRate(DEFAULT_ENTRY.baudRate);
      setAutoConnect(DEFAULT_ENTRY.autoConnect);
      setSecureEnabled(DEFAULT_ENTRY.secureEnabled ?? false);
      setDeviceSerialNumber(DEFAULT_ENTRY.deviceSerialNumber ?? '00000000');
    }
  }, [port]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = portName.trim();
    if (!name) {
      alert('포트명을 입력하세요.');
      return;
    }
    try {
      await Promise.resolve(
        onSave({
          id: port?.id,
          portName: name,
          baudRate,
          autoConnect,
          secureEnabled,
          deviceSerialNumber: deviceSerialNumber.trim() || '00000000',
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
          <h2>{port ? 'COM 포트 수정' : 'COM 포트 추가'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>포트명</label>
            <input
              type="text"
              value={portName}
              onChange={(e) => setPortName(e.target.value)}
              placeholder="COM1, COM2, ..."
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Baud Rate</label>
            <select value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))}>
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />
              자동 연결
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={secureEnabled} onChange={(e) => setSecureEnabled(e.target.checked)} />
              보안(암호화) 사용
            </label>
          </div>

          <div className={styles.formGroup}>
            <label>단말 시리얼번호 (8자)</label>
            <input
              type="text"
              value={deviceSerialNumber}
              onChange={(e) => setDeviceSerialNumber(e.target.value)}
              placeholder="00000000"
              maxLength={8}
            />
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
