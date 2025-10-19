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

## Demo: Split Editor Side View
- Trigger the split view (editor on the left, chat on the right) by sending this exact instruction in chat or from the landing page:

```
Give me a combination of a context exercise and a writing exercise for a 6th grade student learning history. It should be an exercise on London's history.
```

### Trigger Matching Rules
- **Case sensitivity**: Matching is case-sensitive.
- **Whitespace**: Leading/trailing whitespace is ignored; internal whitespace must match exactly.
- **Match type**: Full-string equality after trimming; substrings or extra text will not match.

Examples:
- Will trigger:
  - Exactly the instruction above (character-for-character).
  - The same instruction with added leading/trailing whitespace, e.g. `"  <instruction>  "`.
- Will NOT trigger:
  - `give me a combination ...` (different casing).
  - The instruction with double spaces or newlines inserted inside.
  - `Please, <instruction>` or `<instruction> thanks!` (extra surrounding text).

Suggested quick tests:
- Send the instruction with different casing (e.g., lowercase first letter) → expect no split view.
- Send the instruction with extra leading/trailing spaces or a trailing newline → expect split view.

- Behavior:
  - The assistant returns a LaTeX exercise (deterministic mapping).
  - The chat view splits: the left pane shows a WYSIWYG editor with the formatted exercise; the right pane keeps the conversation.
  - Use the toolbar’s “Raw” toggle to switch the left pane between WYSIWYG and raw LaTeX.
  - Edits in WYSIWYG are converted back to LaTeX automatically.

- Implementation notes:
  - Deterministic mapping: `src/lib/intentMappings.ts`.
  - Split-view state and sync: `src/pages/Chat.tsx` (wires `RichTextArea`, `LatexView`, `EditorToolbar`, and LaTeX/HTML conversion).
  - LaTeX parsing/building: `src/lib/parseLatex.ts` and `src/lib/buildLatex.ts`.

## Other Hardcoded Chats and Behaviors
- Keyword prompt flow (simulated):
  - If a user input contains the word “exercise”, the assistant asks: “What grade are the students?”
  - If the user replies with a message starting with `grade <number>` (e.g., `grade 6`), the assistant returns a canned LaTeX exercise about water usage:

```
Use the Internet, or contact environment agencies and water companies, to help you with the exercises below.

\begin{enumerate}
\item Name three places in your home where water is made dirty.
\item Where does the dirty water go when it leaves your home?
\end{enumerate}
```

- New chat from landing search (`components/Search.tsx`):
  - Creates a new tab and seeds two messages: the user prompt and a greeting (or the “What grade…” question if prompt includes “exercise”).

- File upload path (`components/FileUploadMenu.tsx` and `components/Search.tsx`):
  - Selecting a file creates a new chat tab with a user message like “I’ve uploaded <file> …” and an assistant message prompting for next steps. Toasts confirm selection.

## Using the Editor in Chat
- WYSIWYG editor: `components/Editor/RichTextArea.tsx` with MathLive for inline math.
- Toolbar: `components/Editor/EditorToolbar.tsx` provides formatting, list controls, alignment, color/highlight, math insertion, and table insertion.
- Raw LaTeX view: `components/Editor/LatexView.tsx` (copy-friendly textarea). Toggle from the toolbar.
- Conversion:
  - LaTeX → HTML (for WYSIWYG): `parseLatexToHtml`.
  - HTML → LaTeX (on edit): `buildLatexDocument`.

## Notes
- The split editor demo currently triggers only on the exact instruction above.
- Chat/tabs/history and user settings persist in `localStorage`.
- Dev server default is port 8080 (see `vite.config.ts`).

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

### Backend API URL
- Set the backend base URL using an environment variable. Supported names (in order): `VITE_API_URL`, `NEXT_PUBLIC_API_URL`, `REACT_APP_API_URL`.
- For Vite, add this to `.env` or `.env.local` in the project root:

```
VITE_API_URL=http://127.0.0.1:5057
```

- In development and test, if the variable is not set, the app falls back to `http://127.0.0.1:5057`.
- In production-like modes, missing configuration will throw a clear error at runtime.
- After changing env files, restart the dev server (`npm run dev`).

## Deployment
- Build with `npm run build` and serve files in `dist/` with any static host (e.g., Nginx, Vercel, Netlify). Ensure SPA fallback to `index.html` is enabled for client-side routing.
