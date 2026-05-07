<div align="center"># Miles Connect### Android + Windows companion app for same-Wi-Fi phone notifications, incoming call alerts, and game-safe PC overlays.<p>  <img src="https://img.shields.io/badge/platform-Android%20%7C%20Windows-blue?style=for-the-badge" />  <img src="https://img.shields.io/badge/tech-Kotlin%20%7C%20Electron-purple?style=for-the-badge" />  <img src="https://img.shields.io/badge/network-Same%20Wi--Fi-brightgreen?style=for-the-badge" />  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" /></p></div>---## Overview**Miles Connect** mirrors phone notifications and incoming call alerts from an Android phone to a Windows PC over the same Wi-Fi network.It is built for people who wear headphones while gaming, studying, coding, or working and often miss important calls or messages.Miles Connect works locally. No account, no cloud server, and no internet relay is required.---## Features- Android notification mirroring- Incoming SIM call alerts on PC- Contact name support for calls- Game-safe desktop overlays- Windows tray background app- Same-Wi-Fi local connection- Pairing-code setup- Manual IP fallback- Duplicate notification filtering- Lightweight Android + Windows apps- No login or cloud server required---## How It Works```txtAndroid Phone → Local Wi-Fi → Windows PC App → Desktop Overlay
The Android app listens for allowed notifications and incoming call events, then sends them to the Windows app through a local WebSocket connection.
The Windows app receives the event and shows a clean overlay without stealing focus or minimizing fullscreen apps.

Tech Stack
Android


Kotlin


NotificationListenerService


Telephony APIs


ContactsContract


OkHttp WebSocket


SharedPreferences


Windows


Electron


React


Vite


Node.js


WebSocket server


UDP LAN discovery


System tray integration


Desktop overlay window



Downloads
Get the latest APK and Windows installer from the Releases page.
Windows
Download and run:
Miles Connect Setup 1.0.0.exe
Android
Download and install:
Miles Connect.apk

Setup
Android
After installing the app, enable:


Notification Access


Phone permission


Contacts permission


On some Android devices, sideloaded apps may need:
Settings → Apps → Miles Connect → Allow restricted settings
Then enable Notification Access for Miles Connect.
Windows


Install and open Miles Connect.


Keep it running in the system tray.


Connect your phone using pairing code or manual Wi-Fi address.


Allow Windows Firewall access if prompted.


Manual connection example:
ws://192.168.1.8:8787

Development
Run PC App
cd pcnpm installnpm run dev
Build Windows Installer
cd pcnpm run dist
Run Android App
Open the android/ folder in Android Studio and run it on a connected Android phone.
Build APK from:
Build → Generate Signed Bundle / APK

Privacy
Miles Connect is designed to work locally.


No account required


No cloud server required


Notification and call data stay on your local Wi-Fi network by default


Android notifications are only read after the user grants Notification Access



Do Not Commit
Never upload private or build-generated files:
*.jks*.keystore*.apk*.exe.envlocal.propertiesnode_modules/dist/build/
Keep your Android signing key private.

Roadmap


Custom notification sounds


Custom call sounds


Voice announcements


WhatsApp call detection


Auto-start on Windows boot


Clipboard sync


Phone-to-PC file drop


Link sharing from phone to PC



Contributing
Contributions are welcome.
Good areas to improve:


Android background reliability


Windows overlay stability


Pairing flow


Notification filtering


UI polish


Documentation


Please keep the project lightweight, local-first, and privacy-focused.

License
This project is licensed under the MIT License.
See the LICENSE file for details.

<div align="center">
Miles Connect
Built for people who miss calls because their headphones are too good.
</div>
```
