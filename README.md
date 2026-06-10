# My AI Desktop

A full Cursor-like desktop IDE that connects to your local AI agent at `http://localhost:8000`.

Built with **Electron + React + Monaco Editor**.

---

## Features

- 📁 **File Explorer** — open folders, browse files, create/rename/delete
- ✏️ **Code Editor** — Monaco (same engine as VS Code) with syntax highlighting for 30+ languages
- 💬 **AI Chat Panel** — chat with your local agent; it automatically includes the open file as context
- 🔄 **Streaming** — supports SSE streaming responses from your FastAPI agent
- 💾 **Save files** — Ctrl+S, dirty-tab indicator
- 🌐 **Agent health** — status bar shows live connection to your agent

---

## Setup

### 1. Prerequisites
- Node.js 18+
- Your FastAPI AI agent running at `http://localhost:8000`

### 2. Install dependencies
```bash
cd my-ai-desktop
npm install
```

### 3. Run in development
```bash
npm run dev
```
This starts Vite on port 5173 and launches Electron automatically.

### 4. Build for Windows
```bash
npm run build
```
Output: `dist-electron/` folder with a `.exe` installer.

---

## Connecting to your AI agent

The app connects to `http://localhost:8000`. It tries these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /chat/stream` | POST | Streaming chat (SSE) — tried first |
| `POST /chat` | POST | Non-streaming fallback |
| `GET /health` | GET | Connection status check |

### Request body
```json
{
  "messages": [
    { "role": "user", "content": "your message here" }
  ]
}
```

### Response formats supported
```json
{ "response": "..." }
{ "message": { "content": "..." } }
{ "content": "..." }
{ "text": "..." }
{ "answer": "..." }
{ "output": "..." }
```

If your agent uses a different schema, edit `src/utils/aiApi.js` — look for `extractText()` and `extractChunk()`.

---

## Project structure

```
my-ai-desktop/
├── electron/
│   ├── main.js          ← Electron main process, IPC handlers
│   └── preload.js       ← Secure bridge (contextBridge)
├── src/
│   ├── App.jsx           ← Root layout and state
│   ├── main.jsx          ← React entry
│   ├── components/
│   │   ├── TitleBar.jsx  ← Custom titlebar + window controls
│   │   ├── FileTree.jsx  ← File explorer sidebar
│   │   ├── EditorArea.jsx← Monaco editor + tabs
│   │   ├── ChatPanel.jsx ← AI chat sidebar
│   │   └── StatusBar.jsx ← Bottom status bar
│   ├── utils/
│   │   ├── aiApi.js      ← AI agent HTTP client
│   │   └── fileUtils.js  ← Language detection, icons
│   └── styles/
│       └── global.css    ← Theme variables + reset
├── index.html
├── vite.config.js
└── package.json
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save file |
| `Enter` | Send chat message |
| `Shift+Enter` | New line in chat |

---

## Customization

- **API URL**: Edit `BASE_URL` in `src/utils/aiApi.js`
- **Theme colors**: Edit CSS variables in `src/styles/global.css`
- **Sidebar width**: Change `--sidebar-width` and `--chat-width` variables
