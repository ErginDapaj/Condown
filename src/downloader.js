import pkg from 'yt-dlp-wrap';
const YTDlpWrap = pkg.default.default || pkg.default;
import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { ensureDirectoryExists, formatDuration, formatFileSize } from './utils.js';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const ytDlpWrap = new YTDlpWrap();
function cleanupTempFiles(directory) {
  try {
    const files = fs.readdirSync(directory);
    files.forEach(file => {
      if (file.includes('-player-script.js') || file.match(/^\d+-player-script\.js$/)) {
        const filePath = path.join(directory, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temporary file: ${file}`);
        } catch (err) {
          console.warn(`Failed to delete temp file ${file}:`, err.message);
        }
      }
    });
  } catch (err) {
    console.warn(`Could not clean temp files in ${directory}:`, err.message);
  }
}
export async function getVideoInfo(url) {
  try {
    const jsonOutput = await Promise.race([
      ytDlpWrap.execPromise([url, '--dump-json', '--no-warnings', '--no-playlist']),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Video info request took too long')), 30000)
      )
    ]);
    const info = JSON.parse(jsonOutput);
    return {
      title: info.title || info.fulltitle || 'Unknown',
      channel: info.channel || info.uploader || 'Unknown',
      duration: info.duration || 0,
      viewCount: info.view_count || '0',
      description: info.description || ''
    };
  } catch (error) {
    throw new Error(`Failed to get video info: ${error.message}`);
  }
}
async function mergeVideoAudio(videoPath, audioPath, outputPath, progressCallback = null) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-strict experimental',
        '-map 0:v:0',
        '-map 1:a:0'
      ])
      .on('start', () => {
        if (progressCallback) progressCallback(0);
      })
      .on('progress', (progress) => {
        if (progress.percent && progressCallback) {
          const percent = Math.min(Math.round(progress.percent), 99);
          progressCallback(percent);
        }
      })
      .on('end', () => {
        if (progressCallback) progressCallback(100);
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`Merge failed: ${err.message}`));
      })
      .save(outputPath);
  });
}
export async function downloadYouTubeVideo(url, quality, format, outputDir, progressCallback = null) {
  try {
    if (progressCallback) {
      progressCallback({ percent: 0, message: 'Fetching video information...' });
    }
    const info = await getVideoInfo(url);
    const title = (info.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
    if (progressCallback) {
      progressCallback({ percent: 2, message: 'Video info retrieved. Preparing download...' });
    }
    ensureDirectoryExists(outputDir);
    const extension = format.toLowerCase() === 'webm' ? 'webm' : 'mp4';
    const outputPath = path.join(outputDir, `${title}.${extension}`);
    if (fs.existsSync(outputPath)) {
      throw new Error(`File already exists: ${outputPath}`);
    }
    if (progressCallback) {
      progressCallback({ percent: 3, message: 'Selecting format...' });
    }
    let formatSelector = null; 
    if (quality === '1080p') {
      formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo[height<=1080]+bestaudio';
    } else if (quality === '2K' || quality === '1440p') {
      formatSelector = 'bestvideo[height<=1440]+bestaudio/best[height<=1440]/bestvideo[height<=1440]+bestaudio';
    } else if (quality === '4K' || quality === '2160p') {
      formatSelector = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]/bestvideo[height<=2160]+bestaudio';
    } else if (quality === 'audio') {
      formatSelector = 'bestaudio';
    } else if (quality === 'best') {
      formatSelector = null;
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Download timeout: Process took too long (10 minutes)'));
      }, 600000); 
      if (progressCallback) {
        progressCallback({ percent: 4, message: 'Initializing download...' });
      }
      const args = [
        url,
        '-o', outputPath,
        '--merge-output-format', extension,
        '--no-mtime',
        '--no-playlist',
        '--no-warnings',
        '--progress',
        '--newline',
        '--no-download-archive' 
      ];
      if (formatSelector) {
        args.push('-f', formatSelector);
      }
      if (progressCallback) {
        progressCallback({ percent: 10, message: 'Starting download...' });
      }
      console.log('Download args:', args);
      const process = ytDlpWrap.exec(args);
      let lastProgress = 0;
      let buffer = '';
      if (!process) {
        reject(new Error('Failed to create yt-dlp process'));
        return;
      }
      const childProcess = process.ytDlpProcess || process;
      if (!childProcess) {
        reject(new Error('Failed to get child process from yt-dlp-wrap'));
        return;
      }
      if (childProcess.stderr && typeof childProcess.stderr.on === 'function') {
        childProcess.stderr.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 
        for (const line of lines) {
          const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
          if (progressMatch && progressCallback) {
            const percent = Math.min(parseFloat(progressMatch[1]), 99);
            if (percent > lastProgress) {
              lastProgress = percent;
              progressCallback({
                percent: 10 + (percent * 0.9),
                message: `Downloading... ${Math.round(percent)}%`
              });
            }
          }
          if (line.includes('[Merger]') || line.includes('Merging')) {
            if (progressCallback) {
              progressCallback({
                percent: 95,
                message: 'Merging video and audio...'
              });
            }
          }
        }
      });
      } else {
        console.warn('childProcess.stderr is not available or does not support .on()');
      }
      if (childProcess.stdout && typeof childProcess.stdout.on === 'function') {
        childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const progressMatch = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (progressMatch && progressCallback) {
          const percent = Math.min(parseFloat(progressMatch[1]), 99);
          if (percent > lastProgress) {
            lastProgress = percent;
            progressCallback({
              percent: 10 + (percent * 0.9),
              message: `Downloading... ${Math.round(percent)}%`
            });
          }
        }
      });
      } else {
        console.warn('childProcess.stdout is not available or does not support .on()');
      }
      if (childProcess && typeof childProcess.on === 'function') {
        childProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          cleanupTempFiles(path.dirname(outputPath));
          if (progressCallback) {
            progressCallback({ percent: 100, message: 'Download complete!' });
          }
          resolve(outputPath);
        } else {
          cleanupTempFiles(path.dirname(outputPath));
          reject(new Error(`Download failed with exit code ${code}`));
        }
      });
        childProcess.on('error', (error) => {
          clearTimeout(timeout);
          console.error('Process error:', error);
          reject(error);
        });
      } else {
        console.warn('childProcess does not support .on() for error handling');
        setTimeout(() => {
          clearTimeout(timeout);
          reject(new Error('Process creation failed - no event handlers available'));
        }, 1000);
      }
    });
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}
async function downloadSeparateStreams(url, quality, extension, outputPath, outputDir, title, progressCallback) {
  const height = quality === '4K' || quality === '2160p' ? '2160' : 
                 quality === '2K' || quality === '1440p' ? '1440' : '1080';
  const videoPath = path.join(outputDir, `${title}_video.${extension}`);
  const audioPath = path.join(outputDir, `${title}_audio.${extension}`);
  if (progressCallback) {
    progressCallback({ percent: 5, message: 'Downloading video stream...' });
  }
  await new Promise((resolve, reject) => {
    const videoArgs = [
      url,
      '-f', `bestvideo[height<=${height}][ext=${extension}]/bestvideo[height<=${height}]`,
      '-o', videoPath,
      '--no-mtime',
      '--no-playlist'
    ];
    const process = ytDlpWrap.exec(videoArgs);
    const childProcess = process.ytDlpProcess || process;
    let lastProgress = 0;
    const handleProgress = (data) => {
      const output = data.toString();
      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch && progressCallback) {
        const percent = Math.min(parseFloat(progressMatch[1]), 99);
        if (percent > lastProgress) {
          lastProgress = percent;
          progressCallback({
            percent: 5 + (percent * 0.35),
            message: `Downloading video... ${Math.round(percent)}%`
          });
        }
      }
    };
    if (childProcess.stdout) childProcess.stdout.on('data', handleProgress);
    if (childProcess.stderr) childProcess.stderr.on('data', handleProgress);
    childProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Video download failed with code ${code}`));
    });
  });
  if (progressCallback) {
    progressCallback({ percent: 45, message: 'Downloading audio stream...' });
  }
  await new Promise((resolve, reject) => {
    const audioArgs = [
      url,
      '-f', 'bestaudio',
      '-o', audioPath,
      '--no-mtime',
      '--no-playlist'
    ];
    const process = ytDlpWrap.exec(audioArgs);
    const childProcess = process.ytDlpProcess || process;
    let lastProgress = 0;
    const handleProgress = (data) => {
      const output = data.toString();
      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch && progressCallback) {
        const percent = Math.min(parseFloat(progressMatch[1]), 99);
        if (percent > lastProgress) {
          lastProgress = percent;
          progressCallback({
            percent: 45 + (percent * 0.25),
            message: `Downloading audio... ${Math.round(percent)}%`
          });
        }
      }
    };
    if (childProcess.stdout) childProcess.stdout.on('data', handleProgress);
    if (childProcess.stderr) childProcess.stderr.on('data', handleProgress);
    childProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Audio download failed with code ${code}`));
    });
  });
  if (progressCallback) {
    progressCallback({ percent: 75, message: 'Merging video and audio...' });
  }
  await mergeVideoAudio(videoPath, audioPath, outputPath, (percent) => {
    if (progressCallback) {
      progressCallback({
        percent: 75 + (percent * 0.25),
        message: `Merging... ${Math.round(percent)}%`
      });
    }
  });
  fs.removeSync(videoPath);
  fs.removeSync(audioPath);
  return outputPath;
}
export function getQualityOptions() {
  return [
    { name: '1080p (Full HD)', value: '1080p' },
    { name: '1440p (2K)', value: '2K' },
    { name: '2160p (4K)', value: '4K' },
    { name: 'Best available', value: 'best' },
    { name: 'Audio only', value: 'audio' }
  ];
}
export function getFormatOptions() {
  return ['MP4', 'WebM'];
}
}
