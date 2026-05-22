import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { writeFile, readFile, unlink, mkdir, copyFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import os from "os";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const tmpDir = path.join(os.tmpdir(), "tmp-upscale");

  try {
    // tmp 디렉토리 생성
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;
    const scaleStr = formData.get("scale") as string;
    const noiseStr = formData.get("noise") as string;

    if (!file) {
      return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
    }

    const scale = parseInt(scaleStr) || 2;
    const noise = parseInt(noiseStr) ?? 1;

    // 파일 저장
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `input_${timestamp}.png`);
    const outputPath = path.join(tmpDir, `output_${timestamp}.png`);

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. 캐시 확인 로직 (이미 같은 파일이 업스케일링 된 적 있는지)
    const cacheDir = path.join(os.tmpdir(), "pdfitor-upscale-cache");
    if (!existsSync(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }
    const hash = crypto.createHash("md5").update(buffer).update(String(scale)).digest("hex");
    const cachedPath = path.join(cacheDir, `${hash}.png`);

    if (existsSync(cachedPath)) {
      console.log(`[Cache Hit] Returning cached upscaled image for hash: ${hash}`);
      const cachedBuffer = await readFile(cachedPath);
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="upscaled_cached.png"`,
        },
      });
    }

    // 캐시가 없으면 임시 파일로 저장 후 처리
    await writeFile(inputPath, buffer);

    // Real-ESRGAN-ncnn-vulkan 실행
    // -n realesrgan-x4plus (기본 고품질 모델)
    const { execFile } = require('child_process');
    
    // VRAM 12GB (50% 제한) & 동시접속 5명 최적화: 1인당 1.2GB 여유로 고품질 범용 모델 적용 가능
    await new Promise<void>((resolve, reject) => {
      execFile(
        '/opt/realesrgan/realesrgan-ncnn-vulkan',
        [
          '-i', inputPath,
          '-o', outputPath,
          '-n', 'realesrgan-x4plus', // 1인당 1.2GB 할당 가능하므로 빠르고 고품질인 범용 모델 사용
          '-s', String(scale),
          '-g', '0',                 // 0번 GPU 사용
          '-j', '2:2:2',             // 동시접속 5명에 맞춰 각 프로세스가 적당한 스레드를 점유하도록 세팅
          '-m', '/opt/realesrgan/models'
        ],
        { timeout: 120000 },
        (error: Error | null, stdout: string, stderr: string) => {
          if (error) {
            console.error("Real-ESRGAN error:", stderr);
            reject(new Error(`업스케일링 실행 실패: ${stderr || error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    // 결과 파일 읽기
    const outputBuffer = await readFile(outputPath);

    // 2. 성공한 결과물을 캐시 폴더에 저장 (다음 요청을 위해)
    await copyFile(outputPath, cachedPath).catch((err) => console.warn("Cache write failed:", err));

    // 임시 파일 정리
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="upscaled_${timestamp}.png"`,
      },
    });
  } catch (error: any) {
    console.error("Upscale error:", error);
    return NextResponse.json(
      { error: error.message || "업스케일링 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

