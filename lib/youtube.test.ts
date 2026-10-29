import { describe, expect, it } from "vitest";
import { youtubeId } from "./youtube";

describe("youtubeId", () => {
  it("여러 주소 모양을 읽는다", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("유튜브가 아니면 null", () => {
    expect(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("그냥 글자")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
});
