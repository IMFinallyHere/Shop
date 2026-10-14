# How-to videos

The videos on the in-app **Help** page are recorded from the real app, so re-record them
whenever a screen they show changes.

```bash
# Once: the tool's own deps and Playwright's recorder
cd tools/videos && npm install && npx playwright-core install ffmpeg
brew install ffmpeg   # assembles the MP4s

# Dev servers must be running (Django :8000, Vite :5173) with Docker's Postgres up.
npm run record                        # all scenes, English and Hindi
node record.js make-bill --lang hi    # one scene, one language
```

What a run does, for each scene and language:

1. `manage.py reset_video_shop` rebuilds the local demo shop **Kavya Fashions**
   (`walkthrough.localhost`, `video@demo.test` / `VideoDemo#2026`) so every take starts
   from the same data. It refuses to run with `DEBUG` off.
2. macOS `say` reads each step (**Rishi** for English, **Lekha** for Hindi); a step stays on
   screen at least as long as its narration.
3. Playwright drives Chrome at 1280×720 with a visible cursor and click ripples
   (`director.js`), following the steps in `scenes.js`.
4. ffmpeg lays the narration over the recording → `frontend/public/videos/<scene>.<lang>.mp4`,
   plus `<scene>.<lang>.vtt` captions, a `<scene>.jpg` poster and `index.json` (lengths).

The output folder is gitignored. `deploy/deploy.sh` ships it because Vite copies
`frontend/public/` into the build, so record before deploying.

To add a video: add a scene to `scenes.js` (English and Hindi lines per step), its start page
to `START` in `record.js`, an entry to `VIDEOS` and its title/description in
`frontend/src/onboarding/strings.js`.
