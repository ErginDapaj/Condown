import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import { getOutputPath, ensureDirectoryExists } from './utils.js';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
export async function convertVideo(inputPath, outputFormat, quality, outputDir, progressCallback = null) {
  return new Promise((resolve, reject) => {
    ensureDirectoryExists(outputDir);
    const outputPath = getOutputPath(inputPath, outputDir, outputFormat);
    if (fs.existsSync(outputPath)) {
      return reject(new Error(`Output file already exists: ${outputPath}`));
    }
    let command = ffmpeg(inputPath)
      .format(outputFormat.toLowerCase())
      .on('start', (commandLine) => {
        if (progressCallback) progressCallback({ percent: 0, message: 'Starting conversion...' });
      })
      .on('progress', (progress) => {
        if (progress.percent && progressCallback) {
          const percent = Math.min(Math.round(progress.percent), 99);
          progressCallback({ 
            percent, 
            message: `Converting... ${percent}%`,
            timemark: progress.timemark 
          });
        }
      })
      .on('end', () => {
        if (progressCallback) progressCallback({ percent: 100, message: 'Conversion complete!' });
        resolve(outputPath);
      })
      .on('error', (err) => {
        if (progressCallback) progressCallback({ percent: 0, message: `Error: ${err.message}`, error: true });
        reject(err);
      });
    if (quality !== 'original') {
      if (quality === '1080p') {
        command = command.videoCodec('libx264').size('1920x1080');
      } else if (quality === '720p') {
        command = command.videoCodec('libx264').size('1280x720');
      } else if (quality === '480p') {
        command = command.videoCodec('libx264').size('854x480');
      } else if (quality === '2K') {
        command = command.videoCodec('libx264').size('2560x1440');
      } else if (quality === '4K') {
        command = command.videoCodec('libx264').size('3840x2160');
      }
    }
    if (quality !== 'original') {
      command = command.videoBitrate('5000k');
    }
    command.save(outputPath);
  });
}
export function getSupportedFormats() {
  return ['MP4', 'AVI', 'MKV', 'WebM', 'MOV'];
}
export function getQualityOptions() {
  return [
    { name: 'Keep original resolution', value: 'original' },
    { name: '1080p (Full HD)', value: '1080p' },
    { name: '720p (HD)', value: '720p' },
    { name: '480p (SD)', value: '480p' }
  ];
}
