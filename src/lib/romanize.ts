export function koreanToRoman(text: string): string {
  const cho = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  const jung = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  const jong = ["", "k", "kk", "ks", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];

  let result = "";

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // 한글 가(AC00) ~ 힣(D7A3) 사이인지 확인
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00;
      const choIndex = Math.floor(index / 588);
      const jungIndex = Math.floor((index - choIndex * 588) / 28);
      const jongIndex = index % 28;

      result += cho[choIndex] + jung[jungIndex] + jong[jongIndex];
    } else {
      // 한글이 아니면 그대로 추가 (영어, 숫자, 띄어쓰기 등)
      // 띄어쓰기는 그대로 유지하거나 언더스코어(_)로 바꿀 수 있음. 파일명이므로 언더스코어로 변경
      if (text[i] === " ") {
        result += "_";
      } else {
        result += text[i];
      }
    }
  }

  // 영문 소문자로 통일하고, 파일명에 적합하지 않은 특수문자 제거
  return result.toLowerCase().replace(/[^a-z0-9_\-\.]/g, "");
}
