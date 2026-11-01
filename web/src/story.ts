import type { LngLat } from './types';

export interface StoryStop {
  city: string;
  position: LngLat;
  era: string;
  text: string;
  zoom: number;
  imageUrl: string;
  imageCaption: string;
}

/**
 * A caravan's journey across today's Uzbekistan, from the silk workshops of the
 * Fergana Valley to the last oasis before the Karakum desert.
 */
export const STORY: StoryStop[] = [
  {
    city: 'Margilan',
    position: [71.7247, 40.4711],
    era: 'Fergana Valley · Silk Capital',
    text: 'The journey starts where the silk is made. Margilan has woven silk for centuries and is internationally celebrated for khan-atlas ikat. Celebrated Fergana horses and handmade fabrics journeyed west from here along ancient trails.',
    zoom: 11,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Khonakhan_Mosque,_Margilan_(496142).jpg?width=640',
    imageCaption: 'Historic Khonakhan Mosque & Silk Centre, Margilan',
  },
  {
    city: 'Kokand',
    position: [70.9425, 40.5286],
    era: 'Kokand Khanate · 18th–19th Century',
    text: 'Kokand was the grand capital of the Kokand Khanate. Caravans leaving the lush valley passed through its bustling bazaars on their way across the Kamchik Pass to the great plains beyond.',
    zoom: 12,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Palace_of_Khudayar_Khan.jpg?width=640',
    imageCaption: 'Palace of Khudayar Khan (Pearl of Kokand)',
  },
  {
    city: 'Tashkent',
    position: [69.2797, 41.3111],
    era: 'Ancient Chach · Eurasian Crossroads',
    text: 'Known in early chronicles as Chach or Shash, Tashkent commanded the crossroads where Eurasian nomadic steppe routes met the oasis caravan roads. The Hazrati Imam complex preserves one of the world’s oldest Qurans (the Uthman Quran).',
    zoom: 11,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Barakhan_Madrasah_Tashkent.jpg?width=640',
    imageCaption: 'Hazrati Imam Complex & Barakhan Madrasah, Tashkent',
  },
  {
    city: 'Samarkand',
    position: [66.9757, 39.6548],
    era: 'Sogdian Marakanda · Timur’s Capital',
    text: 'Sogdian merchants orchestrated transcontinental Silk Road trade from here for centuries, and Timur later crowned it the imperial capital. The iconic Registan square features three monumental madrasas inscribed as UNESCO World Heritage.',
    zoom: 13,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/RegistanSquare_Samarkand.jpg?width=640',
    imageCaption: 'Registan Square (Sher-Dor & Ulugh Beg Madrasas)',
  },
  {
    city: 'Shahrisabz',
    position: [66.8342, 39.0578],
    era: 'Birthplace of Timur · UNESCO Heritage',
    text: 'Amir Timur was born in this ancient city. The monumental turquoise mosaic towers of his Ak-Saray Palace and the Dorut Tilavat complex form part of a UNESCO World Heritage site.',
    zoom: 13,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kok_Gumbaz_Mosque_and_panorama_of_Shahrisabz_2026.jpg?width=640',
    imageCaption: 'Kok Gumbaz Mosque & Historic Centre of Shakhrisyabz',
  },
  {
    city: 'Bukhara',
    position: [64.4286, 39.7747],
    era: 'Noble Bukhara · UNESCO 1993',
    text: 'Bukhara’s vaulted multi-domed trading bazaars, hundreds of madrasas, and the majestic 12th-century Kalyan Minaret made it an intellectual and mercantile beacon of the Islamic world.',
    zoom: 13,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Poi_Kalon.jpg?width=640',
    imageCaption: 'Po-i-Kalyan Mosque Complex and Kalyan Minaret',
  },
  {
    city: 'Khiva',
    position: [60.3639, 41.3783],
    era: 'Itchan Kala · UNESCO 1990',
    text: 'The fairy-tale walled citadel of Itchan Kala was the last vital oasis before the vast Karakum desert and the route into Persia. Caravans refilled their waterskins and stocked supplies here before the perilous desert crossing.',
    zoom: 14,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Islam_Khodja_Madrasa_01.jpg?width=640',
    imageCaption: 'Islam Khodja Minaret & Itchan Kala Walled Oasis',
  },
];
