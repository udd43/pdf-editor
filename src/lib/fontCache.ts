export interface FontBuffers {
  NotoSansKR: ArrayBuffer | null;
  NanumMyeongjo: ArrayBuffer | null;
  Jua: ArrayBuffer | null;
}

let cachedFonts: FontBuffers | null = null;
let fontLoadPromise: Promise<FontBuffers> | null = null;

const loadFontBuffer = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.error(`Failed to load font from ${url}:`, e);
    return null;
  }
};

/**
 * 폰트를 한 번만 다운로드하고 메모리에 캐싱합니다.
 */
export const getFontBuffers = async (): Promise<FontBuffers> => {
  if (cachedFonts) {
    return cachedFonts;
  }

  if (fontLoadPromise) {
    return fontLoadPromise;
  }

  fontLoadPromise = (async () => {
    const [notoBuffer, myeongjoBuffer, juaBuffer] = await Promise.all([
      loadFontBuffer("/NotoSansKR-Regular.otf"),
      loadFontBuffer("/NanumMyeongjo.ttf"),
      loadFontBuffer("/Jua.ttf"),
    ]);

    cachedFonts = {
      NotoSansKR: notoBuffer,
      NanumMyeongjo: myeongjoBuffer,
      Jua: juaBuffer,
    };
    
    return cachedFonts;
  })();

  return fontLoadPromise;
};
