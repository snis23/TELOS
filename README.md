# Telos

고등학생 한 명이 내신과 수능까지 쓰는 학습 보조 웹사이트. (텔로스, 그리스어로 '다다라야 할 완성')

- 명세: [`spec.md`](spec.md)
- 처음 설정 (Supabase, GitHub Pages, Secrets): [`docs/setup.md`](docs/setup.md)
- 데이터베이스 전체 설정: [`supabase/telos.sql`](supabase/telos.sql)

## 기술

Next.js(App Router, 정적 내보내기) + TypeScript strict, Tailwind CSS, Supabase(Postgres, Auth, Storage, Realtime),
TanStack Query, zod, date-fns, Recharts, @dnd-kit, lucide-react. GitHub Pages 에 GitHub Actions 로 배포한다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (`http://localhost:3000/TELOS/`, `.env.local` 필요) |
| `npm run dev:demo` | Supabase 없이 샘플 데이터로 보기 (개발 전용 가짜 백엔드) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint + 디자인 토큰 검사 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run e2e` | E2E 테스트 (Playwright, 화면 크기 4가지) |
| `npm run build` | 정적 빌드 (`out/`) |
| `npm run check` | 타입 검사 → 린트 → 단위 테스트 → 빌드 |

## 폴더

```
src/app            화면 (주소별)
src/components     화면 조각
src/lib            계산, 데이터, 설정 (단위 테스트는 같은 폴더의 *.test.ts)
src/lib/supabase/fake  개발·E2E 전용 가짜 백엔드 (배포 빌드에서는 빠진다)
supabase/telos.sql 데이터베이스 전체 설정 (SQL Editor 에 붙여 넣기)
tests/e2e          E2E 테스트
docs/setup.md      사람이 직접 하는 설정 안내
```
