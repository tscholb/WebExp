# 루틴 브라우징 대시보드

매일 들러보는 사이트를 한 화면에서 빠르게 열고, "오늘 어디까지 봤는지" 체크하는 개인용 시작 페이지.
바닐라 HTML/CSS/JS 단일 페이지, 데이터는 브라우저 `localStorage`에 저장.

## 기능

- 카테고리별 그리드 바로가기. 카드 클릭 시 새 탭으로 열리고 "오늘 방문" 체크.
- 상단 진행 바: `방문한 수 / 전체`. 날짜가 바뀌면 자동 초기화.
- 카드 수동 체크/해제, ↑ ↓ 로 카테고리 내 순서 변경, ✎ 편집, 🗑 삭제.
- `+ 사이트 추가` 모달에서 이름 / URL / 카테고리 / (선택) 아이콘 URL 관리.
- JSON 내보내기 / 가져오기로 백업·복원.

## 로컬 실행

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

또는 VS Code Live Server 등 아무 정적 서버로 루트를 열면 됩니다.
`file://` 로 바로 열어도 대부분 동작하지만, 일부 브라우저에서 `<dialog>` 나 favicon 프록시가 제한될 수 있어 로컬 서버를 권장합니다.

## 배포

### GitHub Pages
1. 이 저장소의 기본 브랜치에 변경사항을 머지.
2. Settings → Pages → Source를 `main` / `/ (root)` 로 지정.
3. 발급된 URL로 접근.

### Vercel
1. 저장소를 Vercel에 임포트.
2. 프레임워크 프리셋: `Other`, 빌드 명령 없음, 출력 디렉토리 `./`.
3. 배포.

## 데이터

- 저장 키: `localStorage["routineBrowsing.v1"]`.
- 스키마: `{ sites: Site[], visits: Record<YYYY-MM-DD, string[]>, lastOpenedDate: string }`.
- 방문 기록은 최근 30일치만 유지됩니다.
