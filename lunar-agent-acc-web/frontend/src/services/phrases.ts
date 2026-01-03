import { apiRequest } from './api';
import { getApiBaseUrl } from './api';

export interface Phrase {
  id: number;
  uid: string;
  text: string;
  isEnabled: boolean;
  color: string;
  bellCodes: string[];
  createdAt: string;
  updatedAt: string;
  bellCount: number;
}

export interface PhraseDatabase {
  Phrases: Phrase[];
}

// 필드명 변환 헬퍼 (PascalCase -> camelCase)
function normalizePhrase(phrase: any): Phrase {
  return {
    id: phrase.id || phrase.Id || 0,
    uid: phrase.uid || phrase.Uid || '',
    text: phrase.text || phrase.Text || '',
    isEnabled: phrase.isEnabled ?? phrase.IsEnabled ?? true,
    color: phrase.color || phrase.Color || '#000000',
    bellCodes: phrase.bellCodes || phrase.BellCodes || [],
    createdAt: phrase.createdAt || phrase.CreatedAt || '',
    updatedAt: phrase.updatedAt || phrase.UpdatedAt || '',
    bellCount: phrase.bellCount ?? phrase.BellCount ?? 0
  };
}

export async function getPhrases(): Promise<PhraseDatabase> {
  const data = await apiRequest<{ Phrases?: any[], phrases?: any[] }>('/api/phrases');
  // 백엔드가 phrases (camelCase)로 반환하도록 수정됨
  const rawPhrases = data.phrases || data.Phrases || [];
  // 필드명 정규화 (PascalCase -> camelCase)
  const phrases = rawPhrases.map(normalizePhrase);
  return { Phrases: phrases };
}

export async function createPhrase(phrase: Partial<Phrase>): Promise<Phrase> {
  return apiRequest<Phrase>('/api/phrases', {
    method: 'POST',
    body: JSON.stringify(phrase),
  });
}

export async function updatePhrase(uid: string, phrase: Partial<Phrase>): Promise<Phrase> {
  return apiRequest<Phrase>(`/api/phrases/${uid}`, {
    method: 'PUT',
    body: JSON.stringify(phrase),
  });
}

export async function deletePhrase(uid: string): Promise<void> {
  await apiRequest(`/api/phrases/${uid}`, {
    method: 'DELETE',
  });
}

export async function getBackendUrl(): Promise<string> {
  return getApiBaseUrl();
}

