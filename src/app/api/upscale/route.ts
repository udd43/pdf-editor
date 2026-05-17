import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import os from "os";

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
    await writeFile(inputPath, buffer);

    // Real-ESRGAN-ncnn-vulkan 실행
    // -n realesrgan-x4plus (기본 고품질 모델)
    const upscaleCmd = `/opt/realesrgan/realesrgan-ncnn-vulkan -i "${inputPath}" -o "${outputPath}" -n realesrgan-x4plus -s ${scale}`;

    await new Promise<void>((resolve, reject) => {
      exec(upscaleCmd, { timeout: 120000, cwd: '/opt/realesrgan' }, (error, stdout, stderr) => {
        if (error) {
          console.error("Real-ESRGAN error:", stderr);
          reject(new Error(`업스케일링 실행 실패: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });

    // 결과 파일 읽기
    const outputBuffer = await readFile(outputPath);

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

