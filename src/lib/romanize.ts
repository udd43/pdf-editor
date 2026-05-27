export function koreanToRoman(text: string): string {
  const cho = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  const jung = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  const jong = ["", "k", "kk", "ks", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];

  const SURNAME_MAP: Record<string, string> = {
    "김": "kim", "이": "lee", "박": "park", "최": "choi", "정": "jung", 
    "강": "kang", "조": "cho", "윤": "yoon", "장": "jang", "임": "lim", 
    "한": "han", "오": "oh", "서": "seo", "신": "shin", "권": "kwon", 
    "황": "hwang", "안": "ahn", "송": "song", "전": "jeon", "홍": "hong", 
    "유": "yoo", "고": "ko", "문": "moon", "양": "yang", "손": "son", 
    "배": "bae", "백": "baek", "허": "hur", "남": "nam", "심": "shim", 
    "노": "noh", "하": "ha", "곽": "kwak", "성": "sung", "차": "cha", 
    "주": "joo", "우": "woo", "구": "koo", "나": "na", "민": "min", 
    "진": "jin", "지": "ji", "엄": "um", "채": "chae", "원": "won", 
    "천": "chun", "방": "bang", "공": "kong", "현": "hyun", "함": "ham", 
    "변": "byun", "염": "yeom", "여": "yeo", "추": "choo", "도": "do", 
    "소": "so", "석": "seok", "선": "sun", "설": "seol", "마": "ma", 
    "길": "gil", "연": "yeon", "위": "wi", "표": "pyo", "명": "myung", 
    "기": "ki", "반": "ban", "라": "ra", "왕": "wang", "금": "geum", 
    "옥": "ok", "육": "yook", "인": "in", "맹": "maeng", "제": "je", 
    "모": "mo", "탁": "tak", "국": "kook", "어": "eo", "은": "eun", 
    "편": "pyeon", "용": "yong", "남궁": "namgoong", "독고": "dokgo", 
    "사공": "sagong", "선우": "sunwoo", "황보": "hwangbo", "제갈": "jegal"
  };

  let result = "";
  let startIndex = 0;

  // 1. 성씨 처리 (두 글자 성씨 확인 후 한 글자 성씨 확인)
  // 띄어쓰기가 있다면 무시하고 맨 앞 글자를 성씨로 판단
  const trimmedText = text.trim();
  if (trimmedText.length >= 2) {
    const twoCharSurname = trimmedText.substring(0, 2);
    if (SURNAME_MAP[twoCharSurname]) {
      result += SURNAME_MAP[twoCharSurname];
      startIndex = text.indexOf(twoCharSurname) + 2;
      // 성과 이름 띄어쓰기를 위해 빈칸 추가 안함 (PdfEditor에서 _ 로 구분하므로)
      // 이름이 바로 이어지면 _를 붙여서 split(' ') 시 떨어지도록 할까?
      // 기존 방식은 글자마다 _를 안 붙이고, 그냥 띄어쓰기만 _ 로 바꿨음.
      // 근데 홍길동 => honggildong 이면 split('_') 가 동작 안함.
      // 아. 기존 코드를 보니 띄어쓰기를 _ 로 바꿨네.
      // 만약 띄어쓰기가 없었다면 honggildong 이 됨.
    }
  }

  if (startIndex === 0 && trimmedText.length >= 1) {
    const oneCharSurname = trimmedText.substring(0, 1);
    if (SURNAME_MAP[oneCharSurname]) {
      result += SURNAME_MAP[oneCharSurname];
      startIndex = text.indexOf(oneCharSurname) + 1;
    }
  }

  for (let i = startIndex; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // 한글 가(AC00) ~ 힣(D7A3) 사이인지 확인
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00;
      const choIndex = Math.floor(index / 588);
      const jungIndex = Math.floor((index - choIndex * 588) / 28);
      const jongIndex = index % 28;

      // 만약 성씨 변환 후 바로 이어지는 이름의 첫 글자이고, 기존 텍스트에 띄어쓰기가 없었다면?
      // 보통 "김철수" -> kim + cheol + su = kimcheolsu.
      // 하지만 영문명은 Kim Cheol Su 로 띄어쓰기를 원할 수 있음.
      // PdfEditor.tsx 에서는 _ 로 split() 하므로, 성씨 뒤에 _ 를 추가해주면 됨.
      if (i === startIndex && startIndex > 0 && text[i - 1] !== ' ') {
        result += "_";
      }

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
