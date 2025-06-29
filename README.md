# 🎙️ MeetAssist - Privacy-First AI Meeting Assistant

> **Offline Chrome extension that records, transcribes, and summarizes Google Meet calls with complete privacy preservation.**

## ✨ Features

- 🚀 **Auto-launch** - Automatically activates on Google Meet calls
- 🎥 **Local Recording** - Captures audio/video using Chrome APIs
- 🗣️ **Speech-to-Text** - Offline transcription with Whisper.cpp
- 👥 **Speaker Diarization** - Identifies and maps speakers to Meet participants
- 📋 **Live Summaries** - AI-powered 5-minute rolling summaries
- 📧 **Meeting Minutes** - Generates and emails comprehensive MoM
- 🔒 **100% Private** - All processing happens locally, zero cloud calls
- 🌐 **Multi-language** - Supports EN, AR, and mixed language modes

## 🏗️ Architecture

```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│ Chrome Extension│ ◄─────────────► │ Node.js Backend  │
│                 │                 │                  │
│ • Content Script│                 │ • Whisper.cpp    │
│ • React Sidebar │                 │ • Diarization    │
│ • Media Capture │                 │ • AI Summaries   │
│ • UI Components │                 │ • Email Service  │
└─────────────────┘                 └──────────────────┘
```

## 📦 Project Structure

```
meetassist/
├─ extension/          # Chrome extension (Manifest v3)
│  ├─ src/
│  │  ├─ background.ts      # Service worker
│  │  ├─ content/inject.ts  # Meet page injection
│  │  ├─ sidebar/           # React UI components
│  │  └─ popup/             # Extension popup
│  └─ public/
├─ server/             # Node.js backend
│  ├─ src/
│  │  ├─ meeting/          # Meeting management
│  │  ├─ stt/              # Speech-to-text
│  │  ├─ summary/          # AI summarization
│  │  ├─ email/            # Email service
│  │  └─ storage/          # File system storage
└─ shared/             # Shared types & utilities
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Chrome/Chromium browser
- pnpm (recommended) or npm

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd meetassist
   pnpm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP settings
   ```

3. **Build the project:**
   ```bash
   pnpm build
   ```

4. **Start the backend server:**
   ```bash
   cd server
   pnpm dev
   ```

5. **Load Chrome extension:**
   - Open Chrome → Extensions → Developer mode
   - Click "Load unpacked" → Select `extension/dist` folder
   - Extension icon should appear in toolbar

### Usage

1. **Join a Google Meet call** - Extension activates automatically
2. **Grant permissions** when prompted for screen/audio capture
3. **View live sidebar** with real-time transcription and summaries
4. **End meeting** - Minutes are saved locally and emailed to participants

## 🎯 Core Components

### Chrome Extension

- **Background Service** - Detects Meet calls, manages WebSocket connection
- **Content Script** - Injects into Meet pages, captures media streams
- **React Sidebar** - Live transcription and summary display
- **Media Capture** - Uses `chrome.tabCapture` and Web Audio API

### Node.js Backend

- **Meeting Manager** - Orchestrates recording, transcription, and summarization
- **Transcription Service** - Whisper.cpp integration with speaker diarization
- **Summary Service** - Local AI model for generating meeting insights
- **Email Service** - SMTP-based meeting minutes distribution
- **Storage Service** - File system persistence for transcripts and recordings

## 🔧 Configuration

### Extension Settings

Configure via popup or extension options:

- **Language Mode** - EN, AR, or MIX
- **Summary Interval** - Default 5 minutes
- **Auto-start** - Automatically begin recording
- **Email Recipients** - Meeting minutes distribution list

### Server Configuration

Environment variables in `.env`:

```bash
# WebSocket server port
WS_PORT=3001

# SMTP settings for email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Whisper model selection
WHISPER_MODEL=tiny-int8  # tiny, base, small, medium, large
```

## 🧪 Development

### Running in Development

```bash
# Terminal 1 - Backend server
cd server
pnpm dev

# Terminal 2 - Extension build (watch mode)
cd extension  
pnpm dev

# Load unpacked extension in Chrome for testing
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific packages
pnpm test --filter=extension
pnpm test --filter=server
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Type checking
pnpm type-check

# Format code
pnpm format
```

## 📊 Performance

- **Transcription Latency** - ~2-3 seconds with tiny model
- **Memory Usage** - ~200MB for extension + 500MB for server
- **Storage** - ~50MB per hour of meeting (including video chunks)
- **CPU Usage** - Moderate during transcription, low during summaries

## 🛡️ Privacy & Security

- **Zero External APIs** - All processing happens locally
- **Local Storage Only** - Recordings saved to local filesystem
- **No Data Transmission** - Transcript data never leaves your machine
- **Optional Email** - Meeting minutes only sent if explicitly configured
- **Chrome Permissions** - Only requests necessary tab capture permissions

## 🔮 Future Enhancements

- **Advanced Diarization** - Enhanced speaker identification accuracy
- **Action Item Extraction** - Automatic detection of tasks and assignments
- **Integrations** - Jira, GitHub, Notion export capabilities
- **Advanced Summaries** - Keyword highlighting, sentiment analysis
- **Multi-platform** - Firefox and Edge extension support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build process or auxiliary tool changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation** - Check the `/docs` folder for detailed guides
- 🐛 **Issues** - Report bugs via GitHub Issues
- 💬 **Discussions** - Join GitHub Discussions for questions
- 📧 **Contact** - Email support@meetassist.dev

---

**MeetAssist** - Empowering productive meetings with privacy-first AI assistance.