# Habit Tracker

A local-first web app for building daily habits: create habits, check them off, and watch your streaks grow. All data stays in your browser — no accounts, no server.

Built with React + Vite + TypeScript.

## Setup

```sh
npm install
```

## Development

```sh
npm run dev
```

Starts the dev server (Vite) and prints the local URL, usually `http://localhost:5173`.

## Tests

```sh
npm test          # run once
npm run test:watch  # watch mode
```

Tests run in Vitest with jsdom and React Testing Library. Domain logic is tested at the habit-store seam with a fake storage adapter and fake clock; UI tests assert only what the user sees.

## Build

```sh
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
```

## Project layout

- `src/` — application code
- `src/test/` — test setup
- `docs/agents/` — agent configuration (issue tracker, triage labels, domain docs)
- Spec: [issue #1](https://github.com/MahmoudMagdi312/habit_tracker/issues/1)
