<div align="center">

# LIFT

**A personal training log, fast between sets.**

Log a set in one tap, see the plates on the bar, and find out whether you're getting stronger.
Works offline, installs on your phone and keeps your data on your device.

<img src="docs/screenshots/banner.webp" alt="LIFT on a phone: the Home screen, the Log screen in dark and light, and the Progress chart" width="100%">

</div>

## What it does

**Logging**
- One-tap **Log set** with last time's numbers filled in, and a nudge to try the next step up
- The working weight drawn as **plates on the bar, per side**, rebuilt live as you change it
- Seven log types: barbell, rack (dumbbells, kettlebells, plates), machine, bodyweight (plain, added or assisted), band, timed holds and cardio
- Warm-up, working, drop and failure sets; supersets; notes on a set or pinned to an exercise
- A **rest timer** that rings and vibrates, keeps the screen awake and still knows the time if you switch apps

**Progress**
- Personal records flagged as you lift
- Charts per exercise for max weight, volume, estimated 1RM and reps, with a best-reps-per-weight table
- Weekly sets per muscle against MEV / MRV target ranges, plus streaks and a 12-week training calendar
- A 1RM calculator (Epley or Brzycki) and weekly bodyweight weigh-ins

**Your data**
- Everything is stored on the device; nothing is sent anywhere
- One-file backup export and import, including import from the older LIFT 5
- Templates, custom exercises, your own bar and plate set, weight steps and dumbbell range

**Comfort**
- Light, dark or follow-the-phone theme; a "reduce glass" option and a larger text size
- 56px main buttons for one-handed use mid-set; full keyboard focus rings; animations turn off with Reduce motion

## Screenshots

Sample data, not real training history.

| Home | Log a set | Rest timer | Workout overview |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/dark-home.webp" alt="Home screen" width="200"> | <img src="docs/screenshots/dark-log.webp" alt="Log screen with the plate bar" width="200"> | <img src="docs/screenshots/dark-rest.webp" alt="Rest timer" width="200"> | <img src="docs/screenshots/dark-overview.webp" alt="Workout overview" width="200"> |
| **History** | **Progress** | **Stats** | **Welcome** |
| <img src="docs/screenshots/dark-history.webp" alt="Workout history" width="200"> | <img src="docs/screenshots/dark-progress.webp" alt="Progress chart" width="200"> | <img src="docs/screenshots/dark-stats.webp" alt="Weekly stats" width="200"> | <img src="docs/screenshots/dark-welcome.webp" alt="Welcome screen" width="200"> |

<details>
<summary>Light mode</summary>

| Home | Log a set | History | Progress |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/light-home.webp" alt="Home, light" width="200"> | <img src="docs/screenshots/light-log.webp" alt="Log, light" width="200"> | <img src="docs/screenshots/light-history.webp" alt="History, light" width="200"> | <img src="docs/screenshots/light-progress.webp" alt="Progress, light" width="200"> |

</details>

## Install on your phone

1. Open the site in Chrome on Android (or Safari on iPhone).
2. Choose **Install app** (Safari: Share › Add to Home Screen).
3. Open LIFT from your home screen. It works with no signal from then on.

Moving from another phone or the old LIFT 5? Go to **Settings › Import backup** and pick your backup file.

## Run it yourself

LIFT is plain HTML, CSS and JavaScript with no build step and no dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To host it, upload these files to GitHub Pages or Cloudflare Pages. All paths are relative, so it also works from a sub-folder.

After changing any file, bump `VERSION` in `sw.js` so installed copies pick up the update.

## How it's built

| File | Role |
| --- | --- |
| `index.html` | The page shell and the icon set |
| `app.css` | Base styles and design tokens |
| `unslop.css`, `motion.css`, `theme.css` | Design polish, motion, and the dark palette (Midnight Black, Electric Blue, Sunset Orange) |
| `js/store.js` | All storage (localStorage, `lift2_` keys) |
| `js/lift.js` | Logic: plate maths, PRs, volume, imports |
| `js/ui-core.js`, `js/ui-log.js`, `js/ui-views.js` | Rendering, the Log screen, and every other screen |
| `js/motion.js`, `js/unslop.js` | Transitions, feedback animations and loading states |
| `data/exercises.js` | The built-in exercise library |
| `sw.js`, `manifest.webmanifest` | Offline support and installation |

## Credits

- Fonts: Manrope and Instrument Serif, both under the SIL Open Font License (see `fonts/OFL.txt`).
- Plate colours follow Olympic competition bumper plates.
