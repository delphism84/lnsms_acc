// 문구 삭제 API 테스트
const http = require('http');

const DEFAULT_PORT = 58000;
const MAX_PORT = 58999;

// 백엔드 포트 찾기
async function findBackendPort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/settings/port`, (res) => {
          if (res.statusCode === 200) {
            resolve(port);
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return result;
    } catch (error) {
      continue;
    }
  }
  throw new Error('백엔드 포트를 찾을 수 없습니다.');
}

// API 요청 헬퍼
function apiRequest(port, endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${port}${endpoint}`;
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // 204 No Content는 성공으로 처리
        if (res.statusCode === 204) {
          resolve({ status: res.statusCode, data: null, headers: res.headers });
          return;
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
          } catch (error) {
            resolve({ status: res.statusCode, data: data, headers: res.headers });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// 테스트 실행
async function runTests() {
  console.log('=== 문구 삭제 API 테스트 시작 ===\n');
  
  try {
    // 1. 백엔드 포트 찾기
    console.log('1. 백엔드 포트 찾기...');
    const port = await findBackendPort();
    console.log(`   ✓ 포트 발견: ${port}\n`);

    // 2. 기존 문구 조회
    console.log('2. 기존 문구 조회 (GET /api/phrases)...');
    const getResponse = await apiRequest(port, '/api/phrases');
    console.log(`   응답 데이터:`, JSON.stringify(getResponse.data, null, 2));
    const phrases = getResponse.data?.Phrases || getResponse.data?.phrases || [];
    const initialCount = phrases.length;
    console.log(`   ✓ 현재 문구 개수: ${initialCount}`);
    
    if (initialCount === 0) {
      console.log('   ⚠ 삭제할 문구가 없습니다. 테스트 문구를 생성합니다...');
      // 테스트 문구 생성
      const createResponse = await apiRequest(port, '/api/phrases', {
        method: 'POST',
        body: {
          text: '[DELETE TEST] 삭제 테스트 문구',
          isEnabled: true,
          color: '#FF0000',
          bellCodes: []
        }
      });
      console.log(`   ✓ 테스트 문구 생성됨 (ID: ${createResponse.data.id})`);
      phrases.push(createResponse.data);
    }
    
    const testPhrase = phrases[0];
    console.log(`   테스트 문구:`, JSON.stringify(testPhrase, null, 2));
    const testId = testPhrase?.id || testPhrase?.Id;
    if (!testId) {
      throw new Error(`문구 ID를 찾을 수 없습니다. 문구 데이터: ${JSON.stringify(testPhrase)}`);
    }
    console.log(`   ✓ 테스트 대상 문구 ID: ${testId}\n`);

    // 3. 문구 삭제 테스트
    console.log(`3. 문구 삭제 테스트 (DELETE /api/phrases/${testId})...`);
    const deleteResponse = await apiRequest(port, `/api/phrases/${testId}`, {
      method: 'DELETE'
    });
    
    console.log(`   ✓ 상태 코드: ${deleteResponse.status}`);
    if (deleteResponse.status !== 204) {
      throw new Error(`예상된 상태 코드는 204인데 ${deleteResponse.status}가 반환되었습니다.`);
    }
    console.log(`   ✓ 삭제 성공 (204 No Content)\n`);

    // 4. 삭제 후 문구 개수 확인
    console.log('4. 삭제 후 문구 개수 확인 (GET /api/phrases)...');
    const getAfterResponse = await apiRequest(port, '/api/phrases');
    const afterPhrases = getAfterResponse.data?.Phrases || getAfterResponse.data?.phrases || [];
    const afterCount = afterPhrases.length;
    console.log(`   ✓ 삭제 후 문구 개수: ${afterCount}`);
    
    if (afterCount !== initialCount - 1) {
      throw new Error(`문구 개수가 예상과 다릅니다. (예상: ${initialCount - 1}, 실제: ${afterCount})`);
    }
    console.log(`   ✓ 문구 개수 감소 확인됨\n`);

    // 5. 삭제된 문구가 목록에 없는지 확인
    console.log('5. 삭제된 문구 확인...');
    const deletedPhrase = afterPhrases.find(p => p.id === testId);
    if (deletedPhrase) {
      throw new Error(`삭제된 문구(ID: ${testId})가 여전히 목록에 있습니다.`);
    }
    console.log(`   ✓ 삭제된 문구가 목록에서 제거됨\n`);

    console.log('=== 모든 테스트 통과! ===');
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세 오류:', error);
    process.exit(1);
  }
}

// 테스트 실행
runTests();

