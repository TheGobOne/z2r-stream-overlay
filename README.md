# Z2R Restream Overlay

A stream overlay for Zelda II Randomizer restreams. It shows the game windows, each runner's name, boss and item trackers, a race timer, commentary, and an optional Max Rando gem count. It runs as a Next.js app that OBS captures.

## What it does

- **Layouts:** 2, 3 or 4 runners. The 2-runner layout has the Arcade look.
- **Name plates:** each runner's name, a music note (click it to switch audio to that runner), and best-of series wins shown as triforces.
- **Trackers:** per-runner boss and item grids. Set badges (codes, numbers and letters) from the tools window.
- **Placement badges:** 1st to 4th, and DNF.
- **Timer:** click to start, pause or resume; middle-click resets to 0; right-click edits the start time.
- **Racetime.gg import:** paste a room link to fill runner names and Twitch channels, sync the race clock, and set place badges from the room.
- **Remote trackers:** share a join code from the tools window. Trackers open `/track` in their own browser and mark items and bosses for every runner.
- **VODs and live streams:** Twitch and YouTube, cropped to each game window.

## Setting up OBS

1. Open the overlay in Chrome at `http://localhost:3000` (or your deployed URL).
2. Add a **Window Capture** of that Chrome tab (or a browser source at 1456x816, if you prefer).
3. Open the **tools window** from the setup dialog or by right-clicking the overlay. Viewers never see it.

## Using the tools window

- **Setup:** runner count, commentators, Max Rando.
- **Racetime.gg room:** paste a link and press Enter. "Swap sides" flips the runner order. Re-importing a different room asks before clearing the trackers.
- **Videos:** load a Twitch or YouTube link per runner, set the start time, and crop. "Listen to [runner] only" switches audio.
- **Series score:** best of 1, 3 or 5, with wins for each runner.
- **Bosses and items:** a single master set for setting badges. These don't toggle on the overlay.
- **Remote trackers:** start sharing, then copy the link or join code.

## Development

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm lint    # type check
pnpm build
```

Overlay state, the timer and the join code are saved in `localStorage`, so a reload restores them. Clearing the overlay resets everything for the next race.

## Notes

- Twitch blocks scripted play on stretched (cropped) players. If the timer doesn't start a Twitch VOD, click play on that player once, then use the timer.
- Twitch may mute audio on VODs for copyrighted music.
- Remote trackers use PeerJS's public signalling server to connect the two browsers. A tracker needs the overlay tab open.
- Built with Next.js and TypeScript. Icons and the Zelda II font are in `public/`.
