# Miles Connect

Production-quality Windows desktop app that receives notifications from your Android phone over Wi-Fi and displays them as clean, non-intrusive overlays. Formerly known as PhoneBridge.

## Features

- **WebSocket Server**: Built-in server on port 8787 for high-speed local communication.
- **QR Pairing**: Easily connect your phone by scanning the QR code on the dashboard.
- **Game-Safe Overlays**: Notifications appear in a transparent, always-on-top window that doesn't steal focus or minimize fullscreen games.
- **Call Alerts**: Special handling for incoming calls with persistent alerts.
- **Tray Support**: Minimizes to the system tray to keep your desktop clean.
- **Modern UI**: Dark, premium design with glassmorphism effects.

## Tech Stack

- **Electron**: Desktop application framework.
- **React**: UI library.
- **Vite**: Modern frontend build tool.
- **ws**: WebSocket implementation for Node.js.
- **Framer Motion**: Smooth animations for notifications.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository (if applicable) or copy the files.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development

```bash
npm run dev
```

### Building for Production (Windows)

```bash
npm run build
```
This will generate a portable `.exe` and an installer in the `dist` directory.

## Connection Info

- **Default Port**: 8787
- **URL Format**: `ws://YOUR_PC_IP:8787`

The app automatically detects your local IPv4 address and displays it as a QR code for easy pairing.

## Notification Format

The app accepts JSON messages via WebSocket:

### Standard Notification
```json
{
  "type": "notification",
  "app": "WhatsApp",
  "title": "Mom",
  "text": "Call me when free",
  "time": 1710000000000
}
```

### Incoming Call
```json
{
  "type": "call",
  "name": "Unknown",
  "number": "+91XXXXXXXXXX",
  "state": "ringing",
  "time": 1710000000000
}
```

## Settings

- **Overlay Position**: Top-Right, Top-Left, Bottom-Right, Bottom-Left.
- **Duration**: Adjustable from 3s to 15s.
- **Gaming Mode**: Optimized performance for gaming sessions.
- **Sound Alerts**: Toggle notification sounds.

## License

MIT
