# Z2R Restream Overlay

Stream overlay for Zelda II Randomizer restreams (Next.js). Add it to OBS as a browser source at 1456x816.

- Runs 2-, 3- or 4-runner layouts with per-player boss/item trackers, timer, commentary and VOD windows.
- The setup dialog opens a separate tools window (VOD loading, sync, crop) that viewers never see.
- Overlay state and the timer are saved to `localStorage`, so a reload restores them.

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm lint    # type check
pnpm build
```

Linked to a v0 project; merges to `main` deploy automatically.
