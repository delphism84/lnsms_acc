// API 서비스 - 백엔드 포트 설정을 읽어서 API URL 구성

const DEFAULT_PORT = 58000;
const DEFAULT_API_URL = `http://localhost:${DEFAULT_PORT}`;
const MAX_PORT = 58999;

let apiBaseUrl: string | null = null;

/**
 * 백엔드 포트 설정을 가져와서 API URL 구성
 */
export async function getApiBaseUrl(): Promise<string> {
  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  // localStorage에서 저장된 URL 확인
  const savedUrl = localStorage.getItem('backendUrl');
  if (savedUrl) {
    try {
      const testResponse = await fetch(`${savedUrl}/api/settings/port`, {
        signal: AbortSignal.timeout(1000)
      });
      if (testResponse.ok) {
        apiBaseUrl = savedUrl;
        return apiBaseUrl;
      }
    } catch {
      // 저장된 URL이 유효하지 않으면 계속 탐색
      localStorage.removeItem('backendUrl');
    }
  }

  // 기본 포트부터 순차적으로 시도
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    try {
      const testUrl = `http://localhost:${port}/api/settings/port`;
      const testResponse = await fetch(testUrl, { 
        signal: AbortSignal.timeout(500) // 500ms 타임아웃
      });
      
      if (testResponse.ok) {
        const data = await testResponse.json();
        const foundUrl = data.backendUrl || `http://localhost:${data.port}`;
        apiBaseUrl = foundUrl;
        // localStorage에 저장
        localStorage.setItem('backendUrl', foundUrl);
        console.log(`백엔드 포트 발견: ${port}`);
        return foundUrl;
      }
    } catch {
      // 다음 포트 시도
      continue;
    }
  }

  // 모든 시도 실패 시 기본값 사용
  console.warn('백엔드 포트를 찾을 수 없어 기본값 사용');
  apiBaseUrl = DEFAULT_API_URL;
  return apiBaseUrl;
}

/**
 * API 요청 헬퍼
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  if (!baseUrl || baseUrl === null) {
    throw new Error('API 기본 URL을 가져올 수 없습니다.');
  }
  const url = `${baseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
  }

  // 204 No Content 또는 본문이 없는 경우 JSON 파싱 시도하지 않음
  if (response.status === 204 || response.status === 201 && response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  // Content-Type이 JSON이 아니거나 본문이 없는 경우 처리
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // 본문이 있는지 확인
  const text = await response.text();
  if (!text || text.trim() === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('JSON 파싱 실패, 텍스트 반환:', text);
    return text as T;
  }
}

