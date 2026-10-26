# 개인화 — 내 업무 메뉴 · 테마 (design.json)

같은 스킬로 만들어도 **사람마다 다른 대시보드**가 나오게 하는 재료다. 기본 메뉴 30개는 누구나 같고, 사람마다 달라지는 건 이 파일이다.

```
my-work-map.md (업무 지도, 1주차 과제1)  ─→  에이전트가 design.json 초안  ─→  사용자 확인  ─→  build_dashboard.mjs --design design.json
```

## 1. 업무 지도에서 "내 업무" 메뉴 뽑기

1. main 워크스페이스의 `my-work-map.md`를 읽는다. 없으면 인터뷰 답(하는 일·반복 업무·맡기고 싶은 일)으로 대신한다.
2. **상위 3개 업무**(위임 희망도 순)를 각각 메뉴 후보로 본다. 기본 30개 메뉴로 충분히 표현되면(예: "메일 답장" → `email`) 커스텀을 만들지 않고 기본 메뉴를 켠다. 그 사람만의 업무일 때만 커스텀 메뉴를 만든다.
3. 메뉴 하나 = "그 업무에서 쌓이는 한 줄짜리 기록"이다. 예: 꽃집 → 주문 한 건, 유튜버 → 영상 한 편, 컨설턴트 → 고객사 한 곳.
4. 2~4개를 권한다(최대 6개). 이름은 **사용자가 평소 쓰는 말**로 짓는다("주문관리"보다 "예약 꽃다발").

## 2. design.json 형식

```json
{
  "customMenus": [
    {
      "key": "c-bouquet",
      "label": "예약 꽃다발",
      "icon": "Flower2",
      "purpose": "픽업 날짜별 꽃다발 주문을 놓치지 않게 관리합니다.",
      "fields": ["person", "dueAt", "body", "status"],
      "fieldLabels": { "person": "고객명", "dueAt": "픽업일", "body": "꽃 구성 / 메모" },
      "statusLabels": { "open": "주문 접수", "working": "제작 중", "waiting": "픽업 대기", "done": "전달 완료" },
      "kanban": true,
      "owner": "flora"
    }
  ],
  "theme": { "preset": "sunset", "accent": "", "emoji": "💐", "tagline": "꽃이 늦지 않게, 단골이 잊히지 않게" }
}
```

| 키 | 규칙 |
|---|---|
| `key` | `c-` + 영문 소문자·숫자·`-` (최대 30자). 한 번 정하면 바꾸지 않는다(기록이 이 키에 쌓인다) |
| `label` | 20자 이내. 사이드바 맨 위 **"내 업무"** 그룹에 뜬다 |
| `icon` | 아래 아이콘 목록 중 하나. 모르면 생략(✨) |
| `fields` | `title`(자동 포함) 외에 `body` `summary` `person` `agent` `date` `dueAt` `link` `status` 중에서 고른다. 생략하면 `body, status` |
| `fieldLabels` | 필드 이름을 그 사람의 말로 바꾼다. 20자 이내 |
| `statusLabels` | `status` 가 있을 때만. `open` `working` `waiting` `done` `rejected` 의 이름을 바꾼다. 12자 이내 |
| `kanban` | `true` 면 칸반 보기(상태 4칸). `status` 필수 |
| `owner` | 담당 직원 ID(선택). `team.json` 의 에이전트 ID |

**아이콘**: `Flower2` `Gift` `Heart` `Star` `Calendar` `Camera` `Coffee` `ShoppingBag` `Store` `Truck` `Wallet` `PiggyBank` `Receipt` `Music` `Clapperboard` `Megaphone` `PenTool` `Palette` `Scissors` `Dumbbell` `Utensils` `Stethoscope` `Wrench` `Hammer` `Plane` `Car` `Home` `Dog` `Leaf` `Sprout` `Smile` `Handshake` `Briefcase` `ClipboardList` `Target` + 기본 메뉴 아이콘(`Lightbulb` `Users` `Phone` `Inbox` `Search` `Globe` `BookOpen` `FileText` …).

## 3. 테마 3문항

인터뷰에서 딱 세 가지만 묻는다. 고르기 어려워하면 업무 지도를 보고 추천한다.

1. **분위기** → `preset`
   | preset | 느낌 | 어울리는 예 |
   |---|---|---|
   | `olive` | 차분한 종이 (기본) | 글쓰기·코칭·교육 |
   | `ocean` | 맑은 파랑 | IT·컨설팅·여행 |
   | `sunset` | 따뜻한 주황+보라 | 꽃·카페·뷰티·공방 |
   | `forest` | 짙은 초록+호박 | 농산물·건강·친환경 |
   | `mono` | 흑백, 군더더기 없음 | 디자인·사진·패션 |
   | `midnight` | 어두운 화면 | 영상·개발·밤에 일하는 사람 |
2. **로고 이모지** → `emoji` (사이드바 로고 자리). 예: 💐 🎬 ☕ 🏋️ 📚
3. **홈 한 줄** → `tagline` (80자 이내). "이 대시보드가 나에게 해 주는 일"을 한 문장으로. 예: "꽃이 늦지 않게, 단골이 잊히지 않게"

`accent`(#rrggbb)는 브랜드 색이 정해진 사람만 넣는다. 비우면 테마 기본색.

## 4. 직군별 예시

| 사용자 | 내 업무(커스텀 메뉴) | 테마 |
|---|---|---|
| 꽃집 사장님 | 예약 꽃다발(칸반: 주문 접수→제작 중→픽업 대기→전달 완료) · 단골 기념일(`date`=기념일) · 새벽 경매 메모 | `sunset` 💐 |
| 유튜버 | 영상 파이프라인(칸반: 아이디어→촬영→편집→업로드) · 협찬 문의(`person`=브랜드, `dueAt`=회신 기한) · 댓글 하이라이트 | `midnight` 🎬 |
| 1인 컨설턴트 | 고객사(`person`=담당자, `dueAt`=다음 미팅) · 제안서(칸반: 초안→검토→발송→계약) · 세금계산서(`date`, `link`) | `ocean` 💼 |

완성 예시 파일: `references/examples/flower-design.json` (+ 위젯 `flower-widget.html`).

## 5. 업데이트할 때

- `--design` 을 다시 주지 않으면 이전 `config.json` 의 내 업무·테마가 그대로 유지된다.
- 메뉴를 추가·수정하려면 design.json 을 고쳐 `--design` 으로 다시 빌드한다. **`key` 는 바꾸지 않는다**(바꾸면 기존 기록이 새 메뉴에 안 보인다).
- PC 설정 화면에서 사용자가 테마를 바꿨다면, VPS 쪽 테마가 **새로 바뀔 때만** 덮어쓴다(같은 값으로 다시 보내도 PC 의 선택이 유지된다).
- 커스텀 메뉴에 칸반 기록을 넣으려면 seed 의 `records["c-bouquet"]` 에 넣는다(`source`+`sourceId` 필수, `references/sync-contract.md`).
