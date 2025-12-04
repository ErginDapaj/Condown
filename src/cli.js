import inquirer from 'inquirer';
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { convertVideo, getSupportedFormats, getQualityOptions } from './converter.js';
import { downloadYouTubeVideo, getVideoInfo, getQualityOptions as getDownloadQualityOptions, getFormatOptions } from './downloader.js';
import { isValidVideoFile, isValidYouTubeUrl, formatDuration, ensureDirectoryExists } from './utils.js';
const program = new Command();
async function mainMenu() {
  console.log(chalk.cyan.bold('\n========================================'));
  console.log(chalk.cyan.bold('  Video Converter & YouTube Downloader'));
  console.log(chalk.cyan.bold('========================================\n'));
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Convert a video file', value: 'convert' },
        { name: 'Download from YouTube', value: 'download' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  if (action === 'convert') {
    await handleConvert();
  } else if (action === 'download') {
    await handleDownload();
  } else {
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
  }
}
async function handleConvert() {
  console.log(chalk.blue('\n--- Video Conversion ---\n'));
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputFile',
        message: 'Enter the path to your video file:',
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) {
            return 'Please enter a file path';
          }
          if (!isValidVideoFile(trimmed)) {
            return 'File does not exist or is not a valid video file';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'format',
        message: 'What format would you like to convert to?',
        choices: getSupportedFormats()
      },
      {
        type: 'list',
        name: 'quality',
        message: 'Select output quality:',
        choices: getQualityOptions()
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Where should the converted file be saved?',
        default: (answers) => {
          return path.dirname(answers.inputFile) || './';
        },
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) {
            return 'Please enter an output directory';
          }
          return true;
        }
      }
    ]);
    const outputDir = path.resolve(answers.outputPath);
    ensureDirectoryExists(outputDir);
    console.log(chalk.yellow('\nConverting video...'));
    const outputFile = await convertVideo(
      answers.inputFile,
      answers.format,
      answers.quality,
      outputDir
    );
    console.log(chalk.green('Conversion complete!'));
    console.log(chalk.blue(`Output: ${outputFile}`));
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}`));
  }
  await askAgain();
}
async function handleDownload() {
  console.log(chalk.blue('\n--- YouTube Downloader ---\n'));
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Enter YouTube video URL:',
        validate: (input) => {
          if (!isValidYouTubeUrl(input.trim())) {
            return 'Please enter a valid YouTube URL';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'quality',
        message: 'Select video quality:',
        choices: getDownloadQualityOptions()
      },
      {
        type: 'list',
        name: 'format',
        message: 'Select format:',
        choices: getFormatOptions()
      },
      {
        type: 'input',
        name: 'outputPath',
        message: 'Where should the video be saved?',
        default: './downloads',
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) {
            return 'Please enter an output directory';
          }
          return true;
        }
      }
    ]);
    const outputDir = path.resolve(answers.outputPath);
    ensureDirectoryExists(outputDir);
    console.log(chalk.yellow('\nFetching video information...'));
    const videoInfo = await getVideoInfo(answers.url);
    console.log(chalk.blue(`Title: ${videoInfo.title}`));
    console.log(chalk.blue(`Channel: ${videoInfo.channel}`));
    console.log(chalk.blue(`Duration: ${formatDuration(videoInfo.duration)}`));
    console.log(chalk.yellow('\nDownloading video...'));
    const outputFile = await downloadYouTubeVideo(
      answers.url,
      answers.quality,
      answers.format,
      outputDir
    );
    console.log(chalk.green('Download complete!'));
    console.log(chalk.blue(`Saved to: ${outputFile}`));
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}`));
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.log(chalk.yellow('\nTroubleshooting tips:'));
      console.log(chalk.yellow('  - YouTube may have updated their API'));
      console.log(chalk.yellow('  - The video might be region or age-restricted'));
      console.log(chalk.yellow('  - Try again in a few minutes'));
      console.log(chalk.yellow('  - Check if the video plays in your browser'));
    } else if (error.message.includes('Private') || error.message.includes('unavailable')) {
      console.log(chalk.yellow('This video may be private, deleted, or region-restricted.'));
    }
  }
  await askAgain();
}
async function askAgain() {
  const { again } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'again',
      message: 'Would you like to do something else?',
      default: true
    }
  ]);
  if (again) {
    await mainMenu();
  } else {
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
  }
}
program
  .name('condown')
  .description('Video converter and YouTube downloader')
  .version('1.0.0');
program
  .command('convert')
  .description('Convert a video file')
  .option('-i, --input <path>', 'Input video file path')
  .option('-o, --output <path>', 'Output directory path')
  .option('-f, --format <format>', 'Output format (MP4, AVI, MKV, WebM, MOV)')
  .option('-q, --quality <quality>', 'Output quality (original, 1080p, 720p, 480p)')
  .action(async (options) => {
    try {
      if (!options.input) {
        await handleConvert();
        return;
      }
      if (!isValidVideoFile(options.input)) {
        console.error(chalk.red('Error: Invalid video file'));
        process.exit(1);
      }
      const format = options.format || 'MP4';
      const quality = options.quality || 'original';
      const outputDir = path.resolve(options.output || path.dirname(options.input));
      ensureDirectoryExists(outputDir);
      console.log(chalk.yellow('Converting video...'));
      const outputFile = await convertVideo(options.input, format, quality, outputDir);
      console.log(chalk.green('Conversion complete!'));
      console.log(chalk.blue(`Output: ${outputFile}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
program
  .command('download')
  .description('Download a YouTube video')
  .option('-u, --url <url>', 'YouTube video URL')
  .option('-q, --quality <quality>', 'Video quality (1080p, 2K, 4K, best, audio)')
  .option('-f, --format <format>', 'Output format (MP4, WebM)')
  .option('-o, --output <path>', 'Output directory path')
  .action(async (options) => {
    try {
      if (!options.url) {
        await handleDownload();
        return;
      }
      if (!isValidYouTubeUrl(options.url)) {
        console.error(chalk.red('Error: Invalid YouTube URL'));
        process.exit(1);
      }
      const quality = options.quality || 'best';
      const format = options.format || 'MP4';
      const outputDir = path.resolve(options.output || './downloads');
      ensureDirectoryExists(outputDir);
      console.log(chalk.yellow('Fetching video information...'));
      const videoInfo = await getVideoInfo(options.url);
      console.log(chalk.blue(`Title: ${videoInfo.title}`));
      console.log(chalk.blue(`Channel: ${videoInfo.channel}`));
      console.log(chalk.blue(`Duration: ${formatDuration(videoInfo.duration)}`));
      console.log(chalk.yellow('\nDownloading video...'));
      const outputFile = await downloadYouTubeVideo(options.url, quality, format, outputDir);
      console.log(chalk.green('Download complete!'));
      console.log(chalk.blue(`Saved to: ${outputFile}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        console.log(chalk.yellow('\nTroubleshooting tips:'));
        console.log(chalk.yellow('  - YouTube may have updated their API'));
        console.log(chalk.yellow('  - The video might be region or age-restricted'));
        console.log(chalk.yellow('  - Try again in a few minutes'));
        console.log(chalk.yellow('  - Check if the video plays in your browser'));
      }
      process.exit(1);
    }
  });
const args = process.argv.slice(2);
if (args.length === 0) {
  mainMenu().catch((error) => {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  });
} else {
  program.parse();
}
