/**
 * Postgres 접속 주소를 환경 변수에서 찾는다.
 * Vercel Storage는 연결할 때 붙인 이름(prefix)에 따라 STORAGE_URL, NEON_DATABASE_URL 등으로
 * 만들 수 있어서, 기본 이름이 없으면 postgres:// 로 시작하는 값을 찾아 쓴다.
 */
export function findDatabaseUrl(env: Record<string, string | undefined>): string | undefined {
  for (const key of ["DATABASE_URL", "POSTGRES_URL"]) {
    if (env[key]) return env[key];
  }
  const candidates = Object.keys(env)
    .filter((key) => /^postgres(ql)?:\/\//.test(env[key] ?? ""))
    // 커넥션 풀을 거치는 주소를 먼저, 그다음 이름순
    .sort((a, b) => Number(/UNPOOLED|NON_POOLING/.test(a)) - Number(/UNPOOLED|NON_POOLING/.test(b)) || a.localeCompare(b));
  return candidates.length ? env[candidates[0]] : undefined;
}
