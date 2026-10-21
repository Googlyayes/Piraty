
window.addEventListener("error", (event) => {
  console.error("Global JS error:", event.message, event.filename, event.lineno);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

function buildPiraTYMediaDownloadUrl(item, season = 1, episode = 1) {
  if (!item) return null;
  const id = item.tmdbId || item.id;
  if (!id) return null;

  const mediaType = String(item.mediaType || '').toLowerCase();
  const type = String(item.type || '').toLowerCase();
  const category = String(item.category || '').toLowerCase();
  const typeText = `${mediaType} ${type} ${category}`;
  const isSeries = mediaType === 'tv' || type === 'tv' || type === 'show' || type === 'anime' || type === 'series' || typeText.includes('tv show') || typeText.includes('anime') || typeText.includes('series');
  if (isSeries && (item.anilistId || item.malId) && !item.tmdbId) {
    return null;
  }
  if (isSeries) {
    return `https://vidvault.ru/tv/${encodeURIComponent(id)}/${encodeURIComponent(season || 1)}/${encodeURIComponent(episode || 1)}`;
  }
  return `https://vidvault.ru/movie/${encodeURIComponent(id)}`;
}
window.buildPiraTYMediaDownloadUrl = buildPiraTYMediaDownloadUrl;

async function openPiraTYMediaDownload(item = null, season = 1, episode = 1) {
  let selected = item || (() => {
    try { return JSON.parse(localStorage.getItem('piraty_selected_item') || 'null'); } catch (e) { return null; }
  })();

  if (selected && !selected.tmdbId && (selected.anilistId || selected.malId) && typeof resolveAnimePlayableItem === 'function') {
    const resolved = await resolveAnimePlayableItem(selected);
    if (resolved?.tmdbId) {
      selected = typeof saveSelectedItem === 'function' ? saveSelectedItem(resolved) || resolved : resolved;
    }
  }

  const url = buildPiraTYMediaDownloadUrl(selected, season, episode);
  if (!url) {
    console.warn('Could not build media download URL because this item has no ID.');
    return;
  }
  window.location.href = url;
}
window.openPiraTYMediaDownload = openPiraTYMediaDownload;

document.addEventListener("click", (event) => {
  const directBtn = event.target.closest("[data-direct-play]");
  if (directBtn) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof openDirectPlayerModalForItem === "function") {
      openDirectPlayerModalForItem(directBtn.dataset.directPlay);
    }
    return;
  }

  const btn = event.target.closest("[data-media-download]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  openPiraTYMediaDownload().catch(error => console.warn('Failed to open download URL:', error));
});

function trackEvent(name, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

window.piratyAuth = {
  async login(email, password) {
    const safeEmail = String(email || '').trim();
    const safePassword = String(password || '');
    if (!safeEmail || !safePassword) {
      throw new Error('Enter email and password.');
    }
    const user = { email: safeEmail, username: safeEmail.split('@')[0] || 'member' };
    try {
      localStorage.setItem('piraty_logged_in', 'true');
      localStorage.setItem('piraty_user', JSON.stringify(user));
    } catch (error) {}
    return { user };
  },

  async signup(email, password) {
    return this.login(email, password);
  },

  async logout() {
    try {
      localStorage.removeItem('piraty_logged_in');
      localStorage.removeItem('piraty_user');
    } catch (error) {}
    return true;
  },

  watch(callback) {
    if (typeof callback === 'function') {
      try {
        const user = JSON.parse(localStorage.getItem('piraty_user') || 'null');
        callback(user || null);
      } catch (error) {
        callback(null);
      }
    }
    return () => {};
  },

  currentUser() {
    try {
      return JSON.parse(localStorage.getItem('piraty_user') || 'null');
    } catch (error) {
      return null;
    }
  }
};

window.trackEvent = trackEvent;

function trackApkDownload() {
  trackEvent("app_download_clicked", {
    app_name: "PiraTY",
    platform: "Android"
  });
}

function trackPlayClick(item, source = "unknown") {
  const content = item && typeof item === "object" ? item : findItem?.(item);
  trackEvent("play_clicked", {
    content_id: content?.tmdbId || content?.id || String(item || "unknown"),
    title: content?.title || content?.name || "unknown",
    type: content?.type || content?.mediaType || content?.category || "unknown",
    source
  });
}

window.trackPlayClick = trackPlayClick;

function deferBackgroundVideo() {
  const video = document.querySelector(".bg-video");
  const source = video?.querySelector("source[data-video-src]");
  if (!video || !source || source.src) return;

  const loadVideo = () => {
    source.src = source.dataset.videoSrc;
    video.load();
    video.play?.().catch(() => {});
  };

  if (window.matchMedia?.("(max-width: 760px), (prefers-reduced-motion: reduce), (save-data: reduce)")?.matches) {
    window.setTimeout(loadVideo, 2500);
    return;
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadVideo, { timeout: 1800 });
  } else {
    window.setTimeout(loadVideo, 1200);
  }
}

/*
  PiraTY app script
  Customization map, because apparently future-you deserves one mercy:
  - Change content in DATA.items, DATA.collections, DATA.studios
  - Replace image paths in assets/images
  - Connect APIs inside loadPage() or replace DATA arrays with fetch() results
  - Login/signup can be added in .login-slot and Settings page blocks
*/
const TMDB_CONFIG = {
  proxyUrl: "/api/tmdb",
  imageBaseUrl: "https://image.tmdb.org/t/p"
};
const JIKAN_CONFIG = {
  proxyUrl: "/api/jikan"
};
const ANILIST_CONFIG = {
  proxyUrl: "/api/anilist"
};
function slugifyCollectionTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectionCoverSvg(title, colors = ['#111827', '#16a34a']) {
  const [from, to] = colors;
  const words = String(title || 'Collection').split(/\s+/).slice(0, 4).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 382"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><radialGradient id="r" cx=".76" cy=".18" r=".72"><stop stop-color="#ffffff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="680" height="382" fill="url(#g)"/><rect width="680" height="382" fill="url(#r)"/><g opacity=".18"><circle cx="118" cy="92" r="76" fill="#fff"/><circle cx="572" cy="304" r="132" fill="#fff"/><path d="M0 312c102-74 203-82 306-24s227 47 374-34v128H0z" fill="#000"/></g><text x="48" y="74" fill="#fff" fill-opacity=".7" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="5">PIRATY COLLECTION</text><text x="48" y="214" fill="#fff" font-family="Arial, sans-serif" font-size="54" font-weight="900">${words.replace(/&/g, '&amp;')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const REAL_COLLECTION_DEFINITIONS = [
  { id: 'marvel-cinematic-universe', title: 'Marvel Cinematic Universe', colors: ['#410b13', '#b91c1c'], items: ['Iron Man', 'Iron Man 2', 'Thor', 'Captain America: The First Avenger', 'The Avengers', 'Avengers: Age of Ultron', 'Captain America: Civil War', 'Avengers: Infinity War', 'Avengers: Endgame'] },
  { id: 'harry-potter-universe', title: 'Harry Potter Universe', colors: ['#24124d', '#b7791f'], items: ["Harry Potter and the Philosopher's Stone", 'Harry Potter and the Chamber of Secrets', 'Harry Potter and the Prisoner of Azkaban', 'Harry Potter and the Goblet of Fire', 'Harry Potter and the Order of the Phoenix', 'Harry Potter and the Half-Blood Prince', 'Harry Potter and the Deathly Hallows: Part 1', 'Harry Potter and the Deathly Hallows: Part 2'] },
  { id: 'the-dark-knight-trilogy', title: 'The Dark Knight Trilogy', colors: ['#050505', '#475569'], items: ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'] },
  { id: 'lord-of-the-rings', title: 'Lord of the Rings', colors: ['#16351f', '#b45309'], items: ['The Lord of the Rings: The Fellowship of the Ring', 'The Lord of the Rings: The Two Towers', 'The Lord of the Rings: The Return of the King'] },
  { id: 'john-wick-collection', title: 'John Wick Collection', colors: ['#020617', '#2563eb'], items: ['John Wick', 'John Wick: Chapter 2', 'John Wick: Chapter 3 - Parabellum', 'John Wick: Chapter 4'] },
  { id: 'mission-impossible-collection', title: 'Mission: Impossible Collection', colors: ['#3b0a0a', '#f97316'], items: ['Mission: Impossible', 'Mission: Impossible II', 'Mission: Impossible III', 'Mission: Impossible - Ghost Protocol', 'Mission: Impossible - Rogue Nation', 'Mission: Impossible - Fallout', 'Mission: Impossible - Dead Reckoning Part One'] },
  { id: 'pirates-of-the-caribbean', title: 'Pirates of the Caribbean', colors: ['#102a43', '#0f766e'], items: ['Pirates of the Caribbean: The Curse of the Black Pearl', "Pirates of the Caribbean: Dead Man's Chest", "Pirates of the Caribbean: At World's End", 'Pirates of the Caribbean: On Stranger Tides', 'Pirates of the Caribbean: Dead Men Tell No Tales'] },
  { id: 'spider-man-live-action', title: 'Spider-Man Live Action', colors: ['#7f1d1d', '#1d4ed8'], items: ['Spider-Man', 'Spider-Man 2', 'Spider-Man 3', 'The Amazing Spider-Man', 'The Amazing Spider-Man 2', 'Spider-Man: Homecoming', 'Spider-Man: Far From Home', 'Spider-Man: No Way Home'] },
  { id: 'studio-ghibli-essentials', title: 'Studio Ghibli Essentials', colors: ['#14532d', '#38bdf8'], items: ['Spirited Away', 'Princess Mononoke', 'My Neighbor Totoro', "Howl's Moving Castle", "Kiki's Delivery Service", 'Ponyo'] },
  { id: 'beginner-anime-starter-pack', title: 'Beginner Anime Starter Pack', colors: ['#312e81', '#db2777'], items: ['Death Note', 'Attack on Titan', 'Fullmetal Alchemist: Brotherhood', 'Demon Slayer: Kimetsu no Yaiba', 'One Punch Man'] },
  { id: 'modern-shonen-essentials', title: 'Modern Shonen Essentials', colors: ['#7c2d12', '#dc2626'], items: ['Jujutsu Kaisen', 'Demon Slayer: Kimetsu no Yaiba', 'Chainsaw Man', 'My Hero Academia', 'Black Clover'] },
  { id: 'breaking-bad-universe', title: 'Breaking Bad Universe', colors: ['#052e16', '#65a30d'], items: ['Breaking Bad', 'Better Call Saul', 'El Camino: A Breaking Bad Movie'] },
  { id: 'game-of-thrones-universe', title: 'Game of Thrones Universe', colors: ['#0f172a', '#94a3b8'], items: ['Game of Thrones', 'House of the Dragon'] },
  { id: 'crime-drama-essentials', title: 'Crime Drama Essentials', colors: ['#111827', '#991b1b'], items: ['Breaking Bad', 'Better Call Saul', 'True Detective', 'Mindhunter', 'Narcos'] },
  { id: 'sci-fi-masterpieces', title: 'Sci-Fi Masterpieces', colors: ['#0c4a6e', '#4c1d95'], items: ['Dark', 'Severance', 'Westworld', 'Silo', 'The Expanse'] },
  { id: 'courtroom-classics', title: 'Courtroom Classics', colors: ['#1f2937', '#ca8a04'], items: ['12 Angry Men', 'A Few Good Men', 'My Cousin Vinny', 'The Lincoln Lawyer', 'The Trial of the Chicago 7'] },
  { id: 'mind-bending-movies', title: 'Mind-Bending Movies', colors: ['#312e81', '#0891b2'], items: ['Inception', 'Interstellar', 'Shutter Island', 'Memento', 'The Prestige', 'Donnie Darko'] },
  { id: 'greatest-plot-twists', title: 'Greatest Plot Twists', colors: ['#18181b', '#be123c'], items: ['Fight Club', 'The Sixth Sense', 'The Prestige', 'Shutter Island', 'Gone Girl'] },
  { id: 'movies-every-adult-should-watch', title: 'Movies Every Adult Should Watch', colors: ['#292524', '#78716c'], items: ['The Shawshank Redemption', 'Forrest Gump', '12 Angry Men', 'The Godfather', "Schindler's List", 'Good Will Hunting'] },
  { id: 'best-animated-films', title: 'Best Animated Films', colors: ['#164e63', '#f59e0b'], items: ['Spider-Man: Into the Spider-Verse', 'Spider-Man: Across the Spider-Verse', 'The Lion King', 'WALL-E', 'Coco', 'Ratatouille'] }
].map(collection => ({
  ...collection,
  slug: collection.id,
  description: `${collection.items.length} hand-picked titles in ${collection.title}.`,
  image: collectionCoverSvg(collection.title, collection.colors),
  count: `${collection.items.length} titles`
}));

window.PIRATY_REAL_COLLECTIONS = REAL_COLLECTION_DEFINITIONS;
const DATA = {
  items: [
  {
    "id": "void-runner",
    "title": "Void Runner",
    "category": "Movie",
    "year": "2026",
    "rating": "8.7",
    "type": "movie",
    "poster": "assets/images/posters/void-runner.svg",
    "backdrop": "assets/images/heroes/void-runner.svg"
  },
  {
    "id": "project-nova",
    "title": "Project Nova",
    "category": "Movie",
    "year": "2026",
    "rating": "8.5",
    "type": "movie",
    "poster": "assets/images/posters/project-nova.svg",
    "backdrop": "assets/images/heroes/project-nova.svg"
  },
  {
    "id": "red-signal",
    "title": "Red Signal",
    "category": "Movie",
    "year": "2025",
    "rating": "7.9",
    "type": "movie",
    "poster": "assets/images/posters/red-signal.svg",
    "backdrop": "assets/images/heroes/red-signal.svg"
  },
  {
    "id": "last-circuit",
    "title": "Last Circuit",
    "category": "Movie",
    "year": "2026",
    "rating": "7.6",
    "type": "movie",
    "poster": "assets/images/posters/last-circuit.svg",
    "backdrop": "assets/images/heroes/last-circuit.svg"
  },
  {
    "id": "bright-creatures",
    "title": "Bright Creatures",
    "category": "Movie",
    "year": "2025",
    "rating": "8.2",
    "type": "movie",
    "poster": "assets/images/posters/bright-creatures.svg",
    "backdrop": "assets/images/heroes/bright-creatures.svg"
  },
  {
    "id": "obsidian-wish",
    "title": "Obsidian Wish",
    "category": "Movie",
    "year": "2026",
    "rating": "7.4",
    "type": "movie",
    "poster": "assets/images/posters/obsidian-wish.svg",
    "backdrop": "assets/images/heroes/obsidian-wish.svg"
  },
  {
    "id": "black-harbor",
    "title": "Black Harbor",
    "category": "Movie",
    "year": "2024",
    "rating": "8.1",
    "type": "movie",
    "poster": "assets/images/posters/black-harbor.svg",
    "backdrop": "assets/images/heroes/black-harbor.svg"
  },
  {
    "id": "night-law",
    "title": "Night Law",
    "category": "Movie",
    "year": "2026",
    "rating": "8.6",
    "type": "movie",
    "poster": "assets/images/posters/night-law.svg",
    "backdrop": "assets/images/heroes/night-law.svg"
  },
  {
    "id": "glass-kingdom",
    "title": "Glass Kingdom",
    "category": "Movie",
    "year": "2025",
    "rating": "7.8",
    "type": "movie",
    "poster": "assets/images/posters/glass-kingdom.svg",
    "backdrop": "assets/images/heroes/glass-kingdom.svg"
  },
  {
    "id": "northbound",
    "title": "Northbound",
    "category": "Movie",
    "year": "2026",
    "rating": "8.0",
    "type": "movie",
    "poster": "assets/images/posters/northbound.svg",
    "backdrop": "assets/images/heroes/northbound.svg"
  },
  {
    "id": "the-foundry",
    "title": "The Foundry",
    "category": "TV Show",
    "year": "S1",
    "rating": "8.5",
    "type": "show",
    "poster": "assets/images/posters/the-foundry.svg",
    "backdrop": "assets/images/heroes/the-foundry.svg"
  },
  {
    "id": "off-campus",
    "title": "Off Campus",
    "category": "TV Show",
    "year": "S2",
    "rating": "8.7",
    "type": "show",
    "poster": "assets/images/posters/off-campus.svg",
    "backdrop": "assets/images/heroes/off-campus.svg"
  },
  {
    "id": "wonderline",
    "title": "Wonderline",
    "category": "TV Show",
    "year": "S1",
    "rating": "7.4",
    "type": "show",
    "poster": "assets/images/posters/wonderline.svg",
    "backdrop": "assets/images/heroes/wonderline.svg"
  },
  {
    "id": "dutton-range",
    "title": "Dutton Range",
    "category": "TV Show",
    "year": "S3",
    "rating": "9.1",
    "type": "show",
    "poster": "assets/images/posters/dutton-range.svg",
    "backdrop": "assets/images/heroes/dutton-range.svg"
  },
  {
    "id": "berlin-hours",
    "title": "Berlin Hours",
    "category": "TV Show",
    "year": "S1",
    "rating": "7.8",
    "type": "show",
    "poster": "assets/images/posters/berlin-hours.svg",
    "backdrop": "assets/images/heroes/berlin-hours.svg"
  },
  {
    "id": "from-below",
    "title": "From Below",
    "category": "TV Show",
    "year": "S2",
    "rating": "8.3",
    "type": "show",
    "poster": "assets/images/posters/from-below.svg",
    "backdrop": "assets/images/heroes/from-below.svg"
  },
  {
    "id": "elevator-17",
    "title": "Elevator 17",
    "category": "TV Show",
    "year": "S1",
    "rating": "8.4",
    "type": "show",
    "poster": "assets/images/posters/elevator-17.svg",
    "backdrop": "assets/images/heroes/elevator-17.svg"
  },
  {
    "id": "the-devil-writes",
    "title": "The Devil Writes",
    "category": "TV Show",
    "year": "S1",
    "rating": "6.9",
    "type": "show",
    "poster": "assets/images/posters/the-devil-writes.svg",
    "backdrop": "assets/images/heroes/the-devil-writes.svg"
  },
  {
    "id": "crimson-mecha",
    "title": "Crimson Mecha",
    "category": "Anime",
    "year": "EP 12",
    "rating": "8.8",
    "type": "anime",
    "poster": "assets/images/posters/crimson-mecha.svg",
    "backdrop": "assets/images/heroes/crimson-mecha.svg"
  },
  {
    "id": "aang-of-ember",
    "title": "Aang of Ember",
    "category": "Anime",
    "year": "EP 8",
    "rating": "8.2",
    "type": "anime",
    "poster": "assets/images/posters/aang-of-ember.svg",
    "backdrop": "assets/images/heroes/aang-of-ember.svg"
  },
  {
    "id": "demon-city",
    "title": "Demon City",
    "category": "Anime",
    "year": "EP 21",
    "rating": "9.0",
    "type": "anime",
    "poster": "assets/images/posters/demon-city.svg",
    "backdrop": "assets/images/heroes/demon-city.svg"
  },
  {
    "id": "neon-shrine",
    "title": "Neon Shrine",
    "category": "Anime",
    "year": "EP 9",
    "rating": "8.6",
    "type": "anime",
    "poster": "assets/images/posters/neon-shrine.svg",
    "backdrop": "assets/images/heroes/neon-shrine.svg"
  },
  {
    "id": "samurai-zero",
    "title": "Samurai Zero",
    "category": "Anime",
    "year": "EP 6",
    "rating": "8.1",
    "type": "anime",
    "poster": "assets/images/posters/samurai-zero.svg",
    "backdrop": "assets/images/heroes/samurai-zero.svg"
  },
  {
    "id": "star-bloom",
    "title": "Star Bloom",
    "category": "Anime",
    "year": "EP 15",
    "rating": "7.7",
    "type": "anime",
    "poster": "assets/images/posters/star-bloom.svg",
    "backdrop": "assets/images/heroes/star-bloom.svg"
  },
  {
    "id": "ink-katana",
    "title": "Ink Katana",
    "category": "Manga",
    "year": "Vol 4",
    "rating": "8.9",
    "type": "manga",
    "poster": "assets/images/posters/ink-katana.svg",
    "backdrop": "assets/images/heroes/ink-katana.svg"
  },
  {
    "id": "paper-ghost",
    "title": "Paper Ghost",
    "category": "Manga",
    "year": "Vol 2",
    "rating": "7.9",
    "type": "manga",
    "poster": "assets/images/posters/paper-ghost.svg",
    "backdrop": "assets/images/heroes/paper-ghost.svg"
  },
  {
    "id": "moon-archive",
    "title": "Moon Archive",
    "category": "Manga",
    "year": "Vol 7",
    "rating": "8.4",
    "type": "manga",
    "poster": "assets/images/posters/moon-archive.svg",
    "backdrop": "assets/images/heroes/moon-archive.svg"
  },
  {
    "id": "blue-curse",
    "title": "Blue Curse",
    "category": "Manga",
    "year": "Vol 1",
    "rating": "8.0",
    "type": "manga",
    "poster": "assets/images/posters/blue-curse.svg",
    "backdrop": "assets/images/heroes/blue-curse.svg"
  },
  {
    "id": "last-panel",
    "title": "Last Panel",
    "category": "Manga",
    "year": "Vol 6",
    "rating": "7.6",
    "type": "manga",
    "poster": "assets/images/posters/last-panel.svg",
    "backdrop": "assets/images/heroes/last-panel.svg"
  },
  {
    "id": "after-midnight",
    "title": "After Midnight",
    "category": "Music",
    "year": "Album",
    "rating": "8.0",
    "type": "music",
    "poster": "assets/images/posters/after-midnight.svg",
    "backdrop": "assets/images/heroes/after-midnight.svg"
  },
  {
    "id": "glass-synths",
    "title": "Glass Synths",
    "category": "Music",
    "year": "EP",
    "rating": "7.8",
    "type": "music",
    "poster": "assets/images/posters/glass-synths.svg",
    "backdrop": "assets/images/heroes/glass-synths.svg"
  },
  {
    "id": "city-bassline",
    "title": "City Bassline",
    "category": "Music",
    "year": "Mix",
    "rating": "8.3",
    "type": "music",
    "poster": "assets/images/posters/city-bassline.svg",
    "backdrop": "assets/images/heroes/city-bassline.svg"
  },
  {
    "id": "static-hearts",
    "title": "Static Hearts",
    "category": "Music",
    "year": "Single",
    "rating": "7.5",
    "type": "music",
    "poster": "assets/images/posters/static-hearts.svg",
    "backdrop": "assets/images/heroes/static-hearts.svg"
  },
  {
    "id": "night-league",
    "title": "Night League",
    "category": "Live Sports",
    "year": "Live",
    "rating": "8.8",
    "type": "sports",
    "poster": "assets/images/posters/night-league.svg",
    "backdrop": "assets/images/heroes/night-league.svg"
  },
  {
    "id": "arena-one",
    "title": "Arena One",
    "category": "Live Sports",
    "year": "8 PM",
    "rating": "7.9",
    "type": "sports",
    "poster": "assets/images/posters/arena-one.svg",
    "backdrop": "assets/images/heroes/arena-one.svg"
  },
  {
    "id": "final-whistle",
    "title": "Final Whistle",
    "category": "Live Sports",
    "year": "Live",
    "rating": "8.1",
    "type": "sports",
    "poster": "assets/images/posters/final-whistle.svg",
    "backdrop": "assets/images/heroes/final-whistle.svg"
  },
  {
    "id": "court-clash",
    "title": "Court Clash",
    "category": "Live Sports",
    "year": "9 PM",
    "rating": "8.4",
    "type": "sports",
    "poster": "assets/images/posters/court-clash.svg",
    "backdrop": "assets/images/heroes/court-clash.svg"
  }
],
  collections: REAL_COLLECTION_DEFINITIONS.map(collection => ({
    id: collection.id,
    title: collection.title,
    count: collection.count,
    image: collection.image
  })),
  studios: [
  {
    "id": "marvel",
    "name": "Marvel Studios",
    "image": "assets/images/studios/marvel-studios.svg"
  },
  {
    "id": "pixar",
    "name": "Pixar",
    "image": "assets/images/studios/pixar.svg"
  },
  {
    "id": "walt-disney-pictures",
    "name": "Walt Disney Pictures",
    "image": "assets/images/studios/walt-disney-pictures.svg"
  },
  {
    "id": "warner-bros",
    "name": "Warner Bros",
    "image": "assets/images/studios/warner-bros.svg"
  },
  {
    "id": "universal",
    "name": "Universal",
    "image": "assets/images/studios/universal.svg"
  },
  {
    "id": "dreamworks",
    "name": "DreamWorks",
    "image": "assets/images/studios/dreamworks.svg"
  },
  {
    "id": "paramount",
    "name": "Paramount",
    "image": "assets/images/studios/paramount.svg"
  },
  {
    "id": "columbia-pictures",
    "name": "Columbia Pictures",
    "image": "assets/images/studios/columbia-pictures.svg"
  },
  {
    "id": "20th-century-fox",
    "name": "20th Century Fox",
    "image": "assets/images/studios/20th-century-fox.svg"
  },
  {
    "id": "legendary",
    "name": "Legendary",
    "image": "assets/images/studios/legendary.svg"
  }
]
};

// ============================================================
// TMDB INTEGRATION
// ============================================================
// TMDB requests go through /api/tmdb.php so the read access token is not exposed in browser JavaScript.



// Fetch helper for TMDB API through the local PHP proxy
const TMDB_FETCH_CACHE_KEY = 'piraty-tmdb-fetch-cache-v1';
const TMDB_FETCH_CACHE_TTL = 30 * 60 * 1000;
const TMDB_FETCH_CACHE_LIMIT = 80;
const TMDB_FETCH_MEMORY = new Map();
const TMDB_FETCH_IN_FLIGHT = new Map();

function readTmdbFetchCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(TMDB_FETCH_CACHE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeTmdbFetchCache(cache) {
  try {
    const entries = Object.entries(cache || {})
      .filter(([, value]) => value && typeof value === 'object')
      .sort((a, b) => Number(b[1].savedAt || 0) - Number(a[1].savedAt || 0))
      .slice(0, TMDB_FETCH_CACHE_LIMIT);
    localStorage.setItem(TMDB_FETCH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Cache failures are non-fatal.
  }
}

function getCachedTmdbResponse(endpoint) {
  const key = String(endpoint || '').trim();
  if (!key) return null;
  const now = Date.now();
  const inMemory = TMDB_FETCH_MEMORY.get(key);
  if (inMemory && Number(inMemory.expiresAt || 0) > now) return inMemory.data;
  const cache = readTmdbFetchCache();
  const cached = cache[key];
  if (!cached || Number(cached.expiresAt || 0) <= now) return null;
  TMDB_FETCH_MEMORY.set(key, cached);
  return cached.data;
}

function cacheTmdbResponse(endpoint, data) {
  const key = String(endpoint || '').trim();
  if (!key) return;
  const record = {
    data,
    savedAt: Date.now(),
    expiresAt: Date.now() + TMDB_FETCH_CACHE_TTL
  };
  TMDB_FETCH_MEMORY.set(key, record);
  const cache = readTmdbFetchCache();
  cache[key] = record;
  writeTmdbFetchCache(cache);
}

async function tmdbFetch(endpoint) {
  const key = String(endpoint || '').trim();
  if (!key) return null;

  const cached = getCachedTmdbResponse(key);
  if (cached) return cached;

  if (TMDB_FETCH_IN_FLIGHT.has(key)) return TMDB_FETCH_IN_FLIGHT.get(key);

  const request = (async () => {
    try {
      const proxyUrl = `${TMDB_CONFIG.proxyUrl}?endpoint=${encodeURIComponent(key)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`TMDB proxy error: ${response.status} ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      cacheTmdbResponse(key, data);
      return data;
    } catch (error) {
      console.warn('TMDB fetch failed:', error);
      return null;
    } finally {
      TMDB_FETCH_IN_FLIGHT.delete(key);
    }
  })();

  TMDB_FETCH_IN_FLIGHT.set(key, request);
  return request;
}

// Get TMDB image URL with fallback to placeholder
function getTMDBImage(path, size = "w342") {
  if (!path) return null;
  return `${TMDB_CONFIG.imageBaseUrl}/${size}${path}`;
}

const HERO_LOGO_CACHE_KEY = 'piraty-hero-logo-cache';
const HERO_LOGO_CACHE_TTL = 24 * 60 * 60 * 1000;

function readHeroLogoCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(HERO_LOGO_CACHE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeHeroLogoCache(cache) {
  try {
    localStorage.setItem(HERO_LOGO_CACHE_KEY, JSON.stringify(cache || {}));
  } catch {
    // Cache failures are non-fatal.
  }
}

function heroLogoCacheKey(item) {
  const mediaType = String(item?.mediaType || item?.type || '').toLowerCase().includes('tv') ? 'tv' : 'movie';
  return `${mediaType}:${item?.tmdbId || item?.id || ''}`;
}

function heroMediaType(item) {
  const value = String(item?.mediaType || item?.type || '').toLowerCase();
  if (value.includes('movie')) return 'movie';
  if (value.includes('tv')) return 'tv';
  if (value.includes('anime')) return item?.format === 'MOVIE' ? 'movie' : 'tv';
  return '';
}

function pickHeroLogo(logos = []) {
  const cleaned = (Array.isArray(logos) ? logos : []).filter(logo => logo && logo.file_path);
  return cleaned.find(logo => logo.iso_639_1 === 'en')
    || cleaned.find(logo => logo.iso_639_1 == null)
    || cleaned[0]
    || null;
}

async function fetchHeroLogoUrl(item) {
  const mediaType = heroMediaType(item);
  const tmdbId = item?.tmdbId || item?.id;
  if ((!mediaType && !String(item?.mediaType || item?.type || '').toLowerCase().includes('anime')) || !isTMDBConfigured()) return null;

  const cache = readHeroLogoCache();
  const key = heroLogoCacheKey(item);
  const cached = cache[key];
  if (cached && (Date.now() - Number(cached.updatedAt || 0) < HERO_LOGO_CACHE_TTL)) {
    return cached.url || null;
  }

  try {
    let resolvedId = tmdbId;
    let resolvedType = mediaType;
    const title = String(item?.title || item?.titleEnglish || item?.titleRomaji || item?.titleNative || '').trim();

    if ((!resolvedId || !resolvedType) && title) {
      const search = await tmdbFetch(`/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      const results = (search?.results || []).filter(result => result.media_type === 'movie' || result.media_type === 'tv');
      const normalizedTitle = normalizeAnimeMatchTitle(title);
      const exact = results.find(result => normalizeAnimeMatchTitle(result.title || result.name || '') === normalizedTitle);
      const fallback = exact || results[0] || null;
      resolvedId = fallback?.id || resolvedId;
      resolvedType = fallback?.media_type || resolvedType;
    }

    if (!resolvedId || !resolvedType) return null;

    let url = null;
    const data = await tmdbFetch(`/${resolvedType}/${resolvedId}/images`);
    const logo = pickHeroLogo(data?.logos || []);
    if (logo?.file_path) {
      url = `${TMDB_CONFIG.imageBaseUrl}/w500${logo.file_path}`;
    } else if (title) {
      const search = await tmdbFetch(`/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      const results = (search?.results || []).filter(result => result.media_type === 'movie' || result.media_type === 'tv');
      const normalizedTitle = normalizeAnimeMatchTitle(title);
      const fallback = results.find(result => normalizeAnimeMatchTitle(result.title || result.name || '') === normalizedTitle) || results[0] || null;
      if (fallback?.id && fallback?.media_type) {
        const fallbackImages = await tmdbFetch(`/${fallback.media_type}/${fallback.id}/images`);
        const fallbackLogo = pickHeroLogo(fallbackImages?.logos || []);
        if (fallbackLogo?.file_path) {
          url = `${TMDB_CONFIG.imageBaseUrl}/w500${fallbackLogo.file_path}`;
        }
      }
    }
    cache[key] = { url, updatedAt: Date.now() };
    writeHeroLogoCache(cache);
    return url;
  } catch (error) {
    console.warn('Hero logo fetch failed:', error);
    cache[key] = { url: null, updatedAt: Date.now() };
    writeHeroLogoCache(cache);
    return null;
  }
}

// Normalize TMDB response to match existing card format
function normalizeTMDBItem(item, forcedMediaType = null) {
  if (!item) return null;
  
  // Determine media type
  let mediaType = forcedMediaType || item.media_type;
  if (!mediaType) {
    // Default to movie if no media_type
    mediaType = item.title ? 'movie' : 'tv';
  }
  
  // Ignore person results
  if (mediaType === 'person') return null;
  
  let title, date, type;
  
  if (mediaType === 'movie') {
    title = item.title || 'Untitled';
    date = item.release_date || '';
    type = 'Movie';
  } else if (mediaType === 'tv') {
    title = item.name || 'Untitled';
    date = item.first_air_date || '';
    type = 'TV Show';
  } else {
    return null;
  }
  
  // Extract year from date
  const year = date ? date.substring(0, 4) : 'N/A';
  
  // Round rating to 1 decimal
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  
  // Get poster with fallback
  const poster = getTMDBImage(item.poster_path, 'w342') || 'assets/images/posters/void-runner.svg';
  
  // Get backdrop
  const backdrop = getTMDBImage(item.backdrop_path, 'w780') || (item.poster_path ? getTMDBImage(item.poster_path, 'w780') : null) || 'assets/images/heroes/void-runner.svg';
  
  // Description
  const description = item.overview || 'No description available.';
  
  // Unique ID combining TMDB ID and type
  const id = `tmdb-${mediaType}-${item.id}`;
  
  return {
    id,
    tmdbId: item.id,
    mediaType,
    title,
    type,
    year,
    rating,
    poster,
    backdrop,
    description,
    category: type,
    // Keep legacy fields for compatibility with existing code
    ...item
  };
}

// End TMDB config and helpers
// ============================================================

const icons = window.icons = {
  directPlay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polygon points="10 8 16 11 10 14 10 8" fill="currentColor"/><path d="M8 21h8M12 17v4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 10.8 12 3l9 7.8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  browse: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  movie: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  anime: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 2l1.8 5.4L19 5.6l-3 4.7 5.2 1.7-5.2 1.7 3 4.7-5.2-1.8L12 22l-1.8-5.4L5 18.4l3-4.7-5.2-1.7L8 10.3 5 5.6l5.2 1.8L12 2Z"/></svg>',
  manga: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z"/><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  sports: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M8 6a8 8 0 0 0 0 12M16 6a8 8 0 0 1 0 12M4 9a12 12 0 0 0 0 6M20 9a12 12 0 0 1 0 6"/><circle cx="12" cy="12" r="2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v6l4 2"/></svg>',
  legal: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z"/><path d="M9 12l2 2 4-5"/></svg>',
  privacy: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>',
  about: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>',
  contact: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  terms: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17v-5"/><path d="M12 17V9"/><path d="M16 17v-9"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 18 9 12l6-6"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
};

const page = document.body.dataset.page || 'home';
const ROOT = document.body.dataset.root || '';
const path = p => ROOT + p;
const browsePageHref = params => {
  if (page === 'browse') {
    return params ? `?${params}` : 'index.html';
  }
  return `${ROOT}browse/index.html${params ? `?${params}` : ''}`;
};
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const byType = type => DATA.items.filter(x => x.type === type);
const mixed = () => DATA.items.slice(0, 20);
const UNDER_DEV_CATEGORIES = ['manga', 'music', 'sports'];

function isUnderDevelopment(type) {
  return UNDER_DEV_CATEGORIES.includes(String(type).toLowerCase());
}

function underDevOverlay() {
  return `<section class="panel under-dev-panel">
    <div class="under-dev-content">
      <div class="under-dev-indicator"></div>
      <h1>Under Development</h1>
      <p>This section is currently being built for the future PiraTY experience.</p>
      <p class="under-dev-hint">Check back soon for exciting new content.</p>
      <a href="${path('index.html')}" class="btn primary" style="margin-top:32px">Back to Home</a>
    </div>
  </section>`;
}

function safeRun(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`${name} failed:`, error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  safeRun("Theme", applyStoredTheme);
  safeRun("Sidebar State", applySidebarState);
  safeRun("Background Video", deferBackgroundVideo);
  safeRun("Sidebar Toggle", initSidebarToggle);
  safeRun("Build Sidebar", buildSidebar);
  safeRun("Footer", buildFooter);
  safeRun("Menu", initMenu);
  safeRun("Search", initSearch);
  safeRun("Page Load", () => loadPage(page));
  safeRun("Row Buttons", initRowButtons);
  safeRun("Auth", initAuthModal);

  if (typeof initSliders === "function") {
    safeRun("Sliders", initSliders);
  }
});

function applyStoredTheme() {
  const theme = localStorage.getItem('piraty-theme') || 'dark';
  document.documentElement.dataset.theme = theme;
}
function initSampleWatchlist() {
  const watchlist = getWatchlist();
  if (watchlist.length === 0) {
    const sampleIds = ['void-runner', 'project-nova', 'red-signal', 'night-law', 'glass-kingdom', 'black-harbor'];
    localStorage.setItem('piraty-watchlist', JSON.stringify(sampleIds));
  }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('piraty-theme', theme);
  toast(theme === 'light' ? 'Light mode enabled' : 'Dark mode enabled');
}

function applySidebarState() {
  const isCollapsed = localStorage.getItem('piraty_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    document.body.classList.add('sidebar-collapsed');
  } else {
    document.body.classList.remove('sidebar-collapsed');
  }
}
function initSidebarToggle() {
  // Use event delegation so the handler survives DOM replacements.
  if (window.__piraty_sidebar_toggle_initialized) return;
  window.__piraty_sidebar_toggle_initialized = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#sidebarToggle');
    if (!btn) return;
    e.preventDefault();
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('piraty_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    // Remove preload marker to ensure toggle state is respected after navigation
    document.documentElement.classList.remove('sidebar-collapsed-preload');
  });
}

function buildSidebar() {
  const nav = $('.nav-scroll');
  if (!nav) return;
  const primary = [
    ['home','Home', path('index.html'), icons.home],
    ['search','Search','#', icons.search],
    ['browse','Browse',path('browse/'), icons.browse]
  ];
  const media = [
    ['movies','Movies',path('movies/'), icons.movie],
    ['tv-shows','TV Shows',path('tv-shows/'), icons.tv],
    ['anime','Anime',path('anime/'), icons.anime],
    ['manga','Manga','https://read.piraty.in', icons.manga],
    ['sports','Live Sports','https://sports.piraty.in', icons.sports],
    ['watchlist','Watchlist',path('watchlist/'), icons.heart],
    ['history','History',path('history/'), icons.history],
    ['legal','Legal Disclaimer',path('legal/'), icons.legal],
    ['privacy','Privacy Policy',path('privacy/'), icons.privacy],
    ['about','About Us',path('about/'), icons.about],
    ['contact','Contact Us',path('contact/'), icons.contact],
    ['terms','Terms of Service',path('terms/'), icons.terms]
  ];
  nav.innerHTML = `
    <div class="nav-card">${primary.map(n => navItem(n)).join('')}</div>
    <div class="nav-card"><div class="nav-label">Media</div>${media.map(n => navItem(n)).join('')}</div>`;
  const settings = $('.settings-link');
  if (settings) {
    settings.innerHTML = `${icons.settings}<span>Settings</span>`;
    if (page === 'settings') settings.classList.add('active');
  }
  const searchBtn = nav.querySelector('[data-nav="search"]');
  searchBtn?.addEventListener('click', e => { e.preventDefault(); openSearch(); });
}

function buildFooter() {
  const main = document.querySelector('.main');
  if (!main || document.querySelector('.site-footer')) return;

  main.insertAdjacentHTML('beforeend', `
    <footer class="site-footer" aria-label="Site footer">
      <div class="site-footer-inner">
        <p>
          Site made by fellow redditor
          <a href="https://www.reddit.com/user/Googly_eyes-/" target="_blank" rel="noopener noreferrer">u/Googly_eyes-</a>
        </p>
        <p class="site-footer-note">
          Have changes or suggestions?
          <a href="mailto:technologyguy235@gmail.com">Contact me</a>.
        </p>
      </div>
    </footer>
  `);
}
function navItem([id,label,href,icon]) {
  const active = id === page || (page === 'home' && id === 'home');
  const featuredClass = id === 'lists' ? 'nav-item-featured' : (id === 'profile' ? 'nav-item-featured-profile' : '');
  return `<a class="nav-item ${active ? 'active' : ''} ${featuredClass}" data-nav="${id}" href="${href}">${icon}<span>${label}</span></a>`;
}

function initMenu() {
  $('.mobile-menu')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  document.addEventListener('click', e => {
    if (window.innerWidth > 760) return;
    if (!e.target.closest('.sidebar') && !e.target.closest('.mobile-menu')) document.body.classList.remove('sidebar-open');
  });
}

async function loadPage(p) {
  const root = $('#page-root');
  if (!root) return;
  
  // Check if page is under development
  if (isUnderDevelopment(p)) {
    root.innerHTML = underDevOverlay();
    return;
  }
  
  const map = {
    home: () => homePage(),
    browse: () => browsePage(),
    movies: () => mediaPage('Movies', 'movie'),
    'tv-shows': () => mediaPage('TV Shows', 'show'),
    anime: () => mediaPage('Anime', 'anime'),
    manga: () => mediaPage('Manga', 'manga'),
    music: () => mediaPage('Music', 'music'),
    sports: () => mediaPage('Live Sports', 'sports'),
    watchlist: () => libraryPage('watchlist'),
    history: () => libraryPage('history'),
    legal: () => legalPage(),
    privacy: () => privacyPage(),
    about: () => aboutPage(),
    contact: () => contactPage(),
    terms: () => termsPage(),
    settings: () => settingsPage(),
    details: () => detailPage()
  };
  const pageContent = (map[p] || map.home)();
  root.innerHTML = pageContent instanceof Promise ? await pageContent : pageContent;
  initHero();
  initCards(root);
  initTop10Switchers(root);
  initSettings(root);
  initRowButtons();
  
  // Load TMDB enrichment on detail page
  if (p === 'details') {
    loadTMDBDetailEnrichment().catch(err => console.warn('TMDB enrichment error:', err));
  }
}

function homePage() {
  const continueItems = getContinueWatchingItems();
  return `
    ${hero(mixed().slice(0,4))}
      ${continueItems.length ? row('Continue Watching', continueItems, true, 'continueWatching') : ''}
    ${row('Trending Movies', byType('movie').slice(0,8))}
    ${row('Trending Shows', byType('show').slice(0,8))}
    ${row('Trending Anime', byType('anime').slice(0,8))}
    ${row('Top Manga', byType('manga'))}
    ${row('Music Picks', byType('music'))}
    ${row('Live Sports', byType('sports'))}
    ${row('Recently Added', DATA.items.slice().reverse().slice(0,12))}
  `;
}
function browsePage() {
  return `
    ${hero(DATA.items.slice(6,10))}
    ${row('Recommended', DATA.items.slice(0,12))}
    ${row('Movies', byType('movie'))}
    ${row('TV Shows', byType('show'))}
    ${row('Anime', byType('anime'))}
    ${row('Manga', byType('manga'))}
    ${row('Music', byType('music'))}
    ${row('Live Sports', byType('sports'))}
    ${collectionsSection()}
  `;
}
function mediaPage(title, type) {
  const list = byType(type);
  return `
    ${hero(list.slice(0,4))}
    ${row(`Trending ${title}`, list)}
    ${row('Recently Added', list.slice().reverse())}
    ${row('Recommended', shuffle(DATA.items).slice(0,10))}
    ${type === 'movie' ? collectionsSection() : ''}
  `;
}
function legalPage() {
  return `<section class="panel legal-content">
    <h1>Legal Disclaimer</h1>
    <p><strong>PiraTY is a media interface template.</strong> It is meant to show how a streaming dashboard works and does not itself host copyrighted content.</p>
    <h2>Responsibility for uploaded or embedded content</h2>
    <p>Anyone who adds, embeds, imports, or streams material through this platform is responsible for making sure it is legal. That means owning the rights, having a valid license, or using content that is allowed in your country.</p>
    <h2>No unauthorized copyrighted material</h2>
    <p>This site does not include unauthorized movies, shows, anime, music, sports broadcasts, or paid streams.</p>
    <h2>Rights or DMCA contact</h2>
    <p>If you are a rights owner or need to report copyright concerns, email: <strong>technologyguy235@gmail.com</strong>.</p>
    <h2>Important note</h2>
    <p>Before publishing, add your actual legal contact details and licensing information so the page matches your real service.</p>
  </section>`;
}
function privacyPage() {
  return `<section class="panel legal-content">
    <h1>Privacy Policy</h1>
    <p><strong>Effective date: June 4, 2026.</strong> This policy explains how PiraTY collects, uses, and shares information when you use the website.</p>
    <h2>Information we collect</h2>
    <p>PiraTY may store your theme, watchlist, viewing history, and similar preferences in your browser. Our server and security tools may also process technical data such as your IP address, browser, device, requested pages, and timestamps.</p>
    <h2>Analytics, advertising, and third parties</h2>
    <p>We use Google Analytics to understand site usage and Google AdSense to display advertising. These services may use cookies or device identifiers. PiraTY also uses or links to services including TMDB, Jikan, and embedded video providers, which process data under their own privacy policies.</p>
    <h2>How information is used</h2>
    <p>Information is used to provide and personalize site features, maintain accounts, remember preferences, measure performance, display ads, prevent abuse, and improve reliability.</p>
    <h2>Cookies and local storage</h2>
    <p>You can restrict cookies through your browser and clear locally stored PiraTY preferences at any time. Disabling storage or cookies may prevent some features from working correctly.</p>
    <h2>Your choices</h2>
    <p>You can manage Google ad personalization at <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Google Ads Settings</a> and review Google's practices in its <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. You may contact us to ask about your PiraTY account data.</p>
    <h2>Retention and security</h2>
    <p>We retain information only as long as reasonably needed for the purposes described here, legal obligations, and site security. We use reasonable safeguards, but no online service can guarantee absolute security.</p>
    <h2>Children</h2>
    <p>PiraTY is not directed to children under 13, and we do not knowingly collect personal information from children under 13.</p>
    <h2>Changes and contact</h2>
    <p>We may update this policy as the site changes. Questions or privacy requests can be sent to <strong>technologyguy235@gmail.com</strong>.</p>
  </section>`;
}
function aboutPage() {
  return `<section class="panel legal-content">
    <h1>About Us</h1>
    <p><strong>PiraTY is a media discovery and interface platform.</strong> It helps users browse information about movies, TV shows, and anime through a streaming-style dashboard.</p>
    <h2>Content information</h2>
    <p>PiraTY displays media information and artwork provided by third-party data services. PiraTY does not host copyrighted movies, TV shows, anime, or paid streams on its own servers.</p>
    <h2>Third-party services</h2>
    <p>Some features may link to or embed independent third-party services. Those services are responsible for their own content, availability, and policies.</p>
  </section>`;
}
function contactPage() {
  return `<section class="panel legal-content">
    <h1>Contact Us</h1>
    <p><a href="mailto:technologyguy235@gmail.com"><strong>technologyguy235@gmail.com</strong></a></p>
  </section>`;
}
function termsPage() {
  return `<section class="panel legal-content">
    <h1>Terms of Service</h1>
    <p><strong>Effective date: June 4, 2026.</strong> By using PiraTY, you agree to these terms.</p>
    <h2>Permitted use</h2>
    <p>You may use PiraTY for lawful personal use. You must not misuse the site, disrupt its operation, attempt unauthorized access, or use it to infringe the rights of others.</p>
    <h2>Content and third-party services</h2>
    <p>PiraTY is a media interface and does not host copyrighted movies, TV shows, anime, or paid streams on its own servers. Media information, links, and embedded services may be provided by independent third parties and remain subject to their own terms.</p>
    <h2>Accounts</h2>
    <p>You are responsible for keeping your account credentials secure and for activity performed through your account.</p>
    <h2>Availability and liability</h2>
    <p>PiraTY is provided as available without a guarantee that every feature, link, or third-party service will always work. To the extent permitted by law, PiraTY is not responsible for losses caused by third-party services or misuse of the site.</p>
    <h2>Changes</h2>
    <p>These terms may be updated when the service changes. Continued use after an update means you accept the revised terms.</p>
    <h2>Contact</h2>
    <p><a href="mailto:technologyguy235@gmail.com"><strong>technologyguy235@gmail.com</strong></a></p>
  </section>`;
}
function settingsPage() {
  return `<section class="panel">
    <div class="settings-grid">
      <div class="theme-toggle-card">
        <div>
          <h1 class="section-title" style="font-size:clamp(38px,6vw,72px)">Theme Control</h1>
          <p style="color:var(--muted);line-height:1.6;max-width:620px">Switch between dark and light mode. Preference is saved in localStorage and applies across sidebar, cards, hero, buttons, search modal, and glass panels.</p>
        </div>
        <button class="big-toggle" data-theme-toggle aria-label="Toggle theme"><span></span></button>
        <div class="hero-buttons">
          <button class="btn primary" data-theme-set="dark">Dark Mode</button>
          <button class="btn" data-theme-set="light">Light Mode</button>
        </div>
      </div>
      <div>
        <div class="preview-row">
          <div class="preview-box preview-dark"><strong>Dark preview</strong><div class="preview-chip"></div><div class="preview-card"></div></div>
          <div class="preview-box preview-light"><strong>Light preview</strong><div class="preview-chip"></div><div class="preview-card"></div></div>
        </div>
        <div class="panel" style="margin-top:16px;box-shadow:none">
          <h2 style="margin-top:0">Future account area</h2>
          <p style="color:var(--muted);line-height:1.6">Under Development</p>
        </div>
      </div>
    </div>
  </section>`;
}
function libraryPage(kind) {
  const ids = kind === 'watchlist' ? getWatchlist() : getHistory();
  const title = kind === 'watchlist' ? 'Watchlist' : 'History';
  const subtitle = kind === 'watchlist' ? 'Saved titles from localStorage.' : 'Recently viewed titles.';
  const items = ids.map(id => findItem(id)).filter(Boolean);
  return `<section class="panel">
    <h1 class="section-title" style="font-size:clamp(42px,6vw,76px)">${title}</h1>
    <p style="color:var(--muted);margin-bottom:24px">${subtitle}</p>
    ${items.length ? `<div class="grid-list">${items.map(item => card(item, true, kind)).join('')}</div>` : `<div class="empty-state"><div><h2>No ${title.toLowerCase()} yet</h2><p>Play or add something from the homepage.</p></div></div>`}
  </section>
  `;
}
function detailPage() {
  // Try to get item from localStorage first (set by card click)
  let item = null;
  const stored = localStorage.getItem('piraty_selected_item');
  if (stored) {
    try {
      item = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored item', e);
    }
  }
  
  // Fall back to URL parameter or first item
  if (!item) {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    item = id ? findItem(id) : DATA.items[0];
  }
  
  // Ensure we have an item
  if (!item) {
    return `<section class="panel">
      <div class="empty-state">
        <div>
          <h2>No media selected</h2>
          <p>Select a title from the homepage to view details.</p>
          <a href="${path('index.html')}" class="btn" style="margin-top:16px;display:inline-block">Back to Home</a>
        </div>
      </div>
    </section>`;
  }
  
  // Add to history if not already done
  addHistory(item.id, false);
  
  // Prepare description - use TMDB description if available
  const description = item.description || item.overview || 'No description available.';
  
  return `<section class="panel detail-layout">
    <div class="detail-poster"><img ${imageAttrs(item.poster, { kind: 'detailPoster', alt: item.title, loading: 'lazy', sizes: '(max-width: 760px) 70vw, 320px', width: 342, height: 513 })}></div>
    <div class="detail-copy">
      <h1>${item.title}</h1>
      <div class="detail-meta"><span>${item.mediaType || item.type || 'media'}</span></div>
      <p>${description}</p>
      <div class="hero-buttons">
        <button class="btn primary" data-play="${item.id}">${icons.play} Play</button>
        <button class="btn btn-direct-player" data-direct-play="${item.id}">${icons.directPlay || icons.play} Direct Player</button>
        <button class="btn" data-media-download>${icons.download} Download</button>
        <button class="btn" data-add-watchlist="${item.id}">${icons.plus} Add</button>
    </div>
    </div>
    <div id="tmdb-enrichment" style="display:none;"></div>
  </section>`;
}

function addDetailTrailerButton(trailerKey) {
  const buttons = document.querySelector('.detail-copy .hero-buttons');
  if (!buttons || buttons.querySelector('.detail-trailer-btn')) return;

  buttons.insertAdjacentHTML(
    'beforeend',
    `<button class="btn detail-trailer-btn" onclick="window.open('https://youtube.com/watch?v=${trailerKey}', '_blank'); return false;">${icons.play} Watch Trailer</button>`
  );
}

// Load richer TMDB details asynchronously if available
async function loadTMDBDetailEnrichment() {
  try {
    const stored = localStorage.getItem('piraty_selected_item');
    if (!stored) return;
    
    const item = JSON.parse(stored);
    if (!item.tmdbId || !item.mediaType) return;
    
    // Fetch enriched TMDB data
    const endpoint = item.mediaType === 'movie' 
      ? `/movie/${item.tmdbId}?language=en-US&append_to_response=videos,credits,similar`
      : `/tv/${item.tmdbId}?language=en-US&append_to_response=videos,credits,similar`;
    
    const data = await tmdbFetch(endpoint);
    if (!data) return;
    
    // Extract useful data
    const overview = String(data.overview || '').trim();
    const genres = data.genres?.map(g => g.name).join(', ') || 'N/A';
    const runtime = data.runtime ? `${data.runtime} min` : (data.number_of_seasons ? `${data.number_of_seasons} seasons` : '');
    
    // Get cast (first 6)
    const cast = (data.credits?.cast || []).slice(0, 6).map(c => c.name).join(', ') || 'N/A';
    
    // Get trailer if available
    const youtubeTrailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    if (youtubeTrailer) {
      addDetailTrailerButton(youtubeTrailer.key);
    }

    if (overview) {
      item.description = overview;
      saveSelectedItem(item);
      const descriptionEl = document.getElementById('detailDescription');
      if (descriptionEl) descriptionEl.textContent = overview;
    }
    
    // Get similar content
    let similarHtml = '';
    if (data.similar?.results?.length > 0) {
      const similarItems = data.similar.results
        .map(s => normalizeTMDBItem(s, item.mediaType))
        .filter(Boolean)
        .slice(0, 10);
      if (similarItems.length > 0) {
        similarHtml = row('Similar Content', similarItems);
      }
    }
    
    // Render enrichment if available
    if (genres !== 'N/A' || runtime || cast !== 'N/A' || similarHtml) {
      const enrichmentEl = $('#tmdb-enrichment');
      if (enrichmentEl) {
        let enrichmentContent = `<section class="panel" style="margin-top:32px">`;
        if (genres !== 'N/A') enrichmentContent += `<p><strong>Genres:</strong> ${genres}</p>`;
        if (runtime) enrichmentContent += `<p><strong>Duration:</strong> ${runtime}</p>`;
        if (cast !== 'N/A') enrichmentContent += `<p><strong>Cast:</strong> ${cast}</p>`;
        enrichmentContent += `</section>`;
        enrichmentEl.innerHTML = enrichmentContent;
        enrichmentEl.style.display = 'block';
      }
    }
    
    // Load similar content section if we have it
    if (similarHtml) {
      const root = $('#page-root');
      if (root) {
        root.innerHTML += similarHtml;
        initCards(root);
        initRowButtons();
      }
    }
  } catch (error) {
    console.warn('Failed to load TMDB enrichment:', error);
    // Don't crash page, just silently fail
  }
}

function hero(items) {
  if (!items || !items.length) return '';
  return `<section class="hero" data-hero>
    ${items.map((item, i) => `<article class="hero-slide ${i===0?'active':''}" data-hero-slide
      data-id="${escapeHtml(item.id)}"
      data-tmdb-id="${escapeHtml(item.tmdbId || '')}"
      data-anilist-id="${escapeHtml(item.anilistId || '')}"
      data-mal-id="${escapeHtml(item.malId || '')}"
      data-media-type="${escapeHtml(item.mediaType || item.type || '')}"
      data-title="${escapeHtml(item.title)}"
      data-type="${escapeHtml(item.category || item.type || '')}"
      data-year="${escapeHtml(item.year)}"
      data-rating="${escapeHtml(item.rating)}"
      data-poster="${escapeHtml(item.poster)}"
      data-backdrop="${escapeHtml(item.backdrop)}"
      data-description="${escapeHtml(item.description || '')}">
      <img ${imageAttrs(item.backdrop, { kind: 'hero', alt: item.title, loading: i === 0 ? 'eager' : 'lazy', fetchpriority: i === 0 ? 'high' : 'low', sizes: '(max-width: 760px) 100vw, calc(100vw - var(--sidebar-w))', width: 1280, height: 720 })}>
      <div class="hero-content">
        <h1>${item.title}</h1>
        <p>${item.category} • ${item.year} • ★ ${item.rating}</p>
        <div class="hero-buttons">
          <button class="btn primary" data-hero-play="${item.id}">${icons.play} Play</button>
          <button class="btn" data-hero-add-watchlist="${item.id}" aria-label="Add ${escapeHtml(item.title)} to Watchlist">${icons.plus}</button>
        </div>
      </div>
    </article>`).join('')}
    <div class="hero-controls"><button class="round-btn" data-hero-prev aria-label="Previous featured title">${icons.arrowLeft}</button><button class="round-btn" data-hero-next aria-label="Next featured title">${icons.arrowRight}</button></div>
  </section>`;
}
function row(title, items, removable=false, removeKind='history') {
  if (!items || !items.length) return '';
  const id = 'row-' + Math.random().toString(36).slice(2,9);
  return `<section class="section">
    <div class="section-head"><h2 class="section-title">${title} ${title==='Collections' ? '<span>Explore All</span>' : ''}</h2><div class="row-controls"><button class="round-btn" data-scroll-left="${id}" aria-label="Scroll ${escapeHtml(title)} left">${icons.arrowLeft}</button><button class="round-btn" data-scroll-right="${id}" aria-label="Scroll ${escapeHtml(title)} right">${icons.arrowRight}</button></div></div>
    <div class="media-row" id="${id}">${items.map(item => card(item, removable, removeKind)).join('')}</div>
  </section>`;
}
function card(item, removable=false, removeKind='history') {
  if (!item) return '';
  const removeId = removeKind === 'continueWatching' ? (item.mediaKey || item.id) : item.id;
  return `<article class="poster-card" 
    data-card-id="${item.id}"
    data-card-title="${escapeHtml(item.title)}"
    data-card-type="${item.category || item.type}"
    data-card-year="${item.year}"
    data-card-rating="${item.rating}"
    data-card-poster="${item.poster}"
    data-card-backdrop="${item.backdrop}"
    data-tmdb-id="${item.tmdbId || ''}"
    data-anilist-id="${item.anilistId || ''}"
    data-mal-id="${item.malId || ''}"
    data-media-type="${item.mediaType || item.type || ''}"
    aria-label="View ${escapeHtml(item.title)}">
    <div class="poster-frame">
      <img ${imageAttrs(item.poster, { kind: 'poster', alt: item.title, loading: 'lazy', sizes: '(max-width: 520px) 42vw, (max-width: 760px) 172px, 190px', width: 342, height: 513 })}>
      <span class="rating">${item.rating}</span>
      <div class="card-actions">
        ${removable ? `<button class="icon-btn" title="Remove" data-remove-${removeKind}="${escapeHtml(String(removeId || ''))}">${icons.trash}</button>` : `<button class="icon-btn" title="Add to Watchlist" data-add-watchlist="${item.id}">${icons.plus}</button>`}
      </div>
      <div class="card-play"><button title="View details" data-card-play="${item.id}">${icons.play}</button></div>
    </div>
    <a class="card-meta" href="${path('details/?id=' + item.id)}" data-detail="${item.id}">
      <div class="card-line"><span>${item.category || item.type}</span><span>${item.year}</span></div>
      <div class="card-title">${item.title}</div>
    </a>
  </article>`;
}
function collectionsSection() {
  const id='collections-row';
  return `<section class="section"><div class="section-head"><h2 class="section-title">Collections <span>Explore All</span></h2><div class="row-controls"><button class="round-btn" data-scroll-left="${id}" aria-label="Scroll Collections left">${icons.arrowLeft}</button><button class="round-btn" data-scroll-right="${id}" aria-label="Scroll Collections right">${icons.arrowRight}</button></div></div><div class="collection-row" id="${id}">${DATA.collections.map(renderCollectionCard).join('')}</div></section>`;
}

// ============================================================
// TMDB PAGE LOADERS - Async functions to load TMDB data for pages
// ============================================================

async function loadTMDBHomeHero() {
  if (!isTMDBConfigured()) return hero(mixed().slice(0,4));
  try {
    const data = await tmdbFetch('/trending/all/week?language=en-US');
    if (!data || !data.results) return hero(mixed().slice(0,4));
    const items = data.results
      .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.backdrop_path)
      .map(item => normalizeTMDBItem(item))
      .filter(Boolean)
      .slice(0, 5);
    return items.length > 0 ? hero(items) : hero(mixed().slice(0,4));
  } catch (error) {
    console.warn('Failed to load TMDB hero:', error);
    return hero(mixed().slice(0,4));
  }
}

async function loadTMDBTrendingMovies() {
  if (!isTMDBConfigured()) return row('Trending Movies', byType('movie').slice(0,8));
  try {
    const data = await tmdbFetch('/trending/movie/week?language=en-US');
    if (!data || !data.results) return row('Trending Movies', byType('movie').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'movie'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Trending Movies', items) : row('Trending Movies', byType('movie').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB trending movies:', error);
    return row('Trending Movies', byType('movie').slice(0,8));
  }
}

async function loadTMDBTrendingShows() {
  if (!isTMDBConfigured()) return row('Trending Shows', byType('show').slice(0,8));
  try {
    const data = await tmdbFetch('/trending/tv/week?language=en-US');
    if (!data || !data.results) return row('Trending Shows', byType('show').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'tv'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Trending Shows', items) : row('Trending Shows', byType('show').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB trending shows:', error);
    return row('Trending Shows', byType('show').slice(0,8));
  }
}

async function loadTMDBPopularMovies() {
  if (!isTMDBConfigured()) return row('Popular Movies', byType('movie').slice(0,12));
  try {
    const data = await tmdbFetch('/movie/popular?language=en-US&page=1');
    if (!data || !data.results) return row('Popular Movies', byType('movie').slice(0,12));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'movie'))
      .filter(Boolean)
      .slice(0, 12);
    return items.length > 0 ? row('Popular Movies', items) : row('Popular Movies', byType('movie').slice(0,12));
  } catch (error) {
    console.warn('Failed to load TMDB popular movies:', error);
    return row('Popular Movies', byType('movie').slice(0,12));
  }
}

async function loadTMDBTopRatedMovies() {
  if (!isTMDBConfigured()) return row('Top Rated Movies', byType('movie').slice(0,8));
  try {
    const data = await tmdbFetch('/movie/top_rated?language=en-US&page=1');
    if (!data || !data.results) return row('Top Rated Movies', byType('movie').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'movie'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Top Rated Movies', items) : row('Top Rated Movies', byType('movie').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB top rated movies:', error);
    return row('Top Rated Movies', byType('movie').slice(0,8));
  }
}

async function loadTMDBPopularShows() {
  if (!isTMDBConfigured()) return row('Popular TV Shows', byType('show').slice(0,12));
  try {
    const data = await tmdbFetch('/tv/popular?language=en-US&page=1');
    if (!data || !data.results) return row('Popular TV Shows', byType('show').slice(0,12));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'tv'))
      .filter(Boolean)
      .slice(0, 12);
    return items.length > 0 ? row('Popular TV Shows', items) : row('Popular TV Shows', byType('show').slice(0,12));
  } catch (error) {
    console.warn('Failed to load TMDB popular shows:', error);
    return row('Popular TV Shows', byType('show').slice(0,12));
  }
}

async function loadTMDBTopRatedShows() {
  if (!isTMDBConfigured()) return row('Top Rated TV Shows', byType('show').slice(0,8));
  try {
    const data = await tmdbFetch('/tv/top_rated?language=en-US&page=1');
    if (!data || !data.results) return row('Top Rated TV Shows', byType('show').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'tv'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Top Rated TV Shows', items) : row('Top Rated TV Shows', byType('show').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB top rated shows:', error);
    return row('Top Rated TV Shows', byType('show').slice(0,8));
  }
}

async function loadTMDBAiringToday() {
  if (!isTMDBConfigured()) return row('Airing Today', byType('show').slice(0,8));
  try {
    const data = await tmdbFetch('/tv/airing_today?language=en-US&page=1');
    if (!data || !data.results) return row('Airing Today', byType('show').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'tv'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Airing Today', items) : row('Airing Today', byType('show').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB airing today:', error);
    return row('Airing Today', byType('show').slice(0,8));
  }
}

async function loadTMDBAnime() {
  if (!isTMDBConfigured()) return row('Trending Anime', byType('anime').slice(0,8));
  try {
    const data = await tmdbFetch('/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1');
    if (!data || !data.results) return row('Trending Anime', byType('anime').slice(0,8));
    const items = data.results
      .map(item => normalizeTMDBItem(item, 'tv'))
      .filter(Boolean)
      .slice(0, 8);
    return items.length > 0 ? row('Trending Anime', items) : row('Trending Anime', byType('anime').slice(0,8));
  } catch (error) {
    console.warn('Failed to load TMDB anime:', error);
    return row('Trending Anime', byType('anime').slice(0,8));
  }
}

// Check if TMDB is configured
function isTMDBConfigured() {
  return Boolean(TMDB_CONFIG.proxyUrl);
}

function initHero() {

  const hero = $('[data-hero]');
  if (!hero) return;
  const slides = Array.from(hero.querySelectorAll('[data-hero-slide]'));
  let index = 0;
  const show = n => {
    index = (n + slides.length) % slides.length;
    slides.forEach((s,i) => s.classList.toggle('active', i === index));
  };
  hero.querySelector('[data-hero-next]')?.addEventListener('click', () => show(index + 1));
  hero.querySelector('[data-hero-prev]')?.addEventListener('click', () => show(index - 1));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce), (update: slow), (max-width: 760px)')?.matches;
  if (slides.length > 1 && !reduceMotion) {
    setInterval(() => {
      if (!document.hidden) show(index + 1);
    }, 5200);
  }

  // Delegated handler: resolve clicked hero button to its closest slide at event time
  hero.addEventListener('click', e => {
    const playBtn = e.target.closest && e.target.closest('[data-hero-play]');
    if (playBtn) {
      e.preventDefault(); e.stopPropagation();
      let slideEl = playBtn.closest('[data-hero-slide]');
      // Prefer the visible active slide if the clicked slide isn't active
      if (slideEl && !slideEl.classList.contains('active')) {
        const active = hero.querySelector('.hero-slide.active');
        if (active) slideEl = active;
      }
      const item = findItem(slideEl?.dataset?.id) || itemFromDataset(slideEl);
      if (item) {
        trackPlayClick(item, "hero");
        playItem(item);
      }
      return;
    }
    const addBtn = e.target.closest && e.target.closest('[data-hero-add-watchlist]');
    if (addBtn) {
      e.preventDefault(); e.stopPropagation();
      let slideEl = addBtn.closest('[data-hero-slide]');
      if (slideEl && !slideEl.classList.contains('active')) {
        const active = hero.querySelector('.hero-slide.active');
        if (active) slideEl = active;
      }
      const item = itemFromDataset(slideEl);
      if (item) addWatchlist(item);
      return;
    }
  });

  upgradeHeroTitles(hero).catch(error => console.error('Hero title upgrade failed:', error));
}

async function upgradeHeroTitles(hero) {
  const slides = Array.from(hero.querySelectorAll('[data-hero-slide]'));
  await Promise.all(slides.map(async slide => {
    const item = findItem(slide?.dataset?.id) || itemFromDataset(slide);
    if (!item) return;
    const wrap = slide.querySelector('[data-hero-title-wrap]');
    const img = slide.querySelector('[data-hero-logo-title]');
    const fallback = slide.querySelector('[data-hero-title-fallback]');
    if (!wrap || !img || !fallback) return;

    const logoUrl = await fetchHeroLogoUrl(item);
    if (!logoUrl) return;

    const preload = new Image();
    preload.decoding = 'async';
    preload.onload = () => {
      img.src = logoUrl;
      img.hidden = false;
      fallback.hidden = true;
      wrap.classList.add('has-logo');
    };
    preload.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
      wrap.classList.remove('has-logo');
    };
    preload.src = logoUrl;
  }));
}
function initRowButtons() {
  $$('[data-scroll-left]').forEach(btn => btn.onclick = () => scrollRow(btn.dataset.scrollLeft, -1));
  $$('[data-scroll-right]').forEach(btn => btn.onclick = () => scrollRow(btn.dataset.scrollRight, 1));
}
function scrollRow(id, dir) {
  const el = document.getElementById(id); if (!el) return;
  el.scrollBy({ left: dir * Math.min(620, el.clientWidth * .82), behavior: 'smooth' });
}
function initCards(scope=document) {
   if (!scope) return;
  // Card navigation
  scope.querySelectorAll('.poster-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });
  
  scope.querySelectorAll('[data-add-watchlist]').forEach(btn => btn.addEventListener('click', e => {
    if (btn.closest('[data-hero]')) return; // hero buttons handled separately
    e.preventDefault(); e.stopPropagation(); addWatchlist(btn.dataset.addWatchlist);
  }));
  scope.querySelectorAll('[data-card-play]').forEach(btn => btn.addEventListener('click', e => {
    if (btn.closest('[data-hero]')) return; // hero buttons handled separately
    e.preventDefault(); e.stopPropagation(); playItem(btn.dataset.cardPlay);
  }));
  scope.querySelectorAll('[data-detail]').forEach(link => link.addEventListener('click', () => addHistory(link.dataset.detail, false)));
  scope.querySelectorAll('[data-remove-watchlist]').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); removeWatchlist(btn.dataset.removeWatchlist); }));
  scope.querySelectorAll('[data-remove-history]').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); removeHistory(btn.dataset.removeHistory); }));
  scope.querySelectorAll('[data-remove-continueWatching]').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); removeContinueWatching(btn.dataset.removeContinueWatching); }));
}

function handleCardClick(e) {
  // Don't navigate if clicking on button, links, or action elements
  const target = e.target;
  if (target.closest('button') || target.closest('a') || target.closest('.card-actions')) {
    return;
  }
  
  const card = e.currentTarget;
  const itemId = card.dataset.cardId;
  if (!itemId) return;
  
  const item = itemFromDataset(card) || findItem(itemId);
  if (!item) return;
  
  // Block navigation for under-development categories
  if (isUnderDevelopment(item.type)) {
    showUnderDevModal();
    return;
  }
  
  saveSelectedItem(item);
  addHistory(item, false);
  window.location.href = path('details/');
}

function navigateToDetail(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  
  // Save selected item to localStorage for detail page
  // Ensure TMDB IDs are preserved if available
  const itemToSave = {
    ...item,
    id: item.id,
    tmdbId: item.tmdbId || null,
    mediaType: item.mediaType || null
  };
  localStorage.setItem('piraty_selected_item', JSON.stringify(itemToSave));
  
  // Add to history
  addHistory(itemId, false);
  
  // Navigate to detail page
  window.location.href = path('details/');
}
function addWatchlist(id) {
  const list = getWatchlist();
  if (!list.includes(id)) list.unshift(id);
  localStorage.setItem('piraty-watchlist', JSON.stringify(list.slice(0,60)));
  toast('Added to watchlist');
}
function removeWatchlist(id) {
  localStorage.setItem('piraty-watchlist', JSON.stringify(getWatchlist().filter(x => x !== id)));
  loadPage(page);
  toast('Removed from watchlist');
}
function addHistory(id, notify=true) {
  const list = getHistory().filter(x => x !== id);
  list.unshift(id);
  localStorage.setItem('piraty-history', JSON.stringify(list.slice(0,40)));
  if (notify) toast('Added to history');
}
function removeHistory(id) {
  localStorage.setItem('piraty-history', JSON.stringify(getHistory().filter(x => x !== id)));
  loadPage(page);
  toast('Removed from history');
}

function removeContinueWatching(itemOrId) {
  const item = typeof itemOrId === 'object' ? itemOrId : findItem(itemOrId);
  const targetId = String(itemOrId || (item ? item.id : ''));
  const targetKey = item ? getMediaIdentityKey(item) : '';
  const targetTitle = String(item?.title || '').trim().toLowerCase();

  const localContinue = getLocalContinueItems().filter(entry => {
    if (String(entry.id) === targetId) return false;
    if (targetKey && getMediaIdentityKey(entry) === targetKey) return false;
    if (targetTitle && String(entry.title || '').trim().toLowerCase() === targetTitle) return false;
    return true;
  });
  writeStore(CONTINUE_KEY, localContinue);

  // Also clean history of this item so fallback doesn't resurrect it
  try {
    const cleanHist = getHistory().filter(entry => {
      const eId = typeof entry === 'object' ? String(entry.id || '') : String(entry);
      if (eId === targetId) return false;
      if (targetTitle && typeof entry === 'object' && String(entry.title || '').trim().toLowerCase() === targetTitle) return false;
      return true;
    });
    writeStore(HISTORY_KEY, cleanHist);
  } catch (e) {}

  if (getLocalUser() && item) removeLocalLibraryItem('continueWatching', item).catch(error => console.warn('Continue watching remove sync failed:', error));
  loadPage(page);
  toast('Removed from continue watching');
}

function showUnderDevModal() {
  let modal = document.getElementById('under-dev-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'under-dev-modal';
    modal.className = 'under-dev-modal';
    modal.innerHTML = `<div class="under-dev-modal-content">
      <div class="under-dev-modal-inner">
        <div class="under-dev-indicator"></div>
        <h2>Under Development</h2>
        <p>This section is currently being built for the future PiraTY experience.</p>
        <button class="btn" onclick="this.closest('.under-dev-modal').remove()">Got it</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  if (modal) {
  modal.classList.add('active');

  const modalButton = modal.querySelector('button');

  if (modalButton) {
    modalButton.focus();
  }
}
}
function getWatchlist() { return JSON.parse(localStorage.getItem('piraty-watchlist') || '[]'); }
function getHistory() { return JSON.parse(localStorage.getItem('piraty-history') || '[]'); }
function findItem(id) { return DATA.items.find(x => x.id === id); }

function initSearch() {
  $('.top-search input')?.addEventListener('focus', openSearch);
  $('.search-modal')?.addEventListener('click', e => { if (e.target.classList.contains('search-modal')) closeSearch(); });
  $('[data-close-search]')?.addEventListener('click', closeSearch);
  $('#searchInput')?.addEventListener('input', e => {
    clearTimeout(window.__searchDebounce);
    window.__searchDebounce = setTimeout(() => renderSearch(e.target.value), 400);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });
}
function openSearch() {
  $('.search-modal')?.classList.add('open');
  renderSearch('');
  setTimeout(() => $('#searchInput')?.focus(), 60);
}
function closeSearch() { $('.search-modal')?.classList.remove('open'); }

// Render search results - combines local and TMDB results
async function renderSearch(q) {
  const box = $('#searchResults');
  if (!box) return;
  
  const query = (q || '').toLowerCase().trim();
  
  // If no query, show placeholder
  if (!query) {
    box.innerHTML = '<div class="empty-state"><p>Start typing to search...</p></div>';
    return;
  }
  
  // Show loading state
  box.innerHTML = '<div class="empty-state"><p>Searching...</p></div>';
  
  let results = [];
  
  // Search local data first
  const localResults = DATA.items
    .filter(item => item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query) || item.type.toLowerCase().includes(query))
    .slice(0, 6);
  
  results = [...localResults];
  
  // Search TMDB if API is configured and query is long enough
  if (isTMDBConfigured() && query.length > 2) {
    try {
      const tmdbData = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`);
      if (tmdbData && tmdbData.results) {
        const tmdbResults = tmdbData.results
          .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
          .map(item => normalizeTMDBItem(item))
          .filter(Boolean)
          .slice(0, 6);
        
        // Combine and dedupe (prefer local results)
        results = results.concat(tmdbResults.filter(tr => !results.some(lr => lr.title.toLowerCase() === tr.title.toLowerCase())));
      }
    } catch (error) {
      console.warn('TMDB search error:', error);
      // Continue with local results only
    }
  }
  
  // Limit to 12 total results
  results = results.slice(0, 12);
  
  // Render results
  if (results.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>No results. The database survived another vague query.</p></div>';
  } else {
    box.innerHTML = results.map(item => card(item)).join('');
    initCards(box);
  }
}

function initSettings(scope = document) {
  if (!scope) return;

  scope.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const next =
      document.documentElement.dataset.theme === 'dark'
        ? 'light'
        : 'dark';

    setTheme(next);
  });

  scope.querySelectorAll('[data-theme-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeSet);
    });
  });
}

function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
}
function shuffle(arr) { return arr.slice().sort(() => Math.random() - .5); }
function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }


/* ============================================================
   FINAL TMDB + CARD + LIBRARY PATCH
   This section intentionally overrides earlier functions in this file.
   It keeps the existing design, but fixes TMDB rendering, TMDB IDs,
   card clicks, details, watchlist, history, and remote image paths.
============================================================ */

const PIRATY_CACHE = window.PIRATY_CACHE || (window.PIRATY_CACHE = new Map());
const WATCHLIST_KEY = 'piraty-watchlist';
const HISTORY_KEY = 'piraty-history';
const CONTINUE_KEY = 'piraty-continue-watching';
const SELECTED_KEY = 'piraty_selected_item';
const FIRESTORE_COLLECTIONS = {
  watchlist: 'watchlist',
  history: 'history',
  continueWatching: 'continueWatching'
};
const COMMUNITY_STATE = {
  comments: [],
  commentSort: 'newest',
  rating: null,
  lists: [],
  pendingLikes: new Set()
};
const LIBRARY_STATE = {
  user: null,
  loaded: false,
  migratedUsers: new Set(),
  watchlist: [],
  history: [],
  continueWatching: []
};
const AUTH_STATE = {
  profile: null
};
let authReady = false;
let currentUser = null;
let currentUserProfile = null;
const LIST_TITLE_SUGGESTION_CACHE_KEY = 'piraty-list-title-suggestions';
const LIST_TITLE_SUGGESTION_CACHE_TTL = 24 * 60 * 60 * 1000;
const LIST_TITLE_AUTOCOMPLETE_MIN_CHARS = 1;
const LIST_TITLE_AUTOCOMPLETE_REMOTE_MIN_CHARS = 2;
const LIST_TITLE_AUTOCOMPLETE_LIMIT = 8;
const LIST_TITLE_AUTOCOMPLETE_STATE = {
  requestId: 0
};

function setAuthReadyState(value) {
  authReady = Boolean(value);
  window.__piratyAuthReady = authReady;
}

function setCurrentUserState(user = null, profile = null) {
  currentUser = user || null;
  currentUserProfile = profile || null;
  AUTH_STATE.profile = currentUserProfile;
}

setAuthReadyState(false);

function normalizeListTitleQuery(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function listTitleSuggestionKey(item) {
  return `${normalizeListTitleQuery(item?.title || item?.name || '')}::${String(item?.mediaType || item?.type || item?.category || '').toLowerCase()}`;
}

function listTitleSuggestionCacheKey(query) {
  return `${LIST_TITLE_SUGGESTION_CACHE_KEY}:${normalizeListTitleQuery(query)}`;
}

function readListTitleSuggestionCache(query) {
  try {
    const raw = localStorage.getItem(listTitleSuggestionCacheKey(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.ts) return null;
    if (Date.now() - Number(parsed.ts || 0) > LIST_TITLE_SUGGESTION_CACHE_TTL) {
      localStorage.removeItem(listTitleSuggestionCacheKey(query));
      return null;
    }
    return parsed.items
      .map(item => (item && typeof item === 'object' ? rememberItem(item) : null))
      .filter(Boolean);
  } catch {
    return null;
  }
}

function writeListTitleSuggestionCache(query, items) {
  try {
    const key = listTitleSuggestionCacheKey(query);
    const payload = {
      ts: Date.now(),
      items: (items || []).slice(0, LIST_TITLE_AUTOCOMPLETE_LIMIT).map(item => rememberItem(item)).filter(Boolean)
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

function collectLocalListTitleSuggestions(query, limit = LIST_TITLE_AUTOCOMPLETE_LIMIT) {
  const normalized = normalizeListTitleQuery(query);
  if (!normalized) return [];
  return DATA.items
    .map(item => rememberItem(item))
    .filter(Boolean)
    .filter(item => normalizeListTitleQuery(item.title || '').startsWith(normalized))
    .sort((a, b) => {
      const aTitle = normalizeListTitleQuery(a.title || '');
      const bTitle = normalizeListTitleQuery(b.title || '');
      if (aTitle === normalized && bTitle !== normalized) return -1;
      if (bTitle === normalized && aTitle !== normalized) return 1;
      return aTitle.localeCompare(bTitle);
    })
    .slice(0, limit);
}

async function collectRemoteListTitleSuggestions(query, limit = LIST_TITLE_AUTOCOMPLETE_LIMIT) {
  const normalized = normalizeListTitleQuery(query);
  if (!normalized || !isTMDBConfigured() || normalized.length < LIST_TITLE_AUTOCOMPLETE_REMOTE_MIN_CHARS) return [];
  const cached = readListTitleSuggestionCache(normalized);
  if (cached) return cached.slice(0, limit);
  try {
    const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`);
    const items = (data?.results || [])
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .map(item => normalizeTMDBItem(item))
      .filter(Boolean)
      .filter(item => normalizeListTitleQuery(item.title || '').startsWith(normalized));
    writeListTitleSuggestionCache(normalized, items);
    return items.slice(0, limit);
  } catch (error) {
    console.warn('List title suggestions failed:', error);
    return [];
  }
}

function mergeListTitleSuggestions(primary = [], secondary = [], limit = LIST_TITLE_AUTOCOMPLETE_LIMIT) {
  const seen = new Set();
  return [...primary, ...secondary].filter(item => {
    const key = listTitleSuggestionKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function renderListTitleSuggestionItems(items, query) {
  const normalized = normalizeListTitleQuery(query);
  if (!normalized) return '';
  const rows = (items || []).map((item, index) => {
    const title = item?.title || item?.name || 'Untitled';
    const category = item?.category || item?.mediaType || item?.type || '';
    const year = item?.year || '';
    const poster = item?.poster ? `<img ${imageAttrs(item.poster, { kind: 'poster', alt: title, loading: 'lazy', sizes: '56px', width: 56, height: 84 })}>` : `<div class="list-title-suggestion-fallback">${escapeHtml(String(title).slice(0, 1).toUpperCase())}</div>`;
    return `<button class="list-title-suggestion" type="button" data-list-title-suggestion="${escapeHtml(String(index))}" data-list-title="${escapeHtml(title)}">
      <span class="list-title-suggestion-poster">${poster}</span>
      <span class="list-title-suggestion-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml([category, year].filter(Boolean).join(' • '))}</span>
      </span>
    </button>`;
  }).join('');
  return rows ? `<div class="list-title-suggestions-panel" role="listbox">${rows}</div>` : '';
}

function pickBestListTitleSuggestion(items, query) {
  const normalized = normalizeListTitleQuery(query);
  if (!normalized || !Array.isArray(items) || !items.length) return null;
  return items.find(item => normalizeListTitleQuery(item.title || '') === normalized)
    || items[0]
    || null;
}

function assetUrl(src) {
  const fallback = path('assets/images/posters/void-runner.svg');
  const versionAsset = value => window.PiraTYCache?.withVersion ? window.PiraTYCache.withVersion(value) : value;
  if (!src) return versionAsset(fallback);
  if (/^(https?:|data:|blob:)/i.test(String(src))) return versionAsset(src);
  return versionAsset(String(src).startsWith('/') ? src : path(src));
}

const TMDB_IMAGE_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/([^/]+)(\/.+)$/i;

function tmdbImageVariant(src, size) {
  const match = String(src || '').match(TMDB_IMAGE_RE);
  return match ? `${TMDB_CONFIG.imageBaseUrl}/${size}${match[2]}` : null;
}

function tmdbSrcset(src, widths) {
  if (!String(src || '').match(TMDB_IMAGE_RE)) return '';
  return widths
    .map(width => {
      const url = tmdbImageVariant(src, `w${width}`);
      return url ? `${url} ${width}w` : '';
    })
    .filter(Boolean)
    .join(', ');
}

function imageAttrs(src, {
  kind = 'poster',
  alt = '',
  loading = 'lazy',
  fetchpriority = null,
  sizes = '',
  width = 342,
  height = 513,
  className = ''
} = {}) {
  const isTmdb = TMDB_IMAGE_RE.test(String(src || ''));
  const tmdbWidths = {
    poster: [185, 342],
    detailPoster: [342, 500],
    hero: [780, 1280],
    backdrop: [780, 1280],
    profile: [185, 300]
  };
  const baseSizes = {
    poster: 'w342',
    detailPoster: 'w342',
    hero: 'w780',
    backdrop: 'w780',
    profile: 'w185'
  };
  const imgSrc = isTmdb ? (tmdbImageVariant(src, baseSizes[kind] || 'w342') || src) : assetUrl(src);
  const attrs = [
    className ? `class="${className}"` : '',
    `src="${imgSrc}"`,
    isTmdb ? `srcset="${tmdbSrcset(src, tmdbWidths[kind] || tmdbWidths.poster)}"` : '',
    sizes ? `sizes="${sizes}"` : '',
    `width="${width}"`,
    `height="${height}"`,
    `alt="${escapeHtml(alt)}"`,
    `loading="${loading}"`,
    'decoding="async"',
    fetchpriority ? `fetchpriority="${fetchpriority}"` : ''
  ];

  return attrs.filter(Boolean).join(' ');
}

const COLLECTION_POSTER_CACHE = new Map();
const collectionPosterTimers = new WeakMap();

function getCollectionDefinition(id) {
  return REAL_COLLECTION_DEFINITIONS.find(collection => collection.id === id || collection.slug === id) || null;
}

function renderCollectionMedia(collection) {
  const slides = COLLECTION_POSTER_CACHE.get(collection.id);
  const resolvedSlides = Array.isArray(slides) ? slides.filter(Boolean).slice(0, 8) : [];
  const fallback = collection.image || getCollectionDefinition(collection.id)?.image || 'assets/images/heroes/void-runner.svg';

  if (!resolvedSlides.length) {
    return `<div class="collection-media" data-collection-media="${escapeHtml(collection.id)}"><img ${imageAttrs(fallback, { className: 'collection-fallback', alt: collection.title, loading: 'lazy', sizes: '(max-width: 760px) 270px, 340px', width: 340, height: 191 })}></div>`;
  }

  return `
    <div class="collection-media" data-collection-media="${escapeHtml(collection.id)}">
      <div class="collection-slideshow" aria-hidden="true">
        ${resolvedSlides.map((poster, index) => `<img ${imageAttrs(poster, { className: index === 0 ? 'is-active' : '', alt: '', loading: 'lazy', sizes: '(max-width: 760px) 270px, 340px', width: 340, height: 191 })}>`).join('')}
      </div>
    </div>`;
}

function renderCollectionCard(collection) {
  return `
    <a class="collection-card" href="${browsePageHref('collection=' + collection.id)}" data-type="collection" data-collection="${collection.id}" aria-label="Browse ${escapeHtml(collection.title)}">
      ${renderCollectionMedia(collection)}
      <div class="collection-copy"><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.count)}</p></div>
    </a>`;
}

async function resolveCollectionPoster(title) {
  if (!isTMDBConfigured() || !title) return null;
  try {
    const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
    const candidates = (data?.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    const exact = candidates.find(item => String(item.title || item.name || '').toLowerCase() === String(title).toLowerCase());
    const match = exact || candidates[0];
    if (!match?.poster_path) {
      console.warn('Collection poster could not be resolved:', title);
      return null;
    }
    return getTMDBImage(match.poster_path, 'w500') || null;
  } catch (error) {
    console.warn('Collection poster resolve failed:', title, error);
    return null;
  }
}

async function loadCollectionPosterSlides(collectionId) {
  const cached = COLLECTION_POSTER_CACHE.get(collectionId);
  if (cached) return cached instanceof Promise ? cached : Promise.resolve(cached);

  const definition = getCollectionDefinition(collectionId);
  if (!definition) return [];

  const promise = Promise.all((definition.items || []).map(resolveCollectionPoster))
    .then(posters => {
      const unique = Array.from(new Set(posters.filter(Boolean))).slice(0, 8);
      COLLECTION_POSTER_CACHE.set(collectionId, unique);
      return unique;
    })
    .catch(error => {
      console.warn('Collection poster slideshow failed:', collectionId, error);
      COLLECTION_POSTER_CACHE.set(collectionId, []);
      return [];
    });

  COLLECTION_POSTER_CACHE.set(collectionId, promise);
  return promise;
}

function startCollectionSlideshow(mediaEl) {
  const slides = Array.from(mediaEl.querySelectorAll('.collection-slideshow img'));
  if (slides.length < 2 || collectionPosterTimers.has(mediaEl)) return;

  let active = 0;
  const timer = window.setInterval(() => {
    if (!document.body.contains(mediaEl)) {
      window.clearInterval(timer);
      return;
    }
    slides[active]?.classList.remove('is-active');
    active = (active + 1) % slides.length;
    slides[active]?.classList.add('is-active');
  }, 2400);

  collectionPosterTimers.set(mediaEl, timer);
}

function initCollectionPosterSlides(scope = document) {
  const cards = Array.from(scope.querySelectorAll('.collection-card[data-collection]'));
  cards.forEach(card => {
    const collectionId = card.dataset.collection;
    const collection = DATA.collections.find(entry => entry.id === collectionId);
    const mediaEl = card.querySelector('.collection-media');
    if (!collectionId || !collection || !mediaEl || card.dataset.posterSlidesInit === 'true') {
      if (mediaEl) startCollectionSlideshow(mediaEl);
      return;
    }

    card.dataset.posterSlidesInit = 'true';
    loadCollectionPosterSlides(collectionId).then(slides => {
      if (!slides.length || !document.body.contains(card)) return;
      mediaEl.outerHTML = renderCollectionMedia(collection);
      startCollectionSlideshow(card.querySelector('.collection-media'));
    });
  });
}

function cleanItem(item) {
  if (!item) return null;
  const mediaType = item.mediaType || item.type || 'movie';
  const typeLabel = item.category || item.typeLabel || item.type || (mediaType === 'tv' ? 'TV Show' : 'Movie');
  const anilistIdFromItemId = String(item.id || '').match(/^anilist-anime-(\d+)$/)?.[1] || null;
  return {
    id: String(item.id || `local-${Date.now()}`),
    tmdbId: item.tmdbId ?? null,
    anilistId: item.anilistId ?? item.idAniList ?? item.anilist_id ?? anilistIdFromItemId,
    malId: item.malId ?? item.mal_id ?? item.malID ?? item.myAnimeListId ?? null,
    mediaType: item.mediaType || (item.type === 'show' ? 'tv' : item.type) || null,
    title: item.title || item.name || 'Untitled',
    titleEnglish: item.titleEnglish || '',
    titleRomaji: item.titleRomaji || '',
    titleNative: item.titleNative || '',
    type: item.type || mediaType,
    category: item.category || typeLabel,
    format: item.format || null,
    episodes: item.episodes || null,
    duration: item.duration || null,
    season: item.season || item.selectedSeason || 1,
    episode: item.episode || item.selectedEpisode || 1,
    selectedSeason: item.selectedSeason || item.season || 1,
    selectedEpisode: item.selectedEpisode || item.episode || 1,
    server: item.server || '',
    sourceUrl: item.sourceUrl || '',
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    original_language: item.original_language || null,
    origin_country: Array.isArray(item.origin_country) ? item.origin_country : [],
    year: item.year || 'N/A',
    rating: item.rating || 'N/A',
    poster: item.poster || 'assets/images/posters/void-runner.svg',
    backdrop: item.backdrop || item.poster || 'assets/images/heroes/void-runner.svg',
    description: item.description || item.overview || 'No description available.'
  };
}

function rememberItem(item) {
  const clean = cleanItem(item);
  if (!clean || !clean.id) return null;
  PIRATY_CACHE.set(String(clean.id), clean);
  return clean;
}

function rememberItems(items) {
  return (items || []).map(rememberItem).filter(Boolean);
}

function readStore(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function writeStore(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function getLocalUser() {
  return currentUser || window.piratyAuth?.currentUser?.() || LIBRARY_STATE.user || null;
}

function getLocalDataStore() {
  return window.piratyAuth?.firestore || null;
}

function normalizeMediaTypeForKey(item) {
  const mediaType = String(item?.mediaType || '').toLowerCase();
  const raw = `${item?.mediaType || ''} ${item?.type || ''} ${item?.category || ''}`.toLowerCase();
  if (raw.includes('anime') && !item?.tmdbId) return 'anime';
  if (raw === 'tv' || raw === 'show' || raw.includes('tv show') || raw.includes('series')) return 'tv';
  if (raw === 'movie' || raw.includes('movie') || raw.includes('film')) return 'movie';
  if (raw.includes('anime')) return mediaType === 'movie' ? 'movie' : 'tv';
  return item?.tmdbId ? 'movie' : 'anime';
}

function mediaKeyForItem(item, season = 1, episode = 1) {
  const clean = item ? cleanItem(item) : null;
  if (!clean) return null;
  const type = normalizeMediaTypeForKey(clean);
  if (type === 'movie') {
    const id = clean.tmdbId || clean.id;
    return id ? `movie_${id}` : null;
  }
  if (type === 'tv') {
    const id = clean.tmdbId || clean.id;
    return id ? `tv_${id}_s${season || 1}_e${episode || 1}` : null;
  }
  const id = clean.tmdbId || clean.anilistId || clean.malId || clean.id;
  return id ? `anime_${id}_s${season || 1}_e${episode || 1}` : null;
}

function libraryDocData(item, { season = 1, episode = 1, server = '', sourceUrl = '', type = '' } = {}) {
  const clean = rememberItem(item);
  if (!clean) return null;
  return {
    id: clean.id,
    tmdbId: clean.tmdbId || null,
    anilistId: clean.anilistId || null,
    malId: clean.malId || null,
    type: type || normalizeMediaTypeForKey(clean) || clean.mediaType || clean.type,
    mediaType: clean.mediaType || null,
    category: clean.category || '',
    title: clean.title,
    poster: clean.poster,
    backdrop: clean.backdrop,
    rating: clean.rating,
    year: clean.year,
    season: Number(season || 1),
    episode: Number(episode || 1),
    server: server || '',
    sourceUrl: sourceUrl || '',
    updatedAt: getLocalDataStore()?.serverTimestamp?.()
  };
}

function itemFromLibraryDoc(data) {
  if (!data) return null;
  return rememberItem({
    id: data.id,
    tmdbId: data.tmdbId || null,
    anilistId: data.anilistId || null,
    malId: data.malId || null,
    mediaType: data.mediaType || data.type || null,
    type: data.category || data.type || data.mediaType || 'media',
    category: data.category || data.type || 'Media',
    title: data.title,
    poster: data.poster,
    backdrop: data.backdrop,
    rating: data.rating,
    year: data.year,
    season: data.season || 1,
    episode: data.episode || 1,
    selectedSeason: data.season || 1,
    selectedEpisode: data.episode || 1
  });
}

function getLocalContinueItems() {
  return readStore(CONTINUE_KEY).map(entryToItem).filter(Boolean);
}

function getMediaIdentityKey(item) {
  if (!item) return '';
  const clean = cleanItem(item) || item;
  const externalId = clean.tmdbId || clean.anilistId || clean.malId;
  const type = normalizeMediaTypeForKey(clean) || clean.mediaType || clean.type || 'media';
  if (externalId) return `${type}_${externalId}`;
  if (clean.id && !String(clean.id).startsWith('local-')) return String(clean.id);
  const normalizedTitle = String(clean.title || clean.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ');
  if (normalizedTitle) return `${type}_${normalizedTitle}`;
  return String(clean.id || '');
}

function dedupeContinueWatchingItems(items = []) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    if (!item) continue;
    const identity = getMediaIdentityKey(item);

    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(item);
  }

  return deduped;
}

function sortContinueWatchingItems(items = []) {
  const prepared = (items || []).map((item, index) => ({ ...item, __continueIndex: index }));
  const hasTimestamps = prepared.some(item => timestampMillis(item.updatedAt || item.createdAt) > 0);
  if (!hasTimestamps) {
    return dedupeContinueWatchingItems(prepared.map(({ __continueIndex, ...item }) => item));
  }
  return dedupeContinueWatchingItems(
    prepared
      .sort((a, b) => {
        const diff = timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt);
        return diff || (a.__continueIndex - b.__continueIndex);
      })
      .map(({ __continueIndex, ...item }) => item)
  );
}

function getContinueWatchingItems() {
  if (getLocalUser() && LIBRARY_STATE.loaded) return sortContinueWatchingItems(LIBRARY_STATE.continueWatching.map(itemFromLibraryDoc).filter(Boolean));
  const localContinue = getLocalContinueItems();
  return localContinue.length ? sortContinueWatchingItems(localContinue) : dedupeContinueWatchingItems(getHistoryItems());
}

async function libraryCollectionDocs(kind) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  const collectionName = FIRESTORE_COLLECTIONS[kind];
  if (!user || !fs || !collectionName) return [];

  try {
    const ref = fs.collection(fs.db, 'users', user.uid, collectionName);
    const q = fs.query(ref, fs.orderBy('updatedAt', 'desc'), fs.limit(80));
    const snapshot = await fs.getDocs(q);
    return snapshot.docs.map(docSnap => ({ mediaKey: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.warn(`Firestore ${kind} load failed:`, error);
    return [];
  }
}

async function loadLocalLibraries() {
  if (!getLocalUser()) {
    LIBRARY_STATE.loaded = false;
    LIBRARY_STATE.watchlist = [];
    LIBRARY_STATE.history = [];
    LIBRARY_STATE.continueWatching = [];
    return;
  }

  const [watchlist, history, continueWatching] = await Promise.all([
    libraryCollectionDocs('watchlist'),
    libraryCollectionDocs('history'),
    libraryCollectionDocs('continueWatching')
  ]);
  LIBRARY_STATE.watchlist = watchlist;
  LIBRARY_STATE.history = history;
  LIBRARY_STATE.continueWatching = continueWatching;
  LIBRARY_STATE.loaded = true;
}

async function saveLocalLibraryItem(kind, item, options = {}) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  const collectionName = FIRESTORE_COLLECTIONS[kind];
  if (!user || !fs || !collectionName || !item) return false;

  const season = options.season || item.selectedSeason || item.season || 1;
  const episode = options.episode || item.selectedEpisode || item.episode || 1;
  const key = mediaKeyForItem(item, season, episode);
  const data = libraryDocData(item, { ...options, season, episode });
  if (!key || !data) return false;

  try {
    await fs.setDoc(fs.doc(fs.db, 'users', user.uid, collectionName, key), data, { merge: true });
    const cache = LIBRARY_STATE[kind] || [];
    LIBRARY_STATE[kind] = [data, ...cache.filter(entry => entry.mediaKey !== key && mediaKeyForItem(entry, entry.season, entry.episode) !== key)].slice(0, 80);
    return true;
  } catch (error) {
    console.warn(`Firestore ${kind} save failed:`, error);
    return false;
  }
}

async function removeLocalLibraryItem(kind, itemOrId) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  const collectionName = FIRESTORE_COLLECTIONS[kind];
  const item = typeof itemOrId === 'object' ? itemOrId : findItem(itemOrId);
  if (!user || !fs || !collectionName || !item) return false;

  const key = mediaKeyForItem(item, item.selectedSeason || item.season || 1, item.selectedEpisode || item.episode || 1);
  if (!key) return false;

  try {
    await fs.deleteDoc(fs.doc(fs.db, 'users', user.uid, collectionName, key));
    LIBRARY_STATE[kind] = (LIBRARY_STATE[kind] || []).filter(entry => entry.mediaKey !== key && mediaKeyForItem(entry, entry.season, entry.episode) !== key);
    return true;
  } catch (error) {
    console.warn(`Firestore ${kind} remove failed:`, error);
    return false;
  }
}

async function migrateLocalLibrary(kind, items) {
  for (const item of items.map(entryToItem).filter(Boolean)) {
    await saveLocalLibraryItem(kind, item, {
      season: item.selectedSeason || item.season || 1,
      episode: item.selectedEpisode || item.episode || 1
    });
  }
}

async function migrateGuestDataOnLogin() {
  const user = getLocalUser();
  if (!user || LIBRARY_STATE.migratedUsers.has(user.uid)) return;
  LIBRARY_STATE.migratedUsers.add(user.uid);
  await Promise.all([
    migrateLocalLibrary('watchlist', getWatchlist()),
    migrateLocalLibrary('history', getHistory()),
    migrateLocalLibrary('continueWatching', readStore(CONTINUE_KEY))
  ]);
}

function saveLocalContinueWatching(item, options = {}) {
  const clean = rememberItem({
    ...item,
    selectedSeason: options.season || item?.selectedSeason || item?.season || 1,
    selectedEpisode: options.episode || item?.selectedEpisode || item?.episode || 1
  });
  if (!clean) return;
  const showIdentity = getMediaIdentityKey(clean);
  const list = getLocalContinueItems().filter(entry => getMediaIdentityKey(entry) !== showIdentity);
  writeStore(CONTINUE_KEY, [clean, ...list].slice(0, 40));
}

async function saveContinueWatching(item, options = {}) {
  if (!item) return;
  saveLocalContinueWatching(item, options);
  if (getLocalUser()) {
    await saveLocalLibraryItem('continueWatching', item, options);
  }
}

window.piratySaveContinueWatching = saveContinueWatching;

function openAuthModal(message = '') {
  const modal = document.getElementById('authModal');
  const emailInput = document.getElementById('authEmail');
  if (!modal) return;
  let messageEl = document.getElementById('authMessage');
  const authBox = modal.querySelector('.auth-box');
  if (!messageEl && authBox) {
    messageEl = document.createElement('p');
    messageEl.id = 'authMessage';
    messageEl.className = 'auth-message';
    authBox.querySelector('h2')?.insertAdjacentElement('afterend', messageEl);
  }
  if (messageEl) {
    messageEl.textContent = message || '';
    messageEl.style.display = message ? 'block' : 'none';
  }
  modal.querySelector('[data-auth-tab="login"]')?.click();
  modal.classList.add('open');
  setTimeout(() => emailInput?.focus(), 50);
}

function requireLogin(actionName = 'continue') {
  if (getLocalUser()) return true;
  openAuthModal(`Login to ${actionName}.`);
  return false;
}

window.requireLogin = requireLogin;

function currentUsername(user = getLocalUser()) {
  if (!user) return 'PiraTY User';
  if (!authReady) return currentUserProfile?.username || 'PiraTY User';
  const profile = currentUserProfile && currentUserProfile.uid === user.uid
    ? currentUserProfile
    : (AUTH_STATE.profile && AUTH_STATE.profile.uid === user.uid ? AUTH_STATE.profile : null);
  return profile?.username || user.displayName || user.email?.split('@')[0] || 'PiraTY User';
}

function currentAvatar(user = getLocalUser()) {
  if (!user) return '';
  if (!authReady) return currentUserProfile?.photoURL || '';
  const profile = currentUserProfile && currentUserProfile.uid === user.uid
    ? currentUserProfile
    : (AUTH_STATE.profile && AUTH_STATE.profile.uid === user.uid ? AUTH_STATE.profile : null);
  return profile?.photoURL || user.photoURL || '';
}

function canManagePublicList(list, user = getLocalUser()) {
  return Boolean(list && user && list.ownerUid === user.uid);
}

function friendlyAuthError(error) {
  const code = String(error?.code || error?.message || '');
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'permission-denied': 'Permission denied. Check Firestore rules.'
  };
  return map[code] || (code.includes('permission-denied') ? map['permission-denied'] : 'Something went wrong. Please try again.');
}

function isValidUsername(username) {
  return /^[A-Za-z0-9_]{3,24}$/.test(String(username || ''));
}

function usernameLower(username) {
  return String(username || '').trim().toLowerCase();
}

function usernameFromGoogleUser(user) {
  const base = String(user?.displayName || user?.email?.split('@')[0] || 'piraty_user')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18) || 'piraty_user';
  return base.length >= 3 ? base : `${base}_user`.slice(0, 24);
}

async function usernameExists(username, ignoreUid = '') {
  const fs = getLocalDataStore();
  const key = usernameLower(username);
  if (!fs || !key) return false;
  const snap = await fs.getDoc(fs.doc(fs.db, 'usernames', key));
  return snap.exists() && (!ignoreUid || snap.data()?.uid !== ignoreUid);
}

async function reserveUsername(username, uid) {
  const fs = getLocalDataStore();
  const key = usernameLower(username);
  if (!fs || !uid || !isValidUsername(username)) return false;
  const ref = fs.doc(fs.db, 'usernames', key);
  const snap = await fs.getDoc(ref);
  if (snap.exists()) return snap.data()?.uid === uid;
  await fs.setDoc(ref, {
    uid,
    username: username.trim(),
    createdAt: fs.serverTimestamp()
  });
  return true;
}

async function uniqueGoogleUsername(user) {
  const base = usernameFromGoogleUser(user);
  if (!await usernameExists(base)) return base;
  for (let i = 0; i < 8; i += 1) {
    const candidate = `${base.slice(0, 18)}_${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 24);
    if (!await usernameExists(candidate)) return candidate;
  }
  return `${base.slice(0, 14)}_${Date.now().toString().slice(-6)}`.slice(0, 24);
}

async function loadUserProfile(uid) {
  const fs = getLocalDataStore();
  if (!fs || !uid) return null;
  try {
    const snap = await fs.getDoc(fs.doc(fs.db, 'users', uid, 'profile', 'main'));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Profile load failed:', error);
    return null;
  }
}

async function loadOwnProfile(user = getLocalUser()) {
  return user ? loadUserProfile(user.uid) : null;
}

async function ensureUserProfile(user, { username = '', isGoogle = false } = {}) {
  const fs = getLocalDataStore();
  if (!fs || !user) return null;
  const existing = await loadOwnProfile(user);
  if (existing) {
    setCurrentUserState(user, existing);
    return existing;
  }

  let finalUsername = String(username || '').trim();
  if (!finalUsername) {
    if (isGoogle) {
      finalUsername = await uniqueGoogleUsername(user);
    } else if (user.displayName) {
      finalUsername = String(user.displayName).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    } else if (user.email) {
      finalUsername = String(user.email.split('@')[0] || '').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    }
  }
  if (!isValidUsername(finalUsername)) throw new Error('invalid-username');
  const reserved = await reserveUsername(finalUsername, user.uid);
  if (!reserved) throw new Error('username-taken');

  const profile = {
    uid: user.uid,
    username: finalUsername,
    usernameLower: usernameLower(finalUsername),
    displayName: isGoogle ? (user.displayName || finalUsername) : finalUsername,
    email: user.email || '',
    photoURL: isGoogle ? (user.photoURL || '') : '',
    bio: '',
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
    statsPublic: true,
    ratingsPublic: true
  };
  await fs.setDoc(fs.doc(fs.db, 'users', user.uid, 'profile', 'main'), profile, { merge: true });
  setCurrentUserState(user, profile);
  return profile;
}

function hasGuestLibraryData() {
  return Boolean(getWatchlistItems().length || getHistoryItems().length || getLocalContinueItems().length);
}

function promptGuestMigrationChoice() {
  let modal = document.getElementById('guestMigrationModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="auth-modal" id="guestMigrationModal">
        <div class="auth-box guest-migration-box">
          <h2>Move guest data?</h2>
          <p>Move your guest watchlist, history, and continue watching data to this account?</p>
          <div class="guest-migration-actions">
            <button class="auth-submit" type="button" data-move-guest>Move Data</button>
            <button class="auth-google" type="button" data-skip-guest>Not Now</button>
          </div>
        </div>
      </div>
    `);
    modal = document.getElementById('guestMigrationModal');
  }

  return new Promise(resolve => {
    const moveBtn = modal.querySelector('[data-move-guest]');
    const skipBtn = modal.querySelector('[data-skip-guest]');
    const cleanup = value => {
      modal.classList.remove('open');
      moveBtn?.removeEventListener('click', onMove);
      skipBtn?.removeEventListener('click', onSkip);
      resolve(value);
    };
    const onMove = () => cleanup(true);
    const onSkip = () => cleanup(false);
    moveBtn?.addEventListener('click', onMove);
    skipBtn?.addEventListener('click', onSkip);
    modal.classList.add('open');
  });
}

async function maybePromptGuestMigration() {
  const user = getLocalUser();
  if (!user || LIBRARY_STATE.migratedUsers.has(user.uid) || !hasGuestLibraryData()) return;
  const shouldMove = await promptGuestMigrationChoice();
  if (!shouldMove) {
    LIBRARY_STATE.migratedUsers.add(user.uid);
    return;
  }
  try {
    await migrateGuestDataOnLogin();
    await loadLocalLibraries();
    toast('Guest data moved to your account.');
  } catch (error) {
    console.error('Guest data migration failed:', error);
    toast('Could not move guest data. Check console.');
  }
}

function detailCurrentItem() {
  try {
    const stored = localStorage.getItem(SELECTED_KEY);
    return stored ? rememberItem(JSON.parse(stored)) : null;
  } catch (error) {
    console.warn('Selected item read failed:', error);
    return null;
  }
}

function textLimit(value, max) {
  return String(value || '').trim().slice(0, max);
}

function mediaListObject(item) {
  const clean = hydrateListCatalogItem(item);
  if (!clean) return null;
  return {
    mediaKey: publicListItemKey(clean),
    id: clean.id,
    type: normalizeMediaTypeForKey(clean),
    mediaType: clean.mediaType || normalizeMediaTypeForKey(clean),
    category: clean.category || clean.type || '',
    title: clean.title,
    poster: clean.poster,
    year: clean.year,
    rating: clean.rating,
    creatorNote: '',
    recommendationStars: 3
  };
}

function resolveCatalogItemFromListEntry(item) {
  const clean = cleanItem(item);
  if (!clean) return null;
  const catalog = Array.isArray(DATA.items) ? DATA.items : [];
  const normalizedTitle = normalizeListTitleQuery(clean.title || clean.name || '');
  const normalizedType = normalizeMediaTypeForKey(clean);
  const tmdbId = clean.tmdbId != null && clean.tmdbId !== '' ? String(clean.tmdbId) : '';
  const idKey = String(clean.id || '');
  const typeMatches = entry => {
    if (!entry) return false;
    const entryType = normalizeMediaTypeForKey(entry);
    const rawType = String(entry.category || entry.type || entry.mediaType || '').toLowerCase();
    if (normalizedType === 'anime') return entryType === 'anime' || rawType.includes('anime');
    if (normalizedType === 'tv') return entryType === 'tv' || rawType.includes('tv') || rawType.includes('series');
    if (normalizedType === 'movie') return entryType === 'movie' || rawType.includes('movie') || rawType.includes('film');
    return true;
  };
  const pickBestMatch = entries => {
    if (!entries.length) return null;
    const yearKey = String(clean.year || '').trim();
    return entries.find(entry => String(entry.year || '').trim() === yearKey) || entries[0] || null;
  };

  if (idKey) {
    const exact = catalog.find(entry => String(entry.id) === idKey);
    if (exact) return rememberItem(exact);
    const slug = idKey.match(/^tmdb-(movie|tv)-(\d+)$/);
    if (slug) {
      const bySlug = catalog.find(entry => String(entry.tmdbId || '') === slug[2]);
      if (bySlug) return rememberItem(bySlug);
    }
  }

  if (tmdbId) {
    const byTmdb = catalog.find(entry => String(entry.tmdbId || '') === tmdbId);
    if (byTmdb) return rememberItem(byTmdb);
  }

  if (normalizedTitle) {
    const exactTitleMatches = catalog.filter(entry => typeMatches(entry) && normalizeListTitleQuery(entry.title || entry.name || '') === normalizedTitle);
    const startsWithMatches = catalog.filter(entry => typeMatches(entry) && (
      normalizeListTitleQuery(entry.title || entry.name || '').startsWith(normalizedTitle)
      || normalizedTitle.startsWith(normalizeListTitleQuery(entry.title || entry.name || ''))
    ));
    const looseMatches = catalog.filter(entry => typeMatches(entry) && (
      normalizeListTitleQuery(entry.title || entry.name || '').includes(normalizedTitle)
      || normalizedTitle.includes(normalizeListTitleQuery(entry.title || entry.name || ''))
    ));
    return pickBestMatch(exactTitleMatches) || pickBestMatch(startsWithMatches) || pickBestMatch(looseMatches);
  }

  return null;
}

function hydrateListCatalogItem(item) {
  const clean = cleanItem(item);
  if (!clean) return null;
  const source = resolveCatalogItemFromListEntry(clean)
    || (clean.id ? findItem(clean.id) : null)
    || (clean.tmdbId ? findItem(String(clean.tmdbId)) : null)
    || null;
  if (!source) return rememberItem(clean);
  return rememberItem({
    ...source,
    ...clean,
    id: source.id || clean.id,
    tmdbId: clean.tmdbId || source.tmdbId || null,
    anilistId: clean.anilistId || source.anilistId || null,
    malId: clean.malId || source.malId || null,
    mediaType: clean.mediaType || source.mediaType || source.type || null,
    type: clean.type || source.type || source.mediaType || 'movie',
    category: clean.category || source.category || source.type || '',
    title: clean.title || source.title,
    poster: clean.poster || source.poster,
    backdrop: clean.backdrop || source.backdrop,
    rating: clean.rating || source.rating,
    year: clean.year || source.year,
    description: source.description || clean.description || source.overview || 'No description available.'
  });
}

function publicListItemKey(item) {
  const clean = item ? cleanItem(item) : null;
  if (!clean) return null;
  const type = normalizeMediaTypeForKey(clean);
  const externalId = clean.tmdbId || clean.anilistId || clean.malId;
  if (externalId) return `${type}_${externalId}`;
  const titleKey = normalizeListTitleQuery(clean.title || '');
  const yearKey = String(clean.year || '').trim() || 'n/a';
  return `${type}_${titleKey}_${yearKey}`;
}

function normalizeListItemEntry(item) {
  const clean = item ? hydrateListCatalogItem(item) : null;
  if (!clean) return null;
  return {
    mediaKey: publicListItemKey(clean),
    id: clean.id,
    tmdbId: clean.tmdbId || null,
    anilistId: clean.anilistId || null,
    malId: clean.malId || null,
    type: clean.type || clean.mediaType || 'movie',
    mediaType: clean.mediaType || clean.type || 'movie',
    category: clean.category || clean.type || '',
    title: clean.title,
    poster: clean.poster,
    year: clean.year,
    rating: clean.rating,
    backdrop: clean.backdrop,
    description: clean.description,
    creatorNote: textLimit(item.creatorNote || '', 500),
    recommendationStars: Math.max(1, Math.min(5, Number(item.recommendationStars || 3) || 3)),
    season: item.season || clean.season || 1,
    episode: item.episode || clean.episode || 1
  };
}

function normalizeListItems(items = []) {
  const seen = new Map();
  (items || []).map(normalizeListItemEntry).filter(Boolean).forEach(item => {
    const key = item.mediaKey || publicListItemKey(item);
    if (!key) return;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      return;
    }
    seen.set(key, {
      ...existing,
      ...item,
      creatorNote: item.creatorNote || existing.creatorNote || '',
      recommendationStars: item.recommendationStars || existing.recommendationStars || 3
    });
  });
  return Array.from(seen.values());
}

function listItemsNeedMigration(items = []) {
  return (items || []).some(item => !item || !Object.prototype.hasOwnProperty.call(item, 'creatorNote') || !Object.prototype.hasOwnProperty.call(item, 'recommendationStars'));
}

async function updateUserStats(delta = {}) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  if (!user || !fs) return;

  try {
    const statsRef = fs.doc(fs.db, 'users', user.uid, 'stats', 'main');
    const payload = { lastUpdated: fs.serverTimestamp() };
    ['moviesWatched', 'showsWatched', 'episodesWatched', 'commentsMade', 'ratingsGiven', 'listsCreated', 'watchTimeEstimate'].forEach(key => {
      if (Number(delta[key])) payload[key] = fs.increment(Number(delta[key]));
    });
    await fs.setDoc(statsRef, payload, { merge: true });
  } catch (error) {
    console.warn('Profile stats update failed:', error);
  }
}

async function loadUserStats() {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  if (!user || !fs) return null;

  try {
    const snap = await fs.getDoc(fs.doc(fs.db, 'users', user.uid, 'stats', 'main'));
    return snap.exists() ? snap.data() : {};
  } catch (error) {
    console.warn('Profile stats load failed:', error);
    return {};
  }
}

async function savePlayStats(item) {
  const clean = cleanItem(item);
  if (!clean || !getLocalUser()) return;
  const type = normalizeMediaTypeForKey(clean);
  await updateUserStats({
    moviesWatched: type === 'movie' ? 1 : 0,
    showsWatched: type === 'tv' || type === 'anime' ? 1 : 0,
    episodesWatched: type === 'tv' || type === 'anime' ? 1 : 0,
    watchTimeEstimate: type === 'movie' ? 110 : 24
  });
  await createActivity(type === 'movie' ? 'completed_movie' : 'completed_episode', clean);
  await checkAchievements(getLocalUser()?.uid);
}

async function loadComments(mediaKey) {
  const fs = getLocalDataStore();
  if (!fs || !mediaKey) return [];
  try {
    const ref = fs.collection(fs.db, 'media', mediaKey, 'comments');
    const snap = await fs.getDocs(fs.query(ref, fs.orderBy('createdAt', 'desc'), fs.limit(40)));
    const comments = await Promise.all(snap.docs.map(async (docSnap) => {
      const comment = { id: docSnap.id, ...docSnap.data() };
      comment.replies = await loadCommentReplies(mediaKey, comment.id);
      return comment;
    }));
    return comments;
  } catch (error) {
    console.error('Comments load failed:', error);
    return [];
  }
}

async function loadCommentReplies(mediaKey, commentId) {
  const fs = getLocalDataStore();
  if (!fs || !mediaKey || !commentId) return [];
  try {
    const ref = fs.collection(fs.db, 'media', mediaKey, 'comments', commentId, 'replies');
    const snap = await fs.getDocs(fs.query(ref, fs.orderBy('createdAt', 'asc'), fs.limit(60)));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error('Replies load failed:', error);
    return [];
  }
}

async function addComment(mediaKey, text, containsSpoiler = false) {
  if (!requireLogin('comment')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const cleanText = textLimit(text, 500);
  if (!fs || !user || !mediaKey || !cleanText) return false;

  try {
    const commentId = `${user.uid}_${Date.now()}`;
    await fs.setDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId), {
      uid: user.uid,
      username: currentUsername(user),
      avatar: currentAvatar(user),
      text: cleanText,
      containsSpoiler: Boolean(containsSpoiler),
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp(),
      likesCount: 0
    });
    await updateUserStats({ commentsMade: 1 });
    return true;
  } catch (error) {
    console.error('Comment save failed:', error);
    return false;
  }
}

async function deleteComment(mediaKey, commentId, ownerUid) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  if (!user || user.uid !== ownerUid || !fs) return false;
  try {
    await fs.deleteDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId));
    return true;
  } catch (error) {
    console.error('Comment delete failed:', error);
    return false;
  }
}

async function updateComment(mediaKey, commentId, ownerUid, text, containsSpoiler = false) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  const cleanText = textLimit(text, 500);
  if (!user || user.uid !== ownerUid || !fs || !mediaKey || !commentId || !cleanText) return false;
  try {
    await fs.updateDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId), {
      text: cleanText,
      containsSpoiler: Boolean(containsSpoiler),
      updatedAt: fs.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Comment update failed:', error);
    return false;
  }
}

async function addReply(mediaKey, commentId, text, containsSpoiler = false) {
  if (!requireLogin('reply')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const cleanText = textLimit(text, 500);
  if (!fs || !user || !mediaKey || !commentId || !cleanText) return false;

  try {
    const replyId = `${user.uid}_${Date.now()}`;
    await fs.setDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'replies', replyId), {
      uid: user.uid,
      username: currentUsername(user),
      avatar: currentAvatar(user),
      text: cleanText,
      containsSpoiler: Boolean(containsSpoiler),
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp(),
      likesCount: 0
    });
    return true;
  } catch (error) {
    console.error('Reply save failed:', error);
    return false;
  }
}

async function updateReply(mediaKey, commentId, replyId, ownerUid, text, containsSpoiler = false) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  const cleanText = textLimit(text, 500);
  if (!user || user.uid !== ownerUid || !fs || !mediaKey || !commentId || !replyId || !cleanText) return false;
  try {
    await fs.updateDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'replies', replyId), {
      text: cleanText,
      containsSpoiler: Boolean(containsSpoiler),
      updatedAt: fs.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Reply update failed:', error);
    return false;
  }
}

async function deleteReply(mediaKey, commentId, replyId, ownerUid) {
  const user = getLocalUser();
  const fs = getLocalDataStore();
  if (!user || user.uid !== ownerUid || !fs || !mediaKey || !commentId || !replyId) return false;
  try {
    await fs.deleteDoc(fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'replies', replyId));
    return true;
  } catch (error) {
    console.error('Reply delete failed:', error);
    return false;
  }
}

async function likeComment(mediaKey, commentId) {
  if (!requireLogin('like this comment')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  if (!fs || !user || !mediaKey || !commentId) return false;
  try {
    const commentRef = fs.doc(fs.db, 'media', mediaKey, 'comments', commentId);
    const likeRef = fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'likes', user.uid);
    const likeSnap = await fs.getDoc(likeRef);
    if (likeSnap.exists()) return true;
    await fs.setDoc(likeRef, {
      uid: user.uid,
      createdAt: fs.serverTimestamp()
    });
    await fs.updateDoc(commentRef, {
      likesCount: fs.increment(1)
    });
    return true;
  } catch (error) {
    console.error('Comment like failed:', error);
    return false;
  }
}

async function likeReply(mediaKey, commentId, replyId) {
  if (!requireLogin('like this reply')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  if (!fs || !user || !mediaKey || !commentId || !replyId) return false;
  try {
    const replyRef = fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'replies', replyId);
    const likeRef = fs.doc(fs.db, 'media', mediaKey, 'comments', commentId, 'replies', replyId, 'likes', user.uid);
    const likeSnap = await fs.getDoc(likeRef);
    if (likeSnap.exists()) return true;
    await fs.setDoc(likeRef, {
      uid: user.uid,
      createdAt: fs.serverTimestamp()
    });
    await fs.updateDoc(replyRef, {
      likesCount: fs.increment(1)
    });
    return true;
  } catch (error) {
    console.error('Reply like failed:', error);
    return false;
  }
}

function communityLikeKey(kind, mediaKey, commentId, replyId = '') {
  return [kind, mediaKey, commentId, replyId].filter(Boolean).join(':');
}

async function loadRating(mediaKey) {
  const fs = getLocalDataStore();
  if (!fs || !mediaKey) return { avgRating: 0, ratingCount: 0, userRating: null };
  try {
    const mediaSnap = await fs.getDoc(fs.doc(fs.db, 'media', mediaKey));
    const mediaData = mediaSnap.exists() ? mediaSnap.data() : {};
    const user = getLocalUser();
    let userRating = null;
    if (user) {
      const ratingSnap = await fs.getDoc(fs.doc(fs.db, 'media', mediaKey, 'ratings', user.uid));
      userRating = ratingSnap.exists() ? Number(ratingSnap.data().rating) : null;
    }
    return {
      avgRating: Number(mediaData.avgRating || 0),
      ratingCount: Number(mediaData.ratingCount || 0),
      userRating
    };
  } catch (error) {
    console.warn('Rating load failed:', error);
    return { avgRating: 0, ratingCount: 0, userRating: null };
  }
}

async function saveRating(mediaKey, rating) {
  if (!requireLogin('rate this title')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const nextRating = Math.max(1, Math.min(10, Number(rating)));
  if (!fs || !user || !mediaKey || !nextRating) return false;

  try {
    const ratingRef = fs.doc(fs.db, 'media', mediaKey, 'ratings', user.uid);
    const mediaRef = fs.doc(fs.db, 'media', mediaKey);
    const [ratingSnap, mediaSnap] = await Promise.all([fs.getDoc(ratingRef), fs.getDoc(mediaRef)]);
    const oldRating = ratingSnap.exists() ? Number(ratingSnap.data().rating || 0) : 0;
    const mediaData = mediaSnap.exists() ? mediaSnap.data() : {};
    const ratingTotal = Number(mediaData.ratingTotal || 0) - oldRating + nextRating;
    const ratingCount = Number(mediaData.ratingCount || 0) + (oldRating ? 0 : 1);

    await fs.setDoc(ratingRef, {
      uid: user.uid,
      rating: nextRating,
      createdAt: oldRating ? ratingSnap.data().createdAt || fs.serverTimestamp() : fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp()
    }, { merge: true });
    await fs.setDoc(mediaRef, {
      ratingTotal,
      ratingCount,
      avgRating: ratingCount ? Number((ratingTotal / ratingCount).toFixed(2)) : 0
    }, { merge: true });
    if (!oldRating) await updateUserStats({ ratingsGiven: 1 });
    await createActivity('rated', detailCurrentItem() || {}, { rating: nextRating });
    await checkAchievements(user.uid);
    return true;
  } catch (error) {
    console.warn('Rating save failed:', error);
    return false;
  }
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function activityPayload(type, item = {}, extra = {}) {
  const clean = item?.id || item?.title ? cleanItem(item) || {} : {};
  return {
    uid: getLocalUser()?.uid || '',
    username: currentUsername(),
    avatar: currentAvatar(),
    type,
    mediaKey: clean.id ? mediaKeyForItem(clean, clean.season || 1, clean.episode || 1) : '',
    mediaTitle: clean.title || '',
    mediaPoster: clean.poster || '',
    listId: extra.listId || '',
    listTitle: extra.listTitle || '',
    rating: extra.rating || null,
    textPreview: textLimit(extra.textPreview || '', 180),
    visibility: 'public'
  };
}

async function createActivity(type, item = {}, extra = {}) {
  const fs = getLocalDataStore();
  const user = getLocalUser();
  if (!fs || !user) return;
  try {
    const activityId = `${user.uid}_${Date.now()}_${type}`;
    await fs.setDoc(fs.doc(fs.db, 'activity', activityId), {
      ...activityPayload(type, item, extra),
      createdAt: fs.serverTimestamp()
    });
  } catch (error) {
    console.warn('Activity save failed:', error);
  }
}

async function loadActivityFeed(limitCount = 12) {
  const fs = getLocalDataStore();
  if (!fs) return [];
  try {
    const snap = await fs.getDocs(fs.query(
      fs.collection(fs.db, 'activity'),
      fs.orderBy('createdAt', 'desc'),
      fs.limit(limitCount)
    ));
    return snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(item => item.visibility === 'public')
      .sort((a, b) => timestampMillis(b.createdAt || b.updatedAt) - timestampMillis(a.createdAt || a.updatedAt))
      .slice(0, limitCount);
  } catch (error) {
    console.warn('Activity feed load failed:', error);
    return [];
  }
}

async function loadUserActivity(uid, types = [], limitCount = 20) {
  const items = await loadActivityFeed(100);
  return items
    .filter(item => item.uid === uid && (!types.length || types.includes(item.type)))
    .slice(0, limitCount);
}

const ACHIEVEMENTS = [
  ['first-watch', 'First Watch', 'Played your first title.', 'play'],
  ['first-review', 'First Review', 'Posted your first review.', 'review'],
  ['10-movies', '10 Movies Watched', 'Watched 10 movies.', '10'],
  ['50-movies', '50 Movies Watched', 'Watched 50 movies.', '50'],
  ['100-movies', '100 Movies Watched', 'Watched 100 movies.', '100'],
  ['anime-fan', 'Anime Fan', 'Watched anime content.', 'anime'],
  ['series-binger', 'Series Binger', 'Watched 10 episodes.', 'series'],
  ['critic', 'Critic', 'Submitted 10 ratings.', 'star']
];

async function unlockAchievement(id) {
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const ach = ACHIEVEMENTS.find(entry => entry[0] === id);
  if (!fs || !user || !ach) return;
  try {
    const ref = fs.doc(fs.db, 'users', user.uid, 'achievements', id);
    const snap = await fs.getDoc(ref);
    if (snap.exists()) return;
    await fs.setDoc(ref, {
      id,
      title: ach[1],
      description: ach[2],
      icon: ach[3],
      unlockedAt: fs.serverTimestamp()
    });
  } catch (error) {
    console.warn('Achievement unlock failed:', error);
  }
}

async function checkAchievements(uid = getLocalUser()?.uid) {
  const fs = getLocalDataStore();
  if (!fs || !uid || uid !== getLocalUser()?.uid) return;
  try {
    const statsSnap = await fs.getDoc(fs.doc(fs.db, 'users', uid, 'stats', 'main'));
    const stats = statsSnap.exists() ? statsSnap.data() : {};
    const unlocks = [];
    if ((stats.moviesWatched || 0) + (stats.showsWatched || 0) > 0) unlocks.push('first-watch');
    if ((stats.commentsMade || 0) > 0) unlocks.push('first-review');
    if ((stats.moviesWatched || 0) >= 10) unlocks.push('10-movies');
    if ((stats.moviesWatched || 0) >= 50) unlocks.push('50-movies');
    if ((stats.moviesWatched || 0) >= 100) unlocks.push('100-movies');
    if ((stats.episodesWatched || 0) >= 1) unlocks.push('anime-fan');
    if ((stats.episodesWatched || 0) >= 10) unlocks.push('series-binger');
    if ((stats.ratingsGiven || 0) >= 10) unlocks.push('critic');
    await Promise.all(unlocks.map(unlockAchievement));
  } catch (error) {
    console.warn('Achievement check failed:', error);
  }
}

async function loadAchievements(uid = getLocalUser()?.uid) {
  const fs = getLocalDataStore();
  if (!fs || !uid) return [];
  try {
    const snap = await fs.getDocs(fs.collection(fs.db, 'users', uid, 'achievements'));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.warn('Achievements load failed:', error);
    return [];
  }
}

async function loadReviews(mediaKey) {
  const fs = getLocalDataStore();
  if (!fs || !mediaKey) return [];
  try {
    const ref = fs.collection(fs.db, 'media', mediaKey, 'reviews');
    const snap = await fs.getDocs(fs.query(ref, fs.orderBy('updatedAt', 'desc'), fs.limit(30)));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.warn('Reviews load failed:', error);
    return [];
  }
}

async function saveReview(mediaKey, item, { rating, reviewText, containsSpoiler }) {
  if (!requireLogin('review this title')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const text = textLimit(reviewText, 1500);
  const nextRating = Math.max(1, Math.min(10, Number(rating)));
  if (!fs || !user || !mediaKey || !text || !nextRating) return false;
  try {
    const reviewRef = fs.doc(fs.db, 'media', mediaKey, 'reviews', user.uid);
    const oldSnap = await fs.getDoc(reviewRef);
    await fs.setDoc(reviewRef, {
      uid: user.uid,
      username: currentUsername(user),
      avatar: currentAvatar(user),
      rating: nextRating,
      reviewText: text,
      containsSpoiler: Boolean(containsSpoiler),
      createdAt: oldSnap.exists() ? oldSnap.data().createdAt || fs.serverTimestamp() : fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp(),
      likesCount: oldSnap.exists() ? Number(oldSnap.data().likesCount || 0) : 0
    }, { merge: true });
    await saveRating(mediaKey, nextRating);
    if (!oldSnap.exists()) await updateUserStats({ commentsMade: 1 });
    await createActivity('reviewed', item, { rating: nextRating, textPreview: text });
    await checkAchievements(user.uid);
    return true;
  } catch (error) {
    console.warn('Review save failed:', error);
    return false;
  }
}

async function deleteReview(mediaKey, uid) {
  const fs = getLocalDataStore();
  const user = getLocalUser();
  if (!fs || !user || user.uid !== uid) return false;
  try {
    await fs.deleteDoc(fs.doc(fs.db, 'media', mediaKey, 'reviews', uid));
    return true;
  } catch (error) {
    console.warn('Review delete failed:', error);
    return false;
  }
}

async function loadPublicProfile(uid) {
  const fs = getLocalDataStore();
  if (!fs || !uid) return null;
  try {
    const snap = await fs.getDoc(fs.doc(fs.db, 'users', uid, 'profile', 'main'));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.warn('Public profile load failed:', error);
    return null;
  }
}

function isEmailLike(value) {
  return /@/.test(String(value || ''));
}

async function resolvePublicOwnerName(uid) {
  const user = getLocalUser();
  if (!uid) return 'PiraTY User';
  if (user?.uid === uid && currentUserProfile?.username) return currentUserProfile.username;

  const cacheKey = `public-owner-name:${uid}`;
  if (PIRATY_CACHE.has(cacheKey)) return PIRATY_CACHE.get(cacheKey);

  const profile = await loadPublicProfile(uid);
  const resolved = profile?.username || (profile?.displayName && !isEmailLike(profile.displayName) ? profile.displayName : '') || 'PiraTY User';
  PIRATY_CACHE.set(cacheKey, resolved);
  return resolved;
}

async function savePublicProfile({ displayName, username, bio, statsPublic = true, ratingsPublic = true }) {
  if (!requireLogin('edit your public profile')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  const cleanUsername = textLimit(username, 24);
  if (!fs || !user || !isValidUsername(cleanUsername)) {
    toast('Use 3-24 letters, numbers, or underscores');
    return false;
  }
  try {
    const existing = await loadOwnProfile(user);
    if (usernameLower(cleanUsername) !== usernameLower(existing?.username)) {
      if (await usernameExists(cleanUsername, user.uid)) {
        toast('Username already taken.');
        return false;
      }
      const reserved = await reserveUsername(cleanUsername, user.uid);
      if (!reserved) {
        toast('Username already taken.');
        return false;
      }
    }
    await fs.setDoc(fs.doc(fs.db, 'users', user.uid, 'profile', 'main'), {
      uid: user.uid,
      displayName: textLimit(displayName, 60) || currentUsername(user),
      username: cleanUsername,
      usernameLower: usernameLower(cleanUsername),
      email: user.email || '',
      photoURL: currentAvatar(user),
      bio: textLimit(bio, 300),
      statsPublic: Boolean(statsPublic),
      ratingsPublic: Boolean(ratingsPublic),
      updatedAt: fs.serverTimestamp(),
      createdAt: existing?.createdAt || fs.serverTimestamp()
    }, { merge: true });
    setCurrentUserState(user, {
      uid: user.uid,
      displayName: textLimit(displayName, 60) || currentUsername(user),
      username: cleanUsername,
      usernameLower: usernameLower(cleanUsername),
      email: user.email || '',
      photoURL: currentAvatar(user),
      bio: textLimit(bio, 300),
      statsPublic: Boolean(statsPublic),
      ratingsPublic: Boolean(ratingsPublic),
      createdAt: existing?.createdAt || null,
      updatedAt: null
    });
    return true;
  } catch (error) {
    console.warn('Public profile save failed:', error);
    return false;
  }
}

async function followUser(targetUid, targetName = 'PiraTY User') {
  if (!requireLogin('follow this user')) return false;
  const fs = getLocalDataStore();
  const user = getLocalUser();
  if (!fs || !user || !targetUid || user.uid === targetUid) return false;
  try {
    const followingRef = fs.doc(fs.db, 'users', user.uid, 'following', targetUid);
    const snap = await fs.getDoc(followingRef);
    if (snap.exists()) {
      await fs.deleteDoc(followingRef);
      await fs.deleteDoc(fs.doc(fs.db, 'users', targetUid, 'followers', user.uid));
      toast('Unfollowed');
      return true;
    }
    const data = { uid: targetUid, username: targetName, avatar: '', createdAt: fs.serverTimestamp() };
    await fs.setDoc(followingRef, data);
    await fs.setDoc(fs.doc(fs.db, 'users', targetUid, 'followers', user.uid), {
      uid: user.uid,
      username: currentUsername(user),
      avatar: currentAvatar(user),
      createdAt: fs.serverTimestamp()
    });
    await createActivity('followed_user', {}, { textPreview: `Followed ${targetName}` });
    toast('Following');
    return true;
  } catch (error) {
    console.warn('Follow action failed:', error);
    return false;
  }
}

async function countSubcollection(pathParts) {
  const fs = getLocalDataStore();
  if (!fs) return 0;
  try {
    const snap = await fs.getDocs(fs.collection(fs.db, ...pathParts));
    return snap.size;
  } catch (error) {
    console.warn('Count load failed:', error);
    return 0;
  }
}

function officialCollections() {
  return REAL_COLLECTION_DEFINITIONS.map(collection => ({
    id: collection.id,
    title: collection.title,
    slug: collection.slug || collection.id,
    description: collection.description,
    coverImage: collection.image,
    isOfficial: true,
    items: collection.items.map((title, index) => ({
      id: `${collection.id}-${index}-${slugifyCollectionTitle(title)}`,
      title,
      mediaTitle: title,
      order: index + 1
    }))
  }));
}

async function loadCollections() {
  const fs = getLocalDataStore();
  const local = officialCollections();
  if (!fs) return local;
  try {
    const snap = await fs.getDocs(fs.collection(fs.db, 'collections'));
    const remote = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    return remote.length ? remote : local;
  } catch (error) {
    console.warn('Collections load failed:', error);
    return local;
  }
}

function entryToItem(entry) {
  if (!entry) return null;
  if (typeof entry === 'object') return rememberItem(entry);
  return findItem(String(entry));
}

async function resolveCollectionEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'object' && (entry.tmdbId || entry.poster)) return rememberItem(entry);
  const title = typeof entry === 'string' ? entry : (entry.mediaTitle || entry.title || '');
  if (!title) return entryToItem(entry);

  if (isTMDBConfigured()) {
    try {
      const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      const result = (data?.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .find(item => String(item.title || item.name || '').toLowerCase() === String(title).toLowerCase())
        || (data?.results || []).find(item => item.media_type === 'movie' || item.media_type === 'tv');
      const normalized = result ? normalizeTMDBItem(result) : null;
      if (normalized) return normalized;
    } catch (error) {
      console.warn('Collection entry resolve failed:', title, error);
    }
  }

  console.warn('Collection item could not be resolved:', title);
  return null;
}

function getWatchlist() {
  return readStore(WATCHLIST_KEY);
}

function getHistory() {
  return readStore(HISTORY_KEY);
}

function getWatchlistItems() {
  if (getLocalUser() && LIBRARY_STATE.loaded) return LIBRARY_STATE.watchlist.map(itemFromLibraryDoc).filter(Boolean);
  return getWatchlist().map(entryToItem).filter(Boolean);
}

function getHistoryItems() {
  if (getLocalUser() && LIBRARY_STATE.loaded) return LIBRARY_STATE.history.map(itemFromLibraryDoc).filter(Boolean);
  return getHistory().map(entryToItem).filter(Boolean);
}

function findItem(id) {
  if (!id) return null;
  const key = String(id);
  if (PIRATY_CACHE.has(key)) return PIRATY_CACHE.get(key);

  const local = DATA.items.find(x => String(x.id) === key)
    || DATA.items.find(x => String(x.tmdbId || '') === key)
    || (key.match(/^tmdb-(movie|tv)-(\d+)$/) ? DATA.items.find(x => String(x.tmdbId || '') === key.match(/^tmdb-(movie|tv)-(\d+)$/)[2]) : null)
    || (/^\d+$/.test(key) ? DATA.items.find(x => String(x.tmdbId || '') === key) : null);
  if (local) return rememberItem(local);

  const selected = localStorage.getItem(SELECTED_KEY);
  if (selected) {
    try {
      const item = JSON.parse(selected);
      if (String(item.id) === key) return rememberItem(item);
    } catch (e) {}
  }

  const libraryItem = [...getWatchlist(), ...getHistory()]
    .filter(x => x && typeof x === 'object')
    .find(x => String(x.id) === key);

  return libraryItem ? rememberItem(libraryItem) : null;
}

function saveSelectedItem(item) {
  const clean = rememberItem(item);
  if (!clean) return null;
  localStorage.setItem(SELECTED_KEY, JSON.stringify(clean));
  return clean;
}

// Build an item object from a slide or card dataset
function itemFromDataset(el) {
  if (!el || !el.dataset) return null;
  const rawType = el.dataset.type || el.dataset.cardType || null;
  const normalizedType = rawType
    ? String(rawType).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
  const resolvedType = normalizedType.includes('tv') || normalizedType.includes('series')
    ? 'tv'
    : normalizedType.includes('movie') || normalizedType.includes('film')
      ? 'movie'
      : normalizedType.includes('anime')
        ? 'anime'
        : rawType;
  return {
    id: el.dataset.id || el.dataset.cardId || null,
    tmdbId: el.dataset.tmdbId ? (isNaN(Number(el.dataset.tmdbId)) ? el.dataset.tmdbId : Number(el.dataset.tmdbId)) : null,
    anilistId: el.dataset.anilistId ? (isNaN(Number(el.dataset.anilistId)) ? el.dataset.anilistId : Number(el.dataset.anilistId)) : null,
    malId: el.dataset.malId ? (isNaN(Number(el.dataset.malId)) ? el.dataset.malId : Number(el.dataset.malId)) : null,
    mediaType: el.dataset.mediaType || null,
    title: el.dataset.title || el.dataset.cardTitle || null,
    type: resolvedType,
    category: rawType || null,
    year: el.dataset.year || el.dataset.cardYear || null,
    rating: el.dataset.rating || el.dataset.cardRating || null,
    poster: el.dataset.poster || el.dataset.cardPoster || null,
    backdrop: el.dataset.backdrop || el.dataset.cardBackdrop || null,
    description: el.dataset.description || ''
  };
}

// Persist and open an item (object or id)
function openItem(item) {
  if (!item) return;
  const clean = typeof item === 'object' ? rememberItem(item) : findItem(item);
  if (!clean) return;
  saveSelectedItem(clean);
  addHistory(clean, false);
  window.location.href = path('details/');
}

function addWatchlist(itemOrId) {
  const item = typeof itemOrId === 'object' ? rememberItem(itemOrId) : findItem(itemOrId);
  if (!item) return;

  const list = getWatchlist().map(entryToItem).filter(Boolean).filter(x => x.id !== item.id);
  list.unshift(item);
  writeStore(WATCHLIST_KEY, list.slice(0, 60));
  if (getLocalUser()) saveLocalLibraryItem('watchlist', item).catch(error => console.warn('Watchlist sync failed:', error));
  if (getLocalUser()) createActivity('added_to_watchlist', item).catch(error => console.warn('Watchlist activity failed:', error));
  toast('Added to watchlist');
}

function removeWatchlist(id) {
  const list = getWatchlist().map(entryToItem).filter(Boolean).filter(x => x.id !== id);
  writeStore(WATCHLIST_KEY, list);
  if (getLocalUser()) removeLocalLibraryItem('watchlist', id).catch(error => console.warn('Watchlist remove sync failed:', error));
  loadPage(page);
  toast('Removed from watchlist');
}

function addHistory(itemOrId, notify = true) {
  const item = typeof itemOrId === 'object' ? rememberItem(itemOrId) : findItem(itemOrId);
  if (!item) return;

  const list = getHistory().map(entryToItem).filter(Boolean).filter(x => x.id !== item.id);
  list.unshift(item);
  writeStore(HISTORY_KEY, list.slice(0, 40));
  if (getLocalUser()) saveLocalLibraryItem('history', item).catch(error => console.warn('History sync failed:', error));
  if (notify) toast('Added to history');
}

function removeHistory(id) {
  const list = getHistory().map(entryToItem).filter(Boolean).filter(x => x.id !== id);
  writeStore(HISTORY_KEY, list);
  if (getLocalUser()) removeLocalLibraryItem('history', id).catch(error => console.warn('History remove sync failed:', error));
  loadPage(page);
  toast('Removed from history');
}

function initSampleWatchlist() {
  const watchlist = getWatchlist();
  if (watchlist.length === 0) {
    const sampleIds = ['void-runner', 'project-nova', 'red-signal', 'night-law', 'glass-kingdom', 'black-harbor'];
    localStorage.setItem('piraty-watchlist', JSON.stringify(sampleIds));
  }
}

function isTMDBConfigured() {
  return Boolean(TMDB_CONFIG.proxyUrl);
}

function getTMDBImage(pathValue, size = 'w342') {
  if (!pathValue) return null;
  return `${TMDB_CONFIG.imageBaseUrl}/${size}${pathValue}`;
}

function normalizeTMDBItem(item, forcedMediaType = null) {
  if (!item) return null;

  const mediaType = forcedMediaType || item.media_type || (item.title ? 'movie' : 'tv');
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;
  if (item.adult) return null;

  const title = mediaType === 'movie' ? item.title : item.name;
  const date = mediaType === 'movie' ? item.release_date : item.first_air_date;
  if (!title) return null;

  const poster = getTMDBImage(item.poster_path, 'w342') || 'assets/images/posters/void-runner.svg';
  const backdrop = getTMDBImage(item.backdrop_path, 'w780') || getTMDBImage(item.poster_path, 'w780') || 'assets/images/heroes/void-runner.svg';

  return rememberItem({
    id: `tmdb-${mediaType}-${item.id}`,
    tmdbId: item.id,
    mediaType,
    title,
    type: mediaType,
    category: mediaType === 'movie' ? 'Movie' : 'TV Show',
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    original_language: item.original_language || null,
    origin_country: Array.isArray(item.origin_country) ? item.origin_country : [],
    releaseDate: date || '',
    status: item.status || '',
    year: date ? String(date).slice(0, 4) : 'N/A',
    rating: typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : 'N/A',
    poster,
    backdrop,
    description: item.overview || 'No description available.'
  });
}

async function tmdbItems(endpoint, forcedMediaType = null, limit = 12, requireBackdrop = false) {
  if (!isTMDBConfigured()) return [];
  const data = await tmdbFetch(endpoint);
  if (!data || !Array.isArray(data.results)) return [];
  return data.results
    .filter(item => !requireBackdrop || item.backdrop_path)
    .map(item => normalizeTMDBItem(item, forcedMediaType))
    .filter(Boolean)
    .slice(0, limit);
}

async function tmdbRow(title, endpoint, forcedMediaType = null, fallbackItems = [], limit = 12) {
  const items = await tmdbItems(endpoint, forcedMediaType, limit);
  return row(title, items.length ? items : fallbackItems);
}

async function tmdbAnimeRow(title, endpoint, fallbackItems = byType('anime'), limit = 12) {
  const items = await tmdbItems(endpoint, 'tv', limit);
  const animeItems = items.map(item => rememberItem({
    ...item,
    type: 'anime',
    mediaType: 'tv',
    category: 'Anime'
  })).filter(Boolean);
  return row(title, animeItems.length ? animeItems : fallbackItems);
}

async function tmdbAnimeHero(endpoint, fallbackItems = byType('anime').slice(0, 4)) {
  const items = await tmdbItems(endpoint, 'tv', 5, true);
  const animeItems = items.map(item => rememberItem({
    ...item,
    type: 'anime',
    mediaType: 'tv',
    category: 'Anime'
  })).filter(Boolean);
  return hero(animeItems.length ? animeItems : fallbackItems);
}
async function tmdbHero(endpoint, forcedMediaType = null, fallbackItems = mixed().slice(0, 4)) {
  const items = await tmdbItems(endpoint, forcedMediaType, 5, true);
  return hero(items.length ? items : fallbackItems);
}

const JIKAN_TMDB_MATCH_CACHE = new Map();
const JIKAN_ITEMS_CACHE_KEY = 'piraty-jikan-items-v2';
const JIKAN_ITEMS_CACHE_TTL = 6 * 60 * 60 * 1000;
const JIKAN_REQUEST_CACHE = new Map();
const ANILIST_TMDB_MATCH_CACHE = JIKAN_TMDB_MATCH_CACHE;
const ANILIST_ITEMS_CACHE_KEY = 'piraty-anilist-items-v1';
const ANILIST_ITEMS_CACHE_TTL = 45 * 60 * 1000;
const ANILIST_REQUEST_CACHE = new Map();

function readAniListItemsCache(key) {
  try {
    const cache = JSON.parse(localStorage.getItem(ANILIST_ITEMS_CACHE_KEY) || '{}');
    const entry = cache[key];
    if (!entry || Date.now() - entry.savedAt > ANILIST_ITEMS_CACHE_TTL || !Array.isArray(entry.items)) {
      return null;
    }
    return rememberItems(entry.items);
  } catch (error) {
    return null;
  }
}

function writeAniListItemsCache(key, items) {
  try {
    const cache = JSON.parse(localStorage.getItem(ANILIST_ITEMS_CACHE_KEY) || '{}');
    cache[key] = { savedAt: Date.now(), items };
    localStorage.setItem(ANILIST_ITEMS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {}
}

function aniListFetch(query, variables = {}) {
  const cacheKey = JSON.stringify({ query, variables });
  if (ANILIST_REQUEST_CACHE.has(cacheKey)) return ANILIST_REQUEST_CACHE.get(cacheKey);

  const request = (async () => {
    let lastError = null;

    try {
      const response = await fetch(ANILIST_CONFIG.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        lastError = new Error(`AniList proxy error: ${response.status} ${response.statusText}`);
        return null;
      }

      const payload = await response.json();
      if (payload?.errors && Array.isArray(payload.errors) && payload.errors.length) {
        lastError = new Error(payload.errors.map(error => error?.message || 'AniList error').join('; '));
        return null;
      }

      return payload;
    } catch (error) {
      lastError = error;
    }

    if (lastError) {
      console.warn('AniList fetch failed:', lastError);
    }
    return null;
  })();

  ANILIST_REQUEST_CACHE.set(cacheKey, request);
  request.finally(() => ANILIST_REQUEST_CACHE.delete(cacheKey));
  return request;
}

const ANIME_SCHEDULE_CACHE_KEY = 'piraty-anime-airing-schedule-v1';
const ANIME_SCHEDULE_CACHE_TTL = 30 * 60 * 1000;
const ANIME_AIRING_SCHEDULE_QUERY = `
  query PiraTYAiringSchedule($page: Int, $perPage: Int, $airingAtGreater: Int, $airingAtLesser: Int) {
    Page(page: $page, perPage: $perPage) {
      airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
        id
        airingAt
        episode
        timeUntilAiring
        media {
          id
          title { romaji english native }
          status
          coverImage { extraLarge large color }
        }
      }
    }
  }
`;

const ANIME_SCHEDULE_STATE = window.__piratyAnimeScheduleState || (window.__piratyAnimeScheduleState = {
  loaded: new Map(),
  activeKey: '',
  timer: null
});

function readAnimeScheduleCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(ANIME_SCHEDULE_CACHE_KEY) || '{}');
    return cache && typeof cache === 'object' ? cache : {};
  } catch {
    return {};
  }
}

function writeAnimeScheduleCache(cache) {
  try {
    localStorage.setItem(ANIME_SCHEDULE_CACHE_KEY, JSON.stringify(cache || {}));
  } catch {}
}

function weekScheduleDates(reference = new Date()) {
  const today = new Date(reference);
  const localDay = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - localDay);
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const localDateKey = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const key = localDateKey(date);
    return {
      key,
      label,
      date,
      shortDate: formatter.format(date),
      startSec: Math.floor(start.getTime() / 1000),
      endSec: Math.floor(end.getTime() / 1000),
      isToday: date.toDateString() === today.toDateString()
    };
  });
}

function scheduleTimeLabel(airingAt) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(Number(airingAt || 0) * 1000));
}

function scheduleCountdownLabel(airingAt) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(airingAt || 0) - now;
  if (diff <= 0) {
    const ago = Math.abs(diff);
    if (ago < 60) return 'Airing now';
    const hours = Math.floor(ago / 3600);
    const mins = Math.floor((ago % 3600) / 60);
    if (hours === 0) return `Aired ${Math.max(mins, 1)}m ago`;
    return `Aired ${hours}h ${mins ? `${mins}m` : ''} ago`.trim();
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${Math.max(mins, 1)}m`;
}

function scheduleStatusLabel(item, dateInfo) {
  const now = Math.floor(Date.now() / 1000);
  const airingAt = Number(item.airingAt || 0);
  const diff = airingAt - now;
  if (diff <= 0 && diff > -3600) return 'Airing';
  if (dateInfo?.isToday && diff > 0) return 'Today';
  if (airingAt < now) return 'Aired';
  return 'Upcoming';
}

function scheduleSort(items = []) {
  const now = Math.floor(Date.now() / 1000);
  return items.slice().sort((a, b) => {
    const aFuture = Number(a.airingAt || 0) >= now;
    const bFuture = Number(b.airingAt || 0) >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    if (aFuture) return Number(a.airingAt || 0) - Number(b.airingAt || 0);
    return Number(b.airingAt || 0) - Number(a.airingAt || 0);
  });
}

function animeScheduleTitle(media = {}) {
  return media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled Anime';
}

function animeScheduleCover(media = {}) {
  return media?.coverImage?.extraLarge || media?.coverImage?.large || '';
}

function normalizeAiringScheduleEntry(entry) {
  if (!entry?.id || !entry?.media?.id) return null;
  return {
    id: entry.id,
    airingAt: Number(entry.airingAt || 0),
    episode: Number(entry.episode || 0),
    timeUntilAiring: Number(entry.timeUntilAiring || 0),
    mediaId: entry.media.id,
    title: animeScheduleTitle(entry.media),
    cover: animeScheduleCover(entry.media),
    status: entry.media.status || '',
    media: entry.media
  };
}

function animeScheduleShell() {
  return `<section class="section anime-schedule-section" data-anime-schedule>
    <div class="section-head anime-schedule-head">
      <div>
        <h2 class="section-title">Airing Schedule</h2>
      </div>
    </div>
    <div class="anime-schedule-tabs" data-schedule-tabs></div>
    <div class="anime-schedule-body">
      <div class="anime-schedule-grid" data-schedule-grid aria-live="polite">${animeScheduleSkeletonCards(6)}</div>
    </div>
  </section>`;
}

function animeScheduleSkeletonCards(count = 6) {
  return Array.from({ length: count }, () => `
    <article class="anime-schedule-card skeleton-card" aria-hidden="true">
      <div class="anime-schedule-poster skeleton-frame"></div>
      <div class="anime-schedule-copy">
        <div class="skeleton-line skeleton-copy-title short"></div>
        <div class="skeleton-line skeleton-copy-text"></div>
        <div class="skeleton-line skeleton-copy-text short"></div>
      </div>
      <div class="anime-schedule-side">
        <span class="skeleton-pill"></span>
        <span class="skeleton-line skeleton-copy-text short"></span>
      </div>
    </article>
  `).join('');
}

function animeScheduleCard(item, dateInfo, isMySchedule = false) {
  const status = scheduleStatusLabel(item, dateInfo);
  const statusClass = status.toLowerCase();
  const poster = item.cover;
  const isJikan = item.source === 'jikan' || String(item.id || '').startsWith('jikan');
  const detailsId = isJikan ? `jikan-anime-${item.mediaId}` : `anilist-anime-${item.mediaId}`;
  return `<a class="anime-schedule-card" href="${path('details/?id=' + encodeURIComponent(detailsId))}" data-open-schedule-item="${escapeHtml(String(item.mediaId))}" data-open-title="${escapeHtml(item.title)}" data-open-poster="${escapeHtml(poster || '')}" data-open-media-id="${escapeHtml(String(item.mediaId))}" data-open-source="${isJikan ? 'jikan' : 'anilist'}">
    <span class="anime-schedule-cover">
      ${poster
        ? `<img ${imageAttrs(poster, { kind: 'poster', alt: item.title, loading: 'lazy', sizes: '(max-width: 760px) 84px, 104px', width: 104, height: 156 })}>`
        : `<div class="anime-schedule-cover-fallback">${escapeHtml(item.title.slice(0, 1).toUpperCase())}</div>`}
    </span>
    <div class="anime-schedule-copy">
      <div class="anime-schedule-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="anime-schedule-inline">
          <span class="anime-schedule-episode">EP ${escapeHtml(String(item.episode || '0'))}</span>
          <span class="anime-schedule-dot">•</span>
          <span>${escapeHtml(scheduleTimeLabel(item.airingAt))}</span>
        </div>
      </div>
      <div class="anime-schedule-time">${escapeHtml(scheduleCountdownLabel(item.airingAt))}</div>
    </div>
    <div class="anime-schedule-side">
      <span class="anime-schedule-badge ${statusClass}">${escapeHtml(status)}</span>
      <span class="anime-schedule-status-sub">${escapeHtml(isMySchedule ? `Watchlist match • ${dateInfo?.shortDate || ''}` : (dateInfo?.shortDate || ''))}</span>
    </div>
  </a>`;
}

function animeScheduleEmpty(title, text) {
  return `<div class="empty-state anime-schedule-empty"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div></div>`;
}

function buildAnimeWatchlistMatcher() {
  const watchlist = getWatchlistItems().filter(item => normalizeMediaTypeForKey(item) === 'anime');
  const ids = new Set();
  const titles = new Set();
  watchlist.forEach(item => {
    [item.anilistId, item.id].forEach(value => {
      const numeric = Number(String(value || '').replace(/\D+/g, ''));
      if (Number.isFinite(numeric) && numeric > 0) ids.add(numeric);
    });
    [item.title, item.titleEnglish, item.titleRomaji, item.titleNative].forEach(title => {
      const normalized = normalizeAnimeMatchTitle(title);
      if (normalized) titles.add(normalized);
    });
  });
  return { ids, titles };
}

async function loadAnimeScheduleRange(dateInfo) {
  const cache = readAnimeScheduleCache();
  const cacheKey = dateInfo.key;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.savedAt < ANIME_SCHEDULE_CACHE_TTL && Array.isArray(cached.items)) {
    return cached.items;
  }

  // 1. Try AniList Airing Schedule
  try {
    const response = await aniListFetch(ANIME_AIRING_SCHEDULE_QUERY, {
      page: 1,
      perPage: 100,
      airingAtGreater: dateInfo.startSec,
      airingAtLesser: dateInfo.endSec
    });
    const rawItems = response?.data?.Page?.airingSchedules || [];
    const items = rawItems.map(normalizeAiringScheduleEntry).filter(Boolean);
    if (items.length) {
      cache[cacheKey] = { savedAt: Date.now(), items };
      writeAnimeScheduleCache(cache);
      return items;
    }
  } catch (error) {
    console.warn('AniList schedule error:', error);
  }

  // 2. Try Jikan Airing Schedule Fallback
  try {
    const dayName = (dateInfo.label || '').toLowerCase();
    if (dayName) {
      const jikanData = await jikanFetch(`/schedules?filter=${encodeURIComponent(dayName)}`);
      if (Array.isArray(jikanData?.data) && jikanData.data.length) {
        const scheduleSec = dateInfo.date ? Math.floor(dateInfo.date.getTime() / 1000) + 3600 * 12 : dateInfo.startSec + 3600 * 12;
        const nowSec = Math.floor(Date.now() / 1000);
        const items = jikanData.data.slice(0, 30).map(anime => {
          if (!anime?.mal_id) return null;
          const title = anime.title_english || anime.title || 'Untitled Anime';
          const cover = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
          return {
            id: `jikan-schedule-${anime.mal_id}`,
            source: 'jikan',
            airingAt: scheduleSec,
            episode: anime.episodes || 1,
            timeUntilAiring: Math.max(0, scheduleSec - nowSec),
            mediaId: anime.mal_id,
            title,
            cover,
            status: anime.status || 'Currently Airing',
            media: {
              id: anime.mal_id,
              title: { romaji: anime.title, english: anime.title_english, native: anime.title_japanese },
              status: anime.status || ''
            }
          };
        }).filter(Boolean);

        if (items.length) {
          cache[cacheKey] = { savedAt: Date.now(), items };
          writeAnimeScheduleCache(cache);
          return items;
        }
      }
    }
  } catch (jikanErr) {
    console.warn('Jikan schedule fallback error:', jikanErr);
  }

  if (cached && Array.isArray(cached.items) && cached.items.length) {
    return cached.items;
  }
  return [];
}

function renderAnimeScheduleTabs(dates, activeKey, includeMySchedule) {
  const tabs = dates.map(dateInfo => `
    <button class="anime-schedule-tab ${dateInfo.key === activeKey ? 'active' : ''}" type="button" data-schedule-tab="${escapeHtml(dateInfo.key)}">
      <span>${escapeHtml(dateInfo.label)}</span>
      <strong>${escapeHtml(dateInfo.shortDate)}</strong>
    </button>
  `).join('');
  const mySchedule = includeMySchedule ? `
    <button class="anime-schedule-tab anime-schedule-tab-secondary ${activeKey === 'my-schedule' ? 'active' : ''}" type="button" data-schedule-tab="my-schedule">
      <span>My Schedule</span>
      <strong>Watchlist</strong>
    </button>
  ` : '';
  return tabs + mySchedule;
}

async function renderAnimeScheduleView(root, activeKey, { preloaded = null } = {}) {
  const section = root.querySelector('[data-anime-schedule]');
  if (!section) return;
  const tabsEl = section.querySelector('[data-schedule-tabs]');
  const gridEl = section.querySelector('[data-schedule-grid]');
  const weekDates = weekScheduleDates();
  const includeMySchedule = Boolean(getLocalUser());
  const activeDate = weekDates.find(dateInfo => dateInfo.key === activeKey) || weekDates.find(dateInfo => dateInfo.isToday) || weekDates[0];
  const isMySchedule = activeKey === 'my-schedule';
  const cache = readAnimeScheduleCache();
  const watchlistMatcher = buildAnimeWatchlistMatcher();

  ANIME_SCHEDULE_STATE.activeKey = activeKey;
  tabsEl.innerHTML = renderAnimeScheduleTabs(weekDates, activeKey, includeMySchedule);

  const scheduleLists = await Promise.all(weekDates.map(async dateInfo => {
    if (preloaded?.[dateInfo.key]) return preloaded[dateInfo.key];
    if (cache[dateInfo.key] && Date.now() - cache[dateInfo.key].savedAt < ANIME_SCHEDULE_CACHE_TTL) return cache[dateInfo.key].items;
    return loadAnimeScheduleRange(dateInfo).catch(error => {
      console.error('Anime schedule load failed:', error);
      return [];
    });
  }));

  const allItemsByDate = new Map(weekDates.map((dateInfo, index) => [dateInfo.key, scheduleSort(scheduleLists[index] || [])]));
  ANIME_SCHEDULE_STATE.loaded = allItemsByDate;

  const myScheduleItems = isMySchedule
    ? scheduleSort([].concat(...weekDates.map(dateInfo => (allItemsByDate.get(dateInfo.key) || []).map(item => ({ ...item, scheduleDateInfo: dateInfo })))).filter(item => {
        if (watchlistMatcher.ids.has(Number(item.mediaId))) return true;
        const normalizedTitles = [
          item.title,
          item.media?.title?.english,
          item.media?.title?.romaji,
          item.media?.title?.native
        ].map(normalizeAnimeMatchTitle);
        return normalizedTitles.some(title => title && watchlistMatcher.titles.has(title));
      }))
    : [];
  const renderItems = isMySchedule ? myScheduleItems : (allItemsByDate.get(activeDate.key) || []).map(item => ({ ...item, scheduleDateInfo: activeDate }));

  if (!renderItems.length) {
    gridEl.innerHTML = isMySchedule
      ? animeScheduleEmpty('No matching anime yet.', 'Add anime to your watchlist to build a personal airing schedule.')
      : animeScheduleEmpty('No airing titles found.', 'Nothing is scheduled for this day right now.');
  } else {
    gridEl.innerHTML = renderItems.map(item => animeScheduleCard(item, item.scheduleDateInfo || activeDate, isMySchedule)).join('');
  }
}

async function prefetchAnimeScheduleWeek() {
  const weekDates = weekScheduleDates();
  const cache = readAnimeScheduleCache();
  const missingDates = weekDates.filter(dateInfo => !cache[dateInfo.key] || Date.now() - cache[dateInfo.key].savedAt >= ANIME_SCHEDULE_CACHE_TTL);
  if (!missingDates.length) return;
  await Promise.all(missingDates.map(async dateInfo => {
    try {
      await loadAnimeScheduleRange(dateInfo);
    } catch (error) {
      console.error('Anime schedule prefetch failed:', error);
    }
  }));
}

const ANILIST_MEDIA_QUERY = `
  query PiraTYAnime($page: Int, $perPage: Int, $sort: [MediaSort], $format: MediaFormat, $status: MediaStatus, $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: $sort, format: $format, status: $status, season: $season, seasonYear: $seasonYear, isAdult: false) {
        id
        idMal
        title { romaji english native }
        format
        status
        episodes
        duration
        averageScore
        popularity
        trending
        seasonYear
        startDate { year month day }
        coverImage { extraLarge large color }
        bannerImage
        description(asHtml: false)
        genres
      }
    }
  }
`;

const ANILIST_DETAIL_QUERY = `
  query PiraTYAnimeDetail($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      format
      episodes
      duration
      genres
      studios(isMain: true) {
        nodes { name }
      }
      staff(perPage: 12) {
        edges {
          role
          node { name { full } }
        }
      }
      characters(sort: ROLE, perPage: 8) {
        edges {
          node {
            name { full }
            image { large medium }
          }
          voiceActors(language: JAPANESE, sort: RELEVANCE) {
            name { full }
            image { large medium }
          }
        }
      }
    }
  }
`;

function readJikanItemsCache(endpoint) {
  try {
    const cache = JSON.parse(localStorage.getItem(JIKAN_ITEMS_CACHE_KEY) || '{}');
    const entry = cache[endpoint];
    if (!entry || Date.now() - entry.savedAt > JIKAN_ITEMS_CACHE_TTL || !Array.isArray(entry.items)) {
      return null;
    }
    return rememberItems(entry.items);
  } catch (error) {
    return null;
  }
}

function writeJikanItemsCache(endpoint, items) {
  try {
    const cache = JSON.parse(localStorage.getItem(JIKAN_ITEMS_CACHE_KEY) || '{}');
    cache[endpoint] = { savedAt: Date.now(), items };
    localStorage.setItem(JIKAN_ITEMS_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {}
}

function jikanFetch(endpoint) {
  if (JIKAN_REQUEST_CACHE.has(endpoint)) return JIKAN_REQUEST_CACHE.get(endpoint);

  const request = (async () => {
    try {
      const proxyUrl = `${JIKAN_CONFIG.proxyUrl}?endpoint=${encodeURIComponent(endpoint)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`Jikan proxy error: ${response.status} ${response.statusText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn('Jikan fetch failed:', error);
      return null;
    } finally {
      JIKAN_REQUEST_CACHE.delete(endpoint);
    }
  })();

  JIKAN_REQUEST_CACHE.set(endpoint, request);
  return request;
}

function normalizeAnimeMatchTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getJikanSearchTitles(anime) {
  const titles = [
    anime?.title_english,
    anime?.title,
    anime?.titleEnglish,
    anime?.titleRomaji,
    anime?.titleNative,
    ...(Array.isArray(anime?.titles) ? anime.titles.map(entry => entry?.title) : [])
  ];
  return [...new Set(titles.map(title => String(title || '').trim()).filter(Boolean))];
}

function scoreJikanTMDBMatch(anime, result, mediaType) {
  const resultTitle = mediaType === 'movie' ? result.title : result.name;
  const normalizedResult = normalizeAnimeMatchTitle(resultTitle);
  const animeTitles = getJikanSearchTitles(anime).map(normalizeAnimeMatchTitle);
  const resultYear = String(mediaType === 'movie' ? result.release_date || '' : result.first_air_date || '').slice(0, 4);
  const animeYear = String(anime?.year || anime?.seasonYear || anime?.aired?.from || '').slice(0, 4);

  let score = 0;
  if (animeTitles.includes(normalizedResult)) score += 100;
  else if (animeTitles.some(title => title && (title.includes(normalizedResult) || normalizedResult.includes(title)))) score += 45;
  if (animeYear && resultYear === animeYear) score += 25;
  if (result.original_language === 'ja') score += 10;
  if (Array.isArray(result.genre_ids) && result.genre_ids.includes(16)) score += 15;
  return score;
}

function stripAniListDescription(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAniListAnime(anime) {
  if (!anime?.id) return null;
  const isMovie = anime.format === 'MOVIE';
  const year = anime.seasonYear || anime.startDate?.year || 'N/A';
  const rating = typeof anime.averageScore === 'number' ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const poster = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const title = anime.title?.english || anime.title?.romaji || anime.title?.native || 'Untitled';

  return rememberItem({
    id: `anilist-anime-${anime.id}`,
    anilistId: anime.id,
    malId: anime.idMal || null,
    title,
    titleEnglish: anime.title?.english || '',
    titleRomaji: anime.title?.romaji || '',
    titleNative: anime.title?.native || '',
    mediaType: isMovie ? 'movie' : 'tv',
    type: isMovie ? 'movie' : 'anime',
    category: isMovie ? 'Anime Movie' : 'Anime',
    format: anime.format,
    episodes: anime.episodes || null,
    duration: anime.duration || null,
    genre_ids: [16],
    original_language: 'ja',
    origin_country: ['JP'],
    year,
    rating,
    poster,
    backdrop: anime.bannerImage || poster,
    description: stripAniListDescription(anime.description) || 'No description available.'
  });
}

function buildAnimeScheduleItemFromElement(el) {
  if (!el) return null;
  const mediaId = Number(el.dataset.openMediaId || 0);
  if (!mediaId) return null;
  const isJikan = el.dataset.openSource === 'jikan';
  return rememberItem({
    id: isJikan ? `jikan-anime-${mediaId}` : `anilist-anime-${mediaId}`,
    ...(isJikan ? { malId: mediaId } : { anilistId: mediaId }),
    title: el.dataset.openTitle || 'Untitled Anime',
    poster: el.dataset.openPoster || '',
    backdrop: el.dataset.openPoster || '',
    type: 'anime',
    mediaType: 'tv',
    category: 'Anime'
  });
}

function initAnimeScheduleSection(root) {
  const section = root.querySelector('[data-anime-schedule]');
  if (!section) return;

  if (ANIME_SCHEDULE_STATE.timer) {
    clearInterval(ANIME_SCHEDULE_STATE.timer);
    ANIME_SCHEDULE_STATE.timer = null;
  }

  const defaultDate = weekScheduleDates().find(dateInfo => dateInfo.isToday) || weekScheduleDates()[0];
  const initialKey = defaultDate.key;
  const tabsEl = section.querySelector('[data-schedule-tabs]');
  const gridEl = section.querySelector('[data-schedule-grid]');

  const handleTab = async tabKey => {
    gridEl?.classList.add('is-loading');
    await renderAnimeScheduleView(root, tabKey);
    gridEl?.classList.remove('is-loading');
  };

  tabsEl?.addEventListener('click', event => {
    const btn = event.target.closest('[data-schedule-tab]');
    if (!btn) return;
    event.preventDefault();
    const key = btn.dataset.scheduleTab;
    if (!key || key === ANIME_SCHEDULE_STATE.activeKey) return;
    handleTab(key).catch(error => console.error('Anime schedule tab switch failed:', error));
  });

  section.addEventListener('click', event => {
    const card = event.target.closest('[data-open-schedule-item]');
    if (!card) return;
    event.preventDefault();
    const item = buildAnimeScheduleItemFromElement(card);
    if (item) openItem(item);
  });

  renderAnimeScheduleView(root, initialKey).catch(error => {
    console.error('Anime schedule initial render failed:', error);
    gridEl.innerHTML = animeScheduleEmpty('Could not load airing schedule.', 'Please try again in a moment.');
  });

  prefetchAnimeScheduleWeek().catch(error => console.error('Anime schedule prefetch failed:', error));
  ANIME_SCHEDULE_STATE.timer = setInterval(() => {
    section.querySelectorAll('.anime-schedule-time').forEach(node => {
      const card = node.closest('[data-open-schedule-item]');
      if (!card) return;
      const mediaId = Number(card.dataset.openMediaId || 0);
      let airingAt = null;
      for (const items of ANIME_SCHEDULE_STATE.loaded.values()) {
        const match = (items || []).find(entry => Number(entry.mediaId || 0) === mediaId);
        if (match) {
          airingAt = match.airingAt;
          break;
        }
      }
      if (airingAt) node.textContent = scheduleCountdownLabel(airingAt);
    });
  }, 60000);
}

async function resolveAniListTMDBMatch(anime) {
  const aniListId = anime?.anilistId || anime?.id;
  if (!aniListId) return null;
  const mediaType = String(anime.format || '').toUpperCase() === 'MOVIE' || anime.mediaType === 'movie' ? 'movie' : 'tv';
  const cacheKey = `anilist:${mediaType}:${aniListId}`;
  if (ANILIST_TMDB_MATCH_CACHE.has(cacheKey)) return ANILIST_TMDB_MATCH_CACHE.get(cacheKey);

  const promise = (async () => {
    const titles = getJikanSearchTitles(anime).slice(0, 3);
    let bestMatch = null;
    let bestScore = -1;

    for (const title of titles) {
      const data = await tmdbFetch(`/search/${mediaType}?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      for (const result of data?.results || []) {
        const score = scoreJikanTMDBMatch(anime, result, mediaType);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }
      if (bestScore >= 125) break;
    }

    return bestScore >= 45 ? { ...bestMatch, mediaType } : null;
  })();

  ANILIST_TMDB_MATCH_CACHE.set(cacheKey, promise);
  return promise;
}

async function resolveAniListPlayableItem(item) {
  if (!item?.anilistId || item.tmdbId) return item;
  const tmdbMatch = await resolveAniListTMDBMatch(item);
  if (!tmdbMatch?.id) return null;

  return rememberItem({
    ...item,
    tmdbId: tmdbMatch.id,
    mediaType: tmdbMatch.mediaType,
    backdrop: getTMDBImage(tmdbMatch.backdrop_path, 'w780') || item.backdrop
  });
}

window.resolveAniListPlayableItem = resolveAniListPlayableItem;

async function resolveAnimePlayableItem(item) {
  if (!item) return null;
  if (item.tmdbId) return item;
  if (item.anilistId) return await resolveAniListPlayableItem(item);
  if (item.malId) return await resolveJikanPlayableItem(item);
  return item;
}

window.resolveAnimePlayableItem = resolveAnimePlayableItem;

async function resolveJikanTMDBMatch(anime) {
  const malId = anime?.mal_id || anime?.malId;
  if (!malId) return null;
  const mediaType = String(anime.type || '').toLowerCase() === 'movie' ? 'movie' : 'tv';
  const cacheKey = `${mediaType}:${malId}`;
  if (JIKAN_TMDB_MATCH_CACHE.has(cacheKey)) return JIKAN_TMDB_MATCH_CACHE.get(cacheKey);

  const promise = (async () => {
    const titles = getJikanSearchTitles(anime).slice(0, 2);
    let bestMatch = null;
    let bestScore = -1;

    for (const title of titles) {
      const data = await tmdbFetch(`/search/${mediaType}?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      for (const result of data?.results || []) {
        const score = scoreJikanTMDBMatch(anime, result, mediaType);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = result;
        }
      }
      if (bestScore >= 125) break;
    }

    return bestScore >= 45 ? { ...bestMatch, mediaType } : null;
  })();

  JIKAN_TMDB_MATCH_CACHE.set(cacheKey, promise);
  return promise;
}

function normalizeJikanAnime(anime, tmdbMatch) {
  if (!anime || !tmdbMatch?.id) return null;
  const mediaType = tmdbMatch.mediaType;
  const isMovie = mediaType === 'movie';
  const airedYear = anime.year || String(anime.aired?.from || '').slice(0, 4) || 'N/A';
  const poster = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url;
  const backdrop = anime.trailer?.images?.maximum_image_url
    || getTMDBImage(tmdbMatch.backdrop_path, 'w780')
    || poster;

  return rememberItem({
    id: `jikan-anime-${anime.mal_id}`,
    tmdbId: tmdbMatch.id,
    malId: anime.mal_id,
    mediaType,
    title: anime.title_english || anime.title || 'Untitled',
    type: isMovie ? 'movie' : 'anime',
    category: isMovie ? 'Anime Movie' : 'Anime',
    genre_ids: [16],
    original_language: 'ja',
    origin_country: ['JP'],
    year: airedYear,
    rating: typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A',
    poster,
    backdrop,
    description: anime.synopsis || 'No description available.'
  });
}

function normalizeJikanAnimeMetadata(anime) {
  if (!anime?.mal_id) return null;
  const isMovie = String(anime.type || '').toLowerCase() === 'movie';
  const poster = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url;
  const backdrop = anime.trailer?.images?.maximum_image_url || poster;

  return rememberItem({
    id: `jikan-anime-${anime.mal_id}`,
    malId: anime.mal_id,
    mediaType: isMovie ? 'movie' : 'tv',
    title: anime.title_english || anime.title || 'Untitled',
    type: isMovie ? 'movie' : 'anime',
    category: isMovie ? 'Anime Movie' : 'Anime',
    genre_ids: [16],
    original_language: 'ja',
    origin_country: ['JP'],
    year: anime.year || String(anime.aired?.from || '').slice(0, 4) || 'N/A',
    rating: typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A',
    poster,
    backdrop,
    description: anime.synopsis || 'No description available.'
  });
}

async function resolveJikanPlayableItem(item) {
  if (!item?.malId || item.tmdbId) return item;
  const tmdbMatch = await resolveJikanTMDBMatch(item);
  if (!tmdbMatch?.id) return null;

  return rememberItem({
    ...item,
    tmdbId: tmdbMatch.id,
    mediaType: tmdbMatch.mediaType,
    backdrop: getTMDBImage(tmdbMatch.backdrop_path, 'w780') || item.backdrop
  });
}
window.resolveJikanPlayableItem = resolveJikanPlayableItem;

async function hydrateAnimeHeroBackdrops(scope = document) {
  const slides = Array.from(scope.querySelectorAll('[data-hero-slide]'))
    .filter(slide => {
      const id = String(slide.dataset.id || '');
      return id.startsWith('jikan-anime-') || id.startsWith('anilist-anime-');
    })
    .slice(0, 5);

  await Promise.all(slides.map(async slide => {
    const item = findItem(slide.dataset.id);
    if (!item || item.tmdbId) return;

    const resolved = await resolveAnimePlayableItem(item);
    if (!resolved?.tmdbId || !resolved.backdrop) return;

    slide.dataset.tmdbId = resolved.tmdbId;
    slide.dataset.mediaType = resolved.mediaType || 'tv';
    slide.dataset.backdrop = resolved.backdrop;

    const image = slide.querySelector('img');
    if (!image) return;

    image.src = tmdbImageVariant(resolved.backdrop, 'w1280') || resolved.backdrop;
    const srcset = tmdbSrcset(resolved.backdrop, [780, 1280]);
    if (srcset) image.srcset = srcset;
  }));
}

async function jikanAnimeItems(endpoint, limit = 14) {
  const cachedItems = readJikanItemsCache(endpoint);
  if (cachedItems?.length) return cachedItems.slice(0, limit);

  const data = await jikanFetch(endpoint);
  const anime = Array.isArray(data?.data) ? data.data : [];
  const uniqueAnime = anime.filter((item, index, list) =>
    item?.mal_id && list.findIndex(candidate => candidate?.mal_id === item.mal_id) === index
  );

  const items = uniqueAnime
    .slice(0, limit)
    .map(normalizeJikanAnimeMetadata)
    .filter(Boolean);
  if (items.length) writeJikanItemsCache(endpoint, items);
  return items;
}

async function aniListAnimeItems(cacheKey, variables, limit = 20) {
  const cachedItems = readAniListItemsCache(cacheKey);
  if (cachedItems?.length) return cachedItems.slice(0, limit);

  const data = await aniListFetch(ANILIST_MEDIA_QUERY, {
    page: 1,
    perPage: Math.max(limit, 20),
    ...variables
  });
  const anime = Array.isArray(data?.data?.Page?.media) ? data.data.Page.media : [];
  const uniqueAnime = anime.filter((item, index, list) =>
    item?.id && list.findIndex(candidate => candidate?.id === item.id) === index
  );

  const items = uniqueAnime
    .slice(0, limit)
    .map(normalizeAniListAnime)
    .filter(Boolean);
  if (items.length) writeAniListItemsCache(cacheKey, items);
  return items;
}

function skeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <article class="skeleton-card" aria-hidden="true">
      <div class="skeleton-frame"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </article>
  `).join('');
}

function skeletonRow(title = '') {
  return `<section class="section section-skeleton" aria-hidden="true">
    <div class="section-head">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      <div class="row-controls"><span class="round-btn skeleton-button"></span><span class="round-btn skeleton-button"></span></div>
    </div>
    <div class="media-row">${skeletonCards(10)}</div>
  </section>`;
}

function pageSkeleton(p = 'home') {
  if (p === 'details') {
    return `<section class="panel detail-layout page-skeleton" aria-hidden="true">
      <div class="detail-poster skeleton-frame"></div>
      <div class="detail-copy">
        <div class="skeleton-line skeleton-copy-kicker"></div>
        <div class="skeleton-line skeleton-copy-title"></div>
        <div class="skeleton-line skeleton-copy-title short"></div>
        <div class="skeleton-line skeleton-copy-text"></div>
        <div class="skeleton-line skeleton-copy-text"></div>
        <div class="hero-buttons"><span class="btn skeleton-button"></span><span class="btn skeleton-button"></span></div>
      </div>
      <aside class="detail-cast"><div class="cast-grid">${skeletonCards(4)}</div></aside>
    </section>`;
  }

  if (['legal', 'privacy', 'about', 'contact', 'terms', 'settings', 'watchlist', 'history', 'profile'].includes(p)) {
    return `<section class="panel page-skeleton" aria-hidden="true">
      <div class="skeleton-line skeleton-copy-kicker"></div>
      <div class="skeleton-line skeleton-copy-title"></div>
      <div class="skeleton-line skeleton-copy-text"></div>
      <div class="skeleton-line skeleton-copy-text"></div>
    </section>`;
  }

  const titles = {
    home: ['Trending Movies', 'Trending Shows', 'Trending Anime'],
    browse: ['Recommended', 'Movies', 'TV Shows', 'Anime'],
    movies: ['Trending Movies', 'Popular Movies', 'Top Rated Movies', 'Now Playing'],
    'tv-shows': ['Trending Shows', 'Popular Shows', 'Top Rated Shows', 'Airing Today'],
    anime: ['Trending Anime', 'Anime Movies', 'Top Rated Anime', 'Recent Anime']
  }[p] || ['Trending', 'Recently Added', 'Recommended'];

  return `<section class="hero hero-skeleton" aria-hidden="true">
    <div class="hero-content">
      <div class="skeleton-line skeleton-copy-title"></div>
      <div class="skeleton-line skeleton-copy-text"></div>
      <div class="hero-buttons"><span class="btn skeleton-button"></span><span class="btn skeleton-button"></span></div>
    </div>
  </section>${titles.map(skeletonRow).join('')}`;
}

async function loadPage(p) {
  const root = $('#page-root');
  if (!root) return;

  // Check if page is under development
  if (isUnderDevelopment(p)) {
    root.innerHTML = underDevOverlay();
    return;
  }

  const map = {
    home: () => homePage(),
    browse: () => browsePage(),
    movies: () => moviesPage(),
    'tv-shows': () => tvShowsPage(),
    anime: () => animePage(),
    manga: () => mediaPage('Manga', 'manga'),
    music: () => mediaPage('Music', 'music'),
    sports: () => mediaPage('Live Sports', 'sports'),
    watchlist: () => libraryPage('watchlist'),
    history: () => libraryPage('history'),
    legal: () => legalPage(),
    privacy: () => privacyPage(),
    about: () => aboutPage(),
    contact: () => contactPage(),
    terms: () => termsPage(),
    settings: () => settingsPage(),
    details: () => detailPage()
  };

  try {
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = pageSkeleton(p);
    root.innerHTML = await (map[p] || map.home)();
  } catch (error) {
    console.warn('Page load failed, using local fallback:', error);
    root.innerHTML = await homePage(false);
  } finally {
    root.removeAttribute('aria-busy');
  }

  initHero();
  initCards(root);
  initTop10Switchers(root);
  initSettings(root);
  initRowButtons();

  if (p === 'anime') {
    hydrateAnimeHeroBackdrops(root).catch(error => console.warn('Anime hero backdrop upgrade failed:', error));
    initAnimeScheduleSection(root);
  }

  if (p === 'details') {
    loadTMDBDetailEnrichment().catch(err => console.warn('TMDB enrichment error:', err));
    initCommunityFeatures(root).catch(err => console.warn('Community widgets failed:', err));
  }

  if (p === 'home') {
    hydrateHomePage(root);
  }

}

function homePage(useTMDB = true) {
  const continueItems = getContinueWatchingItems();
  const personal = personalizedHomeSections();
  const homeSlot = (key, content) => useTMDB && isTMDBConfigured()
    ? `<div class="home-slot" data-home-slot="${key}">${content}</div>`
    : content;

  return `
    ${homeSlot('hero', hero(mixed().slice(0,4)))}
    ${continueItems.length ? row('Continue Watching', continueItems, true, 'continueWatching') : ''}
    ${personal}
    ${homeSlot('movies', row('Trending Movies', byType('movie').slice(0,8)))}
    ${homeSlot('shows', row('Trending Shows', byType('show').slice(0,8)))}
    ${homeSlot('anime', row('Trending Anime', byType('anime').slice(0,8)))}
    ${collectionsSection()}
    ${homeSlot('recent', row('Recently Added', DATA.items.slice().reverse().slice(0,12)))}
    ${homeSlot('recommended', row('Recommended', DATA.items.slice(0,12)))}
  `;
}

function hydrateHomePage(root) {
  if (!isTMDBConfigured()) return;

  const sections = [
    ['hero', () => tmdbHero('/trending/all/week?language=en-US', null, mixed().slice(0,4))],
    ['movies', () => tmdbRow('Trending Movies', '/trending/movie/week?language=en-US', 'movie', byType('movie').slice(0,8), 12)],
    ['shows', () => tmdbRow('Trending Shows', '/trending/tv/week?language=en-US', 'tv', byType('show').slice(0,8), 12)],
    ['anime', () => tmdbAnimeRow('Trending Anime', '/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1', byType('anime').slice(0,8), 12)],
    ['recent', () => tmdbRow('Recently Added', '/movie/now_playing?language=en-US&page=1', 'movie', DATA.items.slice().reverse().slice(0,12), 12)],
    ['recommended', () => tmdbRow('Recommended', '/movie/popular?language=en-US&page=1', 'movie', DATA.items.slice(0,12), 12)]
  ];

  sections.forEach(([key, loadSection]) => {
    loadSection().then(html => {
      const slot = root.querySelector(`[data-home-slot="${key}"]`);
      if (!slot || !html || slot.innerHTML === html) return;

      slot.innerHTML = html;
      if (key === 'hero') initHero(slot);
      initCards(slot);
      initTop10Switchers(slot);
      initRowButtons();
    }).catch(error => console.warn(`Failed to hydrate home ${key} section:`, error));
  });
}

async function browsePage() {
  if (!isTMDBConfigured()) {
    return `
      ${hero(DATA.items.slice(6,10))}
      ${row('Recommended', DATA.items.slice(0,12))}
      ${row('Movies', byType('movie'))}
      ${row('TV Shows', byType('show'))}
      ${row('Anime', byType('anime'))}
      ${row('Manga', byType('manga'))}
      ${row('Music', byType('music'))}
      ${row('Live Sports', byType('sports'))}
      ${collectionsSection()}
    `;
  }

  const [heroHtml, recommended, movies, shows, anime] = await Promise.all([
    tmdbHero('/trending/all/week?language=en-US', null, DATA.items.slice(6,10)),
    tmdbRow('Recommended', '/movie/popular?language=en-US&page=1', 'movie', DATA.items.slice(0,12), 12),
    tmdbRow('Movies', '/trending/movie/week?language=en-US', 'movie', byType('movie'), 12),
    tmdbRow('TV Shows', '/trending/tv/week?language=en-US', 'tv', byType('show'), 12),
    tmdbAnimeRow('Anime', '/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1', byType('anime'), 12)
  ]);

  return `
    ${heroHtml}
    ${recommended}
    ${movies}
    ${shows}
    ${anime}
    ${row('Live Sports', byType('sports'))}
    ${collectionsSection()}
  `;
}

async function moviesPage() {
  if (!isTMDBConfigured()) return mediaPage('Movies', 'movie');
  const [heroHtml, topDay, topWeek, topMonth, topYear, trending, popular, topRated, nowPlaying, upcoming] = await Promise.all([
    tmdbHero('/movie/popular?language=en-US&page=1', 'movie', byType('movie').slice(0,4)),
    tmdbItems('/trending/movie/day?language=en-US', 'movie', 10),
    tmdbItems('/trending/movie/week?language=en-US', 'movie', 10),
    tmdbItems('/movie/popular?language=en-US&page=1', 'movie', 10),
    tmdbItems('/movie/top_rated?language=en-US&page=1', 'movie', 10),
    tmdbRow('Trending Movies', '/trending/movie/week?language=en-US', 'movie', byType('movie'), 14),
    tmdbRow('Popular Movies', '/movie/popular?language=en-US&page=1', 'movie', byType('movie'), 14),
    tmdbRow('Top Rated Movies', '/movie/top_rated?language=en-US&page=1', 'movie', byType('movie'), 14),
    tmdbRow('Now Playing', '/movie/now_playing?language=en-US&page=1', 'movie', byType('movie'), 14),
    tmdbRow('Upcoming', '/movie/upcoming?language=en-US&page=1', 'movie', byType('movie'), 14)
  ]);
  return `${heroHtml}${top10Section('Top 10 Movies', {
    day: topDay.length ? topDay : byType('movie').slice(0, 10),
    week: topWeek.length ? topWeek : byType('movie').slice(0, 10),
    month: topMonth.length ? topMonth : byType('movie').slice(0, 10),
    year: topYear.length ? topYear : byType('movie').slice(0, 10)
  })}${trending}${popular}${topRated}${nowPlaying}${upcoming}${collectionsSection()}`;
}

async function tvShowsPage() {
  if (!isTMDBConfigured()) return mediaPage('TV Shows', 'show');
  const [heroHtml, topDay, topWeek, topMonth, topYear, trending, popular, topRated, airing, onAir] = await Promise.all([
    tmdbHero('/tv/popular?language=en-US&page=1', 'tv', byType('show').slice(0,4)),
    tmdbItems('/trending/tv/day?language=en-US', 'tv', 10),
    tmdbItems('/trending/tv/week?language=en-US', 'tv', 10),
    tmdbItems('/tv/popular?language=en-US&page=1', 'tv', 10),
    tmdbItems('/tv/top_rated?language=en-US&page=1', 'tv', 10),
    tmdbRow('Trending Shows', '/trending/tv/week?language=en-US', 'tv', byType('show'), 14),
    tmdbRow('Popular Shows', '/tv/popular?language=en-US&page=1', 'tv', byType('show'), 14),
    tmdbRow('Top Rated Shows', '/tv/top_rated?language=en-US&page=1', 'tv', byType('show'), 14),
    tmdbRow('Airing Today', '/tv/airing_today?language=en-US&page=1', 'tv', byType('show'), 14),
    tmdbRow('On The Air', '/tv/on_the_air?language=en-US&page=1', 'tv', byType('show'), 14)
  ]);
  return `${heroHtml}${top10Section('Top 10 TV Shows', {
    day: topDay.length ? topDay : byType('show').slice(0, 10),
    week: topWeek.length ? topWeek : byType('show').slice(0, 10),
    month: topMonth.length ? topMonth : byType('show').slice(0, 10),
    year: topYear.length ? topYear : byType('show').slice(0, 10)
  })}${trending}${popular}${topRated}${airing}${onAir}`;
}

async function fetchAnimeRowItems(category, limit = 24) {
  // 1. Try AniList
  try {
    const currentYear = new Date().getFullYear();
    const queryMap = {
      trending: { cacheKey: 'trending', vars: { sort: ['TRENDING_DESC', 'POPULARITY_DESC'] }, limit: 24 },
      movies: { cacheKey: 'movies', vars: { sort: ['POPULARITY_DESC', 'SCORE_DESC'], format: 'MOVIE' }, limit: 20 },
      'top-rated': { cacheKey: 'top-rated', vars: { sort: ['SCORE_DESC', 'POPULARITY_DESC'] }, limit: 24 },
      recent: { cacheKey: 'recent', vars: { sort: ['POPULARITY_DESC', 'TRENDING_DESC'], status: 'RELEASING', seasonYear: currentYear }, limit: 24 }
    };
    const cfg = queryMap[category];
    if (cfg) {
      const items = await aniListAnimeItems(cfg.cacheKey, cfg.vars, cfg.limit || limit);
      if (items && items.length) return items;
    }
  } catch (err) {
    console.warn(`AniList ${category} fetch failed:`, err);
  }

  // 2. Try Jikan (MyAnimeList) Fallback
  try {
    const jikanEndpoints = {
      trending: '/top/anime?filter=bypopularity',
      movies: '/top/anime?type=movie',
      'top-rated': '/top/anime',
      recent: '/seasons/now'
    };
    const endpoint = jikanEndpoints[category];
    if (endpoint) {
      const jikanItems = await jikanAnimeItems(endpoint, limit);
      if (jikanItems && jikanItems.length) return jikanItems;
    }
  } catch (err) {
    console.warn(`Jikan ${category} fallback failed:`, err);
  }

  // 3. Try TMDB Anime Fallback
  try {
    if (isTMDBConfigured()) {
      const isMovie = category === 'movies';
      const tmdbEndpoints = {
        trending: '/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1',
        movies: '/discover/movie?language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1',
        'top-rated': '/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=200&page=1',
        recent: '/discover/tv?language=en-US&with_genres=16&with_original_language=ja&sort_by=first_air_date.desc&page=1'
      };
      const endpoint = tmdbEndpoints[category];
      if (endpoint) {
        const raw = await tmdbItems(endpoint, isMovie ? 'movie' : 'tv', limit);
        const tmdbAnime = raw.map(item => rememberItem({
          ...item,
          type: 'anime',
          mediaType: isMovie ? 'movie' : 'tv',
          category: 'Anime'
        })).filter(Boolean);
        if (tmdbAnime && tmdbAnime.length) return tmdbAnime;
      }
    }
  } catch (err) {
    console.warn(`TMDB ${category} fallback failed:`, err);
  }

  // 4. Default Static Fallback
  return byType('anime');
}

async function animePage() {
  const [trendingItems, movieItems, topRatedItems, recentItems] = await Promise.all([
    fetchAnimeRowItems('trending', 24),
    fetchAnimeRowItems('movies', 20),
    fetchAnimeRowItems('top-rated', 24),
    fetchAnimeRowItems('recent', 24)
  ]);

  const heroCandidates = trendingItems.filter(item => item.backdrop);
  const heroItems = heroCandidates.length ? heroCandidates.slice(0, 5) : trendingItems.slice(0, 5);
  const fallback = byType('anime');

  return `${hero(heroItems.length ? heroItems : fallback.slice(0, 4))}
    ${top10Section('Top 10 Anime', {
      day: trendingItems.length ? trendingItems.slice(0, 10) : fallback.slice(0, 10),
      week: recentItems.length ? recentItems.slice(0, 10) : trendingItems.slice(0, 10),
      month: topRatedItems.length ? topRatedItems.slice(0, 10) : fallback.slice(0, 10),
      year: topRatedItems.length ? topRatedItems.slice(0, 10) : fallback.slice(0, 10)
    })}
    ${animeScheduleShell()}
    ${row('Trending Anime', trendingItems.length ? trendingItems : fallback)}
    ${row('Anime Movies', movieItems.length ? movieItems : fallback)}
    ${row('Top Rated Anime', topRatedItems.length ? topRatedItems : fallback)}
    ${row('Recent Anime', recentItems.length ? recentItems : fallback)}`;
}
function mediaPage(title, type) {
  const list = byType(type);
  return `
    ${hero(list.slice(0,4))}
    ${row(`Trending ${title}`, list)}
    ${row('Recently Added', list.slice().reverse())}
    ${row('Recommended', shuffle(DATA.items).slice(0,10))}
    ${type === 'movie' ? collectionsSection() : ''}
  `;
}

function libraryPage(kind) {
  const title = kind === 'watchlist' ? 'Watchlist' : 'History';
  const subtitle = kind === 'watchlist' ? 'Saved titles from localStorage.' : 'Recently viewed titles.';
  const items = kind === 'watchlist' ? getWatchlistItems() : getHistoryItems();
  return `<section class="panel">
    <h1 class="section-title" style="font-size:clamp(42px,6vw,76px)">${title}</h1>
    <p style="color:var(--muted);margin-bottom:24px">${subtitle}</p>
    ${items.length ? `<div class="grid-list">${items.map(item => card(item, true, kind)).join('')}</div>` : `<div class="empty-state"><div><h2>No ${title.toLowerCase()} yet</h2><p>Play or add something from the homepage.</p></div></div>`}
  </section>
  `;
}

function personalizedHomeSections() {
  localStorage.removeItem('piraty-personal-home-v2');
  return '';
}

function profileStatsPage() {
  const params = new URLSearchParams(location.search);
  const publicUid = params.get('uid');
  if (publicUid && publicUid !== getLocalUser()?.uid) {
    return `<section class="panel profile-stats-panel">
      <div id="publicProfileSlot" class="profile-public-slot"><div class="empty-state"><p>Loading profile...</p></div></div>
    </section>`;
  }

  if (!authReady) {
    return `<section class="panel profile-stats-panel">
      <div class="empty-state"><div><h2>Loading profile...</h2><p>Checking your login state.</p></div></div>
    </section>`;
  }

  if (!getLocalUser()) {
    setTimeout(() => requireLogin('view profile stats'), 0);
    return `<section class="panel"><div class="empty-state"><div><h2>Login required</h2><p>Login to view your profile stats.</p><button class="btn primary" data-profile-login>Login</button></div></div></section>`;
  }

  return `<section class="panel profile-stats-panel">
    <h1 class="section-title" style="font-size:clamp(42px,6vw,76px)">Your Stats</h1>
    <p style="color:var(--muted);margin-bottom:24px">Synced from your PiraTY activity.</p>
    <div class="account-profile-card" id="accountProfileCard">
      <div class="account-profile-head">
        <div class="account-profile-avatar" id="accountProfileAvatar">P</div>
        <div>
          <h2 id="accountProfileName">Profile</h2>
          <p id="accountProfileMeta" class="muted-line">Loading account...</p>
        </div>
      </div>
      <form class="account-profile-form" id="accountProfileForm">
        <label>Username<input id="accountUsername" maxlength="24" autocomplete="username"></label>
        <label>Email<input id="accountEmail" type="email" readonly></label>
        <label class="account-form-wide">Bio<textarea id="accountBio" maxlength="300" placeholder="Tell people what you watch."></textarea></label>
        <label class="account-toggle"><input id="accountStatsPublic" type="checkbox"> Show stats publicly</label>
        <label class="account-toggle"><input id="accountRatingsPublic" type="checkbox"> Show ratings and reviews publicly</label>
        <button class="btn primary account-form-wide" id="accountProfileSave" type="submit">Save Profile</button>
        <p class="auth-message account-form-wide" id="accountProfileMessage"></p>
      </form>
    </div>
    <div id="profileStatsGrid" class="stats-grid">
      ${['Movies Watched', 'Shows Watched', 'Episodes Watched', 'Comments Made', 'Ratings Given', 'Watch Time Estimate'].map(label => `<div class="stat-card"><span>${label}</span><strong>...</strong></div>`).join('')}
    </div>
  </section>`;
}

async function initProfileStatsPage(scope = document) {
  scope.querySelector('[data-profile-login]')?.addEventListener('click', () => requireLogin('view profile stats'));
  const params = new URLSearchParams(location.search);
  const publicUid = params.get('uid');
  if (publicUid && publicUid !== getLocalUser()?.uid) {
    const slot = document.getElementById('publicProfileSlot');
    if (!slot) return;
    const [profile, stats, followers, following, recentActivity] = await Promise.all([
      loadPublicProfile(publicUid),
      (async () => {
        const fs = getLocalDataStore();
        if (!fs) return {};
        try {
          const snap = await fs.getDoc(fs.doc(fs.db, 'users', publicUid, 'stats', 'main'));
          return snap.exists() ? snap.data() : {};
        } catch { return {}; }
      })(),
      countSubcollection(['users', publicUid, 'followers']),
      countSubcollection(['users', publicUid, 'following']),
      loadUserActivity(publicUid, ['reviewed', 'rated'], 12)
    ]);
    const recentReviews = recentActivity.filter(item => item.type === 'reviewed');
    const recentRatings = recentActivity.filter(item => item.type === 'rated');
    slot.innerHTML = `<div class="public-profile-card">
      <h1>${escapeHtml(profile?.username || profile?.displayName || 'PiraTY User')}</h1>
      <p class="muted-line">${escapeHtml(profile?.bio || 'No bio yet.')}</p>
      <p class="public-list-meta">${followers} followers • ${following} following</p>
      <button class="btn primary" type="button" data-follow-user="${escapeHtml(publicUid)}" data-follow-name="${escapeHtml(profile?.username || profile?.displayName || 'PiraTY User')}">Follow</button>
      ${profile?.statsPublic !== false ? `<div class="stats-grid" style="margin-top:16px">
        <div class="stat-card"><span>Movies</span><strong>${stats.moviesWatched || 0}</strong></div>
        <div class="stat-card"><span>Episodes</span><strong>${stats.episodesWatched || 0}</strong></div>
        <div class="stat-card"><span>Ratings</span><strong>${stats.ratingsGiven || 0}</strong></div>
      </div>` : ''}
      ${profile?.ratingsPublic !== false ? `<h2 class="community-title" style="margin-top:22px">Recent Ratings</h2><div class="comments-list">${recentRatings.length ? recentRatings.map(item => `<article class="comment-card"><div class="comment-avatar">${escapeHtml(String(item.username || 'P').slice(0,1).toUpperCase())}</div><div class="comment-body"><div class="comment-meta"><strong>${escapeHtml(item.username || 'PiraTY User')}</strong><span>${escapeHtml(item.rating || '')} / 10</span></div><p>${escapeHtml(item.mediaTitle || '')}</p></div></article>`).join('') : '<p class="muted-line">No public ratings yet.</p>'}</div>` : ''}
      ${profile?.ratingsPublic !== false ? `<h2 class="community-title" style="margin-top:22px">Recent Reviews</h2><div class="comments-list">${recentReviews.length ? recentReviews.map(item => `<article class="comment-card"><div class="comment-avatar">${escapeHtml(String(item.username || 'P').slice(0,1).toUpperCase())}</div><div class="comment-body"><div class="comment-meta"><strong>${escapeHtml(item.username || 'PiraTY User')}</strong><span>${escapeHtml(item.mediaTitle || '')}</span></div><p>${escapeHtml(item.textPreview || '')}</p></div></article>`).join('') : '<p class="muted-line">No public reviews yet.</p>'}</div>` : ''}
    </div>`;
    slot.querySelector('[data-follow-user]')?.addEventListener('click', async (event) => {
      await followUser(event.currentTarget.dataset.followUser, event.currentTarget.dataset.followName);
    });
    return;
  }

  const grid = document.getElementById('profileStatsGrid');
  if (!grid || !getLocalUser()) return;
  const stats = await loadUserStats() || {};
  const values = [
    ['Movies Watched', stats.moviesWatched || 0],
    ['Shows Watched', stats.showsWatched || 0],
    ['Episodes Watched', stats.episodesWatched || 0],
    ['Comments Made', stats.commentsMade || 0],
    ['Ratings Given', stats.ratingsGiven || 0],
    ['Watch Time Estimate', `${stats.watchTimeEstimate || 0} min`]
  ];
  grid.innerHTML = values.map(([label, value]) => `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');

  const user = getLocalUser();
  const fs = getLocalDataStore();
  const profile = await ensureUserProfile(user, { isGoogle: Boolean(user?.providerData?.some(provider => provider.providerId === 'google.com')) });
  const avatarEl = document.getElementById('accountProfileAvatar');
  const nameEl = document.getElementById('accountProfileName');
  const metaEl = document.getElementById('accountProfileMeta');
  const usernameInput = document.getElementById('accountUsername');
  const emailInput = document.getElementById('accountEmail');
  const bioInput = document.getElementById('accountBio');
  const statsPublicInput = document.getElementById('accountStatsPublic');
  const ratingsPublicInput = document.getElementById('accountRatingsPublic');
  const form = document.getElementById('accountProfileForm');
  const saveBtn = document.getElementById('accountProfileSave');
  const messageEl = document.getElementById('accountProfileMessage');

  const joined = profile?.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Recently';
  const profileName = profile?.username || currentUsername(user);
  if (avatarEl) {
    avatarEl.innerHTML = profile?.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="" width="54" height="54" decoding="async">` : escapeHtml(profileName.slice(0, 1).toUpperCase());
  }
  if (nameEl) nameEl.textContent = profileName;
  if (metaEl) metaEl.textContent = `Joined ${joined}`;
  if (usernameInput) usernameInput.value = profile?.username || '';
  if (emailInput) emailInput.value = user?.email || profile?.email || '';
  if (bioInput) bioInput.value = profile?.bio || '';
  if (statsPublicInput) statsPublicInput.checked = profile?.statsPublic !== false;
  if (ratingsPublicInput) ratingsPublicInput.checked = profile?.ratingsPublic !== false;

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!fs || !user || !saveBtn) return;
    const nextUsername = usernameInput.value.trim();
    const nextBio = textLimit(bioInput.value.trim(), 300);
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    if (!isValidUsername(nextUsername)) {
      messageEl.textContent = 'Username must be 3-24 letters, numbers, or underscores.';
      messageEl.dataset.tone = 'error';
      messageEl.style.display = 'block';
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      if (usernameLower(nextUsername) !== usernameLower(profile?.username)) {
        if (await usernameExists(nextUsername, user.uid)) {
          messageEl.textContent = 'Username already taken.';
          messageEl.dataset.tone = 'error';
          messageEl.style.display = 'block';
          return;
        }
        const reserved = await reserveUsername(nextUsername, user.uid);
        if (!reserved) throw new Error('username-taken');
      }
      await fs.setDoc(fs.doc(fs.db, 'users', user.uid, 'profile', 'main'), {
        uid: user.uid,
        username: nextUsername,
        usernameLower: usernameLower(nextUsername),
        displayName: nextUsername,
        email: user.email || '',
        photoURL: profile?.photoURL || user.photoURL || '',
        bio: nextBio,
        statsPublic: Boolean(statsPublicInput.checked),
        ratingsPublic: Boolean(ratingsPublicInput.checked),
        updatedAt: fs.serverTimestamp(),
        createdAt: profile?.createdAt || fs.serverTimestamp()
      }, { merge: true });
      setCurrentUserState(user, {
        uid: user.uid,
        username: nextUsername,
        usernameLower: usernameLower(nextUsername),
        displayName: nextUsername,
        email: user.email || '',
        photoURL: profile?.photoURL || user.photoURL || '',
        bio: nextBio,
        statsPublic: Boolean(statsPublicInput.checked),
        ratingsPublic: Boolean(ratingsPublicInput.checked),
        createdAt: profile?.createdAt || null,
        updatedAt: null
      });
      messageEl.textContent = 'Profile saved.';
      messageEl.dataset.tone = 'success';
      messageEl.style.display = 'block';
      if (nameEl) nameEl.textContent = nextUsername;
      if (avatarEl && !profile?.photoURL) avatarEl.textContent = nextUsername.slice(0, 1).toUpperCase();
      document.getElementById('accountDropdown')?.classList.remove('open');
      window.updateLoginButton?.();
      toast('Profile saved');
    } catch (error) {
      console.error('Account profile save failed:', error);
      messageEl.textContent = error.message === 'username-taken' ? 'Username already taken.' : friendlyAuthError(error);
      messageEl.dataset.tone = 'error';
      messageEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile';
    }
  });
}

function collectionsPage() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  if (slug) {
    return `<section class="panel collections-panel">
      <div id="collectionDetailSlot"><div class="empty-state"><p>Loading collection...</p></div></div>
    </section>`;
  }
  return `<section class="panel collections-panel">
    <h1 class="section-title" style="font-size:clamp(42px,6vw,76px)">Collections</h1>
    <p style="color:var(--muted);margin-bottom:24px">Curated packs for faster browsing.</p>
    <div id="collectionsGrid" class="public-lists-grid"><div class="empty-state"><p>Loading collections...</p></div></div>
  </section>`;
}

async function initCollectionsPage() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const collections = await loadCollections();
  if (slug) {
    const slot = document.getElementById('collectionDetailSlot');
    if (!slot) return;
    const collection = collections.find(item => item.slug === slug || item.id === slug);
    if (!collection) {
      slot.innerHTML = `<div class="empty-state"><p>Collection not found.</p></div>`;
      return;
    }
    const orderedEntries = (collection.items || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const items = (await Promise.all(orderedEntries.map(resolveCollectionEntry))).filter(Boolean);
    slot.innerHTML = `<h1 class="section-title" style="font-size:clamp(42px,6vw,76px)">${escapeHtml(collection.title)}</h1>
      <p style="color:var(--muted);margin-bottom:24px">${escapeHtml(textLimit(collection.description, 500))}</p>
      ${items.length ? `<div class="grid-list">${items.map(item => card(item)).join('')}</div>` : `<div class="empty-state"><p>No titles in this collection yet.</p></div>`}`;
    initCards(slot);
    return;
  }
  const grid = document.getElementById('collectionsGrid');
  if (!grid) return;
  grid.innerHTML = collections.map(collection => `<a class="public-list-card collection-tile" href="${path('collections/?slug=' + encodeURIComponent(collection.slug || collection.id))}">
    ${collection.coverImage ? `<img class="collection-cover" ${imageAttrs(collection.coverImage, { kind: 'backdrop', alt: collection.title, loading: 'lazy', sizes: '(max-width:760px) 90vw, 360px', width: 500, height: 281 })}>` : ''}
    <h2>${escapeHtml(collection.title)}</h2>
    <p class="public-list-desc">${escapeHtml(textLimit(collection.description, 500))}</p>
    <p class="public-list-meta">${Array.isArray(collection.items) ? collection.items.length : 0} titles</p>
  </a>`).join('');
}

function detailPage() {
  let item = null;
  const stored = localStorage.getItem(SELECTED_KEY);
  if (stored) {
    try { item = rememberItem(JSON.parse(stored)); } catch (e) {}
  }

  if (!item) {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    item = id ? findItem(id) : DATA.items[0];
  }

  if (!item) {
    return `<section class="panel"><div class="empty-state"><div><h2>No media selected</h2><p>Select a title first.</p><a href="${path('index.html')}" class="btn" style="margin-top:16px;display:inline-block">Back to Home</a></div></div></section>`;
  }

  item = saveSelectedItem(item);
  addHistory(item, false);

  const typeText = item.category || item.type || 'Media';
  const description = item.description || 'No description available.';

  return `<section class="panel detail-layout">
    <div class="detail-poster"><img ${imageAttrs(item.poster, { kind: 'detailPoster', alt: item.title, loading: 'lazy', sizes: '(max-width: 760px) 70vw, 320px', width: 342, height: 513 })}></div>
    <div class="detail-copy">
      <h1>${escapeHtml(item.title)}</h1>
      <div class="detail-meta"><span>${escapeHtml(item.mediaType || item.type || 'media')}</span></div>
      <p id="detailDescription">${escapeHtml(description)}</p>
      <div class="hero-buttons">
        <button class="btn primary" data-play="${item.id}">${icons.play} Play</button>
        <button class="btn btn-direct-player" data-direct-play="${item.id}">${icons.directPlay || icons.play} Direct Player</button>
        <button class="btn" data-media-download>${icons.download} Download</button>
        <button class="btn" data-add-watchlist="${item.id}">${icons.plus} Add</button>
      </div>
    </div>
    <aside class="detail-cast" id="detail-cast">
      <div class="cast-panel">
        <div class="cast-panel-header">
          <div>
            <span class="cast-title">Top Cast</span>
            <p class="cast-subtitle">Featured performers</p>
          </div>
        </div>
        <div class="cast-grid">
          <div class="cast-empty">Cast information will appear here once the detail page loads.</div>
        </div>
      </div>
    </aside>
  </section>
  <section class="panel community-panel" data-community-media="${escapeHtml(mediaKeyForItem(item, item.season || 1, item.episode || 1) || '')}">
    <div class="comments-block">
      <div class="comments-head">
        <h2 class="community-title">Comments <span id="commentsCount" class="section-count"></span></h2>
        <div class="comment-sort" role="group" aria-label="Comment sort">
          <button class="comment-sort-btn active" type="button" data-comment-sort="newest">Newest</button>
          <button class="comment-sort-btn" type="button" data-comment-sort="top">Top</button>
        </div>
      </div>
      <div class="review-box comment-box compact-comment-form">
        <textarea id="commentInput" maxlength="500" placeholder="Share your thoughts..."></textarea>
        <div class="comment-form-row">
          <label class="spoiler-check"><input id="commentSpoilerInput" type="checkbox"> Contains spoilers</label>
          <button class="btn primary compact-btn" type="button" data-submit-comment disabled>Post</button>
        </div>
      </div>
      <div id="commentsList" class="comments-list"><p class="muted-line">Loading comments...</p></div>
    </div>
  </section>
  <div id="tmdb-enrichment" class="detail-enrichment-slot" aria-busy="true">${skeletonRow('Similar Content')}</div>`;
}

function formatCommunityTime(value) {
  let date = null;
  if (value?.toDate) date = value.toDate();
  else if (value?.seconds) date = new Date(value.seconds * 1000);
  else if (value) date = new Date(value);
  if (!date || Number.isNaN(date.getTime())) return 'just now';

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];
  for (const [unit, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

function starRatingMarkup(rating) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating || 0) / 2)));
  return Array.from({ length: 5 }, (_, index) =>
    `<span class="${index < filled ? 'filled' : ''}">&#9733;</span>`
  ).join('');
}

function emptyCommunityState(title, body) {
  return `<div class="community-empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

function communityMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function isEdited(createdAt, updatedAt) {
  const created = communityMillis(createdAt);
  const updated = communityMillis(updatedAt);
  return Boolean(created && updated && Math.abs(updated - created) > 1000);
}

function selectorEscape(value) {
  if (window.CSS?.escape) return CSS.escape(String(value || ''));
  return String(value || '').replace(/["\\]/g, '\\$&');
}

function renderComments(comments = [], mediaKey = '') {
  const user = getLocalUser();
  if (!comments.length) return emptyCommunityState('No comments yet.', 'Start the conversation.');
  const spoilerText = text => `<button class="spoiler-reveal" type="button" data-spoiler-text="${escapeHtml(text)}">Spoiler hidden. Click to reveal.</button>`;
  const displayUsername = ownerUid => {
    if (user && ownerUid && ownerUid === user.uid && currentUserProfile?.username) return currentUserProfile.username;
    return '';
  };
  const displayAvatar = ownerUid => {
    if (user && ownerUid && ownerUid === user.uid && (currentUserProfile?.photoURL || currentAvatar(user))) {
      return currentUserProfile?.photoURL || currentAvatar(user) || '';
    }
    return '';
  };
  const renderReply = (comment, reply) => {
    const canEditReply = Boolean(user && user.uid === reply.uid);
    const username = displayUsername(reply.uid) || reply.username || 'PiraTY User';
    const avatar = displayAvatar(reply.uid) || reply.avatar || '';
    return `<article class="comment-card reply-card" data-reply-id="${escapeHtml(reply.id)}" data-reply-owner="${escapeHtml(reply.uid || '')}" data-parent-comment="${escapeHtml(comment.id)}">
      <div class="comment-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="42" height="42" loading="lazy" decoding="async">` : escapeHtml(String(username || 'P').slice(0, 1).toUpperCase())}</div>
      <div class="comment-body">
        <div class="comment-meta">
          <strong>${escapeHtml(username)}</strong>
          <span>${formatCommunityTime(reply.createdAt || reply.updatedAt)}</span>
          ${isEdited(reply.createdAt, reply.updatedAt) ? `<span class="edited-label">edited</span>` : ''}
        </div>
        <p>${reply.containsSpoiler ? spoilerText(reply.text || '') : escapeHtml(reply.text || '')}</p>
        <div class="comment-card-actions">
          <button class="comment-action" type="button" data-like-reply="${escapeHtml(reply.id)}" data-parent-comment="${escapeHtml(comment.id)}">&#9825; Like${Number(reply.likesCount || 0) ? ` ${Number(reply.likesCount || 0)}` : ''}</button>
          ${canEditReply ? `<button class="comment-action" type="button" data-edit-reply="${escapeHtml(reply.id)}" data-parent-comment="${escapeHtml(comment.id)}">Edit</button>` : ''}
          ${canEditReply ? `<button class="comment-delete" type="button" data-delete-reply="${escapeHtml(reply.id)}" data-parent-comment="${escapeHtml(comment.id)}" data-reply-owner="${escapeHtml(reply.uid)}">Delete</button>` : ''}
        </div>
        ${canEditReply ? `<div class="inline-edit-form" data-edit-reply-form="${escapeHtml(reply.id)}" data-parent-comment="${escapeHtml(comment.id)}" hidden>
          <textarea maxlength="500">${escapeHtml(reply.text || '')}</textarea>
          <label class="spoiler-check"><input type="checkbox" ${reply.containsSpoiler ? 'checked' : ''}> Contains spoilers</label>
          <div class="inline-form-actions"><button class="btn primary compact-btn" type="button" data-save-reply-edit="${escapeHtml(reply.id)}" data-parent-comment="${escapeHtml(comment.id)}">Save</button><button class="text-link-btn" type="button" data-cancel-inline-form>Cancel</button></div>
        </div>` : ''}
      </div>
    </article>`;
  };

  return comments.map(comment => {
    const canEditComment = Boolean(user && user.uid === comment.uid);
    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    const username = displayUsername(comment.uid) || comment.username || 'PiraTY User';
    const avatar = displayAvatar(comment.uid) || comment.avatar || '';
    return `<article class="comment-card" data-comment-id="${escapeHtml(comment.id)}" data-comment-owner="${escapeHtml(comment.uid || '')}">
    <div class="comment-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="42" height="42" loading="lazy" decoding="async">` : escapeHtml(String(username || 'P').slice(0, 1).toUpperCase())}</div>
    <div class="comment-body">
      <div class="comment-meta">
        <strong>${escapeHtml(username)}</strong>
        <span>${formatCommunityTime(comment.createdAt || comment.updatedAt)}</span>
        ${isEdited(comment.createdAt, comment.updatedAt) ? `<span class="edited-label">edited</span>` : ''}
      </div>
      <p>${comment.containsSpoiler ? spoilerText(comment.text || '') : escapeHtml(comment.text || '')}</p>
      <div class="comment-card-actions">
        <button class="comment-action" type="button" data-like-comment="${escapeHtml(comment.id)}">&#9825; Like${Number(comment.likesCount || 0) ? ` ${Number(comment.likesCount || 0)}` : ''}</button>
        <button class="comment-action" type="button" data-reply-comment="${escapeHtml(comment.id)}">Reply</button>
        ${canEditComment ? `<button class="comment-action" type="button" data-edit-comment="${escapeHtml(comment.id)}">Edit</button>` : ''}
        ${canEditComment ? `<button class="comment-delete" type="button" data-delete-comment="${escapeHtml(comment.id)}" data-comment-owner="${escapeHtml(comment.uid)}">Delete</button>` : ''}
      </div>
      <div class="inline-reply-form" data-reply-form="${escapeHtml(comment.id)}" hidden>
        <textarea maxlength="500" placeholder="Write a reply..."></textarea>
        <label class="spoiler-check"><input type="checkbox"> Contains spoilers</label>
        <div class="inline-form-actions"><button class="btn primary compact-btn" type="button" data-submit-reply="${escapeHtml(comment.id)}" disabled>Reply</button><button class="text-link-btn" type="button" data-cancel-inline-form>Cancel</button></div>
      </div>
      ${canEditComment ? `<div class="inline-edit-form" data-edit-comment-form="${escapeHtml(comment.id)}" hidden>
        <textarea maxlength="500">${escapeHtml(comment.text || '')}</textarea>
        <label class="spoiler-check"><input type="checkbox" ${comment.containsSpoiler ? 'checked' : ''}> Contains spoilers</label>
        <div class="inline-form-actions"><button class="btn primary compact-btn" type="button" data-save-comment-edit="${escapeHtml(comment.id)}">Save</button><button class="text-link-btn" type="button" data-cancel-inline-form>Cancel</button></div>
      </div>` : ''}
      ${replies.length ? `<div class="reply-list">${replies.map(reply => renderReply(comment, reply)).join('')}</div>` : ''}
    </div>
  </article>`;
  }).join('');
}

function renderReviews(reviews = [], mediaKey = '') {
  const user = getLocalUser();
  if (!reviews.length) return emptyCommunityState('No reviews yet.', 'Share the first review.');
  const spoilerText = text => `<button class="spoiler-reveal" type="button" data-spoiler-text="${escapeHtml(text)}">Spoiler hidden. Click to reveal.</button>`;
  return reviews.map(review => `<article class="review-card">
    <div class="comment-body">
      <div class="review-stars" aria-label="${escapeHtml(review.rating || 'N/A')} out of 10">${starRatingMarkup(review.rating)}</div>
      <p>${review.containsSpoiler ? spoilerText(review.reviewText || '') : escapeHtml(review.reviewText || '')}</p>
      <div class="comment-meta">
        <strong>${escapeHtml(review.username || 'PiraTY User')}</strong>
        <span>${formatCommunityTime(review.updatedAt || review.createdAt)}</span>
      </div>
      ${user?.uid === review.uid ? `<button class="comment-delete" type="button" data-delete-review="${escapeHtml(review.uid)}">Delete</button>` : ''}
    </div>
  </article>`).join('');
}

function bindSpoilerReveal(scope = document) {
  scope.querySelectorAll('[data-spoiler-text]').forEach(button => {
    button.addEventListener('click', () => {
      const p = document.createElement('p');
      p.textContent = button.dataset.spoilerText || '';
      button.replaceWith(p);
    });
  });
}

async function refreshDetailComments(mediaKey) {
  const commentsList = document.getElementById('commentsList');
  if (!commentsList) return;
  const sortMode = COMMUNITY_STATE.commentSort || 'newest';
  const comments = sortComments(await loadComments(mediaKey), sortMode);
  COMMUNITY_STATE.comments = comments;
  const count = document.getElementById('commentsCount');
  if (count) count.textContent = `(${comments.length})`;
  commentsList.innerHTML = renderComments(comments, mediaKey);
  bindSpoilerReveal(commentsList);
  bindCommentActions(commentsList, mediaKey);
}

function sortComments(comments = [], mode = 'newest') {
  const sorted = [...comments];
  if (mode === 'top') {
    return sorted.sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0) || communityMillis(b.createdAt) - communityMillis(a.createdAt));
  }
  return sorted.sort((a, b) => communityMillis(b.createdAt) - communityMillis(a.createdAt));
}

function bindCommentActions(commentsList, mediaKey) {
  commentsList.querySelectorAll('[data-delete-comment]').forEach(button => {
    button.addEventListener('click', async () => {
      if (await deleteComment(mediaKey, button.dataset.deleteComment, button.dataset.commentOwner)) {
        toast('Comment deleted');
        refreshDetailComments(mediaKey);
      }
    });
  });

  commentsList.querySelectorAll('[data-delete-reply]').forEach(button => {
    button.addEventListener('click', async () => {
      if (await deleteReply(mediaKey, button.dataset.parentComment, button.dataset.deleteReply, button.dataset.replyOwner)) {
        toast('Reply deleted');
        refreshDetailComments(mediaKey);
      }
    });
  });

  commentsList.querySelectorAll('[data-like-comment]').forEach(button => {
    button.addEventListener('click', async () => {
      const key = communityLikeKey('comment', mediaKey, button.dataset.likeComment);
      if (COMMUNITY_STATE.pendingLikes.has(key)) return;
      COMMUNITY_STATE.pendingLikes.add(key);
      button.disabled = true;
      try {
        if (await likeComment(mediaKey, button.dataset.likeComment)) {
          refreshDetailComments(mediaKey);
        }
      } finally {
        COMMUNITY_STATE.pendingLikes.delete(key);
      }
    });
  });

  commentsList.querySelectorAll('[data-like-reply]').forEach(button => {
    button.addEventListener('click', async () => {
      const key = communityLikeKey('reply', mediaKey, button.dataset.parentComment, button.dataset.likeReply);
      if (COMMUNITY_STATE.pendingLikes.has(key)) return;
      COMMUNITY_STATE.pendingLikes.add(key);
      button.disabled = true;
      try {
        if (await likeReply(mediaKey, button.dataset.parentComment, button.dataset.likeReply)) {
          refreshDetailComments(mediaKey);
        }
      } finally {
        COMMUNITY_STATE.pendingLikes.delete(key);
      }
    });
  });

  commentsList.querySelectorAll('[data-reply-comment]').forEach(button => {
    button.addEventListener('click', () => {
      if (!getLocalUser()) {
        requireLogin('reply');
        return;
      }
      const form = commentsList.querySelector(`[data-reply-form="${selectorEscape(button.dataset.replyComment)}"]`);
      if (form) form.hidden = !form.hidden;
    });
  });

  commentsList.querySelectorAll('[data-edit-comment]').forEach(button => {
    button.addEventListener('click', () => {
      const form = commentsList.querySelector(`[data-edit-comment-form="${selectorEscape(button.dataset.editComment)}"]`);
      if (form) form.hidden = !form.hidden;
    });
  });

  commentsList.querySelectorAll('[data-edit-reply]').forEach(button => {
    button.addEventListener('click', () => {
      const form = commentsList.querySelector(`[data-edit-reply-form="${selectorEscape(button.dataset.editReply)}"][data-parent-comment="${selectorEscape(button.dataset.parentComment)}"]`);
      if (form) form.hidden = !form.hidden;
    });
  });

  commentsList.querySelectorAll('[data-cancel-inline-form]').forEach(button => {
    button.addEventListener('click', () => {
      const form = button.closest('.inline-reply-form, .inline-edit-form');
      if (form) form.hidden = true;
    });
  });

  commentsList.querySelectorAll('.inline-reply-form textarea').forEach(textarea => {
    const button = textarea.closest('.inline-reply-form')?.querySelector('[data-submit-reply]');
    const sync = () => { if (button) button.disabled = !textarea.value.trim(); };
    textarea.addEventListener('input', sync);
    sync();
  });

  commentsList.querySelectorAll('[data-submit-reply]').forEach(button => {
    button.addEventListener('click', async () => {
      const form = button.closest('.inline-reply-form');
      const textarea = form?.querySelector('textarea');
      const spoiler = form?.querySelector('input[type="checkbox"]');
      if (await addReply(mediaKey, button.dataset.submitReply, textarea?.value || '', spoiler?.checked)) {
        toast('Reply posted');
        refreshDetailComments(mediaKey);
      }
    });
  });

  commentsList.querySelectorAll('[data-save-comment-edit]').forEach(button => {
    button.addEventListener('click', async () => {
      const form = button.closest('.inline-edit-form');
      const card = button.closest('[data-comment-id]');
      const textarea = form?.querySelector('textarea');
      const spoiler = form?.querySelector('input[type="checkbox"]');
      if (await updateComment(mediaKey, button.dataset.saveCommentEdit, card?.dataset.commentOwner, textarea?.value || '', spoiler?.checked)) {
        toast('Comment updated');
        refreshDetailComments(mediaKey);
      }
    });
  });

  commentsList.querySelectorAll('[data-save-reply-edit]').forEach(button => {
    button.addEventListener('click', async () => {
      const form = button.closest('.inline-edit-form');
      const card = button.closest('[data-reply-id]');
      const textarea = form?.querySelector('textarea');
      const spoiler = form?.querySelector('input[type="checkbox"]');
      if (await updateReply(mediaKey, button.dataset.parentComment, button.dataset.saveReplyEdit, card?.dataset.replyOwner, textarea?.value || '', spoiler?.checked)) {
        toast('Reply updated');
        refreshDetailComments(mediaKey);
      }
    });
  });
}

async function refreshDetailReviews(mediaKey) {
  const reviewsList = document.getElementById('reviewsList');
  if (!reviewsList) return;
  const reviews = await loadReviews(mediaKey);
  const count = document.getElementById('reviewsCount');
  if (count) count.textContent = `(${reviews.length})`;
  reviewsList.innerHTML = renderReviews(reviews, mediaKey);
  bindSpoilerReveal(reviewsList);
  reviewsList.querySelectorAll('[data-delete-review]').forEach(button => {
    button.addEventListener('click', async () => {
      if (await deleteReview(mediaKey, button.dataset.deleteReview)) {
        toast('Review deleted');
        refreshDetailReviews(mediaKey);
      }
    });
  });
}

function renderRatingState(state) {
  const text = document.getElementById('communityRatingText');
  const value = document.getElementById('communityRatingValue');
  const userText = document.getElementById('yourRatingText');
  if (value) {
    value.textContent = state.ratingCount ? `${state.avgRating.toFixed(1)} / 10` : 'No ratings yet';
  }
  if (text) {
    text.textContent = state.ratingCount
      ? `${state.ratingCount} rating${state.ratingCount === 1 ? '' : 's'} from the community.`
      : 'Be the first to rate this title.';
  }
  if (userText) {
    userText.textContent = state.userRating ? `Your Rating: ${state.userRating}/10` : '';
  }
  document.querySelectorAll('[data-rate-title]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.rateTitle) === Number(state.userRating));
  });
}

async function initCommunityFeatures(scope = document) {
  const item = detailCurrentItem();
  if (!item) return;
  const mediaKey = mediaKeyForItem(item, item.season || 1, item.episode || 1);
  if (!mediaKey) return;

  COMMUNITY_STATE.commentSort = 'newest';
  scope.querySelectorAll('[data-comment-sort]').forEach(button => {
    button.classList.toggle('active', button.dataset.commentSort === COMMUNITY_STATE.commentSort);
  });
  refreshDetailComments(mediaKey);

  const commentInput = document.getElementById('commentInput');
  commentInput?.addEventListener('focus', () => {
    if (!getLocalUser()) requireLogin('comment');
  });
  const postButton = scope.querySelector('[data-submit-comment]');
  const syncPostButton = () => {
    if (postButton) postButton.disabled = !commentInput?.value.trim();
  };
  commentInput?.addEventListener('input', syncPostButton);
  syncPostButton();

  scope.querySelectorAll('[data-comment-sort]').forEach(button => {
    button.addEventListener('click', () => {
      COMMUNITY_STATE.commentSort = button.dataset.commentSort || 'newest';
      scope.querySelectorAll('[data-comment-sort]').forEach(sortButton => {
        sortButton.classList.toggle('active', sortButton === button);
      });
      refreshDetailComments(mediaKey);
    });
  });

  postButton?.addEventListener('click', async () => {
    if (await addComment(mediaKey, commentInput?.value || '', document.getElementById('commentSpoilerInput')?.checked)) {
      if (commentInput) commentInput.value = '';
      const spoiler = document.getElementById('commentSpoilerInput');
      if (spoiler) spoiler.checked = false;
      syncPostButton();
      toast('Comment posted');
      refreshDetailComments(mediaKey);
    }
  });
}

function clearDetailEnrichmentSlot() {
  const enrichmentEl = $('#tmdb-enrichment');
  if (!enrichmentEl) return;
  enrichmentEl.innerHTML = '';
  enrichmentEl.removeAttribute('aria-busy');
  enrichmentEl.style.display = 'none';
}

function renderDetailInfoPanel({ genres = '', runtime = '', director = '', studio = '', castCards = '' } = {}) {
  const enrichmentEl = $('#tmdb-enrichment');
  if (!enrichmentEl || (!genres && !runtime && !director && !studio && !castCards)) return false;

  enrichmentEl.innerHTML = `<section class="detail-info-panel">
    <div class="detail-info-header">
      <h2>More About This Title</h2>
    </div>
    <div class="detail-info-facts">
      ${genres ? `<div class="detail-info-fact"><span>Genres</span><strong>${escapeHtml(genres)}</strong></div>` : ''}
      ${runtime ? `<div class="detail-info-fact"><span>Duration</span><strong>${escapeHtml(runtime)}</strong></div>` : ''}
      ${director ? `<div class="detail-info-fact"><span>Director</span><strong>${escapeHtml(director)}</strong></div>` : ''}
      ${studio ? `<div class="detail-info-fact"><span>Studio</span><strong>${escapeHtml(studio)}</strong></div>` : ''}
    </div>
    ${castCards ? `<div class="detail-info-cast">
      <div class="detail-info-section-title">Cast</div>
      <div class="detail-info-cast-grid">${castCards}</div>
    </div>` : ''}
  </section>`;
  enrichmentEl.removeAttribute('aria-busy');
  enrichmentEl.style.display = 'block';
  return true;
}

function aniListCastCards(edges = []) {
  return edges.slice(0, 4).map((edge) => {
    const voiceActor = Array.isArray(edge?.voiceActors) ? edge.voiceActors[0] : null;
    const person = voiceActor || edge?.node;
    const name = person?.name?.full || edge?.node?.name?.full || '';
    const imageUrl = person?.image?.large || person?.image?.medium || edge?.node?.image?.large || edge?.node?.image?.medium || '';
    if (!name) return '';

    return `<article class="detail-info-cast-card">
      ${imageUrl ? `<img ${imageAttrs(imageUrl, { kind: 'profile', alt: name, loading: 'lazy', sizes: '(max-width: 760px) 42vw, 140px', width: 140, height: 210 })}>` : `<div class="detail-info-cast-fallback">${escapeHtml(name.slice(0, 1))}</div>`}
      <span>${escapeHtml(name)}</span>
    </article>`;
  }).filter(Boolean).join('');
}

async function loadAniListDetailEnrichment(item) {
  if (!item?.anilistId || typeof aniListFetch !== 'function') return false;

  const data = await aniListFetch(ANILIST_DETAIL_QUERY, { id: Number(item.anilistId) });
  const anime = data?.data?.Media;
  if (!anime) return false;

  const genres = Array.isArray(anime.genres) ? anime.genres.join(', ') : '';
  const runtimeParts = [];
  if (anime.episodes) runtimeParts.push(`${anime.episodes} episodes`);
  if (anime.duration) runtimeParts.push(`${anime.duration} min/ep`);
  const runtime = runtimeParts.join(' • ');
  const director = (anime.staff?.edges || [])
    .filter(edge => /director/i.test(edge?.role || ''))
    .map(edge => edge?.node?.name?.full)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  const studio = (anime.studios?.nodes || [])
    .map(studio => studio?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  const castCards = aniListCastCards(anime.characters?.edges || []);

  return renderDetailInfoPanel({ genres, runtime, director, studio, castCards });
}

async function loadTMDBDetailEnrichment() {
  const stored = localStorage.getItem(SELECTED_KEY);
  if (!stored || !isTMDBConfigured()) {
    clearDetailEnrichmentSlot();
    return;
  }

  let item;
  try { item = JSON.parse(stored); } catch (e) {
    clearDetailEnrichmentSlot();
    return;
  }

  if ((!item.tmdbId || !item.mediaType) && (item.anilistId || item.malId) && typeof resolveAnimePlayableItem === 'function') {
    const resolvedItem = await resolveAnimePlayableItem(item);
    if (resolvedItem?.tmdbId) {
      item = saveSelectedItem(resolvedItem) || resolvedItem;
    }
  }

  if (!item.tmdbId || !item.mediaType) {
    if (await loadAniListDetailEnrichment(item)) return;
    clearDetailEnrichmentSlot();
    return;
  }

  const endpoint = item.mediaType === 'movie'
    ? `/movie/${item.tmdbId}?language=en-US&append_to_response=videos,credits,similar`
    : `/tv/${item.tmdbId}?language=en-US&append_to_response=videos,credits,similar`;

  const data = await tmdbFetch(endpoint);
  if (!data) {
    if (await loadAniListDetailEnrichment(item)) return;
    clearDetailEnrichmentSlot();
    return;
  }

  const overview = String(data.overview || '').trim();
  const genres = data.genres?.map(g => g.name).join(', ') || '';
  const runtime = data.runtime ? `${data.runtime} min` : (data.number_of_seasons ? `${data.number_of_seasons} seasons` : '');
  const director = (data.credits?.crew || [])
    .filter(person => person.job === 'Director' || person.job === 'Series Director')
    .map(person => person.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ') || (data.created_by || []).map(person => person.name).filter(Boolean).slice(0, 2).join(', ');
  const studio = (data.production_companies || [])
    .map(company => company.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ') || (data.networks || []).map(network => network.name).filter(Boolean).slice(0, 2).join(', ');
  const castList = (data.credits?.cast || []).slice(0, 4);
  const castNames = castList.map(c => c.name).join(', ');
  const castCards = castList.map((person) => {
    const imageUrl = person.profile_path
      ? `https://image.tmdb.org/t/p/w300${person.profile_path}`
      : '';
    return `<article class="detail-info-cast-card">
      ${imageUrl ? `<img ${imageAttrs(imageUrl, { kind: 'profile', alt: person.name, loading: 'lazy', sizes: '(max-width: 760px) 42vw, 140px', width: 140, height: 210 })}>` : `<div class="detail-info-cast-fallback">${escapeHtml(person.name.slice(0, 1))}</div>`}
      <span>${escapeHtml(person.name)}</span>
    </article>`;
  }).join('');
  const trailer = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  if (trailer) {
    addDetailTrailerButton(trailer.key);
  }

  if (overview) {
    item.description = overview;
    saveSelectedItem(item);
    const descriptionEl = document.getElementById('detailDescription');
    if (descriptionEl) descriptionEl.textContent = overview;
  }

  if (item.anilistId && !castCards && await loadAniListDetailEnrichment(item)) {
    return;
  }

  const enrichmentEl = $('#tmdb-enrichment');
  if (enrichmentEl && (genres || runtime || director || studio || castNames)) {
    renderDetailInfoPanel({ genres, runtime, director, studio, castCards });
  } else if (item.anilistId && await loadAniListDetailEnrichment(item)) {
    return;
  }

  const castGrid = document.querySelector('#detail-cast .cast-grid');
  if (castGrid) {
    castGrid.innerHTML = castList.length
      ? castList.map((person) => {
          const imageUrl = person.profile_path
            ? `https://image.tmdb.org/t/p/w300${person.profile_path}`
            : '';
          return `
            <article class="cast-card">
              ${imageUrl ? `<img ${imageAttrs(imageUrl, { kind: 'profile', alt: person.name, loading: 'lazy', sizes: '96px', width: 96, height: 144 })}>` : `<div class="cast-fallback">${escapeHtml(person.name.slice(0, 1))}</div>`}
              <div class="cast-name">${escapeHtml(person.name)}</div>
            </article>
          `;
        }).join('')
      : `<div class="cast-empty">Cast details are unavailable for this title.</div>`;
  }

  const similarItems = (data.similar?.results || [])
    .map(s => normalizeTMDBItem(s, item.mediaType))
    .filter(Boolean)
    .slice(0, 12);

  if (similarItems.length) {
    if (enrichmentEl) {
      const existingInfo = genres || runtime || director || studio || castNames ? enrichmentEl.innerHTML : '';
      enrichmentEl.innerHTML = `${existingInfo}${row('Similar Content', similarItems)}`;
      enrichmentEl.removeAttribute('aria-busy');
      enrichmentEl.style.display = 'block';
      initCards(enrichmentEl);
    }
    initRowButtons();
  } else if (!genres && !runtime && !director && !studio && !castNames) {
    clearDetailEnrichmentSlot();
  } else if (enrichmentEl) {
    enrichmentEl.removeAttribute('aria-busy');
  }
}

function hero(items) {
  const cleanItems = rememberItems(items);
  if (!cleanItems.length) return '';
  return `<section class="hero" data-hero>
    ${cleanItems.map((item, i) => `<article class="hero-slide ${i===0?'active':''}" data-hero-slide
      data-id="${escapeHtml(item.id)}"
      data-tmdb-id="${escapeHtml(item.tmdbId || '')}"
      data-anilist-id="${escapeHtml(item.anilistId || '')}"
      data-mal-id="${escapeHtml(item.malId || '')}"
      data-media-type="${escapeHtml(item.mediaType || item.type || '')}"
      data-title="${escapeHtml(item.title)}"
      data-type="${escapeHtml(item.category || item.type || '')}"
      data-year="${escapeHtml(item.year)}"
      data-rating="${escapeHtml(item.rating)}"
      data-poster="${escapeHtml(item.poster)}"
      data-backdrop="${escapeHtml(item.backdrop)}"
      data-description="${escapeHtml(item.description || '')}">
      <img ${imageAttrs(item.backdrop, { kind: 'hero', alt: item.title, loading: i === 0 ? 'eager' : 'lazy', fetchpriority: i === 0 ? 'high' : 'low', sizes: '(max-width: 760px) 100vw, calc(100vw - var(--sidebar-w))', width: 1280, height: 720 })}>
      <div class="hero-content">
        <div class="hero-title-wrap" data-hero-title-wrap>
          <img class="hero-logo-title" data-hero-logo-title alt="${escapeHtml(item.title)}" width="360" height="140" hidden>
          <h1 class="hero-title-fallback" data-hero-title-fallback>${escapeHtml(item.title)}</h1>
        </div>
        <p>${escapeHtml(item.category || item.type || 'Media')} • ${escapeHtml(item.year)} • ★ ${escapeHtml(item.rating)}</p>
        <div class="hero-buttons">
          <button class="btn primary" data-hero-play="${escapeHtml(item.id)}">${icons.play} Play</button>
          <button class="btn" data-hero-add-watchlist="${escapeHtml(item.id)}" aria-label="Add ${escapeHtml(item.title)} to Watchlist">${icons.plus}</button>
        </div>
      </div>
    </article>`).join('')}
    <div class="hero-controls"><button class="round-btn" data-hero-prev aria-label="Previous featured title">${icons.arrowLeft}</button><button class="round-btn" data-hero-next aria-label="Next featured title">${icons.arrowRight}</button></div>
  </section>`;
}

function row(title, items, removable = false, removeKind = 'history') {
  const cleanItems = rememberItems(items);
  if (!cleanItems.length) return '';
  const id = 'row-' + Math.random().toString(36).slice(2,9);
  return `<section class="section">
    <div class="section-head"><h2 class="section-title">${escapeHtml(title)} ${title==='Collections' ? '<span>Explore All</span>' : ''}</h2><div class="row-controls"><button class="round-btn" data-scroll-left="${id}" aria-label="Scroll ${escapeHtml(title)} left">${icons.arrowLeft}</button><button class="round-btn" data-scroll-right="${id}" aria-label="Scroll ${escapeHtml(title)} right">${icons.arrowRight}</button></div></div>
    <div class="media-row" id="${id}">${cleanItems.map(item => card(item, removable, removeKind)).join('')}</div>
  </section>`;
}

const TOP10_SECTION_DATA = new Map();

function top10Section(title, periods) {
  const availablePeriods = Object.entries(periods || {})
    .map(([key, items]) => [key, rememberItems(items).slice(0, 10)])
    .filter(([, items]) => items.length);
  if (!availablePeriods.length) return '';

  const id = 'top10-' + Math.random().toString(36).slice(2, 9);
  const periodData = Object.fromEntries(availablePeriods);
  const initialPeriod = periodData.day ? 'day' : availablePeriods[0][0];
  TOP10_SECTION_DATA.set(id, periodData);

  const labels = { day: 'Today', week: 'Week', month: 'Month', year: 'Year' };
  return `<section class="section top10-section" data-top10-section="${id}">
    <div class="section-head top10-section-head">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      <div class="top10-head-actions">
        <div class="top10-periods" role="group" aria-label="${escapeHtml(title)} timeframe">
          ${availablePeriods.map(([key]) => `<button class="top10-period-btn ${key === initialPeriod ? 'active' : ''}" type="button" data-top10-period="${key}" aria-pressed="${key === initialPeriod}">${labels[key] || escapeHtml(key)}</button>`).join('')}
        </div>
        <div class="row-controls"><button class="round-btn" data-scroll-left="${id}" aria-label="Scroll ${escapeHtml(title)} left">${icons.arrowLeft}</button><button class="round-btn" data-scroll-right="${id}" aria-label="Scroll ${escapeHtml(title)} right">${icons.arrowRight}</button></div>
      </div>
    </div>
    <div class="media-row" id="${id}" data-top10-row>${periodData[initialPeriod].map(item => card(item)).join('')}</div>
  </section>`;
}

function initTop10Switchers(scope = document) {
  scope.querySelectorAll('[data-top10-section]').forEach(section => {
    const id = section.dataset.top10Section;
    const periods = TOP10_SECTION_DATA.get(id);
    const mediaRow = section.querySelector('[data-top10-row]');
    if (!periods || !mediaRow) return;

    section.querySelectorAll('[data-top10-period]').forEach(button => {
      button.onclick = () => {
        const items = periods[button.dataset.top10Period];
        if (!items?.length) return;

        section.querySelectorAll('[data-top10-period]').forEach(periodButton => {
          const active = periodButton === button;
          periodButton.classList.toggle('active', active);
          periodButton.setAttribute('aria-pressed', String(active));
        });

        mediaRow.innerHTML = items.map(item => card(item)).join('');
        mediaRow.scrollLeft = 0;
        initCards(mediaRow);
      };
    });
  });
}

function card(item, removable = false, removeKind = 'history') {
  item = rememberItem(item);
  if (!item) return '';
  const isUnderDev = isUnderDevelopment(item.type);
  const devBadge = isUnderDev ? `<div class="card-dev-badge">DEV</div>` : '';
  return `<article class="poster-card ${isUnderDev ? 'under-dev-card' : ''}"
    data-card-id="${escapeHtml(item.id)}"
    data-tmdb-id="${escapeHtml(item.tmdbId || '')}"
    data-anilist-id="${escapeHtml(item.anilistId || '')}"
    data-mal-id="${escapeHtml(item.malId || '')}"
    data-media-type="${escapeHtml(item.mediaType || item.type || '')}"
    data-title="${escapeHtml(item.title)}"
    data-type="${escapeHtml(item.category || item.type || '')}"
    data-year="${escapeHtml(item.year)}"
    data-rating="${escapeHtml(item.rating)}"
    data-poster="${escapeHtml(item.poster)}"
    data-backdrop="${escapeHtml(item.backdrop)}"
    data-description="${escapeHtml(item.description || '')}"
    aria-label="View ${escapeHtml(item.title)}">
    <div class="poster-frame">
      <img ${imageAttrs(item.poster, { kind: 'poster', alt: item.title, loading: 'lazy', sizes: '(max-width: 520px) 42vw, (max-width: 760px) 172px, 190px', width: 342, height: 513 })}>
      <span class="rating">${escapeHtml(item.rating)}</span>
      <div class="card-actions">
        ${removable ? `<button class="icon-btn" title="Remove" data-remove-${removeKind}="${item.id}">${icons.trash}</button>` : `<button class="icon-btn" title="Add to Watchlist" data-add-watchlist="${item.id}">${icons.plus}</button>`}
      </div>
      <div class="card-play"><button title="${isUnderDev ? 'Coming Soon' : 'View details'}" data-card-play="${item.id}" ${isUnderDev ? 'disabled' : ''}>${icons.play}</button></div>
      ${devBadge}
    </div>
    <a class="card-meta" href="${path('details/?id=' + encodeURIComponent(item.id))}" data-detail="${item.id}">
      <div class="card-line"><span>${escapeHtml(item.category || item.type || 'Media')}</span><span>${escapeHtml(item.year)}</span></div>
      <div class="card-title">${escapeHtml(item.title)}</div>
    </a>
  </article>`;
}

function navigateToDetail(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  saveSelectedItem(item);
  addHistory(item, false);
  window.location.href = path('details/');
}

async function playItem(itemOrId) {
  let item = typeof itemOrId === 'object' ? itemOrId : findItem(itemOrId);
  if (!item) return;

  if ((item.anilistId || item.malId) && !item.tmdbId) {
    item = await resolveAnimePlayableItem(item);
    if (!item) {
      toast('Player source is unavailable for this anime');
      return;
    }
  }

  trackPlayClick(item, "card");
  addHistory(item, false);
  saveContinueWatching(item, {
    season: item.selectedSeason || item.season || 1,
    episode: item.selectedEpisode || item.episode || 1
  }).catch(error => console.warn('Continue watching sync failed:', error));
  savePlayStats(item).catch(error => console.warn('Profile play stats failed:', error));

  const itemType = String(item.type || item.mediaType || item.category || 'movie').toLowerCase();
  const animeItem = typeof isAnimeItem === 'function' && isAnimeItem(item);
  const season = item.selectedSeason || item.season || 1;
  const episode = item.selectedEpisode || item.episode || item.episodeNumber || 1;
  const title = item.title || item.name || '';

  try {
    await ensurePlayerAssets();
  } catch (error) {
    console.error('Player assets failed to load:', error);
    toast('The player could not be loaded. Please try again.');
    return;
  }

  const inlinePlayer = typeof window.openPlayer === 'function' ? window.openPlayer : (typeof openPlayer === 'function' ? openPlayer : null);
  if (inlinePlayer) {
    if (itemType === 'movie') {
      inlinePlayer({ type: 'movie', id: item.tmdbId || item.id, title, item });
      return;
    }

    if (itemType === 'tv' || itemType === 'show' || itemType === 'anime' || itemType === 'series') {
      inlinePlayer({ type: animeItem || itemType === 'anime' ? 'anime' : 'tv', id: item.tmdbId || item.id, season, episode, title, item });
      return;
    }
  }

  const moviePlayer = typeof window.openMoviePlayer === 'function' ? window.openMoviePlayer : (typeof openMoviePlayer === 'function' ? openMoviePlayer : null);
  const showPlayer = typeof window.openShowPlayer === 'function' ? window.openShowPlayer : (typeof openShowPlayer === 'function' ? openShowPlayer : null);
  if (moviePlayer && showPlayer) {
    if (itemType === 'movie') {
      moviePlayer(item);
      return;
    }
    if (itemType === 'tv' || itemType === 'show' || itemType === 'anime') {
      showPlayer(item);
      return;
    }
  }

  openItem(item);
}

let playerAssetsPromise;
function ensurePlayerAssets() {
  if (typeof window.openPlayer === 'function') return Promise.resolve();
  if (playerAssetsPromise) return playerAssetsPromise;

  playerAssetsPromise = Promise.all([
    new Promise((resolve, reject) => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = window.PiraTYCache?.withVersion(path('assets/css/player.css')) || path('assets/css/player.css');
      stylesheet.onload = resolve;
      stylesheet.onerror = () => reject(new Error(`Failed to load ${stylesheet.href}`));
      document.head.append(stylesheet);
    }),
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = window.PiraTYCache?.withVersion(path('assets/js/player.js')) || path('assets/js/player.js');
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${script.src}`));
      document.head.append(script);
    })
  ]).catch(error => {
    playerAssetsPromise = null;
    throw error;
  });

  return playerAssetsPromise;
}

function initCards(scope = document) {
  if (!scope) return;

  initCollectionPosterSlides(scope);

  scope.querySelectorAll('.poster-card').forEach(cardEl => {
    cardEl.onclick = handleCardClick;
  });

  scope.querySelectorAll('[data-add-watchlist]').forEach(btn => {
    btn.onclick = e => {
      if (btn.closest('[data-hero]')) return;

      e.preventDefault();
      e.stopPropagation();

      addWatchlist(btn.dataset.addWatchlist);
    };
  });

  scope.querySelectorAll('[data-card-play]').forEach(btn => {
    btn.onclick = e => {
      if (btn.closest('[data-hero]')) return;

      e.preventDefault();
      e.stopPropagation();

      const card = btn.closest('.poster-card');
      const item = itemFromDataset(card) || findItem(btn.dataset.cardPlay) || findItem(card?.dataset?.cardId);
      playItem(item || btn.dataset.cardPlay);
    };
  });

  scope.querySelectorAll('[data-play]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      openDirectPlayerModalForItem(btn.dataset.play);
    };
  });

  scope.querySelectorAll('[data-direct-play]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      openDirectPlayerModalForItem(btn.dataset.directPlay);
    };
  });

  scope.querySelectorAll('[data-detail]').forEach(link => {
    link.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      navigateToDetail(link.dataset.detail);
    };
  });

  scope.querySelectorAll('[data-remove-watchlist]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      removeWatchlist(btn.dataset.removeWatchlist);
    };
  });

  scope.querySelectorAll('[data-remove-history]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      removeHistory(btn.dataset.removeHistory);
    };
  });

  scope.querySelectorAll('[data-remove-continueWatching]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      removeContinueWatching(btn.dataset.removeContinuewatching || btn.dataset.removeContinueWatching);
    };
  });

}
async function renderSearch(q) {
  const box = $('#searchResults');
  if (!box) return;
  const query = (q || '').toLowerCase().trim();

  if (!query) {
    box.innerHTML = '<div class="empty-state"><p>Start typing to search...</p></div>';
    return;
  }

  box.innerHTML = '<div class="empty-state"><p>Searching...</p></div>';
  if (query !== window.__lastTrackedSearchQuery) {
    window.__lastTrackedSearchQuery = query;
    trackEvent("search_used", {
      query,
      query_length: query.length
    });
  }

  const localResults = DATA.items
    .filter(item => item.title.toLowerCase().includes(query) || item.category.toLowerCase().includes(query) || item.type.toLowerCase().includes(query))
    .slice(0, 6)
    .map(rememberItem);

  let results = [...localResults];


  if (isTMDBConfigured() && query.length > 2) {
    const tmdbData = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`);
    if (tmdbData?.results) {
      const tmdbResults = tmdbData.results
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => normalizeTMDBItem(item))
        .filter(Boolean)
        .slice(0, 12);
      results = results.concat(tmdbResults.filter(tr => !results.some(lr => lr && lr.id === tr.id)));
    }
  }

  results = results.filter(Boolean).slice(0, 12);
  box.innerHTML = results.length
    ? results.map(item => card(item)).join('')
    : '<div class="empty-state"><p>No results found.</p></div>';
  initCards(box);
}

function modernAuthModalMarkup() {
  return `
    <div class="auth-box">
      <button class="auth-close" id="authClose" type="button" aria-label="Close auth modal"></button>

      <div class="auth-head">
        <h2 id="authTitle">Welcome back</h2>
        <p>Access your PiraTY profile, lists, and synced library.</p>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="Authentication">
        <button class="auth-tab active" id="authLoginTab" type="button" data-auth-tab="login" role="tab" aria-selected="true">Login</button>
        <button class="auth-tab" id="authSignupTab" type="button" data-auth-tab="signup" role="tab" aria-selected="false">Sign Up</button>
      </div>

      <p class="auth-message" id="authMessage" aria-live="polite"></p>

      <form class="auth-form active" id="loginForm" data-auth-panel="login">
        <input id="authEmail" type="email" placeholder="Email" autocomplete="email" />
        <input id="authPassword" type="password" placeholder="Password" autocomplete="current-password" />
        <button class="auth-submit" id="authSubmit" type="submit">Login</button>
        <button class="auth-google" id="google-login-btn" type="button" aria-label="Continue with Google">
          <span class="auth-google-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" role="img" aria-label="Google logo">
              <path fill="#4285F4" d="M21.35 11.1h-9.18v2.9h5.27c-.23 1.3-1 2.4-2.1 3.14v2.61h3.4c1.98-1.82 3.11-4.51 3.11-7.65 0-.67-.06-1.32-.5-3z"/>
              <path fill="#34A853" d="M12.17 22c2.7 0 4.96-.9 6.61-2.45l-3.4-2.61c-.94.63-2.14 1.01-3.21 1.01-2.47 0-4.57-1.67-5.32-3.92H3.34v2.68A9.99 9.99 0 0 0 12.17 22z"/>
              <path fill="#FBBC05" d="M6.85 14.03c-.19-.56-.3-1.15-.3-1.76 0-.61.11-1.2.3-1.76V7.83H3.34a10 10 0 0 0 0 8.88l3.51-2.68z"/>
              <path fill="#EA4335" d="M12.17 5.98c1.47 0 2.78.51 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12.17 2C8.52 2 5.29 4.1 3.34 7.83l3.51 2.68c.75-2.25 2.85-3.93 5.32-3.93z"/>
            </svg>
          </span>
          <span class="auth-google-label">Continue with Google</span>
        </button>
        <button class="auth-link" id="forgotPasswordBtn" type="button">Forgot password?</button>
      </form>

      <form class="auth-form" id="signupForm" data-auth-panel="signup">
        <input id="signupUsername" type="text" placeholder="Username" maxlength="24" autocomplete="username" />
        <input id="signupEmail" type="email" placeholder="Email" autocomplete="email" />
        <input id="signupPassword" type="password" placeholder="Password" autocomplete="new-password" />
        <input id="signupConfirmPassword" type="password" placeholder="Confirm password" autocomplete="new-password" />
        <button class="auth-submit" id="signupSubmit" type="submit">Create account</button>
        <button class="auth-google" id="googleSignupBtn" type="button" aria-label="Continue with Google">
          <span class="auth-google-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" role="img" aria-label="Google logo">
              <path fill="#4285F4" d="M21.35 11.1h-9.18v2.9h5.27c-.23 1.3-1 2.4-2.1 3.14v2.61h3.4c1.98-1.82 3.11-4.51 3.11-7.65 0-.67-.06-1.32-.5-3z"/>
              <path fill="#34A853" d="M12.17 22c2.7 0 4.96-.9 6.61-2.45l-3.4-2.61c-.94.63-2.14 1.01-3.21 1.01-2.47 0-4.57-1.67-5.32-3.92H3.34v2.68A9.99 9.99 0 0 0 12.17 22z"/>
              <path fill="#FBBC05" d="M6.85 14.03c-.19-.56-.3-1.15-.3-1.76 0-.61.11-1.2.3-1.76V7.83H3.34a10 10 0 0 0 0 8.88l3.51-2.68z"/>
              <path fill="#EA4335" d="M12.17 5.98c1.47 0 2.78.51 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12.17 2C8.52 2 5.29 4.1 3.34 7.83l3.51 2.68c.75-2.25 2.85-3.93 5.32-3.93z"/>
            </svg>
          </span>
          <span class="auth-google-label">Continue with Google</span>
        </button>
      </form>
    </div>
  `;
}

function initAuthModal() {
  const loginBtn = document.getElementById('loginBtn');
  const modal = document.getElementById('authModal');

  if (!loginBtn || !modal) return;

  if (!modal.querySelector('#loginForm') || !modal.querySelector('#signupForm') || !modal.querySelector('.auth-tabs')) {
    modal.innerHTML = modernAuthModalMarkup();
  }

  const closeBtn = document.getElementById('authClose');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authTitle = document.getElementById('authTitle');
  const messageEl = document.getElementById('authMessage');
  const loginEmail = document.getElementById('authEmail');
  const loginPassword = document.getElementById('authPassword');
  const loginSubmit = document.getElementById('authSubmit');
  const signupUsername = document.getElementById('signupUsername');
  const signupEmail = document.getElementById('signupEmail');
  const signupPassword = document.getElementById('signupPassword');
  const signupConfirm = document.getElementById('signupConfirmPassword');
  const signupSubmit = document.getElementById('signupSubmit');
  const googleButtons = [document.getElementById('google-login-btn'), document.getElementById('googleSignupBtn')].filter(Boolean);
  const forgotBtn = document.getElementById('forgotPasswordBtn');

  let activeTab = 'login';
  let authBusy = false;
  let accountDropdown = document.getElementById('accountDropdown');
  let accountAnchor = loginBtn?.parentElement?.classList.contains('account-menu-anchor') ? loginBtn.parentElement : null;

  if (!accountDropdown) {
    loginBtn.insertAdjacentHTML('afterend', `
      <div class="account-dropdown" id="accountDropdown">
        <a href="${path('profile/')}">My Profile</a>
        <a href="${path('watchlist/')}">Watchlist</a>
        <a href="${path('history/')}">History</a>
        <a href="${path('settings/')}">Settings</a>
        <button type="button" data-account-logout>Logout</button>
      </div>
    `);
    accountDropdown = document.getElementById('accountDropdown');
  }

  if (loginBtn && accountDropdown) {
    accountAnchor = loginBtn.parentElement?.classList.contains('account-menu-anchor')
      ? loginBtn.parentElement
      : null;

    if (!accountAnchor) {
      accountAnchor = document.createElement('div');
      accountAnchor.className = 'account-menu-anchor';
      loginBtn.parentNode?.insertBefore(accountAnchor, loginBtn);
      accountAnchor.appendChild(loginBtn);
      accountAnchor.appendChild(accountDropdown);
    } else if (accountDropdown.parentElement !== accountAnchor) {
      accountAnchor.appendChild(accountDropdown);
    }
  }

  function setMessage(text = '', tone = 'info') {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.dataset.tone = tone;
    messageEl.style.display = text ? 'block' : 'none';
  }

  function setBusy(button, busy, label, busyLabel = 'Loading...') {
    authBusy = busy;
    [loginSubmit, signupSubmit, ...googleButtons, forgotBtn].filter(Boolean).forEach(btn => {
      btn.disabled = busy;
    });
    if (button) button.textContent = busy ? busyLabel : label;
  }

  function switchTab(tab) {
    activeTab = tab;
    modal.querySelectorAll('[data-auth-tab]').forEach(btn => {
      const isActive = btn.dataset.authTab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-auth-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.authPanel === tab);
    });
    if (authTitle) authTitle.textContent = tab === 'login' ? 'Welcome back' : 'Create account';
    setMessage('');
    setTimeout(() => (tab === 'login' ? loginEmail : signupUsername)?.focus(), 40);
  }

  function openModal(message = '', tab = 'login') {
    switchTab(tab);
    setMessage(message, message ? 'info' : 'info');
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
    setMessage('');
  }

  function validateSignup() {
    const username = signupUsername?.value.trim() || '';
    const email = signupEmail?.value.trim() || '';
    const password = signupPassword?.value || '';
    const confirm = signupConfirm?.value || '';
    if (!username) return 'Username is required.';
    if (!isValidUsername(username)) return 'Username must be 3-24 letters, numbers, or underscores.';
    if (!email) return 'Email is required.';
    if (password.length < 6) return 'Password should be at least 6 characters.';
    if (password !== confirm) return 'Confirm password must match.';
    return '';
  }

  async function finishLogin(user, { isGoogle = false } = {}) {
    const profile = await ensureUserProfile(user, { isGoogle });
    setCurrentUserState(user, profile);
    setAuthReadyState(true);
    localStorage.setItem('piraty_logged_in', 'true');
    localStorage.setItem('piraty_user', user.email || user.uid);
    closeModal();
    await maybePromptGuestMigration();
    await loadLocalLibraries();
    renderAccountButton();
    loadPage(page);
  }

  async function handleLogin(event) {
    event?.preventDefault();
    if (authBusy) return;
    const email = loginEmail?.value.trim() || '';
    const password = loginPassword?.value || '';
    if (!email) return setMessage('Email is required.', 'error');
    if (!password) return setMessage('Password is required.', 'error');
    if (!window.piratyAuth?.login) return setMessage('Firebase Auth is not loaded.', 'error');

    setBusy(loginSubmit, true, 'Login', 'Logging in...');
    try {
      const credential = await window.piratyAuth.login(email, password);
      await finishLogin(credential.user);
      loginForm?.reset();
    } catch (error) {
      console.error('Login failed:', error);
      setMessage(friendlyAuthError(error), 'error');
    } finally {
      setBusy(loginSubmit, false, 'Login');
    }
  }

  async function handleSignup(event) {
    event?.preventDefault();
    if (authBusy) return;
    const validation = validateSignup();
    if (validation) return setMessage(validation, 'error');
    if (!window.piratyAuth?.signup) return setMessage('Firebase Auth is not loaded.', 'error');

    const username = signupUsername.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;

    setBusy(signupSubmit, true, 'Create account', 'Creating...');
    try {
      if (await usernameExists(username)) {
        setMessage('Username already taken.', 'error');
        return;
      }
      const credential = await window.piratyAuth.signup(email, password);
      const reserved = await reserveUsername(username, credential.user.uid);
      if (!reserved) throw new Error('username-taken');
      await ensureUserProfile(credential.user, { username, isGoogle: false });
      await finishLogin(credential.user);
      signupForm?.reset();
    } catch (error) {
      console.error('Signup failed:', error);
      setMessage(error.message === 'username-taken' ? 'Username already taken.' : friendlyAuthError(error), 'error');
    } finally {
      setBusy(signupSubmit, false, 'Create account');
    }
  }

  async function handleGoogleLogin(event) {
    event?.preventDefault();
    if (authBusy) return;
    if (!window.piratyAuth?.loginWithGoogle) return setMessage('Google sign-in is not available.', 'error');

    const button = event?.currentTarget || googleButtons[0];
    setBusy(button, true, 'Continue with Google', 'Connecting...');
    try {
      const result = await window.piratyAuth.loginWithGoogle();
      console.log('Logged in:', result.user);
      await finishLogin(result.user, { isGoogle: true });
    } catch (error) {
      console.error('Google login failed:', error);
      setMessage(friendlyAuthError(error), 'error');
    } finally {
      setBusy(button, false, 'Continue with Google');
    }
  }

  async function handlePasswordReset() {
    if (authBusy) return;
    const email = loginEmail?.value.trim() || window.prompt('Enter your email address')?.trim();
    if (!email) return setMessage('Email is required.', 'error');
    if (!window.piratyAuth?.resetPassword) return setMessage('Password reset is not available.', 'error');
    setBusy(forgotBtn, true, 'Forgot password?', 'Sending...');
    try {
      await window.piratyAuth.resetPassword(email);
      setMessage('Password reset email sent.', 'success');
    } catch (error) {
      console.error('Password reset failed:', error);
      setMessage(friendlyAuthError(error), 'error');
    } finally {
      setBusy(forgotBtn, false, 'Forgot password?');
    }
  }

  async function logout() {
    try {
      if (window.piratyAuth?.logout) await window.piratyAuth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      toast(friendlyAuthError(error));
    } finally {
      localStorage.removeItem('piraty_logged_in');
      localStorage.removeItem('piraty_user');
      LIBRARY_STATE.user = null;
      LIBRARY_STATE.loaded = false;
      LIBRARY_STATE.watchlist = [];
      LIBRARY_STATE.history = [];
      LIBRARY_STATE.continueWatching = [];
      setCurrentUserState(null, null);
      setAuthReadyState(false);
      accountDropdown?.classList.remove('open');
      renderAccountButton();
      loadPage(page);
    }
  }

  function renderAccountButton() {
    if (!loginBtn) return;

    const user = currentUser || getLocalUser();
    const profile = currentUserProfile && currentUserProfile.uid === user?.uid
      ? currentUserProfile
      : (AUTH_STATE.profile && AUTH_STATE.profile.uid === user?.uid ? AUTH_STATE.profile : null);

    loginBtn.classList.remove('account-button', 'is-loading');
    loginBtn.removeAttribute('aria-busy');
    loginBtn.disabled = false;

    if (!authReady) {
      loginBtn.classList.add('account-button', 'is-loading');
      loginBtn.setAttribute('aria-busy', 'true');
      loginBtn.disabled = true;
      loginBtn.innerHTML = `
        <span class="account-avatar account-avatar-skeleton" aria-hidden="true"></span>
        <span class="account-loading-text">
          <span class="skeleton-line account-loading-line"></span>
        </span>
      `;
      return;
    }

    if (!user) {
      loginBtn.innerHTML = 'Login';
      return;
    }

    const resolvedName = profile?.username || user.displayName || user.email?.split('@')[0] || 'PiraTY User';
    const avatar = profile?.photoURL || user.photoURL || '';
    loginBtn.classList.add('account-button');
    loginBtn.innerHTML = `${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="24" height="24" decoding="async">` : `<span class="account-avatar">${escapeHtml(resolvedName.slice(0, 1).toUpperCase())}</span>`}<span>${escapeHtml(resolvedName)}</span>`;
  }

  function updateLoginButton() {
    return renderAccountButton();
  }

  window.renderAccountButton = renderAccountButton;
  window.updateLoginButton = updateLoginButton;

  modal.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.authTab || 'login');
  });

  loginBtn.onclick = () => {
    if (getLocalUser()) {
      accountDropdown?.classList.toggle('open');
    } else {
      openModal('', 'login');
    }
  };

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      accountDropdown?.classList.remove('open');
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#loginBtn') && !event.target.closest('#accountDropdown')) {
      accountDropdown?.classList.remove('open');
    }
  });

  loginForm?.addEventListener('submit', handleLogin);
  signupForm?.addEventListener('submit', handleSignup);
  googleButtons.forEach(btn => btn.addEventListener('click', handleGoogleLogin));
  forgotBtn?.addEventListener('click', handlePasswordReset);
  accountDropdown?.querySelector('[data-account-logout]')?.addEventListener('click', logout);

  window.openAuthModal = openModal;
  renderAccountButton();

  if (!window.__piratyFirestoreAuthBound && window.piratyAuth?.watch) {
    window.__piratyFirestoreAuthBound = true;
    window.piratyAuth.watch(async (user) => {
      setAuthReadyState(false);
      LIBRARY_STATE.user = user || null;
      if (user) {
        setCurrentUserState(user, null);
        localStorage.setItem('piraty_logged_in', 'true');
        localStorage.setItem('piraty_user', user.email || user.uid);
        try {
          const profile = await loadUserProfile(user.uid);
          setCurrentUserState(user, profile);
          await ensureUserProfile(user, { isGoogle: Boolean(user.providerData?.some(provider => provider.providerId === 'google.com')) });
          await loadLocalLibraries();
        } catch (error) {
          console.error('Firestore auth sync failed:', error);
        }
      } else {
        localStorage.removeItem('piraty_logged_in');
        localStorage.removeItem('piraty_user');
        LIBRARY_STATE.loaded = false;
        LIBRARY_STATE.watchlist = [];
        LIBRARY_STATE.history = [];
        LIBRARY_STATE.continueWatching = [];
        setCurrentUserState(null, null);
      }
      setAuthReadyState(true);
      renderAccountButton();
      loadPage(page);
    });
  }
}


/* ==========================================================
   MINIMALIST HTML5 / HLS DIRECT STREAM PLAYER MODAL
   ========================================================== */

let directPlayerInstance = null;
let directPlayerHls = null;
let directPlayerModalEl = null;
let directPlayerAssetsPromise = null;

const SAMPLE_DEMO_STREAM = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_HLS_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

function ensureDirectPlayerAssets() {
  if (window.Plyr && window.Hls) return Promise.resolve();
  if (directPlayerAssetsPromise) return directPlayerAssetsPromise;

  directPlayerAssetsPromise = Promise.all([
    new Promise((resolve) => {
      if (document.querySelector('link[href*="plyr.css"]')) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css';
      link.onload = resolve;
      link.onerror = () => resolve();
      document.head.appendChild(link);
    }),
    new Promise((resolve) => {
      if (window.Hls) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';
      script.onload = resolve;
      script.onerror = () => resolve();
      document.head.appendChild(script);
    }),
    new Promise((resolve) => {
      if (window.Plyr) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.polyfilled.min.js';
      script.onload = resolve;
      script.onerror = () => resolve();
      document.head.appendChild(script);
    })
  ]);

  return directPlayerAssetsPromise;
}

function createDirectPlayerModal() {
  if (document.getElementById('directPlayerModal')) {
    directPlayerModalEl = document.getElementById('directPlayerModal');
    return directPlayerModalEl;
  }

  const overlay = document.createElement('div');
  overlay.id = 'directPlayerModal';
  overlay.className = 'direct-player-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Direct Stream Player');

  overlay.innerHTML = `
    <div class="direct-player-modal">
      <div class="direct-player-header">
        <div class="direct-player-title-wrap">
          <div class="direct-player-badge">HTML5 / HLS Direct Stream</div>
          <h2 class="direct-player-title" id="directPlayerTitle">Direct Player</h2>
        </div>
        <button class="direct-player-close" id="closeDirectPlayerBtn" aria-label="Close player" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="direct-player-source-bar">
        <div class="direct-player-input-wrap">
          <span class="direct-player-input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </span>
          <input type="url" id="directStreamUrlInput" class="direct-player-input" placeholder="Paste direct stream URL (.mp4, .webm, .m3u8)..." autocomplete="off" spellcheck="false">
        </div>
        <select id="directPlayerStreamSelect" class="direct-player-stream-select" aria-label="Choose a stream source" hidden></select>
        <div class="direct-player-actions">
          <button type="button" class="btn primary direct-player-load-btn" id="directStreamLoadBtn">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M8 5v14l11-7Z"/></svg> Play Stream
          </button>
          <button type="button" class="btn direct-player-demo-btn" id="directStreamDemoBtn" title="Load sample demo stream to test player">
            Sample
          </button>
        </div>
      </div>

      <div class="direct-player-stage">
        <div class="direct-video-wrapper">
          <video id="piratyDirectVideo" class="direct-video-element" playsinline controls preload="metadata"></video>
        </div>
        <div class="direct-player-status" id="directPlayerStatus" role="status" aria-live="polite" style="display:none;"></div>
      </div>

      <div class="direct-player-footer">
        <div class="direct-player-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hint-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Supports MP4, WebM, and HLS (.m3u8) streams for your authorized media.</span>
        </div>
        <div class="direct-player-shortcuts">
          <span class="key-tag">Space</span> Play/Pause
          <span class="key-tag">F</span> Fullscreen
          <span class="key-tag">M</span> Mute
          <span class="key-tag">Esc</span> Exit
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  directPlayerModalEl = overlay;

  overlay.querySelector('#closeDirectPlayerBtn')?.addEventListener('click', closeDirectPlayer);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDirectPlayer();
  });

  const inputEl = overlay.querySelector('#directStreamUrlInput');
  const loadBtn = overlay.querySelector('#directStreamLoadBtn');
  const demoBtn = overlay.querySelector('#directStreamDemoBtn');
  const streamSelect = overlay.querySelector('#directPlayerStreamSelect');

  loadBtn?.addEventListener('click', () => {
    loadDirectStream(inputEl?.value || '');
  });

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadDirectStream(inputEl.value || '');
    }
  });

  demoBtn?.addEventListener('click', () => {
    const isBigBuck = inputEl?.value === SAMPLE_DEMO_STREAM;
    const targetUrl = isBigBuck ? SAMPLE_HLS_STREAM : SAMPLE_DEMO_STREAM;
    if (inputEl) inputEl.value = targetUrl;
    loadDirectStream(targetUrl);
  });

  streamSelect?.addEventListener('change', () => {
    const selected = streamSelect.selectedOptions[0];
    if (!selected?.value) return;
    if (inputEl) inputEl.value = selected.value;
    loadDirectStream(selected.value);
  });

  return directPlayerModalEl;
}

function openDirectPlayer({ title = 'Direct Stream', poster = '', url = '', item = null, restoreSavedUrl = true } = {}) {
  const modal = createDirectPlayerModal();
  modal._currentItem = item;

  const titleEl = modal.querySelector('#directPlayerTitle');
  if (titleEl) titleEl.textContent = title || 'Direct Stream';

  const inputEl = modal.querySelector('#directStreamUrlInput');
  const videoEl = modal.querySelector('#piratyDirectVideo');
  const streamSelect = modal.querySelector('#directPlayerStreamSelect');
  if (poster && videoEl) videoEl.setAttribute('poster', poster);
  if (streamSelect) {
    streamSelect.replaceChildren();
    streamSelect.hidden = true;
  }

  const initialUrl = url || (restoreSavedUrl ? (() => {
    const key = item ? (item.tmdbId || item.id) : null;
    return (key && localStorage.getItem(`piraty_direct_url_${key}`))
      || localStorage.getItem('piraty_last_direct_url')
      || '';
  })() : '');

  if (inputEl) inputEl.value = initialUrl;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (initialUrl) {
    loadDirectStream(initialUrl, poster);
  } else {
    inputEl?.focus();
  }
}

async function openDirectPlayerModalForItem(itemId) {
  let item = itemId ? findItem(itemId) : null;
  try {
    const selectedItem = JSON.parse(localStorage.getItem(SELECTED_KEY) || 'null');
    if (selectedItem && (!item || String(selectedItem.id) === String(item.id))) {
      item = { ...item, ...selectedItem };
    }
  } catch (error) {
    console.warn('Could not read selected media before fetching streams:', error);
  }
  if (item) item = rememberItem(item);

  if (item && !item.tmdbId && (item.anilistId || item.malId) && typeof resolveAnimePlayableItem === 'function') {
    try {
      item = await resolveAnimePlayableItem(item);
    } catch (error) {
      console.error('Could not resolve anime TMDB ID:', error);
    }
  }

  const title = item ? (item.title || item.name || 'Direct Stream') : 'Direct Stream';
  const poster = item?.poster || item?.backdrop || '';

  openDirectPlayer({
    title,
    poster,
    item,
    restoreSavedUrl: false
  });

  fetchAndPlayApiStreams(item).catch(error => {
    console.error('Stream API request failed:', error);
    showDirectPlayerStatus(error.message || 'Could not retrieve streams. You can enter a direct stream URL above.');
  });
}

function showDirectPlayerStatus(message) {
  const statusEl = document.getElementById('directPlayerStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.display = 'flex';
}

function getDirectStreamUrl(stream) {
  const candidate = typeof stream === 'string'
    ? stream
    : stream && typeof stream === 'object'
      ? stream.url || stream.streamUrl || stream.stream_url || stream.src || stream.file || stream.link
      : '';

  if (typeof candidate !== 'string') return '';
  try {
    const url = new URL(candidate.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

function getDirectStreamLabel(stream, index) {
  if (typeof stream === 'object' && stream) {
    const label = stream.quality || stream.label || stream.name || stream.provider || stream.server;
    if (typeof label === 'string' && label.trim()) return label.trim();
  }
  return `Source ${index + 1}`;
}

async function fetchAndPlayApiStreams(item) {
  if (!item?.tmdbId || !/^\d+$/.test(String(item.tmdbId))) {
    throw new Error('This title has no TMDB ID. Enter an authorized direct stream URL above.');
  }

  const rawType = String(item.mediaType || item.type || item.category || '').toLowerCase();
  const isMovie = rawType === 'movie' || rawType === 'film';
  const type = isMovie ? 'movie' : 'series';
  const tmdbId = encodeURIComponent(String(item.tmdbId));
  const endpoint = type === 'movie'
    ? `https://tmdb-api-esip.onrender.com/api/streams/movie/${tmdbId}`
    : `https://tmdb-api-esip.onrender.com/api/streams/series/${tmdbId}?season=${encodeURIComponent(item.selectedSeason || item.season || 1)}&episode=${encodeURIComponent(item.selectedEpisode || item.episode || 1)}`;

  showDirectPlayerStatus('Looking for available streams...');
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('The stream API returned an invalid response.');
  }
  if (!response.ok) {
    throw new Error(data?.error || `Stream API request failed (${response.status}).`);
  }
  if (data?.success === false) {
    throw new Error(data.error || data.message || 'The stream API could not find sources.');
  }
  if (!Array.isArray(data?.streams)) {
    throw new Error('The stream API response is missing its streams list.');
  }

  const streams = data.streams
    .map((stream, index) => ({ url: getDirectStreamUrl(stream), label: getDirectStreamLabel(stream, index) }))
    .filter(stream => stream.url);
  if (!streams.length) {
    throw new Error('No playable streams were returned for this title and episode.');
  }

  const select = document.getElementById('directPlayerStreamSelect');
  if (select) {
    select.replaceChildren();
    streams.forEach((stream, index) => {
      const option = document.createElement('option');
      option.value = stream.url;
      option.textContent = stream.label;
      select.appendChild(option);
    });
    select.hidden = streams.length < 2;
    select.value = streams[0].url;
  }

  const input = document.getElementById('directStreamUrlInput');
  if (input) input.value = streams[0].url;
  showDirectPlayerStatus(`${streams.length} stream${streams.length === 1 ? '' : 's'} found. Loading ${streams[0].label}...`);
  await loadDirectStream(streams[0].url, item.poster || item.backdrop || '');
}

async function loadDirectStream(rawUrl, poster = '') {
  const url = String(rawUrl || '').trim();
  const videoEl = document.getElementById('piratyDirectVideo');
  const statusEl = document.getElementById('directPlayerStatus');

  if (!videoEl) return;

  if (!url) {
    if (statusEl) {
      statusEl.textContent = 'Please enter a valid stream URL (.mp4, .webm, or .m3u8).';
      statusEl.style.display = 'flex';
    }
    return;
  }

  try {
    localStorage.setItem('piraty_last_direct_url', url);
    const item = directPlayerModalEl?._currentItem;
    if (item?.tmdbId || item?.id) {
      localStorage.setItem(`piraty_direct_url_${item.tmdbId || item.id}`, url);
    }
  } catch (e) {}

  if (statusEl) {
    statusEl.innerHTML = '<span class="direct-spinner"></span> Connecting stream...';
    statusEl.style.display = 'flex';
  }

  if (directPlayerHls) {
    directPlayerHls.destroy();
    directPlayerHls = null;
  }

  await ensureDirectPlayerAssets();

  const isHls = /\.m3u8(\?|$)/i.test(url) || url.includes('/hls/');

  const handleCanPlay = () => {
    if (statusEl) statusEl.style.display = 'none';
    videoEl.play().catch(e => {
      console.log('Direct player autoplay deferred:', e);
    });
  };

  const handleError = () => {
    if (statusEl) {
      statusEl.innerHTML = '⚠️ <strong>Playback Error</strong>: Unable to load stream. Please ensure the URL is valid, accessible, and has CORS enabled.';
      statusEl.style.display = 'flex';
    }
  };

  videoEl.oncanplay = handleCanPlay;
  videoEl.onerror = handleError;

  if (isHls) {
    if (window.Hls && window.Hls.isSupported()) {
      directPlayerHls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true
      });
      directPlayerHls.loadSource(url);
      directPlayerHls.attachMedia(videoEl);
      directPlayerHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (statusEl) statusEl.style.display = 'none';
        videoEl.play().catch(() => {});
      });
      directPlayerHls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network Error, attempting recovery...');
              directPlayerHls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media Error, attempting recovery...');
              directPlayerHls.recoverMediaError();
              break;
            default:
              handleError();
              directPlayerHls.destroy();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      videoEl.load();
    } else {
      if (statusEl) {
        statusEl.textContent = 'HLS (.m3u8) playback is not supported on this browser.';
        statusEl.style.display = 'flex';
      }
      return;
    }
  } else {
    videoEl.src = url;
    videoEl.load();
  }

  if (window.Plyr && !directPlayerInstance) {
    try {
      directPlayerInstance = new window.Plyr(videoEl, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'captions',
          'settings',
          'pip',
          'airplay',
          'fullscreen'
        ],
        settings: ['quality', 'speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: false }
      });
    } catch (err) {
      console.warn('Plyr initialization fallback to native:', err);
    }
  }
}

function closeDirectPlayer() {
  if (!directPlayerModalEl) return;
  directPlayerModalEl.classList.remove('active');
  document.body.style.overflow = '';

  if (directPlayerInstance) {
    try {
      directPlayerInstance.destroy();
    } catch (e) {}
    directPlayerInstance = null;
  }

  if (directPlayerHls) {
    directPlayerHls.destroy();
    directPlayerHls = null;
  }

  const videoEl = document.getElementById('piratyDirectVideo');
  if (videoEl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
  }

  const statusEl = document.getElementById('directPlayerStatus');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && directPlayerModalEl && directPlayerModalEl.classList.contains('active')) {
    closeDirectPlayer();
  }
});

window.openDirectPlayer = openDirectPlayer;
window.closeDirectPlayer = closeDirectPlayer;
window.loadDirectStream = loadDirectStream;
window.openDirectPlayerModalForItem = openDirectPlayerModalForItem;
