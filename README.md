# League Archive Predictor

React + TypeScript + Next.js App Router + Tailwind CSS로 만든 다중 시즌 리그 아카이브 및 순위 확률 예측 웹앱입니다. 과거 시즌 경기 결과를 저장하고 다시 조회할 수 있고, 현재 시즌은 직전 시즌 결과를 prior로 사용해 Monte Carlo simulation 기반 예측을 수행합니다.

## 설치 방법

```bash
npm install
```

## 실행 방법

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 테스트 실행

```bash
npm test
```

## 폴더 구조

```text
.
├─ data
│  └─ sample-league.json
├─ src
│  ├─ app
│  ├─ components
│  ├─ lib
│  │  ├─ dataProviders
│  │  ├─ domain
│  │  ├─ store
│  │  └─ utils
│  └─ workers
└─ tests
```

## 주요 타입

- `League`: 리그 전체 저장 단위. 팀, 시즌, 시즌별 참가팀, 경기 목록 포함
- `Season`: 시즌 메타데이터, 규칙, prior 연결, 시뮬레이션 설정 포함
- `Team`: 전역 팀 엔티티
- `SeasonTeam`: 시즌별 참가팀과 수동 initial rating
- `Match`: 시즌 경기 일정과 결과
- `MatchResult`: 세트 스코어
- `LeagueRules`: 진출 팀 수, 타이브레이커, 라운드로빈 방식
- `SimulationConfig`: 반복 횟수, prior 감소 강도, 퍼센트 표시 자리수
- `PreviousSeasonStats`: 직전 시즌 집계 통계
- `CurrentSeasonRecord`: 현재 시즌 집계 성적
- `TeamProbabilitySummary`: 팀별 최종 순위 분포와 4강 진출 확률
- `SeasonSummary`: 시즌 요약 정보

## 다중 시즌 관리 구조

- 모든 시즌은 `League` 아래에 누적 저장됩니다.
- 경기 결과, 규칙, 시즌 참가팀, 수동 rating은 localStorage에 저장되어 새로고침 후에도 유지됩니다.
- 좌측 아카이브에서 과거/현재 시즌을 자유롭게 오가며 상세 정보를 다시 조회할 수 있습니다.
- 샘플 데이터 초기화 버튼으로 언제든 기본 예시 데이터셋으로 되돌릴 수 있습니다.

## 직전 시즌 데이터를 prior로 사용하는 방식

1. 현재 시즌을 선택하면 `prior.ts`에서 `priorSeasonId`를 기준으로 직전 시즌을 찾습니다.
2. 직전 시즌 경기 결과 전체를 다시 집계해 `PreviousSeasonStats`를 생성합니다.
3. 순위, 승률, 세트득실, 세트 비율을 표준화한 뒤 가중합으로 초기 rating을 만듭니다.
4. 현재 시즌 결과가 누적되면 완료 경기 비율에 따라 prior 비중을 줄이고 현재 시즌 form 비중을 높입니다.
5. 직전 시즌이 없으면 중립 rating(기본 1500) 또는 시즌별 수동 initial rating을 사용합니다.

## 확률 계산 방식

- 남은 경기는 팀 rating 차이에서 승리 확률을 계산합니다.
- 승부가 접전일수록 `3:2` 비중이 커지고, rating 차가 클수록 `3:0`, `3:1` 비중이 커지도록 세트 스코어 분포를 둡니다.
- 모든 남은 경기를 채워 시즌 종료 상태를 만들고 최종 순위를 집계합니다.
- 이 과정을 `N`회 반복하여 팀별 순위 빈도를 확률로 변환합니다.
- 기본 정렬 우선순위는 `승수 > 세트득실 > 세트득`이며, 시즌 설정에서 변경 가능합니다.

## 계산 로직 설명

- `src/lib/domain/standings.ts`
  - 현재 시즌 성적 집계
  - 타이브레이커 적용
  - 시즌 요약 생성
- `src/lib/domain/prior.ts`
  - 직전 시즌 집계 결과를 prior 통계로 변환
  - 초기 rating 생성
  - 현재 시즌 form과 prior blending
- `src/lib/domain/simulation.ts`
  - 세트 스코어 샘플링
  - Monte Carlo 시뮬레이션
  - 팀별 순위 분포/기대 승수/기대 세트득실 계산
- `src/workers/simulation.worker.ts`
  - 계산을 메인 UI 스레드와 분리

## 자동 데이터 로딩 교체 방법

- 샘플 JSON은 `data/sample-league.json`에 있습니다.
- `src/lib/dataProviders/jsonAdapters.ts`는 JSON 로딩/복제/아카이브 prior 로딩 인터페이스를 제공합니다.
- 실제 API로 바꾸려면 이 폴더에 fetch 기반 adapter를 추가하고, `loadSampleLeague()` 대신 해당 adapter를 store 초기화 지점에서 사용하면 됩니다.

## 샘플 데이터 설명

- `2025 스테이지 3`: 완료된 시즌
- `2026 스테이지 1`: 현재 진행 중 시즌
- `RONG`: `2025 스테이지 3` 아카이브에서는 `ONG`로 표시되며, `2026 스테이지 1`에서는 리브랜딩된 이름 `RONG`으로 표시됩니다.
- `PF`, `ZAN`, `NE`: 2026 시즌 신규 참가 팀 예시로 중립 초기 rating이 들어 있습니다.

## 현재 구현된 UX

- 시즌 목록 / 아카이브 보기
- 시즌 생성
- 과거 시즌 상세 조회
- 웹에서 경기 일정 추가, 결과 입력, 결과 수정, 삭제
- 현재 순위표 / 최종 순위 분포 / 4강 진출 확률 확인
- 시즌 설정에서 팀 구성, 라운드로빈, prior 시즌, 타이브레이커, 시뮬레이션 횟수 수정
- 결과 입력 직후 재계산 상태 표시

## 기본 샘플 시즌 구조

- `2024 스테이지 1`, `2024 스테이지 2`: 빈 시즌 틀
- `2025 스테이지 1`, `2025 스테이지 2`: 팀이 들어간 입력용 틀
- `2025 스테이지 3`: 실제 결과 반영
- `2026 스테이지 1`: 현재까지 실제 결과 반영
- `2026 스테이지 2`, `2026 스테이지 3`: 이후 입력용 틀

## 비고

- 시뮬레이션은 Web Worker 기반 비동기 구조를 사용합니다.
- 모델은 해석 가능한 간단한 rating blending 방식으로 설계되어 있어 이후 Elo, Bradley-Terry 등으로 교체하기 쉽습니다.
