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
    const noiseStr = req.body.noise;

    if (!file) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }

    const scale = parseInt(scaleStr) || 2;
    const noise = parseInt(noiseStr) ?? 1;

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
          '-n', 'realesrgan-x4plus',
          '-s', String(scale),
          '-g', '0',
          '-j', '2:2:2',
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
