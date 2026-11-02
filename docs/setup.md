# Telos 설정 안내 (사람이 직접 하는 일)

코드는 저장소에 있고, 아래 설정은 대시보드에서 직접 해야 해요. 순서대로 하면 돼요.
화면 이름은 Supabase·GitHub가 바꿀 수 있어요. 메뉴 이름이 조금 다르면 비슷한 이름을 찾아 주세요.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com/dashboard 에 로그인 → **New project**
2. 이름: `telos` (아무거나), 데이터베이스 비밀번호: 만들어서 따로 보관
3. **Region**: `Northeast Asia (Seoul)` 선택 → **Create new project**
4. 1~2분 기다리면 프로젝트가 준비돼요.

## 2. pg_cron 켜기 (매일 자동 작업)

SQL을 붙여 넣기 **전에** 먼저 켜요. 그래야 SQL이 자동 작업을 함께 등록해요.

1. 왼쪽 메뉴 **Integrations** → **Cron** → **Enable pg_cron**
   - 메뉴가 안 보이면: **Database** → **Extensions** → 검색창에 `pg_cron` → 스위치 켜기
2. 켜졌는지는 3단계 SQL 실행 결과 마지막 줄 `pg_cron 확장 (1 이면 켜짐)`에서 확인할 수 있어요.

## 3. SQL 붙여 넣기 (테이블, 보안 규칙, 사진 저장소, 자동 작업)

1. 저장소의 [`supabase/telos.sql`](../supabase/telos.sql) 파일을 열고 내용 **전체**를 복사
   - GitHub에서 열었다면 파일 오른쪽 위 **Copy raw file** 버튼을 쓰면 편해요.
2. Supabase 왼쪽 메뉴 **SQL Editor** → **New query**(또는 **+**)
3. 붙여 넣고 **Run** (Ctrl/⌘ + Enter)
4. "destructive operations" 경고가 뜨면 **Run this query**를 눌러요.
   (기존 정책을 지우고 다시 만드는 문장 때문이에요. 데이터는 지우지 않아요.)
5. 아래쪽 결과에 이렇게 나오면 성공이에요.

   | 테이블 수 (29 이면 정상) | 사진 버킷 (1 이면 정상) | pg_cron 확장 (1 이면 켜짐) |
   | --- | --- | --- |
   | 29 | 1 | 1 |

- 이 파일은 **여러 번 실행해도 안전**해요. 나중에 파일이 바뀌면 같은 방법으로 다시 실행하면 돼요.
- pg_cron이 0이면 2단계를 한 뒤 SQL을 한 번 더 실행해요.
- 자동 작업 확인: SQL Editor에서 `select jobname, schedule from cron.job;` → `telos-daily-maintenance`, `10 21 * * *`(한국 시간 매일 06:10)이 보이면 돼요.
- 바로 한 번 돌려 보기: `select public.run_daily_maintenance();` 실행 후
  `select * from public.maintenance_runs order by id desc limit 1;` 에서 `ok = true`면 정상이에요.

## 4. 내 계정 만들고 회원가입 막기

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. 이메일, 비밀번호 입력 → **Auto Confirm User** 체크 → **Create user**
3. **Authentication** → **Sign In / Providers**(또는 **Providers**) → **Allow new users to sign up** 끄기 → **Save**
   - 이걸 꺼야 다른 사람이 가입할 수 없어요.

## 5. 주소 설정 (Site URL)

1. **Authentication** → **URL Configuration**
2. **Site URL**: `https://snis23.github.io/TELOS/`
3. **Redirect URLs** → **Add URL**: `https://snis23.github.io/TELOS/` 와 `http://localhost:3000/TELOS/` (내 컴퓨터에서 개발할 때)
4. **Save**

## 6. 공개 키 복사 (다음 단계에서 GitHub에 넣어요)

1. **Project Settings**(톱니바퀴) → **API Keys** (또는 **Data API**)
2. 두 값을 복사해 둬요.
   - **Project URL**: `https://xxxx.supabase.co` 형태
   - **공개 키**: `Publishable key`(`sb_publishable_`로 시작) 또는 **Legacy** 탭의 `anon` `public` 키. 둘 중 하나면 돼요.
3. `service_role` 키나 `Secret key`(`sb_secret_`)는 **절대** 쓰지 않아요. 이 프로젝트 어디에도 필요 없어요.

> 공개 키는 브라우저에 그대로 보이는 값이에요. 데이터는 3단계 SQL의 보안 규칙(RLS)이 지켜요.

---

## 7. GitHub Pages 켜기

1. 저장소 https://github.com/snis23/TELOS → **Settings** → 왼쪽 **Pages**
2. **Build and deployment** → **Source**: `GitHub Actions` 선택 (저장 버튼 없음, 고르면 끝)
3. 저장소는 **Public**이어야 해요 (무료 계정의 Pages 조건).

## 8. GitHub Secrets 넣기

1. 저장소 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. 두 개를 만들어요. 이름은 대소문자까지 똑같이:

   | Name | Secret |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 6단계의 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 6단계의 공개 키 |

3. 다음에 `main`에 코드가 올라가면 자동으로 검사 → 빌드 → 배포돼요.
   이미 올라가 있다면 **Actions** 탭 → **Deploy** → **Run workflow**로 다시 돌릴 수 있어요.
4. 배포가 끝나면 `https://snis23.github.io/TELOS/` 에서 4단계 계정으로 로그인해요.

---

## 9. 오래 쓰지 않을 때 (방학 등)

Supabase 무료 플랜은 일정 기간 활동이 없으면 프로젝트를 **일시 중지**할 수 있어요.
정확한 조건은 Supabase 안내(https://supabase.com/docs/guides/platform/billing-on-supabase 등)에서 확인해요.

- 중지되면 대시보드에서 **Restore project**로 다시 켤 수 있어요.
- 오래 쉬기 전에는 설정 → 백업에서 **모든 기록 JSON**과 **사진 zip**을 내려받아 두세요.

## 10. 내 컴퓨터에서 개발할 때 (선택)

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local`에 6단계의 두 값을 넣고:

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/TELOS/` 를 열어요.

Supabase 없이 샘플 데이터로 화면만 보려면 (개발 전용, 배포에는 들어가지 않아요):

```bash
npm run dev:demo
```
