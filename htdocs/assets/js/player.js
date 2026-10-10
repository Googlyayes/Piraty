/*
  PiraTY Player System
  Handles both movie and TV/anime players with server switching
  ============================================================
*/

// ==========================================================
// UNIFIED SERVER CONFIGURATION
// ==========================================================
// Movies, TV, and Anime all use a common player overlay,
// but each media type can have its own server list.
// Update the anime URL placeholders when you have real anime embed endpoints.
// ==========================================================

function trackPlayerEvent(name, params = {}) {
  if (typeof window.trackEvent === 'function') {
    window.trackEvent(name, params);
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

const SERVER_CONFIGS = {
  movie: [
    {
      name: "vidlink",
      buildUrl: ({ id }) => `https://vidlink.pro/movie/${id}`
    },
    {
      name: "Autoembed",
      buildUrl: ({ id }) => `https://player.autoembed.app/embed/movie/${id}`
    },
    {
      name: "vidsrc",
      buildUrl: ({ id }) => `https://vidsrc-embed.ru/embed/movie/${id}`
    },
    {
      name: "MULTI SERVER 3",
      buildUrl: ({ id }) => `https://www.2embed.cc/embed/${id}`
    },
    {
      name: "vixsrc",
      buildUrl: ({ id }) => `https://vixsrc.to/movie/${id}`
    },
    {
      name: "Vidsrc Premium",
      buildUrl: ({ id }) => `https://vidsrc.pm/embed/movie/${id}`
    },
    {
      name: "CinemaOS",
      code: "COS",
      buildUrl: ({ id }) => `https://cinemaos.tech/embed/movie/${id}`
    },
    {
      name: "VidLux",
      code: "LUX",
      buildUrl: ({ id }) => `https://vidlux.xyz/embed/movie/${id}`
    },
    {
      name: "Hexa",
      code: "HEXA",
      buildUrl: ({ id }) => `https://hexa.su/embed/movie/${id}`
    },
    {
      name: "Screenscape",
      code: "SCREEN",
      buildUrl: ({ id }) => `https://screenscape.me/embed?tmdb=${id}&type=movie&lan=eng`
    },
    {
      name: "TouStream",
      code: "TOU",
      buildUrl: ({ id }) => `https://toustream.xyz/tou/movies/${id}`
    },
    {
      name: "Cinezo",
      buildUrl: ({ id }) => `https://player.cinezo.live/embed/movie/${id}`
    },
    {
      name: "Multi Dub Server",
      buildUrl: ({ id }) => `https://peachify.top/embed/movie/${id}`
    },
    {
      name: "Vidking",
      buildUrl: ({ id }) => `https://www.vidking.net/embed/movie/${id}`
    },
    {
      name: "MULTI SERVER 1",
      buildUrl: ({ id }) => `https://vidcore.net/movie/${id}`
    },
    {
      name: "MULTI SERVER 2",
      buildUrl: ({ id }) => `https://111movies.net/movie/${id}`
    },
    {
      name: "SmashyStream",
      buildUrl: ({ id }) => `https://embed.smashystream.com/playere.php?tmdb=${id}`
    },
    {
      name: "Vidnest",
      buildUrl: ({ id }) => `https://vidnest.fun/movie/${id}?startAt=120&server=gama`
    },
    {
      name: "Vidfast",
      buildUrl: ({ id }) => `https://vidfast.pro/movie/${id}?theme=16A085&autoNext=true&nextButton=true`
    },
    {
      name: "Videasy",
      buildUrl: ({ id }) => `https://player.videasy.net/movie/${id}?color=8B5CF6&overlay=true&autoplayNextEpisode=true`
    },
    {
      name: "Vidstorm",
      buildUrl: ({ id }) => `https://vidstorm.ru/movie/${id}?autoplay=true&autonext=true&theme=ff6b6b&download=false`
    },
    {
      name: "Vidrock",
      buildUrl: ({ id }) => `https://vidrock.ru/movie/${id}?autoplay=true&autonext=true&download=true`
    },
    {
      name: "Vidzee",
      buildUrl: ({ id }) => `https://player.vidzee.wtf/embed/movie/${id}?server=1`
    },
    {
      name: "RiveStream",
      buildUrl: ({ id }) => `https://rivestream.org/embed?type=movie&id=${id}`
    },
    {
      name: "Vidsrc.wtf 1",
      buildUrl: ({ id }) => `https://www.vidsrc.wtf/1/movie/${id}?color=e01621`
    },
    {
      name: "Multi Dub Server 2",
      buildUrl: ({ id }) => `https://www.vidsrc.wtf/2/movie/${id}?color=e01621`
    },
    {
      name: "MULTI SERVER 4",
      buildUrl: ({ id }) => `https://www.vidsrc.wtf/3/movie/${id}?color=e01621`
    },
    {
      name: "MULTI SERVER 5",
      buildUrl: ({ id }) => `https://www.vidsrc.wtf/4/movie/${id}?color=e01621`
    }
  ],

  tv: [
    {
      name: "vidlink",
      buildUrl: ({ id, season, episode }) => `https://vidlink.pro/tv/${id}/${season}/${episode}`
    },
    {
      name: "Autoembed",
      buildUrl: ({ id, season, episode }) => `https://player.autoembed.app/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "vidsrc",
      buildUrl: ({ id, season, episode }) => `https://vidsrc-embed.ru/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "MULTI SERVER 3",
      buildUrl: ({ id, season, episode }) => `https://www.2embed.cc/embedtv/${id}/${season}/${episode}`
    },
    {
      name: "vixsrc",
      buildUrl: ({ id, season, episode }) => `https://vixsrc.to/tv/${id}/${season}/${episode}`
    },
    {
      name: "Vidsrc Premium",
      buildUrl: ({ id, season, episode }) => `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "CinemaOS",
      code: "COS",
      buildUrl: ({ id, season, episode }) => `https://cinemaos.tech/embed/tv/${id}?s=${season}&e=${episode}`
    },
    {
      name: "VidLux",
      code: "LUX",
      buildUrl: ({ id, season, episode }) => `https://vidlux.xyz/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Hexa",
      code: "HEXA",
      buildUrl: ({ id, season, episode }) => `https://hexa.su/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Screenscape",
      code: "SCREEN",
      buildUrl: ({ id, season, episode }) => `https://screenscape.me/embed?tmdb=${id}&type=tv&s=${season}&e=${episode}&lan=eng`
    },
    {
      name: "TouStream",
      code: "TOU",
      buildUrl: ({ id, season, episode }) => `https://toustream.xyz/tou/tv/${id}/${season}/${episode}`
    },
    {
      name: "Cinezo",
      buildUrl: ({ id, season, episode }) => `https://player.cinezo.live/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Multi Dub Server",
      buildUrl: ({ id, season, episode }) => `https://peachify.top/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Vidking",
      buildUrl: ({ id, season, episode }) => `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "MULTI SERVER 1",
      buildUrl: ({ id, season, episode }) => `https://vidcore.net/tv/${id}/${season}/${episode}`
    },
    {
      name: "MULTI SERVER 2",
      buildUrl: ({ id, season, episode }) => `https://111movies.net/tv/${id}/${season}/${episode}`
    },
    {
      name: "SmashyStream",
      buildUrl: ({ id, season, episode }) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${season}&episode=${episode}`
    },
    {
      name: "Vidnest",
      buildUrl: ({ id, season, episode }) => `https://vidnest.fun/tv/${id}/${season}/${episode}?startAt=120&server=gama`
    },
    {
      name: "Vidfast",
      buildUrl: ({ id, season, episode }) => `https://vidfast.pro/tv/${id}/${season}/${episode}?theme=16A085&autoNext=true&nextButton=true`
    },
    {
      name: "Videasy",
      buildUrl: ({ id, season, episode }) => `https://player.videasy.net/tv/${id}/${season}/${episode}?color=8B5CF6&overlay=true&autoplayNextEpisode=true`
    },
    {
      name: "Vidstorm",
      buildUrl: ({ id, season, episode }) => `https://vidstorm.ru/tv/${id}/${season}/${episode}?autoplay=true&autonext=true&theme=ff6b6b&download=false`
    },
    {
      name: "Vidrock",
      buildUrl: ({ id, season, episode }) => `https://vidrock.ru/tv/${id}/${season}/${episode}?autoplay=true&autonext=true&download=true`
    },
    {
      name: "Vidzee",
      buildUrl: ({ id, season, episode }) => `https://player.vidzee.wtf/embed/tv/${id}/${season}/${episode}?server=1`
    },
    {
      name: "RiveStream",
      buildUrl: ({ id, season, episode }) => `https://rivestream.org/embed?type=tv&id=${id}&season=${season}&episode=${episode}`
    },
    {
      name: "Vidsrc.wtf 1",
      buildUrl: ({ id, season, episode }) => `https://www.vidsrc.wtf/1/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "Multi Dub Server 2",
      buildUrl: ({ id, season, episode }) => `https://www.vidsrc.wtf/2/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "MULTI SERVER 4",
      buildUrl: ({ id, season, episode }) => `https://www.vidsrc.wtf/3/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "MULTI SERVER 5",
      buildUrl: ({ id, season, episode }) => `https://www.vidsrc.wtf/4/tv/${id}/${season}/${episode}?color=e01621`
    }
  ],

  anime: [
    {
      name: "vidlink",
      buildUrl: ({ id, season, episode }) =>
        `https://vidlink.pro/tv/${id}/${season}/${episode}`
    },
    {
      name: "autoembed",
      buildUrl: ({ id, season, episode }) =>
        `https://player.autoembed.app/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "vidsrc",
      buildUrl: ({ id, season, episode }) =>
        `https://vidsrc-embed.ru/embed/tv/${id}/${season}/${episode}`
    },
    
    {
      name: "MULTI SERVER 3",
      buildUrl: ({ id, season, episode }) =>
        `https://www.2embed.cc/embed/${id}?season=${season}&episode=${episode}`
    },
    
    {
      name: "vixsrc",
      buildUrl: ({ id, season, episode }) =>
        `https://vixsrc.to/tv/${id}?season=${season}&episode=${episode}`
    },
    {
      name: "ENG DUB vidsrc",
      buildUrl: ({ id, season, episode }) =>
        `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${season}&episode=${episode}&ds_lang=en`
    },
    {
      name: "Vidsrc Premium",
      buildUrl: ({ id, season, episode }) =>
        `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "CinemaOS",
      code: "COS",
      buildUrl: ({ id, season, episode }) =>
        `https://cinemaos.tech/embed/tv/${id}?s=${season}&e=${episode}`
    },
    {
      name: "VidLux",
      code: "LUX",
      buildUrl: ({ id, season, episode }) =>
        `https://vidlux.xyz/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Hexa",
      code: "HEXA",
      buildUrl: ({ id, season, episode }) =>
        `https://hexa.su/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Screenscape",
      code: "SCREEN",
      buildUrl: ({ id, season, episode }) =>
        `https://screenscape.me/embed?tmdb=${id}&type=tv&s=${season}&e=${episode}&lan=eng`
    },
    {
      name: "TouStream",
      code: "TOU",
      buildUrl: ({ id, season, episode }) =>
        `https://toustream.xyz/tou/tv/${id}/${season}/${episode}`
    },
    {
      name: "Cinezo",
      buildUrl: ({ id, season, episode }) =>
        `https://player.cinezo.live/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Multi Dub Server",
      buildUrl: ({ id, season, episode }) =>
        `https://peachify.top/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "Vidking",
      buildUrl: ({ id, season, episode }) =>
        `https://www.vidking.net/embed/tv/${id}/${season}/${episode}`
    },
    {
      name: "MULTI SERVER 1",
      buildUrl: ({ id, season, episode }) =>
        `https://vidcore.net/tv/${id}/${season}/${episode}`
    },
    {
      name: "MULTI SERVER 2",
      buildUrl: ({ id, season, episode }) =>
        `https://111movies.net/tv/${id}/${season}/${episode}`
    },
    {
      name: "SmashyStream",
      buildUrl: ({ id, season, episode }) =>
        `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${season}&episode=${episode}`
    },
    {
      name: "Vidnest",
      buildUrl: ({ id, season, episode }) =>
        `https://vidnest.fun/tv/${id}/${season}/${episode}?startAt=120&server=gama`
    },
    {
      name: "Vidfast",
      buildUrl: ({ id, season, episode }) =>
        `https://vidfast.pro/tv/${id}/${season}/${episode}?theme=16A085&autoNext=true&nextButton=true`
    },
    {
      name: "Videasy",
      buildUrl: ({ id, season, episode }) =>
        `https://player.videasy.net/tv/${id}/${season}/${episode}?color=8B5CF6&overlay=true&autoplayNextEpisode=true`
    },
    {
      name: "Vidstorm",
      buildUrl: ({ id, season, episode }) =>
        `https://vidstorm.ru/tv/${id}/${season}/${episode}?autoplay=true&autonext=true&theme=ff6b6b&download=false`
    },
    {
      name: "Vidrock",
      buildUrl: ({ id, season, episode }) =>
        `https://vidrock.ru/tv/${id}/${season}/${episode}?autoplay=true&autonext=true&download=true`
    },
    {
      name: "Vidzee",
      buildUrl: ({ id, season, episode }) =>
        `https://player.vidzee.wtf/embed/tv/${id}/${season}/${episode}?server=1`
    },
    {
      name: "RiveStream",
      buildUrl: ({ id, season, episode }) =>
        `https://rivestream.org/embed?type=tv&id=${id}&season=${season}&episode=${episode}`
    },
    {
      name: "Vidsrc.wtf 1",
      buildUrl: ({ id, season, episode }) =>
        `https://www.vidsrc.wtf/1/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "Multi Dub Server 2",
      buildUrl: ({ id, season, episode }) =>
        `https://www.vidsrc.wtf/2/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "MULTI SERVER 4",
      buildUrl: ({ id, season, episode }) =>
        `https://www.vidsrc.wtf/3/tv/${id}/${season}/${episode}?color=e01621`
    },
    {
      name: "MULTI SERVER 5",
      buildUrl: ({ id, season, episode }) =>
        `https://www.vidsrc.wtf/4/tv/${id}/${season}/${episode}?color=e01621`
    }
  ]
};

const DEFAULT_SERVER_NAME = "Vidsrc Premium";
const PLAYER_SERVER_LOAD_TIMEOUT = 12000;

function getDefaultServerIndex(type) {
  const servers = SERVER_CONFIGS[type] || [];
  const index = servers.findIndex(server => server.name === DEFAULT_SERVER_NAME);
  return index >= 0 ? index : 0;
}

function getPlayerServers() {
  return SERVER_CONFIGS[playerState.playerType] || [];
}

function getServerIndex(server) {
  return getPlayerServers().findIndex(candidate => candidate === server || candidate.name === server?.name);
}

function syncActiveServerButton() {
  document.querySelectorAll('.server-buttons .server-btn').forEach((button, index) => {
    button.classList.toggle('active', index === playerState.currentServer);
  });
}

// ==========================================================
// TV/ANIME SEASON & EPISODE DATA STRUCTURE
// ==========================================================
// Replace with real TMDb episode data
// Connect to TMDb API for dynamic episode lists
// Format: seasons[season_number].episodes[episode_index]
// ==========================================================

const showSeasons = {
  1: {
    episodes: [
      { number: 1, title: "Episode 1" },
      { number: 2, title: "Episode 2" },
      { number: 3, title: "Episode 3" },
      { number: 4, title: "Episode 4" },
      { number: 5, title: "Episode 5" },
      { number: 6, title: "Episode 6" },
      { number: 7, title: "Episode 7" },
      { number: 8, title: "Episode 8" },
      { number: 9, title: "Episode 9" },
      { number: 10, title: "Episode 10" },
      { number: 11, title: "Episode 11" },
      { number: 12, title: "Episode 12" }
    ]
  },
  2: {
    episodes: [
      { number: 1, title: "Episode 1" },
      { number: 2, title: "Episode 2" },
      { number: 3, title: "Episode 3" },
      { number: 4, title: "Episode 4" },
      { number: 5, title: "Episode 5" },
      { number: 6, title: "Episode 6" },
      { number: 7, title: "Episode 7" },
      { number: 8, title: "Episode 8" }
    ]
  }
};

const ABSOLUTE_EPISODE_NUMBERING_TMDB_IDS = new Set([
  // Add TMDb TV IDs here only when the UI should show absolute anime episode
  // numbers across seasons, such as EP 30 mapping to Season 2 Episode 6.
  220542  // The Apothecary Diaries
]);

const ANIME_METADATA_OVERRIDES = [
  {
    tmdbIds: [220542],
    titleIncludes: ["the apothecary diaries", "apothecary diaries", "kusuriya no hitorigoto"],
    episodeNumbering: "absolute"
  }
];

const ANIME_SEASON_SPLITS = [
  {
    tmdbIds: [65942],
    titleIncludes: ["re:zero", "re zero", "rezero", "starting life in another world"],
    seasons: [
      { season_number: 1, name: "Season 1", episode_count: 25, source_season: 1, episode_offset: 0, server_season: 1, server_episode_offset: 0 },
      { season_number: 2, name: "Season 2", episode_count: 25, source_season: 1, episode_offset: 25, server_season: 2, server_episode_offset: 0 },
      { season_number: 3, name: "Season 3", episode_count: 16, source_season: 1, episode_offset: 50, server_season: 3, server_episode_offset: 0 },
      { season_number: 4, name: "Season 4", episode_count: 19, source_season: 1, episode_offset: 66, server_season: 4, server_episode_offset: 0 }
    ]
  },
  {
    tmdbIds: [95479],
    titleIncludes: ["jujutsu kaisen"],
    seasons: [
      { season_number: 1, name: "Season 1", episode_count: 24, source_season: 1, episode_offset: 0, server_season: 1, server_episode_offset: 0 },
      { season_number: 2, name: "Season 2", episode_count: 23, source_season: 1, episode_offset: 24, server_season: 2, server_episode_offset: 0 },
      { season_number: 3, name: "Season 3", episode_count: 12, source_season: 1, episode_offset: 47, server_season: 3, server_episode_offset: 0 }
    ]
  },
  {
    tmdbIds: [209867],
    titleIncludes: ["frieren"],
    seasons: [
      { season_number: 1, name: "Season 1", episode_count: 28, source_season: 1, episode_offset: 0 },
      { season_number: 2, name: "Season 2", episode_count: 10, source_season: 1, episode_offset: 28 }
    ]
  },
  {
    titleIncludes: ["black lagoon"],
    seasons: [
      { season_number: 1, name: "Season 1", episode_count: 12, source_season: 1, episode_offset: 0, server_season: 1, server_episode_offset: 0 },
      { season_number: 2, name: "Season 2", episode_count: 12, source_season: 1, episode_offset: 12, server_season: 2, server_episode_offset: 0 }
    ]
  }
];

function getSeasonData(item) {
  if (!item) return showSeasons;

  if (item.seasons && typeof item.seasons === 'object') {
    return item.seasons;
  }

  if (Array.isArray(item.episodes)) {
    return { 1: { episodes: item.episodes } };
  }

  return showSeasons;
}

function normalizeSeasonOptions(seasons) {
  return (Array.isArray(seasons) ? seasons : [])
    .filter(season => Number.isInteger(season.season_number) && season.season_number > 0)
    .map(season => ({
      season_number: season.season_number,
      name: season.name || `Season ${season.season_number}`
    }));
}

function getInitialSeasonOptions(item) {
  const split = getAnimeSeasonSplit(item);
  if (split && Array.isArray(split.seasons) && split.seasons.length) {
    return normalizeSeasonOptions(split.seasons);
  }

  const seasons = getSeasonData(item);
  const seasonNumbers = Object.keys(seasons)
    .map(Number)
    .filter(n => n > 0)
    .sort((a, b) => a - b);

  const numbers = seasonNumbers.length ? seasonNumbers : [playerState.currentSeason || 1];
  return numbers.map(number => ({
    season_number: number,
    name: `Season ${number}`
  }));
}

function getAnimeSeasonSplit(item) {
  const tmdbId = Number(item?.tmdbId || item?.id || playerState.currentShowId);
  const title = normalizeAnimeTitle(item?.title || item?.name || playerState.currentTitle || '');

  return ANIME_SEASON_SPLITS.find(split =>
    split.tmdbIds?.includes(tmdbId) ||
    split.titleIncludes?.some(name => title.includes(normalizeAnimeTitle(name)))
  ) || null;
}

function getAnimeMetadataOverride(item) {
  const tmdbId = Number(item?.tmdbId || item?.id || playerState.currentShowId);
  const title = normalizeAnimeTitle(item?.title || item?.name || playerState.currentTitle || '');

  return ANIME_METADATA_OVERRIDES.find(override =>
    override.tmdbIds?.includes(tmdbId) ||
    override.titleIncludes?.some(name => title.includes(normalizeAnimeTitle(name)))
  ) || null;
}

function normalizeAnimeTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function getSplitSeasonOptions(split, sourceEpisodeCount = 0) {
  if (!split || !Array.isArray(split.seasons)) {
    return [];
  }

  return split.seasons
    .map(season => {
      const offset = Number(season.episode_offset || 0);
      const configuredCount = Number(season.episode_count || 0);
      const availableCount = sourceEpisodeCount > offset
        ? Math.min(configuredCount, sourceEpisodeCount - offset)
        : configuredCount;

      return {
        ...season,
        season_number: Number(season.season_number),
        episode_count: availableCount,
        source_season: Number(season.source_season || 1),
        episode_offset: offset,
        server_season: Number(season.server_season || season.season_number),
        server_episode_offset: Number(season.server_episode_offset || 0),
        name: season.name || `Season ${season.season_number}`
      };
    })
    .filter((season, index) => Number.isInteger(season.season_number) && season.season_number > 0 && (index === 0 || season.episode_count > 0));
}

async function getAnimeSplitSeasonOptions(item, tmdbSeasonList = []) {
  const split = getAnimeSeasonSplit(item);
  if (!split) {
    return [];
  }

  const sourceSeason = Number(split.seasons?.[0]?.source_season || 1);
  const sourceFromList = tmdbSeasonList.find(season => season.season_number === sourceSeason);
  let sourceEpisodeCount = Number(sourceFromList?.episode_count || 0);

  if (!sourceEpisodeCount) {
    const sourceEpisodes = await fetchTMDBSeasonEpisodes(item, sourceSeason);
    sourceEpisodeCount = Array.isArray(sourceEpisodes) ? sourceEpisodes.length : 0;
  }

  return getSplitSeasonOptions(split, sourceEpisodeCount);
}

async function fetchTMDBShowSeasons(item) {
  if (!item || !item.tmdbId || typeof tmdbFetch !== 'function' || !isTMDBConfigured()) {
    return null;
  }

  const showId = item.tmdbId;
  if (playerState.currentShowId === showId && Array.isArray(playerState.showSeasonCache.seasons)) {
    return playerState.showSeasonCache.seasons;
  }

  try {
    const show = await tmdbFetch(`/tv/${showId}?language=en-US`);
    console.log('Fetched TMDB show seasons for showId:', showId, show?.seasons);
    if (!show || !Array.isArray(show.seasons)) {
      return null;
    }

    const seasons = show.seasons.filter(s => s.season_number > 0);
    playerState.showSeasonCache.seasons = seasons;
    return seasons;
  } catch (error) {
    console.warn('Failed to fetch TMDB show seasons:', error);
    return null;
  }
}

async function fetchTMDBSeasonEpisodes(item, seasonNumber) {
  if (!item || !item.tmdbId || typeof tmdbFetch !== 'function' || !isTMDBConfigured()) {
    return null;
  }

  const showId = item.tmdbId;
  const currentShow = playerState.currentShowId === showId;
  if (currentShow && playerState.showSeasonCache.episodes[seasonNumber]) {
    return playerState.showSeasonCache.episodes[seasonNumber];
  }

  try {
    const seasonData = await tmdbFetch(`/tv/${showId}/season/${seasonNumber}?language=en-US`);
    if (!seasonData || !Array.isArray(seasonData.episodes)) {
      return null;
    }

    playerState.showSeasonCache.episodes[seasonNumber] = seasonData.episodes;
    return seasonData.episodes;
  } catch (error) {
    console.warn(`Failed to fetch TMDB season ${seasonNumber} episodes for showId ${showId}:`, error);
    return null;
  }
}

async function getShowSeasons(item) {

  const tmdbSeasons = await fetchTMDBShowSeasons(item);
  const tmdbSeasonList = Array.isArray(tmdbSeasons)
    ? tmdbSeasons.map(season => ({
        season_number: season.season_number,
        name: season.name || `Season ${season.season_number}`,
        episode_count: Number(season.episode_count || season.episodeCount || 0)
      }))
    : [];

  const splitSeasons = await getAnimeSplitSeasonOptions(item, tmdbSeasonList);
  if (splitSeasons.length > 0) {
    return splitSeasons;
  }

  if (tmdbSeasonList.length > 0) {
    return tmdbSeasonList;
  }

  const seasons = getSeasonData(item);
  return Object.keys(seasons)
    .map(key => Number(key))
    .filter(n => n > 0)
    .sort((a, b) => a - b)
    .map(number => ({
      season_number: number,
      name: `Season ${number}`,
      episode_count: Array.isArray(seasons[number]?.episodes) ? seasons[number].episodes.length : 0
    }));
}

async function getSeasonEpisodes(item, seasonNumber) {

  const splitSeason = (await getAnimeSplitSeasonOptions(item)).find(season => season.season_number === Number(seasonNumber));
  if (splitSeason) {
    const sourceEpisodes = await fetchTMDBSeasonEpisodes(item, splitSeason.source_season);
    if (Array.isArray(sourceEpisodes) && sourceEpisodes.length > 0) {
      return sourceEpisodes
        .slice(splitSeason.episode_offset, splitSeason.episode_offset + splitSeason.episode_count)
        .map((ep, index) => {
          const displayNumber = index + 1;
          return {
            number: displayNumber,
            sourceEpisode: splitSeason.episode_offset + displayNumber,
            title: ep.name || ep.title || `Episode ${displayNumber}`
          };
        });
    }

    return Array.from({ length: splitSeason.episode_count }, (_, index) => ({
      number: index + 1,
      sourceEpisode: splitSeason.episode_offset + index + 1,
      title: `Episode ${index + 1}`
    }));
  }

  const tmdbEpisodes = await fetchTMDBSeasonEpisodes(item, seasonNumber);
  if (Array.isArray(tmdbEpisodes) && tmdbEpisodes.length > 0) {
    const absoluteStart = shouldUseAbsoluteEpisodeNumbering(item)
      ? await getAbsoluteEpisodeStartForSeason(item, seasonNumber)
      : 0;

    return tmdbEpisodes.map(ep => {
      const episodeNumber = ep.episode_number || ep.number;
      const displayNumber = absoluteStart ? absoluteStart + episodeNumber - 1 : episodeNumber;

      return {
        number: displayNumber,
        tmdbEpisode: episodeNumber,
        title: ep.name || ep.title || `Episode ${displayNumber}`
      };
    });
  }

  const seasons = getSeasonData(item);
  return seasons[seasonNumber]?.episodes || [];
}

let currentShowId = null;
let currentEpisodeTitle = "";

function shouldUseAbsoluteEpisodeNumbering(item) {
  if (playerState.playerType !== 'anime') {
    return false;
  }

  const tmdbId = item?.tmdbId || item?.id || playerState.currentShowId;
  return ABSOLUTE_EPISODE_NUMBERING_TMDB_IDS.has(Number(tmdbId)) ||
    getAnimeMetadataOverride(item)?.episodeNumbering === 'absolute' ||
    item?.episodeNumbering === 'absolute' ||
    item?.useAbsoluteEpisodeNumbering === true;
}

function getCurrentPlayerSeasonForServer() {
  return playerState.serverSeason || playerState.currentSeason;
}

function getCurrentPlayerEpisodeForServer() {
  return playerState.serverEpisode || playerState.currentEpisode;
}

function mapAbsoluteEpisodeToSeasonEpisode(absoluteEpisode, seasons) {
  let remaining = Number(absoluteEpisode);
  if (!Number.isInteger(remaining) || remaining < 1 || !Array.isArray(seasons)) {
    return null;
  }

  for (const season of seasons) {
    const episodeCount = Number(season.episodeCount);
    const seasonNumber = Number(season.seasonNumber);
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeCount) || episodeCount < 1) {
      continue;
    }

    if (remaining <= episodeCount) {
      return {
        season: seasonNumber,
        episode: remaining
      };
    }

    remaining -= episodeCount;
  }

  return null;
}

function normalizeSeasonEpisodeCounts(seasons) {
  if (!Array.isArray(seasons)) return [];

  return seasons
    .map(season => ({
      seasonNumber: Number(season.seasonNumber || season.season_number),
      episodeCount: Number(season.episodeCount || season.episode_count || 0)
    }))
    .filter(season => Number.isInteger(season.seasonNumber) && season.seasonNumber > 0)
    .filter(season => Number.isInteger(season.episodeCount) && season.episodeCount > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

async function getSeasonEpisodeCounts(item) {
  const tmdbSeasons = await getShowSeasons(item);
  const normalized = normalizeSeasonEpisodeCounts(tmdbSeasons);
  if (normalized.length > 0) {
    return normalized;
  }

  const seasons = getSeasonData(item);
  return Object.keys(seasons)
    .map(key => Number(key))
    .filter(number => Number.isInteger(number) && number > 0)
    .sort((a, b) => a - b)
    .map(number => ({
      seasonNumber: number,
      episodeCount: Array.isArray(seasons[number]?.episodes) ? seasons[number].episodes.length : 0
    }))
    .filter(season => season.episodeCount > 0);
}

async function getAbsoluteEpisodeStartForSeason(item, seasonNumber) {
  const seasons = await getSeasonEpisodeCounts(item);
  const targetSeason = Number(seasonNumber);
  let start = 1;

  for (const season of seasons) {
    if (season.seasonNumber === targetSeason) {
      return start;
    }

    start += season.episodeCount;
  }

  return 0;
}

async function getFirstDisplayEpisodeForSeason(item, seasonNumber) {
  if (!shouldUseAbsoluteEpisodeNumbering(item)) {
    return 1;
  }

  return await getAbsoluteEpisodeStartForSeason(item, seasonNumber) || 1;
}

async function getDisplayEpisodeRangeForSeason(item, seasonNumber) {
  const start = await getFirstDisplayEpisodeForSeason(item, seasonNumber);
  const seasons = await getSeasonEpisodeCounts(item);
  const season = seasons.find(entry => entry.seasonNumber === Number(seasonNumber));
  if (!season) {
    return { min: start, max: start };
  }

  return {
    min: start,
    max: start + season.episodeCount - 1
  };
}

async function syncAnimeSeasonFromAbsoluteEpisode(item) {
  if (!shouldUseAbsoluteEpisodeNumbering(item)) {
    return;
  }

  const seasons = await getSeasonEpisodeCounts(item);
  const mapped = mapAbsoluteEpisodeToSeasonEpisode(playerState.currentEpisode, seasons);
  if (mapped) {
    playerState.currentSeason = mapped.season;
  }
}

async function syncSplitSeasonFromEpisode(item) {
  const splitSeasons = await getAnimeSplitSeasonOptions(item);
  if (splitSeasons.length === 0) {
    return;
  }

  const currentSeason = splitSeasons.find(season => season.season_number === Number(playerState.currentSeason));
  if (currentSeason && playerState.currentEpisode >= 1 && playerState.currentEpisode <= currentSeason.episode_count) {
    return;
  }

  const absoluteEpisode = Number(playerState.currentEpisode);
  const mappedSeason = splitSeasons.find(season =>
    absoluteEpisode > season.episode_offset &&
    absoluteEpisode <= season.episode_offset + season.episode_count
  );

  if (!mappedSeason) {
    playerState.currentEpisode = 1;
    return;
  }

  playerState.currentSeason = mappedSeason.season_number;
  playerState.currentEpisode = absoluteEpisode - mappedSeason.episode_offset;
}

async function updateServerEpisodeMapping(item) {
  playerState.serverSeason = playerState.currentSeason;
  playerState.serverEpisode = playerState.currentEpisode;
  playerState.absoluteEpisode = playerState.currentEpisode;

  const splitSeason = (await getAnimeSplitSeasonOptions(item)).find(season => season.season_number === Number(playerState.currentSeason));
  if (splitSeason) {
    playerState.serverSeason = splitSeason.server_season;
    playerState.serverEpisode = splitSeason.server_episode_offset + playerState.currentEpisode;
    playerState.absoluteEpisode = splitSeason.episode_offset + playerState.currentEpisode;
    return;
  }

  if (!shouldUseAbsoluteEpisodeNumbering(item)) {
    return;
  }

  const seasons = await getSeasonEpisodeCounts(item);
  const mapped = mapAbsoluteEpisodeToSeasonEpisode(playerState.currentEpisode, seasons);
  if (!mapped) {
    return;
  }

  playerState.serverSeason = mapped.season;
  playerState.serverEpisode = mapped.episode;
  playerState.absoluteEpisode = playerState.currentEpisode;
}

function getCurrentPlayerData() {
  const item = playerState.currentItem || {};
  const id = item.tmdbId || item.id || playerState.currentShowId;

  return {
    type: playerState.playerType,
    id,
    season: getCurrentPlayerSeasonForServer(),
    episode: getCurrentPlayerEpisodeForServer(),
    absoluteEpisode: playerState.absoluteEpisode || playerState.currentEpisode,
    title: playerState.currentTitle || item.title || item.name || currentEpisodeTitle || "Unknown"
  };
}

function isAnimeItem(item) {
  if (!item) return document.body?.dataset?.page === "anime";

  const rawType = String(`${item.type || ""} ${item.mediaType || ""} ${item.category || ""}`).toLowerCase();
  const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids.map(Number) : [];
  const isJapaneseAnimation = item.original_language === "ja" && genreIds.includes(16);
  const isJapaneseAnimatedShow = Array.isArray(item.origin_country) && item.origin_country.includes("JP") && genreIds.includes(16);

  return rawType.includes("anime") ||
    isJapaneseAnimation ||
    isJapaneseAnimatedShow ||
    document.body?.dataset?.page === "anime";
}

function resolvePlayerType(type, item) {
  const normalizedType = String(type || "").toLowerCase();
  if ((normalizedType === "tv" || normalizedType === "show" || normalizedType === "series") && isAnimeItem(item)) {
    return "anime";
  }

  return normalizedType;
}

async function updateAnimeIframe(tmdbId) {
  const server = (SERVER_CONFIGS[playerState.playerType] || [])[playerState.currentServer] || (SERVER_CONFIGS[playerState.playerType] || [])[0];
  if (!server) return;

  await updateServerEpisodeMapping(playerState.currentItem);

  const season = getCurrentPlayerSeasonForServer();
  const item = playerState.currentItem || {};
  const data = {
    type: playerState.playerType,
    id: tmdbId,
    season,
    episode: getCurrentPlayerEpisodeForServer(),
    absoluteEpisode: playerState.absoluteEpisode || playerState.currentEpisode,
    title: currentEpisodeTitle || playerState.currentTitle || item.title || 'Unknown'
  };

  setPlayerIframeSrc(server, data);
}

// ==========================================================
// PLAYER STATE
// ==========================================================

let playerState = {
  isOpen: false,
  playerType: null, // 'movie', 'tv', or 'anime'
  currentItem: null,
  currentServer: 0,
  currentSeason: 1,
  currentEpisode: 1,
  serverSeason: 1,
  serverEpisode: 1,
  absoluteEpisode: 1,
  currentTitle: '',
  currentShowId: null,
  attemptedServers: new Set(),
  serverLoadTimer: null,
  serverLoadToken: 0,
  lastPlayerData: null,
  lastContentKey: '',
  showSeasonCache: {
    seasons: null,
    episodes: {}
  }
};

function openPlayer({ type, id, season = 1, episode = 1, title = '', item = null }) {
  const resolvedType = resolvePlayerType(type, item);
  const servers = SERVER_CONFIGS[resolvedType];
  if (!servers || servers.length === 0) {
    console.error('No servers found for type:', resolvedType);
    return;
  }

  const existingOverlay = document.getElementById('piraty-player-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  playerState.isOpen = true;
  playerState.playerType = resolvedType;
  playerState.currentItem = item || { tmdbId: id, title };
  playerState.currentServer = getDefaultServerIndex(resolvedType);
  playerState.attemptedServers = new Set();
  playerState.lastPlayerData = null;
  playerState.lastContentKey = '';
  if (playerState.serverLoadTimer) {
    clearTimeout(playerState.serverLoadTimer);
    playerState.serverLoadTimer = null;
  }
  playerState.serverLoadToken++;
  playerState.currentSeason = season;
  playerState.currentEpisode = episode;
  playerState.serverSeason = season;
  playerState.serverEpisode = episode;
  playerState.absoluteEpisode = episode;
  playerState.currentTitle = title || '';
  playerState.currentShowId = (resolvedType === 'tv' || resolvedType === 'anime') ? (item?.tmdbId || id) : null;

  currentShowId = playerState.currentShowId;
  currentEpisodeTitle = item?.title || item?.name || title || '';

  playerState.showSeasonCache = { seasons: null, episodes: {} };

  if (resolvedType === 'movie') {
    renderMoviePlayer(playerState.currentItem);
  } else {
    renderShowPlayer(playerState.currentItem).catch(error => console.warn('Show player failed to render:', error));
  }

  disableBodyScroll();
}

function openMoviePlayer(item) {
  if (!item) {
    console.error('Movie player requires item data');
    return;
  }

  const id = item.tmdbId || item.id;
  if (!id) {
    console.error('Movie player requires TMDB ID or local item ID');
    return;
  }

  openPlayer({
    type: 'movie',
    id,
    title: item.title || item.name || '',
    item
  });
}

function openShowPlayer(item) {
  if (!item) {
    console.error('Show player requires item data');
    return;
  }

  const id = item.tmdbId || item.id;
  if (!id) {
    console.error('Show player requires TMDB ID or local item ID');
    return;
  }

  const type = isAnimeItem(item) ? 'anime' : 'tv';
  const season = item.selectedSeason || item.season || 1;
  const episode = item.selectedEpisode || item.episode || item.episodeNumber || 1;

  openPlayer({
    type,
    id,
    season,
    episode,
    title: item.title || item.name || '',
    item
  });
}

function openAnimePlayer(item) {
  if (!item) {
    console.error('Anime player requires item data');
    return;
  }

  const id = item.tmdbId || item.id;
  if (!id) {
    console.error('Anime player requires TMDB ID or local item ID');
    return;
  }

  openPlayer({
    type: 'anime',
    id,
    title: item.title || item.name || '',
    item
  });
}

window.openPlayer = openPlayer;
window.openMoviePlayer = openMoviePlayer;
window.openShowPlayer = openShowPlayer;
window.openAnimePlayer = openAnimePlayer;

function redirectToPiraTYMediaDownload() {
  const item = playerState.currentItem || null;
  const season = playerState.currentSeason || 1;
  const episode = playerState.currentEpisode || 1;

  if (typeof window.openPiraTYMediaDownload === 'function') {
    window.openPiraTYMediaDownload(item, season, episode)?.catch?.(error => console.warn('Failed to open download URL:', error));
    return;
  }

  const id = item?.tmdbId || item?.id;
  if (!id) {
    console.warn('Could not build media download URL because this item has no ID.');
    return;
  }
  const type = String(playerState.playerType || item?.type || item?.mediaType || '').toLowerCase();
  const url = type === 'tv' || type === 'show' || type === 'anime' || type === 'series'
    ? `https://vidvault.ru/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`
    : `https://vidvault.ru/movie/${encodeURIComponent(id)}`;
  window.location.href = url;
}
function renderMoviePlayer(item) {
  const html = `
    <div id="piraty-player-overlay" class="player-overlay movie-overlay">
      <div class="player-modal">
        <!-- Close Button -->
        <button class="player-close" aria-label="Close player">×</button>

        <!-- Player Container -->
        <div class="player-container">
          <p class="player-server-note">If current server doesn't work, please try other servers. If you get alot of popups or ads, consider using ad blocker or brave browser to get ad free experience. the website itself DOES NOT HAVE ANY ADS.</p>
          <div class="iframe-wrapper">
            <iframe 
              id="player-iframe"
              class="player-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy">
            </iframe>
          </div>
          <div class="player-download-row">
            <button class="server-btn player-download-btn" type="button" data-player-download>Download</button>
          </div>
        </div>

        <!-- Movie Info -->
        <div class="player-info">
          <h2>${escapeHtml(item.title || 'Unknown')}</h2>
        </div>

        <!-- Server Selection -->
        <div class="server-section">
          <h3>Select Server</h3>
          <div class="server-buttons" id="movie-server-buttons"></div>
        </div>

        <!-- Quality/Info Section -->
        <div class="quality-section">
          <span>📺 HD Quality</span>
          <span>🔒 Secure</span>
          <span>⚡ Fast</span>
        </div>
      </div>
    </div>
  `;

  let overlay = document.getElementById('piraty-player-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay = document.getElementById('piraty-player-overlay');
  } else {
    overlay.innerHTML = html;
  }

  overlay.classList.remove('hidden');
  overlay.querySelector('.player-close')?.addEventListener('click', closePlayer);
  overlay.querySelector('[data-player-download]')?.addEventListener('click', redirectToPiraTYMediaDownload);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePlayer();
  });

  const playerData = {
    type: 'movie',
    id: item.tmdbId || item.id,
    season: 1,
    episode: 1,
    title: item.title || 'Unknown'
  };

  renderServerButtons(SERVER_CONFIGS.movie, playerData, 'movie-server-buttons');
  setPlayerIframeSrc(SERVER_CONFIGS.movie[playerState.currentServer] || SERVER_CONFIGS.movie[0], playerData);
}

function loadMovieServers(item) {
  const container = document.getElementById('movie-server-buttons');
  if (!container) return;

  renderServerButtons(SERVER_CONFIGS.movie, {
    type: 'movie',
    id: item.tmdbId || item.id,
    season: 1,
    episode: 1,
    title: item.title || 'Unknown'
  }, 'movie-server-buttons');
}

function loadMovieServer(index, item) {
  const servers = SERVER_CONFIGS.movie;
  if (index >= servers.length) return;

  playerState.currentServer = index;
  const playerData = {
    type: 'movie',
    id: item.tmdbId || item.id,
    season: 1,
    episode: 1,
    title: item.title || 'Unknown'
  };

  setPlayerIframeSrc(servers[index], playerData);
}

function closePlayer() {
  const overlay = document.getElementById('piraty-player-overlay');
  if (overlay) {
    const iframe = document.getElementById('player-iframe');
    if (iframe) iframe.src = '';
    overlay.remove();
  }

  playerState.isOpen = false;
  playerState.playerType = null;
  playerState.currentItem = null;
  playerState.currentServer = 0;
  playerState.currentSeason = 1;
  playerState.currentEpisode = 1;
  playerState.serverSeason = 1;
  playerState.serverEpisode = 1;
  playerState.absoluteEpisode = 1;
  playerState.currentTitle = '';
  playerState.currentShowId = null;
  playerState.attemptedServers = new Set();
  playerState.lastPlayerData = null;
  playerState.lastContentKey = '';
  if (playerState.serverLoadTimer) {
    clearTimeout(playerState.serverLoadTimer);
    playerState.serverLoadTimer = null;
  }
  playerState.serverLoadToken++;
  playerState.showSeasonCache = { seasons: null, episodes: {} };
  enableBodyScroll();
}

function closeMoviePlayer() {
  closePlayer();
}

// ==========================================================
// TV/ANIME PLAYER FUNCTIONS
// ==========================================================

async function hydrateShowPlayerSeasons(item) {
  try {
    const overlay = document.getElementById('piraty-player-overlay');
    if (!overlay || playerState.currentItem !== item) return;

    const seasonOptions = normalizeSeasonOptions(await getShowSeasons(item));
    if (!seasonOptions.length) return;

    const seasonNumbers = seasonOptions.map(season => season.season_number);
    if (!seasonNumbers.includes(playerState.currentSeason)) {
      playerState.currentSeason = seasonNumbers[0] || 1;
      playerState.currentEpisode = 1;
    }

    const dropdown = overlay.querySelector('#season-dropdown');
    if (dropdown) {
      dropdown.innerHTML = seasonOptions
        .map(season => `<option value="${season.season_number}" ${Number(season.season_number) === playerState.currentSeason ? 'selected' : ''}>${escapeHtml(season.name)}</option>`)
        .join('');
    }

    await syncSplitSeasonFromEpisode(item);

    if (shouldUseAbsoluteEpisodeNumbering(item)) {
      await syncAnimeSeasonFromAbsoluteEpisode(item);

      const range = await getDisplayEpisodeRangeForSeason(item, playerState.currentSeason);
      if (playerState.currentEpisode < range.min || playerState.currentEpisode > range.max) {
        playerState.currentEpisode = range.min;
      }
    }

    syncManualEpisodeControls(playerState.currentSeason, playerState.currentEpisode);
    await renderEpisodeList(playerState.currentSeason, item);
    await updateServerEpisodeMapping(item);
    renderServerButtons(SERVER_CONFIGS[playerState.playerType], getCurrentPlayerData(), 'show-server-buttons');
    await updateAnimeIframe(item.tmdbId || item.id);
  } catch (error) {
    console.warn('Failed to hydrate show player seasons:', error);
  }
}

function renderShowPlayer(item) {
  let seasonOptions = getInitialSeasonOptions(item);
  let seasonNumbers = seasonOptions.map(season => season.season_number);

  if (!seasonNumbers.includes(playerState.currentSeason)) {
    playerState.currentSeason = seasonNumbers[0] || 1;
    playerState.currentEpisode = 1;
  }

  const html = `
    <div id="piraty-player-overlay" class="player-overlay show-overlay">
      <div class="player-modal show-modal">
        <!-- Close Button -->
        <button class="player-close" aria-label="Close player">×</button>

        <!-- Main Content Wrapper -->
        <div class="show-content-wrapper">
          <!-- Player Section -->
          <div class="show-player-section">
            <p class="player-server-note">If current server doesn't work, please try other servers. If you get alot of popups or ads, consider using ad blocker or brave browser to get ad free experience. the website itself DOES NOT HAVE ANY ADS.</p>
            <div class="iframe-wrapper">
              <iframe 
                id="player-iframe"
                class="player-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy">
              </iframe>
            </div>
            <div class="player-download-row">
              <button class="server-btn player-download-btn" type="button" data-player-download>Download</button>
            </div>

            <!-- Episode Info -->
            <div class="episode-info">
              <h2 id="episode-title">${escapeHtml(item.title || 'Unknown')}</h2>
              <p id="episode-meta">Season <span id="current-season">${playerState.currentSeason}</span> • Episode <span id="current-episode">${playerState.currentEpisode}</span></p>
            </div>

            <!-- Episode Navigation -->
            <div class="episode-nav">
              <button class="nav-btn prev-btn" id="prev-episode-btn" title="Previous episode">← Previous</button>
              <button class="nav-btn next-btn" id="next-episode-btn" title="Next episode">Next →</button>
            </div>

            <!-- Server Selection -->
            <div class="server-section show-server-section">
              <h3>Select Server</h3>
              <div class="server-buttons" id="show-server-buttons"></div>
            </div>
          </div>

          <!-- Sidebar with Season/Episode Selection -->
          <div class="show-sidebar">
            <!-- Manual Season/Episode Input -->
            <div class="manual-episode-selector" aria-label="Manual season and episode selector">
              <div class="manual-episode-grid">
                <label class="manual-episode-field" for="manual-season-input">
                  <span>Season</span>
                  <input id="manual-season-input" type="number" min="1" step="1" inputmode="numeric" value="${playerState.currentSeason}">
                </label>
                <label class="manual-episode-field" for="manual-episode-input">
                  <span>Episode</span>
                  <input id="manual-episode-input" type="number" min="1" step="1" inputmode="numeric" value="${playerState.currentEpisode}">
                </label>
              </div>
              <button class="manual-episode-load" id="manual-episode-load" type="button">Load Episode</button>
            </div>

            <!-- Season Selector -->
            <div class="season-selector">
              <label for="season-dropdown">Season:</label>
              <select id="season-dropdown">
                ${seasonOptions.map(season => `<option value="${season.season_number}" ${Number(season.season_number) === playerState.currentSeason ? 'selected' : ''}>${escapeHtml(season.name)}</option>`).join('')}
              </select>
            </div>

            <!-- Episode List -->
            <div class="episode-list" id="episode-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let overlay = document.getElementById('piraty-player-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay = document.getElementById('piraty-player-overlay');
  } else {
    overlay.innerHTML = html;
  }

  overlay.classList.remove('hidden');
  overlay.querySelector('.player-close')?.addEventListener('click', closePlayer);
  overlay.querySelector('[data-player-download]')?.addEventListener('click', redirectToPiraTYMediaDownload);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePlayer();
  });

  overlay.querySelector('#season-dropdown')?.addEventListener('change', (e) => {
    changeSeason(Number(e.target.value), item).catch(error => console.warn('Failed to change season:', error));
  });

  overlay.querySelector('#manual-episode-load')?.addEventListener('click', () => {
    loadManualEpisode(item).catch(error => console.warn('Failed to load manual episode:', error));
  });

  overlay.querySelectorAll('#manual-season-input, #manual-episode-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadManualEpisode(item).catch(error => console.warn('Failed to load manual episode:', error));
      }
    });
  });

  overlay.querySelector('#prev-episode-btn')?.addEventListener('click', () => previousEpisode(item));
  overlay.querySelector('#next-episode-btn')?.addEventListener('click', () => nextEpisode(item));

  renderServerButtons(SERVER_CONFIGS[playerState.playerType], getCurrentPlayerData(), 'show-server-buttons');
  updateAnimeIframe(item.tmdbId || item.id).catch(error => console.warn('Failed to load player iframe:', error));
  renderEpisodeList(playerState.currentSeason, item).catch(error => console.warn('Failed to render episode list:', error));
  hydrateShowPlayerSeasons(item);
}

function renderServerButtons(servers, data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  servers.forEach((server, index) => {
    const btn = document.createElement('button');
    btn.className = 'server-btn';
    btn.textContent = server.name;

    btn.onclick = async () => {
      playerState.currentServer = index;

      const currentData = {
        type: playerState.playerType,
        id: playerState.currentItem?.tmdbId || data.id,
        title: playerState.currentTitle || data.title,
        season: getCurrentPlayerSeasonForServer(),
        episode: getCurrentPlayerEpisodeForServer(),
        absoluteEpisode: playerState.absoluteEpisode || playerState.currentEpisode
      };

      await updateAnimeIframe(currentData.id);
      container.querySelectorAll('.server-btn').forEach(button => button.classList.remove('active'));
      btn.classList.add('active');
      trackPlayerEvent('server_changed', {
        title: currentData.title || 'unknown',
        type: currentData.type || 'unknown',
        server_name: server.name || 'unknown',
        season: currentData.season,
        episode: currentData.episode
      });
    };

    if (index === playerState.currentServer) {
      btn.classList.add('active');
    }

    container.appendChild(btn);
  });
}

function stripPlayerLanguageParams(url) {
  const blockedParams = [
    'lang',
    'language',
    'audio',
    'audio_lang',
    'audioLanguage',
    'subtitle',
    'sub',
    'dub',
    'ds_lang'
  ];

  try {
    const parsedUrl = new URL(url);
    blockedParams.forEach(param => parsedUrl.searchParams.delete(param));
    return parsedUrl.toString();
  } catch (error) {
    return blockedParams.reduce((cleanUrl, param) => {
      const pattern = new RegExp(`([?&])${param}=[^&#]*`, 'gi');
      return cleanUrl
        .replace(pattern, '$1')
        .replace(/[?&]$/, '')
        .replace('?&', '?');
    }, url);
  }
}

function versionPlayerUrl(url) {
  const version = window.PiraTYCache?.VERSION;
  if (!version) return url;

  try {
    const parsedUrl = new URL(url, window.location.href);
    parsedUrl.searchParams.set('piraty_v', version);
    return parsedUrl.toString();
  } catch (error) {
    const separator = String(url).includes('?') ? '&' : '?';
    return `${url}${separator}piraty_v=${encodeURIComponent(version)}`;
  }
}

function showPlayerUnavailableMessage() {
  const iframe = document.getElementById('player-iframe');
  const wrapper = document.querySelector('.iframe-wrapper');
  if (iframe) {
    iframe.src = 'about:blank';
    iframe.hidden = true;
  }
  if (!wrapper || wrapper.querySelector('.player-unavailable')) return;

  wrapper.insertAdjacentHTML(
    'beforeend',
    `<div class="player-unavailable" role="status">Sorry this is not available with us.</div>`
  );
}

function preparePlayerIframeForLoad() {
  const iframe = document.getElementById('player-iframe');
  const wrapper = document.querySelector('.iframe-wrapper');
  wrapper?.querySelector('.player-unavailable')?.remove();
  if (iframe) iframe.hidden = false;
  return iframe;
}

function tryNextPlayerServer(data, reason = 'load_failed') {
  const servers = getPlayerServers();
  if (!playerState.isOpen || !servers.length) return;

  let nextIndex = -1;
  for (let offset = 1; offset <= servers.length; offset++) {
    const candidateIndex = (playerState.currentServer + offset) % servers.length;
    if (!playerState.attemptedServers.has(candidateIndex)) {
      nextIndex = candidateIndex;
      break;
    }
  }
  if (nextIndex < 0) {
    showPlayerUnavailableMessage();
    trackPlayerEvent('all_servers_failed', {
      title: data?.title || 'unknown',
      type: data?.type || playerState.playerType || 'unknown',
      reason
    });
    return;
  }

  playerState.currentServer = nextIndex;
  syncActiveServerButton();
  setPlayerIframeSrc(servers[nextIndex], data);
}

function setPlayerIframeSrc(server, data) {
  const iframe = preparePlayerIframeForLoad();
  if (!iframe) return;

  const contentKey = [
    data?.type || playerState.playerType || '',
    data?.id || '',
    data?.season || '',
    data?.episode || '',
    data?.absoluteEpisode || ''
  ].join('|');
  if (contentKey !== playerState.lastContentKey) {
    playerState.attemptedServers = new Set();
    playerState.lastContentKey = contentKey;
  }

  const serverIndex = getServerIndex(server);
  if (serverIndex >= 0) {
    playerState.currentServer = serverIndex;
    playerState.attemptedServers.add(serverIndex);
    syncActiveServerButton();
  }
  playerState.lastPlayerData = data;
  playerState.serverLoadToken++;
  const loadToken = playerState.serverLoadToken;
  if (playerState.serverLoadTimer) clearTimeout(playerState.serverLoadTimer);

  const src = versionPlayerUrl(stripPlayerLanguageParams(server.buildUrl(data)));
  iframe.onload = () => {
    if (loadToken !== playerState.serverLoadToken) return;
    if (playerState.serverLoadTimer) {
      clearTimeout(playerState.serverLoadTimer);
      playerState.serverLoadTimer = null;
    }
    trackPlayerEvent('iframe_loaded', {
      title: data.title || 'unknown',
      type: data.type || 'unknown',
      server_name: server.name || 'unknown'
    });
  };
  iframe.onerror = () => {
    if (loadToken !== playerState.serverLoadToken) return;
    tryNextPlayerServer(data, 'iframe_error');
  };
  playerState.serverLoadTimer = window.setTimeout(() => {
    if (loadToken !== playerState.serverLoadToken) return;
    tryNextPlayerServer(data, 'iframe_timeout');
  }, PLAYER_SERVER_LOAD_TIMEOUT);
  iframe.src = src;

  if (typeof window.piratySaveContinueWatching === 'function') {
    const item = playerState.currentItem || {
      id: data.id,
      tmdbId: data.id,
      title: data.title,
      mediaType: data.type,
      type: data.type
    };
    window.piratySaveContinueWatching(item, {
      season: data.season || playerState.currentSeason || 1,
      episode: data.absoluteEpisode || data.episode || playerState.currentEpisode || 1,
      server: server.name || '',
      sourceUrl: src,
      type: data.type || playerState.playerType || ''
    }).catch?.(error => console.warn('Continue watching player sync failed:', error));
  }
}
async function changeSeason(season, item) {
  playerState.currentSeason = season;
  playerState.currentEpisode = await getFirstDisplayEpisodeForSeason(item, season);
  await renderEpisodeList(season, item);
  await loadEpisode(season, playerState.currentEpisode, item);
}

function readPositiveEpisodeInput(id, fallback) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function syncManualEpisodeControls(season, episode) {
  const seasonInput = document.getElementById('manual-season-input');
  const episodeInput = document.getElementById('manual-episode-input');
  const dropdown = document.getElementById('season-dropdown');

  if (seasonInput) seasonInput.value = season;
  if (episodeInput) episodeInput.value = episode;
  if (dropdown && Array.from(dropdown.options).some(option => Number(option.value) === Number(season))) {
    dropdown.value = String(season);
  }
}

async function loadManualEpisode(item) {
  const season = readPositiveEpisodeInput('manual-season-input', playerState.currentSeason || 1);
  const episode = readPositiveEpisodeInput('manual-episode-input', playerState.currentEpisode || 1);

  playerState.currentSeason = season;
  playerState.currentEpisode = episode;
  syncManualEpisodeControls(season, episode);
  await renderEpisodeList(season, item);
  await loadEpisode(season, episode, item);
}

async function loadEpisode(season, episode, item) {
  playerState.currentSeason = season;
  playerState.currentEpisode = episode;
  trackPlayerEvent('episode_selected', {
    title: item?.title || item?.name || playerState.currentTitle || 'unknown',
    type: playerState.playerType || item?.type || item?.mediaType || 'unknown',
    season,
    episode
  });

  currentShowId = item?.tmdbId || item?.id;
  currentEpisodeTitle = item?.title || item?.name || currentEpisodeTitle;

  const titleEl = document.getElementById('episode-title');
  const seasonEl = document.getElementById('current-season');
  const episodeEl = document.getElementById('current-episode');

  if (titleEl) titleEl.textContent = escapeHtml(item.title || 'Unknown');
  if (seasonEl) seasonEl.textContent = season;
  if (episodeEl) episodeEl.textContent = episode;
  syncManualEpisodeControls(season, episode);

  document.querySelectorAll('.episode-btn').forEach((btn) => {
    const btnEpText = btn.querySelector('.ep-number')?.textContent || '';
    const btnEp = parseInt(btnEpText.replace('EP ', ''), 10);
    btn.classList.toggle('active', btnEp === episode);
  });

  await updateAnimeIframe(item.tmdbId || item.id);
}

async function renderEpisodeList(season, item) {
  const episodes = await getSeasonEpisodes(item, season);
  const container = document.getElementById('episode-list');
  if (!container) return;

  const uniqueEpisodes = [];
  const seenNumbers = new Set();
  for (const ep of episodes) {
    if (!seenNumbers.has(ep.number)) {
      uniqueEpisodes.push(ep);
      seenNumbers.add(ep.number);
    }
  }

  container.innerHTML = '';
  uniqueEpisodes.forEach((episode) => {
    const btn = document.createElement('button');
    btn.className = `episode-btn ${episode.number === playerState.currentEpisode ? 'active' : ''}`;
    btn.innerHTML = `
      <span class="ep-number">EP ${episode.number}</span>
      <span class="ep-title">${escapeHtml(episode.title)}</span>
    `;
    btn.addEventListener('click', () => {
      loadEpisode(season, episode.number, item).catch(error => console.warn('Failed to load episode:', error));
    });
    container.appendChild(btn);
  });
}

async function nextEpisode(item) {
  const episodes = await getSeasonEpisodes(item, playerState.currentSeason);
  const maxEp = Math.max(...episodes.map(e => e.number), 1);

  if (playerState.currentEpisode < maxEp) {
    await loadEpisode(playerState.currentSeason, playerState.currentEpisode + 1, item);
    return;
  }

  const nextSeason = playerState.currentSeason + 1;
  const seasons = await getShowSeasons(item);
  const seasonNumbers = seasons.map(season => season.season_number);
  if (seasonNumbers.includes(nextSeason)) {
    await changeSeason(nextSeason, item);
  }
}

async function previousEpisode(item) {
  const episodes = await getSeasonEpisodes(item, playerState.currentSeason);
  const minEp = episodes.length ? Math.min(...episodes.map(e => e.number)) : 1;

  if (playerState.currentEpisode > minEp) {
    await loadEpisode(playerState.currentSeason, playerState.currentEpisode - 1, item);
    return;
  }

  const prevSeason = playerState.currentSeason - 1;
  if (prevSeason < 1) {
    return;
  }

  const seasons = await getShowSeasons(item);
  const seasonNumbers = seasons.map(season => season.season_number);
  if (!seasonNumbers.includes(prevSeason)) {
    return;
  }

  const prevSeasonEps = await getSeasonEpisodes(item, prevSeason);
  const maxEp = Math.max(...prevSeasonEps.map(e => e.number), 1);
  await changeSeason(prevSeason, item);
  await loadEpisode(prevSeason, maxEp, item);
}

// ==========================================================
// UTILITY FUNCTIONS
// ==========================================================

function disableBodyScroll() {
  document.body.style.overflow = 'hidden';
  // Also disable scrolling on html element
  document.documentElement.style.overflow = 'hidden';
}

function enableBodyScroll() {
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================================
// PLAYER INITIALIZATION - Hook into existing Play buttons
// ==========================================================

function initPlayerIntegration() {
  if (window.__piratyPlayerIntegrationReady) return;
  window.__piratyPlayerIntegrationReady = true;

  function itemFromPlayerDataset(el) {
    if (!el?.dataset) return null;

    const mediaType = el.dataset.mediaType || '';
    const type = el.dataset.type || el.dataset.cardType || mediaType || 'movie';
    const id = el.dataset.id || el.dataset.cardId || null;
    const tmdbId = el.dataset.tmdbId
      ? (Number.isNaN(Number(el.dataset.tmdbId)) ? el.dataset.tmdbId : Number(el.dataset.tmdbId))
      : null;
    const anilistId = el.dataset.anilistId
      ? (Number.isNaN(Number(el.dataset.anilistId)) ? el.dataset.anilistId : Number(el.dataset.anilistId))
      : null;
    const malId = el.dataset.malId
      ? (Number.isNaN(Number(el.dataset.malId)) ? el.dataset.malId : Number(el.dataset.malId))
      : null;

    return {
      id,
      tmdbId,
      anilistId,
      malId,
      mediaType,
      type,
      category: type,
      title: el.dataset.title || el.dataset.cardTitle || '',
      name: el.dataset.title || el.dataset.cardTitle || '',
      year: el.dataset.year || el.dataset.cardYear || '',
      rating: el.dataset.rating || el.dataset.cardRating || '',
      poster: el.dataset.poster || el.dataset.cardPoster || '',
      backdrop: el.dataset.backdrop || el.dataset.cardBackdrop || '',
      description: el.dataset.description || ''
    };
  }

  function itemFromPlayableId(id) {
    const match = String(id || '').match(/^tmdb-(movie|tv)-(\d+)$/i);
    if (!match) return null;

    const mediaType = match[1].toLowerCase();
    const tmdbId = Number(match[2]);
    return {
      id: String(id),
      tmdbId,
      mediaType,
      type: mediaType === 'tv' ? 'tv' : 'movie',
      category: mediaType === 'tv' ? 'TV Show' : 'Movie',
      title: '',
      name: '',
      year: 'N/A',
      rating: 'N/A',
      poster: '',
      backdrop: '',
      description: ''
    };
  }

  function resolvePlayItem(playBtn) {
    const hero = playBtn?.closest?.('[data-hero]');
    const clickedSlide = playBtn?.closest?.('[data-hero-slide]');
    const slide = hero?.querySelector?.('.hero-slide.active') || clickedSlide;
    const id =
      playBtn?.dataset?.play ||
      playBtn?.dataset?.cardPlay ||
      slide?.dataset?.id ||
      playBtn?.dataset?.heroPlay;

    const datasetEl = slide || playBtn.closest?.('.poster-card') || playBtn.closest?.('[data-card-id]');

    if (id && typeof findItem === 'function') {
      const found = findItem(id);
      if (found) return found;
    }

    const datasetItem = itemFromPlayerDataset(datasetEl);
    if (datasetItem?.tmdbId) return datasetItem;

    if (slide && typeof itemFromDataset === 'function') {
      const item = itemFromDataset(slide);
      if (item) return item;
    }

    if (datasetItem?.id || datasetItem?.tmdbId) return datasetItem;

    return itemFromPlayableId(id) || (id ? { id, title: '', type: 'movie', category: 'Movie' } : null);
  }

  function openInlinePlayer(item) {
    if (!item) return;

    const itemType = String(item.type || item.mediaType || item.category || 'movie').toLowerCase().trim();
    if (/\b(movie|film)\b/.test(itemType)) {
      openMoviePlayer(item);
      return;
    }

    if (/\b(tv|show|anime|series)\b/.test(itemType) || item.seasons || item.episodes || Object.prototype.hasOwnProperty.call(item, 'season')) {
      openShowPlayer(item);
      return;
    }

    openMoviePlayer(item);
  }

  document.addEventListener('click', async (e) => {
    const playBtn = e.target.closest?.('[data-play], [data-card-play], [data-hero-play]');
    if (!playBtn) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    let item = resolvePlayItem(playBtn);
    if (!item) {
      console.error('Playable item not found for button:', playBtn);
      return;
    }

    if ((item.anilistId || item.malId) && !item.tmdbId && typeof window.resolveAnimePlayableItem === 'function') {
      item = await window.resolveAnimePlayableItem(item);
      if (!item) {
        if (typeof toast === 'function') toast('Player source is unavailable for this anime');
        return;
      }
    }

    if (typeof window.trackPlayClick === 'function') {
      window.trackPlayClick(item, 'player');
    }

    openInlinePlayer(item);
  }, true);

  // Detail-page play buttons are rendered outside app.js card binding.
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-play]');
    if (!playBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const itemId = playBtn.dataset.play;
    if (!itemId) return;

    const item = findItem(itemId);
    if (!item) {
      console.error('Item not found:', itemId);
      return;
    }

    if (typeof window.trackPlayClick === 'function') {
      window.trackPlayClick(item, 'detail');
    } else if (typeof gtag === 'function') {
      gtag('event', 'play_clicked', {
        content_id: item.tmdbId || item.id || itemId,
        title: item.title || item.name || 'unknown',
        type: item.type || item.mediaType || item.category || 'unknown',
        source: 'detail'
      });
    }

    // Robust type detection: check multiple fields and common aliases
    const itemType = String(item.type || item.mediaType || item.category || 'movie').toLowerCase().trim();
    if (/\b(movie|film)\b/.test(itemType)) {
      openMoviePlayer(item);
    } else if (/\b(tv|show|anime|series)\b/.test(itemType)) {
      openShowPlayer(item);
    } else {
      // Fallback: if item has seasons/episodes metadata treat as show
      if (item.seasons || item.episodes || item.hasOwnProperty('season')) {
        openShowPlayer(item);
      } else {
        openMoviePlayer(item);
      }
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && playerState.isOpen) {
    closePlayer();
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlayerIntegration);
} else {
  initPlayerIntegration();
}
