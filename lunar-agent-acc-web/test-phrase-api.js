// 문구 추가 API 테스트
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
  console.log('=== 문구 추가 API 테스트 시작 ===\n');
  
  try {
    // 1. 백엔드 포트 찾기
    console.log('1. 백엔드 포트 찾기...');
    const port = await findBackendPort();
    console.log(`   ✓ 포트 발견: ${port}\n`);

    // 2. 기존 문구 조회
    console.log('2. 기존 문구 조회 (GET /api/phrases)...');
    const getResponse = await apiRequest(port, '/api/phrases');
    console.log(`   ✓ 상태 코드: ${getResponse.status}`);
    console.log(`   ✓ 응답 데이터:`, JSON.stringify(getResponse.data, null, 2));
    // Phrases 또는 phrases 모두 확인
    const phrases = getResponse.data?.Phrases || getResponse.data?.phrases || [];
    const initialCount = phrases.length;
    console.log(`   ✓ 현재 문구 개수: ${initialCount}\n`);

    // 3. 문구 추가 테스트
    console.log('3. 문구 추가 테스트 (POST /api/phrases)...');
    const newPhrase = {
      text: '[TEST] 테스트 문구',
      isEnabled: true,
      color: '#FF0000',
      bellCodes: ['TEST001', 'TEST002']
    };
    
    console.log(`   요청 데이터:`, JSON.stringify(newPhrase, null, 2));
    
    const postResponse = await apiRequest(port, '/api/phrases', {
      method: 'POST',
      body: newPhrase
    });
    
    console.log(`   ✓ 상태 코드: ${postResponse.status}`);
    console.log(`   ✓ 응답 데이터:`, JSON.stringify(postResponse.data, null, 2));
    
    if (!postResponse.data) {
      throw new Error('응답 데이터가 없습니다.');
    }
    
    if (!postResponse.data.id) {
      throw new Error('응답에 id가 없습니다.');
    }
    
    const createdId = postResponse.data.id;
    console.log(`   ✓ 생성된 문구 ID: ${createdId}\n`);

    // 4. 추가 후 문구 개수 확인
    console.log('4. 추가 후 문구 개수 확인 (GET /api/phrases)...');
    const getAfterResponse = await apiRequest(port, '/api/phrases');
    const afterPhrases = getAfterResponse.data?.Phrases || getAfterResponse.data?.phrases || [];
    const afterCount = afterPhrases.length;
    console.log(`   ✓ 추가 후 문구 개수: ${afterCount}`);
    
    if (afterCount !== initialCount + 1) {
      throw new Error(`문구 개수가 예상과 다릅니다. (예상: ${initialCount + 1}, 실제: ${afterCount})`);
    }
    console.log(`   ✓ 문구 개수 증가 확인됨\n`);

    // 5. 생성된 문구 확인
    console.log('5. 생성된 문구 확인...');
    const createdPhrase = afterPhrases.find(p => p.id === createdId);
    if (!createdPhrase) {
      throw new Error('생성된 문구를 찾을 수 없습니다.');
    }
    console.log(`   ✓ 생성된 문구:`, JSON.stringify(createdPhrase, null, 2));
    
    // 필드 검증
    if (createdPhrase.text !== newPhrase.text) {
      throw new Error(`text 불일치: 예상 "${newPhrase.text}", 실제 "${createdPhrase.text}"`);
    }
    if (createdPhrase.color !== newPhrase.color) {
      throw new Error(`color 불일치: 예상 "${newPhrase.color}", 실제 "${createdPhrase.color}"`);
    }
    if (createdPhrase.isEnabled !== newPhrase.isEnabled) {
      throw new Error(`isEnabled 불일치: 예상 ${newPhrase.isEnabled}, 실제 ${createdPhrase.isEnabled}`);
    }
    if (JSON.stringify(createdPhrase.bellCodes) !== JSON.stringify(newPhrase.bellCodes)) {
      throw new Error(`bellCodes 불일치`);
    }
    console.log(`   ✓ 모든 필드 검증 통과\n`);

    // 6. 테스트 데이터 정리 (선택사항)
    console.log('6. 테스트 데이터 정리 (DELETE /api/phrases/{id})...');
    try {
      await apiRequest(port, `/api/phrases/${createdId}`, {
        method: 'DELETE'
      });
      console.log(`   ✓ 테스트 문구 삭제 완료\n`);
    } catch (error) {
      console.log(`   ⚠ 테스트 문구 삭제 실패: ${error.message}\n`);
    }

    console.log('=== 모든 테스트 통과! ===');
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세 오류:', error);
    process.exit(1);
  }
}

// 테스트 실행
runTests();

