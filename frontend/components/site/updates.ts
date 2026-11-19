/** The game's own changelog, newest first (shown on the dashboard). */
export interface GameUpdate {
  version: string;
  date: string;
  title: string;
  body: string;
}

export const UPDATES: readonly GameUpdate[] = [
  {
    version: 'v1.4',
    date: '2026-11-18',
    title: 'The Open World & Mine Dash tournaments',
    body: 'A free public world of valleys with your own 8×8 plot, and Mine Dash tournaments all day: Bronze every hour, Silver every four hours, Gold daily and a weekly Champion. Pay the entry in gold, everyone plays the same mine, 90% of fees are paid out and 10% burned.',
  },
  {
    version: 'v1.3',
    date: '2026-11-18',
    title: 'The deeper mine',
    body: 'Six zones and the bottomless Abyss below floor 30, eight new monsters with their own tricks (Spitter Slimes, Burrowers, Crystal Beetles, Cave Eels, Fuse Caps, Lantern Thieves, Mimics, Magma Imps), golden elites, a boss every five floors that changes at half health, and special floors: dens, vaults, cave-ins and shortcuts.',
  },
  {
    version: 'v1.2',
    date: '2026-11-18',
    title: 'Better co-op',
    body: 'Rejoin automatically after a dropped connection, find friends with a glowing trail, and fruit trees, wild forage, spouse help and auto-collectors now work in shared worlds. The host picks the day length.',
  },
  {
    version: 'v1.1',
    date: '2026-11-17',
    title: 'A new look for your farmer',
    body: 'A bigger, cleaner player character with more to customise: eyes, hair styles, hats, outfits, shoes and a turnable preview.',
  },
  {
    version: 'v1.0',
    date: '2026-11-17',
    title: 'Trains, tides, ghosts, heirlooms & wildlife',
    body: 'Train contracts at the freight depot, oyster and seaweed tide beds, the ghost night market in the graveyard, heirloom seeds you can trade between worlds, and a living ecosystem of deer, foxes and pollinators.',
  },
];
