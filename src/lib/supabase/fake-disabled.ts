/** 배포 빌드용 대체 파일: 가짜 백엔드 코드가 들어가지 않게 한다. */
export function createFakeBackend(): unknown {
  throw new Error("fake backend is disabled in this build");
}
