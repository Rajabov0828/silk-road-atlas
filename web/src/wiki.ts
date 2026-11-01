import type { Category, SiteProperties } from './types';

export interface WikiSummary {
  title: string;
  extract: string | null;
  imageUrl: string | null;
  pageUrl: string | null;
}

/** Authentic curated high-resolution photography for Uzbekistan Silk Road heritage categories. */
const CATEGORY_FALLBACK_IMAGES: Record<Category, { imageUrl: string; caption: string }> = {
  caravanserai: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Rabat-i_Malik_caravanserai_2_%28cropped_and_retouched%29.jpg/640px-Rabat-i_Malik_caravanserai_2_%28cropped_and_retouched%29.jpg',
    caption: 'Ancient Rabat-i Malik Caravanserai ruins, Navoi Region',
  },
  madrasa: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/RegistanSquare_Samarkand.jpg/640px-RegistanSquare_Samarkand.jpg',
    caption: 'Sher-Dor and Ulugh Beg Madrasas at Registan Square, Samarkand',
  },
  mausoleum: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/ShrineofAmirTimur.jpg/640px-ShrineofAmirTimur.jpg',
    caption: 'Gur-e-Amir Mausoleum, burial place of Amir Timur, Samarkand',
  },
  mosque: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Poi_Kalon.jpg/640px-Poi_Kalon.jpg',
    caption: 'Po-i-Kalyan Mosque complex and Kalyan Minaret, Bukhara',
  },
  fortress: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Ark_of_Bukhara_2023.9.jpg/640px-Ark_of_Bukhara_2023.9.jpg',
    caption: 'Massive brick walls of the Ark Fortress, Bukhara',
  },
  archaeology: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Afrasiab_-_details_from_The_Ambassadors%27_Painting.JPG/640px-Afrasiab_-_details_from_The_Ambassadors%27_Painting.JPG',
    caption: 'Ancient Afrasiyab archaeological settlement murals, Samarkand',
  },
  museum: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Islam_Khodja_Madrasa_01.jpg/640px-Islam_Khodja_Madrasa_01.jpg',
    caption: 'Historic museum complex inside the walled city of Itchan Kala, Khiva',
  },
  monument: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/%D0%9A%D0%BE%D0%BA%D0%B0%D0%BD%D0%B4._%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%BE-%D0%90%D0%B7%D0%B8%D0%B0%D1%82%D1%81%D0%BA%D0%B8%D0%B9_%D0%B1%D0%B0%D0%BD%D0%BA_01.jpg/640px-%D0%9A%D0%BE%D0%BA%D0%B0%D0%BD%D0%B4._%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%BE-%D0%90%D0%B7%D0%B8%D0%B0%D1%82%D1%81%D0%BA%D0%B8%D0%B9_%D0%B1%D0%B0%D0%BD%D0%BA_01.jpg',
    caption: 'Historic architectural monument, Fergana Valley',
  },
  attraction: {
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Islam_Khodja_Madrasa_01.jpg/640px-Islam_Khodja_Madrasa_01.jpg',
    caption: 'Minaret and domes of Itchan Kala World Heritage city, Khiva',
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
 * Tries the explicit Wikipedia tag first, then site English name, and falls back to
 * authentic Silk Road photography for that category.
 */
export async function getSiteSummary(props: SiteProperties): Promise<WikiSummary> {
  const cacheKey = props.id;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
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

  // 3. Fallback to curated high-resolution photography if needed
  if (!imageUrl) {
    imageUrl = CATEGORY_FALLBACK_IMAGES[props.category].imageUrl;
  }

  // 4. Ensure description is ALWAYS 100% high-quality English
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
