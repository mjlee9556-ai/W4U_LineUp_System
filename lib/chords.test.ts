import { describe, expect, it } from "vitest";
import { importChart, isChordLine, keyName, parseKey, transposeChart, transposeChord, transposeKeyText } from "./chords";

describe("transposeChord", () => {
  it("근음, 성질, 베이스를 함께 옮긴다", () => {
    expect(transposeChord("G", 2, false)).toBe("A");
    expect(transposeChord("Em7", 2, false)).toBe("F#m7");
    expect(transposeChord("D/F#", 2, false)).toBe("E/G#");
    expect(transposeChord("Csus4", -2, true)).toBe("Bbsus4");
    expect(transposeChord("Bb", 1, false)).toBe("B");
    expect(transposeChord("Am7(b5)", 3, false)).toBe("Cm7(b5)");
  });
  it("코드가 아니면 그대로", () => {
    expect(transposeChord("주님", 2, false)).toBe("주님");
    expect(transposeChord("Hello", 2, false)).toBe("Hello");
  });
});

describe("isChordLine", () => {
  it("코드 줄을 알아본다", () => {
    expect(isChordLine("G        D/F#     Em")).toBe(true);
    expect(isChordLine("Intro: G D Em C")).toBe(true);
    expect(isChordLine("전주 | G | D | Em | C |")).toBe(true);
    expect(isChordLine("[Verse]  C   G")).toBe(true);
    expect(isChordLine("(G)  D  x2")).toBe(true);
  });
  it("가사 줄은 코드 줄이 아니다", () => {
    expect(isChordLine("주 님의 사랑 놀라워")).toBe(false);
    expect(isChordLine("A mighty fortress is our God")).toBe(false);
    expect(isChordLine("")).toBe(false);
    expect(isChordLine("후렴")).toBe(false);
  });
});

describe("transposeChart", () => {
  it("코드 줄만 옮기고 가사는 그대로, 자리도 맞춘다", () => {
    const chart = ["G       D        Em    C", "주님의 사랑 놀라워 영원해"].join("\n");
    expect(transposeChart(chart, 2)).toBe(["A       E        F#m   D", "주님의 사랑 놀라워 영원해"].join("\n"));
  });
  it("길어진 코드 뒤는 한 칸 이상 띄운다", () => {
    expect(transposeChart("E F", 2)).toBe("F# G");
  });
  it("대괄호 코드(ChordPro)와 key 지시어도 옮긴다", () => {
    expect(transposeChart("{key: G}\n[G]주 님의 [D/F#]사랑 [Verse]", 2)).toBe("{key: A}\n[A]주 님의 [E/G#]사랑 [Verse]");
  });
  it("목표 키에 맞춰 #/b 표기를 고른다", () => {
    expect(transposeChart("C  G  Am  F", 3, { targetKey: parseKey("Eb") })).toBe("Eb Bb Cm  Ab");
    expect(transposeChart("C  G  Am  F", 6, { targetKey: parseKey("F#") })).toBe("F# C# D#m B");
  });
  it("0반음이면 그대로", () => {
    expect(transposeChart("G D", 12)).toBe("G D");
  });
});

describe("키", () => {
  it("키 글자를 읽고 옮긴다", () => {
    expect(keyName(parseKey("G Key")!)).toBe("G");
    expect(keyName(parseKey("F#m")!)).toBe("F#m");
    expect(parseKey("키 없음")).toBeNull();
    expect(transposeKeyText("A→B", 2)).toBe("B→Db");
    expect(transposeKeyText("G", 3)).toBe("Bb");
    expect(transposeKeyText("Em", 2)).toBe("F#m");
  });
});

describe("importChart", () => {
  it("줄바꿈·탭을 정리하고 키·제목을 찾는다", () => {
    const r = importChart("{title: 은혜}\r\n{key: D}\r\n\tD   A\r\n가사  \r\n");
    expect(r).toEqual({ chart: "{title: 은혜}\n{key: D}\n    D   A\n가사", key: "D", keyGuessed: false, title: "은혜" });
  });
  it("Key: 줄을 읽는다", () => {
    expect(importChart("Key: F#\nF#  B").key).toBe("F#");
  });
  it("키 표기가 없으면 첫 코드로 추정한다", () => {
    expect(importChart("주님\nEm  C  G  D\n가사")).toMatchObject({ key: "Em", keyGuessed: true });
    expect(importChart("가사만")).toMatchObject({ key: null });
  });
});
