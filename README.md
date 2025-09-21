# Edion Frontend

A Vite + React + TypeScript single-page application with Tailwind CSS and shadcn/ui. It provides a chat workspace with tabbed conversations, local persistence, a settings page with theme and profile controls, and a LaTeX math editor demo.

## Tech Stack
- React 18, TypeScript, Vite
- Tailwind CSS, shadcn/ui (Radix UI)
- React Router, TanStack Query
- Sonner (toasts)
- MathLive + LaTeX preview/editor
- @react-pdf/renderer (PDF generation demo)

## Getting Started
1. Install Node.js 18+.
2. Install dependencies:

```sh
npm i
```

3. Run the dev server:

```sh
npm run dev
```

4. Build for production:

```sh
npm run build
```

5. Preview the production build:

```sh
npm run preview
```

## Available Scripts
- `npm run dev`: Start Vite dev server
- `npm run build`: Build production assets
- `npm run build:dev`: Build in development mode
- `npm run preview`: Preview built app
- `npm run lint`: Run ESLint

## App Structure
- `src/main.tsx`: App bootstrap and immediate theme initialization from `localStorage` or system preference.
- `src/App.tsx`: Providers (TanStack Query, Tooltip, Sonner) and routing.
- `src/pages/Index.tsx`: Landing page with header, search, and quick actions.
- `src/pages/Chat.tsx`: Chat workspace UI.
- `src/hooks/use-chat.ts`: Chat state model (tabs, messages, history) with localStorage persistence and simulated assistant responses.
- `src/pages/Settings.tsx`: Profile, theme (dark mode), and basic security/notification UI; integrates an image cropper.
- `src/app/math-demo/page.tsx`: LaTeX math editor demo.

### Components (selected)
- `components/Header.tsx`: Top bar with history toggle and user menu.
- `components/ChatHeader.tsx`, `ChatMessages.tsx`, `ChatInput.tsx`, `ChatHistory.tsx`: Chat UI pieces.
- `components/Editor/*`: Block-based document editor combining text and math blocks.
- `components/ui/*`: shadcn/ui primitives.

### Utilities and Types
- `src/types.ts`: Core types (user settings, chat tabs/messages, editor blocks).
- `src/utils/storageUtils.ts`: Read/update user settings and chat history in localStorage; dispatches `themeChanged` events.
- `src/utils/toastUtils.ts`: Toast helpers.
- `src/utils/pdfUtils.ts`: Example of generating a PDF and attaching it to a chat tab.

## Routing
Defined in `src/App.tsx`:
- `/` → Index
- `/chat` → Chat workspace
- `/settings` → Settings
- `/math-editor` → LaTeX editor demo
- `*` → 404

## State and Persistence
- User settings and theme are saved in `localStorage` under `userSettings`.
- Chat tabs and history are saved as `chatTabs` and `chatHistory`.
- Theme class (`dark`) is set on `<html>` before initial render for no-flash behavior.

## Styling
- Tailwind CSS with a small set of custom components from shadcn/ui.
- Dark mode toggled via `document.documentElement.classList`.

## PDF and Math
- PDF demo uses `@react-pdf/renderer` to generate a blob and attach it to a chat tab.
- Math editor uses MathLive for interactive math fields and can show generated LaTeX.

## Configuration
- `vite.config.ts` sets alias `@` → `src`. In development, `lovable-tagger` is enabled but not required for production.
- Port defaults to 8080 in dev server configuration.

## Deployment
- Build with `npm run build` and serve files in `dist/` with any static host (e.g., Nginx, Vercel, Netlify). Ensure SPA fallback to `index.html` is enabled for client-side routing.
