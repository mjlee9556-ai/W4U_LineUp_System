/** 여러 모양의 유튜브 주소에서 영상 id를 꺼낸다 (watch, youtu.be, shorts, live, embed, music) */
export function youtubeId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(shorts|live|embed|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** 키 없이 쓰는 oEmbed로 영상 제목을 가져온다. 실패하면 null */
export async function fetchYoutubeTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(id))}`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 200) : null;
  } catch {
    return null;
  }
}
