# Elearning Sample

An interactive elearning sample built with [Next.js](https://nextjs.org) using an
**AI assisted workflow**.

The first lesson covers the alphabet from A to E. The tiles animate in with spoken
letters, then the learner drags each picture onto its matching letter and gets a
score at the end. It is responsive down to small phones, and the recorded audio
track falls back to the browser's speech synthesis when the clips cannot play.

## Tech

- Next.js 16 (App Router) and React 19
- Tailwind CSS v4
- Vercel Analytics and Speed Insights

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The lesson lives in
[`app/alphabet-lesson.tsx`](app/alphabet-lesson.tsx) and the audio clips are in
[`public/audio/`](public/audio).

## Scripts

- `npm run dev` starts the dev server
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run lint` runs ESLint
