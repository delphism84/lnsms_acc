# 전체 기능 검토 및 개선 요약

목적: setid 규격·Agent·Node·Admin 간 미구현·연결 끊김·필드 불일치 검토 후 개선.

---

## 1. Agent FE (설정 다운로드/업로드)

### 1.1 다운로드 적용 후 브로드캐스트 재등록
- **문제**: 설정 다운로드로 세트 적용 후에도 서버에 Agent가 새 setid로 등록되지 않아, 브로드캐스트 시 이전 setid 기준으로만 동작할 수 있음.
- **개선**: 다운로드 적용 성공 후 `lnmsRegisterAgent(..., setid, selectedStoreId)` 재호출하여 서버에 새 setid·storeid 반영.

### 1.2 업로드 시 phrase.image 필드 (setid.md 1:1)
- **문제**: 업로드 시 .NET에서 가져온 phrase에 `imageUrl`(경로)만 있고 `image`(파일명)가 없어, Node/Admin과 규격 불일치.
- **개선**: 업로드 저장 시 phrases를 정규화하여 `image` = imageUrl에서 파일명만 추출해 전달. `lnmsSaveSetConfig`에 `{ setid, phrases, serial }` 형태로 전송.

### 1.3 다운로드 모달 세트 목록
- **개선**: 매장 미선택 시에도 로그인한 유저의 세트만 보이도록 `userid`(loginId)를 다운로드 모달에 전달. `storeid` 없을 때 `lnmsListSets(userid)` 호출.

---

## 2. Node BE (sets)

### 2.1 phrase.image 저장/반환 일관화
- **PUT /api/sets/:setid**: 저장 시 각 phrase에 대해 `image` = phrase.image ?? (phrase.imageUrl에서 파일명만 추출) 로 정규화하여 DB에 저장.
- **GET /api/sets/:setid/config**: 응답 phrase에 `image` 필드 보장 (기존 imageUrl만 있으면 파일명으로 변환해 반환). setid.md 2.1 규격에 맞춤.

---

## 3. Admin FE (lnms-admin)

### 3.1 유저 추가
- **문제**: 트리에 유저 목록만 있고 신규 유저 추가 방법 없음.
- **개선**: 트리 상단에 "+ 유저 추가" 버튼 추가. 클릭 시 userid·password 입력란 표시 후 `createUser(userid, userpw)` 호출 및 목록 갱신.

### 3.2 유저 삭제
- **개선**: 각 유저 행에 "삭제" 버튼 추가. 확인 후 `deleteUser(userid)` 호출, 성공 시 users/stores/sets 재조회.

### 3.3 매장 삭제
- **개선**: 각 매장 행에 "삭제" 버튼 추가. 확인 후 `deleteStore(storeid)` 호출, 목록 갱신.

---

## 4. 연결·필드 정리

| 구간 | 내용 |
|------|------|
| Agent → Node 업로드 | phrases에 `image`(파일명) 포함, 1:1 페이로드 |
| Node sets PUT | phrase.image 정규화(파일명) 후 저장 |
| Node sets GET config | phrase.image 반환 보장 |
| Agent 다운로드 적용 후 | 브로드캐스트용 Agent 재등록 (setid, storeid) |
| Admin 트리 | 유저 추가/삭제, 매장 삭제로 CRUD 완결 |

---

## 5. 추후 검토 권장

- **이미지 파일 업로드/다운로드**: setid.md 기준 문구 image는 파일명이며, 업로드/다운로드 시 이미지 파일을 함께 전달하는 플로우는 Agent·Node에 이미지 바이너리 API가 있으면 연동 가능.
- **유저 삭제 시 캐스케이드**: 현재 Node는 유저 삭제 시 해당 userid의 store/set을 자동 삭제하지 않음. 필요 시 백엔드에서 cascade 삭제 또는 Admin에서 순서 안내 추가 가능.
