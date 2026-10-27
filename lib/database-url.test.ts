import { describe, expect, it } from "vitest";
import { findDatabaseUrl } from "./database-url";

describe("findDatabaseUrl", () => {
  it("DATABASE_URL을 먼저 쓴다", () => {
    expect(findDatabaseUrl({ DATABASE_URL: "postgres://a", POSTGRES_URL: "postgres://b" })).toBe("postgres://a");
  });
  it("다른 이름이어도 postgres 주소를 찾는다", () => {
    expect(
      findDatabaseUrl({
        STORAGE_URL_UNPOOLED: "postgresql://direct",
        STORAGE_URL: "postgresql://pooled",
        STORAGE_PGHOST: "ep-x.neon.tech",
      }),
    ).toBe("postgresql://pooled");
  });
  it("없으면 undefined", () => {
    expect(findDatabaseUrl({ HOME: "/root" })).toBeUndefined();
  });
});
