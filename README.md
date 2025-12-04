# Condown - Video Converter & YouTube Downloader

A simple, easy-to-use web application for converting videos and downloading YouTube videos in various formats and resolutions.

## Features

- **Video Conversion**: Convert videos between different formats (MP4, AVI, MKV, WebM, MOV)
- **Quality Control**: Choose output resolution (1080p, 720p, 480p, or keep original)
- **YouTube Downloader**: Download YouTube videos in 1080p, 2K (1440p), or 4K (2160p)
- **Format Selection**: Choose between MP4 and WebM for YouTube downloads
- **Web Interface**: Beautiful, modern web UI - no command line needed
- **No Python Required**: Pure Node.js implementation

## Requirements

- Node.js (v16 or higher)
- npm (comes with Node.js)

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

That's it! The FFmpeg binary will be automatically installed as part of the dependencies.

## Usage

1. Start the server:

```bash
npm start
```

2. Open your web browser and navigate to:

```
http://localhost:3000
```

3. Use the web interface to:
   - **Download YouTube videos**: Paste a YouTube URL, select quality and format, then download
   - **Convert videos**: Upload a video file, choose output format and quality, then convert

## How to Use

### YouTube Downloader

1. Click on the "YouTube Downloader" tab
2. Paste a YouTube video URL
3. Select the desired quality (1080p, 2K, 4K, Best available, or Audio only)
4. Choose the format (MP4 or WebM)
5. Click "Download Video"
6. Wait for the download to complete
7. Click the "Download File" button to save the video to your computer

### Video Converter

1. Click on the "Video Converter" tab
2. Click "Choose File" and select a video file from your computer
3. Select the output format (MP4, AVI, MKV, WebM, or MOV)
4. Choose the quality (Keep original, 1080p, 720p, or 480p)
5. Click "Convert Video"
6. Wait for the conversion to complete
7. Click the "Download File" button to save the converted video

## Supported Formats

### Video Conversion Input Formats
- MP4, AVI, MKV, WebM, MOV, FLV, WMV, M4V, 3GP

### Video Conversion Output Formats
- MP4, AVI, MKV, WebM, MOV

### YouTube Download Formats
- MP4, WebM

## Troubleshooting

### "Invalid video file" error
- Make sure you selected a valid video file
- Ensure the file is not corrupted
- Check that the file size is under 5GB

### "Invalid YouTube URL" error
- Make sure the URL is a valid YouTube link
- Check that the video is not private or region-restricted
- Some videos may not be available for download

### Conversion fails
- Ensure you have enough disk space
- Check that the file is a valid video format
- Some video codecs may not be supported

### Download fails
- YouTube may have updated their API
- The video might be age-restricted or unavailable
- Try a different quality option
- The app will automatically try lower quality formats if high quality is blocked

### Server won't start
- Make sure port 3000 is not already in use
- Check that all dependencies are installed (`npm install`)
- Ensure Node.js version is 16 or higher

## Changing the Port

If port 3000 is already in use, you can change it by setting the PORT environment variable:

```bash
PORT=8080 npm start
```

Then access the app at `http://localhost:8080`

## Technical Details

- **Web Server**: Express.js
- **Video Conversion**: Uses FFmpeg via `fluent-ffmpeg`
- **FFmpeg Installation**: Automatically handled by `@ffmpeg-installer/ffmpeg`
- **YouTube Download**: Uses `@distube/ytdl-core` (pure Node.js, no Python required)
- **File Upload**: Handled by Multer
- **Frontend**: Vanilla HTML, CSS, and JavaScript (no frameworks required)

## Project Structure

```
condown/
├── public/          # Web UI files
│   ├── index.html   # Main HTML page
│   ├── styles.css   # Styling
│   └── app.js       # Frontend JavaScript
├── src/
│   ├── server.js    # Express server
│   ├── converter.js # Video conversion logic
│   ├── downloader.js # YouTube download logic
│   └── utils.js     # Helper functions
├── downloads/       # Downloaded YouTube videos
├── output/          # Converted videos
└── uploads/         # Temporary upload directory
```

## License

MIT

## Contributing

Feel free to submit issues or pull requests!
