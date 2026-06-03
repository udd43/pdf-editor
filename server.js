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
  // 서버 안정화 테스트를 위해 임시 비활성화됨
  return res.status(501).json({ error: "업스케일링 기능이 서버 안정화 테스트를 위해 임시로 비활성화되었습니다." });
});

// For any other route, serve index.html (SPA routing support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
