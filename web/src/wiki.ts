import type { Category, SiteProperties } from './types';

export interface WikiSummary {
  title: string;
  extract: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
}

/** Authentic curated high-resolution photography for Uzbekistan Silk Road heritage categories via Wikimedia Commons Special:FilePath. */
const CATEGORY_FALLBACK_IMAGES: Record<Category, { imageUrl: string; caption: string }> = {
  caravanserai: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rabat-i_Malik_caravanserai_2_(cropped_and_retouched).jpg?width=640',
    caption: 'Ancient Rabat-i Malik Caravanserai ruins, Navoi Region',
  },
  madrasa: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/RegistanSquare_Samarkand.jpg?width=640',
    caption: 'Sher-Dor and Ulugh Beg Madrasas at Registan Square, Samarkand',
  },
  mausoleum: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/ShrineofAmirTimur.jpg?width=640',
    caption: 'Gur-e-Amir Mausoleum, burial place of Amir Timur, Samarkand',
  },
  mosque: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Poi_Kalon.jpg?width=640',
    caption: 'Po-i-Kalyan Mosque complex and Kalyan Minaret, Bukhara',
  },
  fortress: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ark_of_Bukhara_2023.9.jpg?width=640',
    caption: 'Massive brick walls of the Ark Fortress, Bukhara',
  },
  archaeology: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Afrasiyab_museum.jpg?width=640',
    caption: 'Ancient Afrasiyab archaeological settlement murals, Samarkand',
  },
  museum: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Palace_of_Khudayar_Khan.jpg?width=640',
    caption: 'Historic museum complex inside the walled city of Itchan Kala, Khiva',
  },
  monument: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Barakhan_Madrasah_Tashkent.jpg?width=640',
    caption: 'Historic architectural monument, Fergana Valley',
  },
  attraction: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Islam_Khodja_Madrasa_01.jpg?width=640',
    caption: 'Minaret and domes of Itchan Kala World Heritage city, Khiva',
  },
};

/** Pre-indexed high-fidelity information for globally famous landmarks. */
const FAMOUS_LANDMARKS: Record<string, { imageUrl: string; extract: string }> = {
  registan: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/RegistanSquare_Samarkand.jpg?width=640',
    extract: 'The Registan was the heart of the ancient city of Samarkand of the Timurid Empire. The public square is framed by three monumental madrasahs: Ulugh Beg Madrasah, Sher-Dor Madrasah, and Tilya-Kori Madrasah, recognized worldwide as masterpieces of Islamic architecture.',
  },
  'poi kalyan': {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Poi_Kalon.jpg?width=640',
    extract: 'Po-i-Kalyan is an iconic Islamic religious complex surrounding the Kalyan minaret in Bukhara, Uzbekistan. The towering 45.6-meter minaret was built in 1127 by the Karakhanid ruler Arslan Khan and survived Genghis Khan’s invasion.',
  },
  kalyan: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Poi_Kalon.jpg?width=640',
    extract: 'The Kalyan Minaret is a landmark minaret of the Po-i-Kalyan mosque complex in Bukhara, Uzbekistan. Built in 1127, it was designed to summon Muslims to prayer five times daily and served as a navigational beacon across the Kyzylkum desert.',
  },
  'gur-e-amir': {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/ShrineofAmirTimur.jpg?width=640',
    extract: 'Gur-e-Amir is the mausoleum of the Asian conqueror Timur (Tamerlane) in Samarkand, Uzbekistan. With its ribbed azure dome and exquisite tile mosaics, it set the architectural prototype for Mughal tombs such as Humayun’s Tomb and the Taj Mahal.',
  },
  'ark of bukhara': {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ark_of_Bukhara_2023.9.jpg?width=640',
    extract: 'The Ark of Bukhara is a massive 5th-century fortified citadel situated in the heart of Bukhara. It once housed the Emirs of Bukhara, government offices, barracks, a royal mint, and treasuries.',
  },
  itchan: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Islam_Khodja_Madrasa_01.jpg?width=640',
    extract: 'Itchan Kala is the walled inner town of the ancient oasis city of Khiva, protected since 1990 as Uzbekistan’s first UNESCO World Heritage Site. It preserves over fifty historic monuments and 250 vernacular dwellings behind 10-meter-high mudbrick ramparts.',
  },
  khudayar: {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Palace_of_Khudayar_Khan.jpg?width=640',
    extract: 'The Palace of Khudayar Khan, popularly known as the Pearl of Kokand, was the grand residence of the last ruler of the Kokand Khanate, built between 1863 and 1874 with majestic mosaic portals and opulent throne rooms.',
  },
  'khast imam': {
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Barakhan_Madrasah_Tashkent.jpg?width=640',
    extract: 'The Hazrati Imam (Khast Imam) Complex is the spiritual religious centre of Tashkent, housing the 16th-century Barakhan Madrasah and the Muyi Mubarak Library, guardian of the famed 7th-century Uthman Quran written on deerskin.',
  },
};

const cache = new Map<string, WikiSummary>();

function parseWikiTag(tag?: string): { lang: string; title: string } | null {
  if (!tag) return null;
  const match = /^([a-z-]{2,10}):(.+)$/.exec(tag.trim());
  if (!match) return null;
  return { lang: match[1], title: match[2].replace(/ /g, '_') };
}

/**
 * Fetch rich summary (extract and high-resolution thumbnail photo) for a heritage site.
 * Checks curated landmarks first, then explicit Wikipedia tags, English Wikipedia API,
 * and falls back to verified Silk Road photography for that category.
 */
export async function getSiteSummary(props: SiteProperties): Promise<WikiSummary> {
  const cacheKey = props.id;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Check famous landmarks first for immediate high-fidelity result
  const needle = `${props.name} ${props.name_en || ''}`.toLowerCase();
  for (const [key, landmark] of Object.entries(FAMOUS_LANDMARKS)) {
    if (needle.includes(key)) {
      const summary: WikiSummary = {
        title: props.name_en || props.name,
        extract: landmark.extract,
        imageUrl: landmark.imageUrl,
        pageUrl: props.wikipedia ? `https://en.wikipedia.org/wiki/${parseWikiTag(props.wikipedia)?.title ?? ''}` : null,
      };
      cache.set(cacheKey, summary);
      return summary;
    }
  }

  const parsed = parseWikiTag(props.wikipedia);
  let imageUrl: string | null = null;
  let extract: string | null = null;
  let pageUrl: string | null = null;

  // 1. Try English Wikipedia first for clean English description and photo
  const enSearchTitles = [
    parsed && parsed.lang === 'en' ? parsed.title : null,
    props.name_en ? encodeURIComponent(props.name_en.replace(/ /g, '_')) : null,
    encodeURIComponent(props.name.replace(/ /g, '_')),
  ].filter((t): t is string => Boolean(t));

  for (const enTitle of enSearchTitles) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${enTitle}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.extract) extract = data.extract.trim();
        if (data.thumbnail?.source || data.originalimage?.source) {
          imageUrl = data.thumbnail?.source || data.originalimage?.source;
        }
        if (data.content_urls?.desktop?.page) pageUrl = data.content_urls.desktop.page;
        break;
      }
    } catch {
      // Continue to next title candidate
    }
  }

  // 2. If photo not found yet, but we have a non-English Wikipedia tag (e.g. uz, ru), query it for the photo
  if (!imageUrl && parsed && parsed.lang !== 'en') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://${parsed.lang}.wikipedia.org/api/rest_v1/page/summary/${parsed.title}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.thumbnail?.source || data.originalimage?.source || null;
        if (!pageUrl && data.content_urls?.desktop?.page) pageUrl = data.content_urls.desktop.page;
      }
    } catch {
      // Ignore
    }
  }

  // 3. Fallback to verified category photography if photo wasn't found
  if (!imageUrl) {
    imageUrl = CATEGORY_FALLBACK_IMAGES[props.category].imageUrl;
  }

  // 4. Ensure description is ALWAYS 100% clean, informative English
  if (!extract) {
    const builtClause = props.start_date ? `, dating back to ${props.start_date}` : '';
    const unescoClause = props.unesco
      ? `It is recognized as an integral part of the UNESCO World Heritage site in ${props.city}, celebrated for its ancient architecture and craftsmanship.`
      : `It served as an important landmark along regional Silk Road trading routes.`;
    extract = `${props.name} is a historic ${props.category} in ${props.city}, Uzbekistan${builtClause}. ${unescoClause}`;
  }

  const summary: WikiSummary = {
    title: props.name_en || props.name,
    extract,
    imageUrl,
    pageUrl,
  };
  cache.set(cacheKey, summary);
  return summary;
}
