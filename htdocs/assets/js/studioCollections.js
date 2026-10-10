// Studio card navigation
// Collection card navigation
// URL filter handling
// TMDB company mapping
// Render filtered results

(function () {
  if (typeof window === 'undefined' || typeof DATA === 'undefined') return;

  const studioCompanyIds = {
    marvel: 420,
    pixar: 3,
    disney: 2,
    'warner-bros': 174,
    universal: 33,
    dreamworks: 521,
    paramount: 4,
    'columbia-pictures': 5,
    '20th-century-fox': 25,
    legendary: 923
  };

  const REAL_COLLECTIONS = Array.isArray(window.PIRATY_REAL_COLLECTIONS) ? window.PIRATY_REAL_COLLECTIONS : [];
  const collectionLookup = REAL_COLLECTIONS.reduce((acc, collection) => {
    if (collection.id) acc[collection.id] = collection;
    if (collection.slug) acc[collection.slug] = collection;
    return acc;
  }, {});

  const studioNameMap = DATA.studios.reduce((acc, studio) => {
    if (studio.id && studio.name) acc[studio.id] = studio.name;
    return acc;
  }, {});

  const collectionNameMap = DATA.collections.reduce((acc, collection) => {
    if (collection.id && collection.title) acc[collection.id] = collection.title;
    return acc;
  }, {});

  const studioFallbackItems = {
    marvel: [
      { id: 'marvel-power-arc', title: 'Power Arc', poster: 'assets/images/posters/void-runner.svg', rating: '8.1', year: '2024', type: 'movie', category: 'Movie' },
      { id: 'marvel-nova-strike', title: 'Nova Strike', poster: 'assets/images/posters/project-nova.svg', rating: '7.8', year: '2023', type: 'movie', category: 'Movie' },
      { id: 'marvel-sentinel-fall', title: 'Sentinel Fall', poster: 'assets/images/posters/red-signal.svg', rating: '8.0', year: '2025', type: 'movie', category: 'Movie' }
    ],
    pixar: [
      { id: 'pixar-night-garden', title: 'Night Garden', poster: 'assets/images/posters/glass-kingdom.svg', rating: '8.6', year: '2023', type: 'movie', category: 'Movie' },
      { id: 'pixar-lucky-star', title: 'Lucky Star', poster: 'assets/images/posters/void-runner.svg', rating: '8.2', year: '2022', type: 'movie', category: 'Movie' },
      { id: 'pixar-dreamyard', title: 'Dreamyard', poster: 'assets/images/posters/red-signal.svg', rating: '8.4', year: '2024', type: 'movie', category: 'Movie' }
    ],
    'walt-disney-pictures': [
      { id: 'disney-royal-trail', title: 'Royal Trail', poster: 'assets/images/posters/project-nova.svg', rating: '8.0', year: '2024', type: 'movie', category: 'Movie' },
      { id: 'disney-summer-spell', title: 'Summer Spell', poster: 'assets/images/posters/void-runner.svg', rating: '7.9', year: '2023', type: 'movie', category: 'Movie' }
    ],
    'warner-bros': [
      { id: 'warner-nightwatch', title: 'Nightwatch', poster: 'assets/images/posters/red-signal.svg', rating: '7.7', year: '2024', type: 'movie', category: 'Movie' },
      { id: 'warner-iron-queen', title: 'Iron Queen', poster: 'assets/images/posters/glass-kingdom.svg', rating: '8.0', year: '2025', type: 'movie', category: 'Movie' }
    ],
    universal: [
      { id: 'universal-deep-sea', title: 'Deep Sea', poster: 'assets/images/posters/project-nova.svg', rating: '7.6', year: '2023', type: 'movie', category: 'Movie' },
      { id: 'universal-night-run', title: 'Night Run', poster: 'assets/images/posters/void-runner.svg', rating: '7.4', year: '2024', type: 'movie', category: 'Movie' }
    ],
    dreamworks: [
      { id: 'dreamworks-forest-echo', title: 'Forest Echo', poster: 'assets/images/posters/glass-kingdom.svg', rating: '8.1', year: '2024', type: 'movie', category: 'Movie' },
      { id: 'dreamworks-iron-wind', title: 'Iron Wind', poster: 'assets/images/posters/red-signal.svg', rating: '7.9', year: '2023', type: 'movie', category: 'Movie' }
    ],
    paramount: [
      { id: 'paramount-legacy-code', title: 'Legacy Code', poster: 'assets/images/posters/project-nova.svg', rating: '7.8', year: '2024', type: 'movie', category: 'Movie' }
    ],
    'columbia-pictures': [
      { id: 'columbia-midnight-force', title: 'Midnight Force', poster: 'assets/images/posters/void-runner.svg', rating: '7.7', year: '2023', type: 'movie', category: 'Movie' }
    ],
    '20th-century-fox': [
      { id: 'fox-skybound', title: 'Skybound', poster: 'assets/images/posters/red-signal.svg', rating: '7.5', year: '2022', type: 'movie', category: 'Movie' }
    ],
    legendary: [
      { id: 'legendary-iron-giant', title: 'Iron Giant Returns', poster: 'assets/images/posters/glass-kingdom.svg', rating: '7.9', year: '2024', type: 'movie', category: 'Movie' }
    ]
  };

  function getCollectionDatum(slug) {
    return collectionLookup[slug] || null;
  }

  function isTMDBAvailable() {
    return typeof isTMDBConfigured === 'function' && isTMDBConfigured() && typeof tmdbFetch === 'function';
  }


  function normalizeFallbackItem(item) {
    return {
      id: item.id,
      title: item.title || 'Untitled',
      poster: item.poster || 'assets/images/posters/void-runner.svg',
      rating: item.rating || 'N/A',
      year: item.year || '2024',
      type: item.type || 'movie',
      category: item.category || 'Movie'
    };
  }

  async function fetchStudioItems(slug) {
    if (isTMDBAvailable() && studioCompanyIds[slug]) {
      try {
        const data = await tmdbFetch(`/discover/movie?with_companies=${studioCompanyIds[slug]}&language=en-US&page=1`);
        if (data && Array.isArray(data.results)) {
          return data.results.map(item => normalizeTMDBItem(item)).filter(Boolean);
        }
      } catch (error) {
        console.warn('TMDB studio filter failed:', error);
      }
    }
    return (studioFallbackItems[slug] || []).map(normalizeFallbackItem);
  }

  async function resolveCollectionTitle(title) {
    if (!isTMDBAvailable() || !title) return null;
    try {
      const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1&include_adult=false`);
      const result = (data?.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .find(item => {
          const resultTitle = item.title || item.name || '';
          return resultTitle.toLowerCase() === String(title).toLowerCase();
        }) || (data?.results || []).find(item => item.media_type === 'movie' || item.media_type === 'tv');
      const normalized = result ? normalizeTMDBItem(result) : null;
      if (!normalized) console.warn('Collection title could not be resolved:', title);
      return normalized;
    } catch (error) {
      console.warn('Collection title resolve failed:', title, error);
      return null;
    }
  }

  async function fetchCollectionItems(slug) {
    const collection = getCollectionDatum(slug);
    if (!collection) return [];
    const resolved = await Promise.all((collection.items || []).map(resolveCollectionTitle));
    return resolved.filter(Boolean);
  }

  function getFilterParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      studio: params.get('studio'),
      collection: params.get('collection')
    };
  }

  function renderNoResults(label) {
    return `
      <section class="panel">
        <div class="empty-state">
          <div>
            <h2>No results found</h2>
            <p>We could not find any content for ${escapeHtml(label)}.</p>
          </div>
        </div>
      </section>`;
  }

  function renderBrowseFilterPage({ heading, subtitle, items, heroOverride, backdrop }) {
    const heroItems = items.length ? items.slice(0, 5) : DATA.items.slice(6, 10);
    const heroHtml = hero(heroItems);

    const resultsHtml = items.length ? row('Filtered Results', items) : renderNoResults(subtitle || heading);

    return `
      ${heroHtml}
      ${resultsHtml}
      ${collectionsSection()}`;
  }



  function buildStudioHeading(slug) {
    const name = studioNameMap[slug] || slug.replace(/-/g, ' ');
    return {
      heading: `${name} Movies`,
      subtitle: `${name} studio releases and related results.`
    };
  }

  function buildCollectionHeading(slug) {
    const name = collectionNameMap[slug] || slug.replace(/-/g, ' ');
    return {
      heading: `${name} Collection`,
      subtitle: `${name} franchise and related titles.`
    };
  }

  if (typeof window.browsePage === 'function') {
    const originalBrowsePage = window.browsePage;
    window.browsePage = async function () {
      const { studio, collection } = getFilterParams();
      if (!studio && !collection) {
        return originalBrowsePage();
      }

      const targetSlug = studio || collection;
      const isStudio = Boolean(studio);

      // Collections: use mapping required by the task (hero + filled poster cards)
      if (!isStudio && collection) {
        const datum = getCollectionDatum(targetSlug);
        const heroBackdrop = datum?.image || '';
        const heading = datum?.title || buildCollectionHeading(targetSlug).heading;
        const subtitle = datum?.description || buildCollectionHeading(targetSlug).subtitle;
        const items = await fetchCollectionItems(targetSlug);

        return renderBrowseFilterPage({
          heading,
          subtitle,
          items,
          heroOverride: datum ? { heroTitle: datum.title, description: datum.description } : null,
          backdrop: heroBackdrop
        });
      }

      // Studios: keep existing behavior
      const itemLoader = isStudio ? fetchStudioItems : fetchCollectionItems;
      const headingData = isStudio ? buildStudioHeading(targetSlug) : buildCollectionHeading(targetSlug);
      const items = await itemLoader(targetSlug);

      return renderBrowseFilterPage({
        heading: headingData.heading,
        subtitle: headingData.subtitle,
        items
      });
    };
  }


  function attachCardLoadingState() {
    const cards = Array.from(document.querySelectorAll('.studio-card, .collection-card'));
    cards.forEach(card => {
      card.addEventListener('click', () => card.classList.add('card-loading'));
    });
  }

  document.addEventListener('DOMContentLoaded', attachCardLoadingState);
})();
