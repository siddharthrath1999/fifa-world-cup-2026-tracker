# FIFA World Cup 2026 Tracker

A live, shareable React dashboard for the FIFA World Cup 2026.

## What It Tracks

- Official 104-match schedule from FIFA's public fixture feed
- Match times displayed for India
- Match status, score, venue, city, group, stage, officials, and official links
- Match detail view with watch links, reminders, line-ups, live timeline, stats, player notes, and source availability
- Group standings computed from live FIFA match results
- Best third-place race
- Knockout bracket
- Team and venue directories
- Favorites, search, team/group filters, today's matches, live matches, calendar export, and shareable match links

## Live Data Sources

Primary source:

- FIFA official public fixture feed: `https://api.fifa.com/api/v3/calendar/matches`

Free enrichment:

- ESPN public soccer scoreboard and summary endpoints for team logos, ESPN match links, summary details, and live enrichment when available

The app does not invent unavailable data. If free live sources do not publish line-ups, live events, xG, possession, player cards, or stats for a match, the match detail view shows an availability message instead of sample content.

## Watch Links

The app lists official India options only:

- ZEE5 official sports page
- ZEE5 help article for FIFA World Cup 2026
- FIFA rights announcement for Z and UNITE8 Sports in India

Pirated streams are intentionally excluded.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## Build And Check

```bash
npm run deploy:check
```

GitHub Pages build:

```bash
npm run build:github
```

## Deploy

Vercel:

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Vite

Netlify:

- Build command: `npm run build`
- Publish directory: `dist`

The included `vercel.json` and `netlify.toml` route all paths back to `index.html` and set basic static-asset caching and browser safety headers.

GitHub Pages:

- Repository: `fifa-world-cup-2026-tracker`
- Build and publish are handled by `.github/workflows/deploy.yml`
- Public URL: `https://siddharthrath1999.github.io/fifa-world-cup-2026-tracker/`

## Share Links

The app keeps the current view and selected match in the URL, for example:

```text
/?view=matches&match=400018143
```

Use the share icon in the match detail panel to copy a direct match link.
