# Shiguang Notes · 拾光便签

[简体中文](README.md) | **English**

Current version: **1.1.0** · [Changelog](CHANGELOG.md) · Free for noncommercial use only

An independent, offline desktop notes app inspired by the three-column workflow of WPS Notes. Capture ideas, organize rich text and images, and keep a floating note on your desktop. No account is required.

![Shiguang Notes interface](docs/screenshots/main.png)

## Run the app

### Windows installer

Run `npm run installer` to generate `release/installer/Shiguang-Notes-1.1.0-Windows-x64-Setup.exe`. Share this single file. Recipients can select a Chinese or English setup wizard and an installation directory, then launch the app from the desktop or Start menu. Node.js, npm, and WPS are not required. Uninstalling preserves local notes by default.

The installer is not commercially code-signed, so Windows may display an unknown-publisher notice. The application UI remains in Simplified Chinese.

### Unpacked application

Build from source using the instructions below, then launch `release/win-unpacked/拾光便签.exe`. This source repository does not include prebuilt binaries.

The Windows build does not require installation. Copy the **entire** `release/win-unpacked` directory to another computer, rather than just the executable. Windows 10 / 11 x64 is the intended target.

## Platform and size

This version has been packaged and tested on **Windows x64 only**. The application UI is in Simplified Chinese. Electron supports cross-platform development, but macOS and Linux builds have not yet been adapted or verified. Bilingual documentation does not imply an English application UI.

The current unpacked Windows application is approximately **304 MB**, largely due to the bundled Chromium and Node.js runtime. Development dependencies, packaged binaries, and personal notes are excluded from the source repository. Actual note storage depends on text, embedded images, and backups.

## Features

- All notes, pinned notes, folders, a monthly calendar filtered by last edit date, and a recoverable trash view.
- Keyword search across titles and body text, with multiple space-separated terms, highlights, all-notes/current-view scopes, and a clear button. Password-protected notes are searched by title only. Sort by last edited time, creation time, or title.
- Per-note password locks encrypt body text and images. Switching notes or closing a window relocks the note. Immediate lock and password-verified lock removal are supported.
- Move notes using the folder selector, the toolbar move button, the context menu, or drag and drop onto a folder in the sidebar.
- Note context menus provide move, pin, password, duplicate, export, and trash actions. Trash context menus provide restore and permanent deletion.
- Rich text: headings, bold, italic, underline, strikethrough, highlights, quotes, code blocks, lists, and checklists.
- Insert local images, paste clipboard images, or drag images into a note. PNG, JPEG, GIF, and WebP are supported, with a 15 MB limit per image.
- Autosave after a 400 ms delay, plus saving before switching notes or closing a window.
- Always-on-top floating notes with content synchronization between the floating window and main window.
- Copy note text, duplicate notes, and export plain text or HTML with embedded images.
- Import and export complete JSON backups. Imports append new copies without replacing existing notes.
- Light and dark themes, focus mode, a system tray menu, and a global new-note shortcut.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + N | Create a note |
| Ctrl + K | Search notes |
| Ctrl + S | Save immediately |
| Ctrl + B / I / U | Bold / italic / underline |
| Ctrl + Z / Ctrl + Shift + Z | Undo / redo |
| Ctrl + V | Paste text or clipboard images |
| Ctrl + Alt + N | Create a note from another application |
| Esc | Leave focus mode |

Closing the main window hides it in the system tray. Right-click the tray icon and choose **退出 (Quit)** to exit completely. Closing a floating note closes only that window. The global shortcut is active while the app is running; if another app has claimed it, use **新建便签 (New note)** in the tray menu.

## Local data and backups

Open **设置与备份 → 打开目录 (Settings & backups → Open folder)** to find the actual storage location. The default packaged-app location is `%APPDATA%/拾光便签/data`; development mode may use `%APPDATA%/shiguang-notes/data`.

- `notes.json` stores note text and embedded images locally. Notes are not uploaded to a cloud service.
- When changes occur, automatic backups are created at most once every 15 minutes. The 30 most recent `backup-*.json` files are retained.
- A backup is also created before importing. Repeatedly importing the same backup creates additional copies of its notes.
- Writes use a temporary file, a disk flush, and a rename within the same directory. If the primary file cannot be read, the app attempts to recover from the most recent valid backup and preserves the damaged original as `damaged-*.json`.
- Automatic backups reside on the same disk as the primary data. Export a backup to another location for migration or protection against disk failure.
- Ordinary notes use readable JSON. Password-protected bodies and images use AES-256-GCM with scrypt-derived keys. Titles, folder assignments, and timestamps remain visible. Passwords are not stored in plaintext.

## Note locks and upgrades

Right-click a note and choose **设置便签密码 (Set password)**, or use the toolbar lock icon. Enter a password of at least six characters twice. Use **输入密码打开 (Open with password)** to read or edit. Switching notes, closing the window, or restarting the app requires reauthentication. Floating windows unlock independently. Immediate lock saves pending edits across all windows before relocking that note everywhere.

Forgotten passwords cannot be recovered. Avoid sensitive titles because titles remain visible. Complete JSON backups and duplicated notes retain password protection. TXT/HTML exports made after unlocking are plaintext. Existing automatic backups, exports, and other copies created before locking are not encrypted retroactively.

The first password lock upgrades the data format to version 2, which 1.0.x cannot read. Export a backup and quit the old app through the tray before updating, then use version 1.1.0 or later. This version still reads and imports old backups. Imports append copies without overwriting existing notes.

## Relationship to WPS

This is an independent application. It does not require WPS and does not read or modify WPS data. This version does not include WPS account synchronization, proprietary WPS-format imports, scheduled reminders, or automatic startup at login.

You can copy text and images from WPS into a note. Remote image URLs are not automatically downloaded; copy the image itself or insert a local image file.

## Development

Requirements: Windows 10 / 11, Node.js 22 or later, and npm.

```sh
npm ci
npm run build
npm start
npm test
npm run test:ui
npm run pack
npm run installer
```

Dependency versions are locked in `package-lock.json`. `npm run pack` generates the icon, builds the UI, and packages the Windows application. Tests use isolated temporary data directories; `npm start` opens the development-mode note store. Initial dependency installation requires internet access.

| File | Purpose |
| --- | --- |
| `src/main.cjs` | Electron main process and desktop integration |
| `src/store.cjs` | Persistence, backups, and recovery |
| `src/preload.cjs` | Isolated renderer-to-main communication |
| `src/renderer.js` | Editor and application UI logic |
| `src/style.css` | Interface styling |
| `scripts/package.cjs` | Windows packaging entry point |

Built with [Electron](https://www.electronjs.org/), [Tiptap](https://tiptap.dev/), and [Lucide](https://lucide.dev/). Editor resources are bundled locally. Renderer sandboxing and context isolation are enabled.

## Verification

- `tests/store.test.cjs` covers persistence, trash and restore, preserving notes when deleting folders, damaged-file recovery, additive imports, and invalid-data rejection.
- `tests/ui.cjs` exercises real Electron windows for Chinese text entry, checklists, images, search, folders, floating-window synchronization, trash and restore, themes, calendar filtering, exports and imports, close-time saves, and persistence after restart.
- `tests/packaged.cjs` verifies that the packaged Windows executable launches and saves notes. Run it with `node tests/packaged.cjs` after packaging.
- `tests/locks.test.cjs` checks encrypted storage, authentication, tamper rejection, moves, protected duplicates, and backup import. `node tests/features.cjs` exercises search, context menus, native dragging, multiwindow locks, restart, and undo-history isolation. Append a packaged EXE path to run the same checks against the built application.

Tests write to isolated temporary directories, not the normal note store. Test screenshots are written to `test-results`.

## License and contributions

**Free of charge. Commercial use is prohibited.** Starting with 1.0.1, new original content uses the [Noncommercial License](LICENSE), permitting personal noncommercial use, learning, and exchange. Business use, sale, and paid distribution are prohibited. The source is publicly available, but this is not an OSI open-source license.

Version 1.0.0 and code previously released under MIT retain their original license and granted rights; see [LICENSE-MIT-1.0.0](LICENSE-MIT-1.0.0). Third-party components retain their respective licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the Electron license files in the packaged application directory.

## Contact and feedback

- [Contact the author](https://v.douyin.com/0gmTrkNdDHo/): opens Douyin.
- [Feedback / feature suggestions](https://laobaiai.com): opens the author website.

The sidebar contains only these two text links, opening directly in the system browser. Notes remain stored locally.

Issues and pull requests are welcome. Include your operating system, reproduction steps, and screenshots with personal information removed. Do not upload private notes or complete personal backups.
