import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
export function getOutputPath(inputPath, outputDir, format) {
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputFilename = `${inputBasename}.${format.toLowerCase()}`;
  return path.join(outputDir, outputFilename);
}
export function isValidVideoFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.flv', '.wmv', '.m4v', '.3gp'];
  return videoExtensions.includes(ext);
}
export function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
}
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
