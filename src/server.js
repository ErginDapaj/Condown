import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { convertVideo, getSupportedFormats, getQualityOptions } from './converter.js';
import { downloadYouTubeVideo, getVideoInfo, getQualityOptions as getDownloadQualityOptions, getFormatOptions } from './downloader.js';
import { ensureDirectoryExists, isValidYouTubeUrl } from './utils.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 
  }
});
ensureDirectoryExists('uploads');
ensureDirectoryExists('downloads');
ensureDirectoryExists('output');
function cleanupTempFilesOnStartup() {
  try {
    const baseDir = path.join(__dirname, '..');
    const files = fs.readdirSync(baseDir);
    files.forEach(file => {
      if (file.includes('-player-script.js') || file.match(/^\d+-player-script\.js$/)) {
        const filePath = path.join(baseDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up leftover temp file: ${file}`);
        } catch (err) {
          console.warn(`Failed to delete temp file ${file}:`, err.message);
        }
      }
    });
  } catch (err) {
  }
}
cleanupTempFilesOnStartup();
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.post('/api/youtube/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/youtube/download', async (req, res) => {
  try {
    const { url, quality, format } = req.body;
    if (!url || !isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 
    const sendProgress = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      } catch (err) {
        console.error('Error sending progress:', err);
      }
    };
    try {
      let outputDir;
      if (req.body.output && req.body.output.trim()) {
        const outputPath = req.body.output.trim();
        if (outputPath.includes('..') || path.isAbsolute(outputPath)) {
          return sendProgress({ error: 'Invalid output path. Use relative paths only.', complete: true });
        }
        if (!/^[a-zA-Z0-9_/\-]+$/.test(outputPath)) {
          return sendProgress({ error: 'Invalid characters in output path.', complete: true });
        }
        outputDir = path.join(__dirname, '..', outputPath);
      } else {
        outputDir = path.join(__dirname, '../downloads');
      }
      await ensureDirectoryExists(outputDir);
      const outputPath = await downloadYouTubeVideo(
        url, 
        quality || 'best', 
        format || 'MP4', 
        outputDir,
        sendProgress
      );
      try {
        const files = fs.readdirSync(outputDir);
        files.forEach(file => {
          if (file.includes('-player-script.js') || file.match(/^\d+-player-script\.js$/)) {
            const filePath = path.join(outputDir, file);
            try {
              fs.unlinkSync(filePath);
              console.log(`Cleaned up temporary file: ${file}`);
            } catch (err) {
              console.warn(`Failed to delete temp file ${file}:`, err.message);
            }
          }
        });
      } catch (err) {
      }
      const filename = path.basename(outputPath);
      sendProgress({ 
        success: true, 
        complete: true,
        filename,
        path: outputPath,
        downloadUrl: `/api/download/${encodeURIComponent(filename)}`
      });
    } catch (error) {
      sendProgress({ error: error.message, complete: true });
    } finally {
      res.end();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/convert', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); 
    res.flushHeaders(); 
    const sendProgress = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      } catch (err) {
        console.error('Error sending progress:', err);
      }
    };
    try {
      const { format, quality, output } = req.body;
      const inputPath = req.file.path;
      let outputDir;
      if (output && output.trim()) {
        const outputPath = output.trim();
        if (outputPath.includes('..') || path.isAbsolute(outputPath)) {
          return sendProgress({ error: 'Invalid output path. Use relative paths only.', complete: true });
        }
        if (!/^[a-zA-Z0-9_/\-]+$/.test(outputPath)) {
          return sendProgress({ error: 'Invalid characters in output path.', complete: true });
        }
        outputDir = path.join(__dirname, '..', outputPath);
      } else {
        outputDir = path.join(__dirname, '../output');
      }
      await ensureDirectoryExists(outputDir);
      sendProgress({ percent: 0, message: 'Upload complete. Starting conversion...' });
      const outputPath = await convertVideo(
        inputPath,
        format || 'MP4',
        quality || 'original',
        outputDir,
        sendProgress
      );
      fs.removeSync(inputPath);
      const filename = path.basename(outputPath);
      sendProgress({ 
        success: true,
        complete: true,
        percent: 100,
        filename,
        path: outputPath,
        downloadUrl: `/api/download/${encodeURIComponent(filename)}`
      });
    } catch (error) {
      if (req.file) {
        fs.removeSync(req.file.path);
      }
      sendProgress({ error: error.message, complete: true });
    } finally {
      res.end();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/directories', async (req, res) => {
  try {
    const baseDir = path.join(__dirname, '..');
    const directories = [];
    const commonDirs = [
      'downloads',
      'output',
      'downloads/youtube',
      'downloads/videos',
      'downloads/audio',
      'output/converted',
      'output/videos'
    ];
    for (const dir of commonDirs) {
      const dirPath = path.join(baseDir, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          directories.push({
            name: dir.split('/').pop(),
            path: dir,
            fullPath: dirPath
          });
        }
      } catch (err) {
        directories.push({
          name: dir.split('/').pop(),
          path: dir,
          fullPath: dirPath,
          create: true
        });
      }
    }
    try {
      const files = await fs.readdir(baseDir);
      for (const file of files) {
        const filePath = path.join(baseDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'src' && file !== 'public') {
            if (!directories.find(d => d.path === file)) {
              directories.push({
                name: file,
                path: file,
                fullPath: filePath
              });
            }
          }
        } catch (err) {
        }
      }
    } catch (err) {
      console.error('Error reading base directory:', err);
    }
    res.json(directories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/download/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const downloadsPath = path.join(__dirname, '../downloads', filename);
  const outputPath = path.join(__dirname, '../output', filename);
  let filePath = null;
  if (fs.existsSync(downloadsPath)) {
    filePath = downloadsPath;
  } else if (fs.existsSync(outputPath)) {
    filePath = outputPath;
  }
  if (!filePath) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Failed to download file' });
    }
  });
});
app.get('/api/formats', (req, res) => {
  res.json({
    conversionFormats: getSupportedFormats(),
    conversionQualities: getQualityOptions(),
    downloadQualities: getDownloadQualityOptions(),
    downloadFormats: getFormatOptions()
  });
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
