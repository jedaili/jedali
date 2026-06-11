# Contributing to My AI Desktop

First off, thank you for considering contributing to My AI Desktop! It's people like you that make the open-source community such an incredible place. 

## 🧠 Getting Started

1. **Fork the Repository:** Click the 'Fork' button at the top right of this page.
2. **Clone your Fork:**
   ```bash
   git clone https://github.com/your-username/my-ai-desktop.git
   cd my-ai-desktop
   ```
3. **Install Dependencies:**
   ```bash
   npm install
   ```
4. **Create a Branch:**
   ```bash
   git checkout -b feature/AmazingFeature
   ```

## 💻 Development Workflow

To start the app in development mode with hot-reloading:

```bash
npm run dev
```

This runs Vite on `localhost:5173` and boots up the Electron main process.

### Architecture Overview
- `src/` contains all the React (Vite) frontend code. This is where components, UI, and editor logic live.
- `electron/` contains the Electron main process (`main.js`) and preload scripts (`preload.js`).
- State is managed mainly at the top level in `App.jsx`, and passed down. 
- IPC (Inter-Process Communication) is used to talk between the React UI and the Node.js file system APIs.

## ✅ Pull Request Guidelines

1. **Keep it focused:** Try to limit your Pull Request to one specific feature or bug fix.
2. **Follow existing code style:** We use standard React and JavaScript conventions.
3. **Write descriptive commit messages:** Explain *what* and *why* you are changing something.
4. **Test your changes:** Run `npm run lint` and verify your changes manually inside the app.

## 🐛 Found a Bug?

If you find a bug in the source code, you can help us by [submitting an issue](#). Even better, you can submit a Pull Request with a fix!

## 💡 Feature Requests

If you have a brilliant idea for a new feature, don't hesitate to open an issue to discuss it before you start coding. We are always looking for ways to make the editor smarter and faster!
