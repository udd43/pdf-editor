const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'dist'))); // Serve Vite build

const upload = multer({ dest: path.join(os.tmpdir(), "tmp-upscale") });

app.post('/api/upscale', upload.single('image'), async (req, res) => {
  const tmpDir = path.join(os.tmpdir(), "tmp-upscale");

  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const file = req.file;
    const scaleStr = req.body.scale;
    const requestedModel = req.body.model || 'realesrgan-x4plus';

    if (!file) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }

    // 모델별 지원 배율 (x4plus 계열은 4배 전용 — 다른 배율로 돌리면 결과가 깨짐)
    const MODEL_SCALES = {
      'realesrgan-x4plus': [4],
      'realesrgan-x4plus-anime': [4],
      'realesr-animevideov3': [2, 3, 4],
    };
    const modelStr = MODEL_SCALES[requestedModel] ? requestedModel : 'realesrgan-x4plus';
    const requestedScale = parseInt(scaleStr) || 2;
    const supported = MODEL_SCALES[modelStr];
    // 요청 배율 이상인 지원 배율 중 가장 작은 값으로 실행 (초과분은 클라이언트에서 고품질 축소)
    const scale = supported.find((s) => s >= requestedScale) || supported[supported.length - 1];

    const timestamp = Date.now();
    const inputPath = file.path;
    const outputPath = path.join(tmpDir, `output_${timestamp}.png`);

    // Use local binary if it exists, otherwise fallback to /opt
    const localBin = path.join(__dirname, 'bin', 'realesrgan', 'realesrgan-ncnn-vulkan');
    const localModels = path.join(__dirname, 'bin', 'realesrgan', 'models');
    
    const binPath = fs.existsSync(localBin) ? localBin : '/opt/realesrgan/realesrgan-ncnn-vulkan';
    const modelsPath = fs.existsSync(localModels) ? localModels : '/opt/realesrgan/models';

    await new Promise((resolve, reject) => {
      execFile(
        binPath,
        [
          '-i', inputPath,
          '-o', outputPath,
          '-n', modelStr,
          '-s', String(scale),
          '-t', '256',
          '-f', 'png',
          '-j', '1:2:2',
          '-m', modelsPath
        ],
        { timeout: 120000 },
        (error, stdout, stderr) => {
          if (error) {
            console.error("Real-ESRGAN error:", stderr);
            reject(new Error(`업스케일링 실행 실패: ${stderr || error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    res.download(outputPath, `upscaled_${timestamp}.png`, (err) => {
      // Cleanup
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    });

  } catch (error) {
    console.error("Upscale error:", error);
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: error.message || "업스케일링 처리 중 오류가 발생했습니다." });
  }
});

// For any other route, serve index.html (SPA routing support)
// Express v5: 와일드카드 '*' 대신 '{*path}' 문법 사용
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
