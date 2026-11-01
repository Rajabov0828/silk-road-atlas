import type { LngLat } from './types';

export interface StoryStop {
  city: string;
  position: LngLat;
  era: string;
  text: string;
  zoom: number;
}

/**
 * A caravan's journey across today's Uzbekistan, from the silk workshops of the
 * Fergana Valley to the last oasis before the Karakum desert.
 */
export const STORY: StoryStop[] = [
  {
    city: 'Margilan',
    position: [71.7247, 40.4711],
    era: 'Fergana Valley · silk',
    text: 'The journey starts where the silk is made. Margilan has woven silk for centuries and is still famous for khan-atlas ikat. Fergana horses and fabric went west from here.',
    zoom: 11,
  },
  {
    city: 'Kokand',
    position: [70.9425, 40.5286],
    era: 'Kokand Khanate · 18th–19th c.',
    text: 'Kokand was the capital of the Kokand Khanate. Caravans leaving the valley passed here on the way to the Kamchik pass and the plains beyond.',
    zoom: 12,
  },
  {
    city: 'Tashkent',
    position: [69.2797, 41.3111],
    era: 'Ancient Chach · crossroads',
    text: 'Known in early sources as Chach or Shash, Tashkent sat where steppe routes met the oasis road. The Khast Imam complex keeps one of the oldest Qurans in the world.',
    zoom: 11,
  },
  {
    city: 'Samarkand',
    position: [66.9757, 39.6548],
    era: 'Sogdian Marakanda · Timur’s capital',
    text: 'Sogdian merchants ran Silk Road trade from here, and Timur later made it his capital. The Registan’s three madrasas are part of the UNESCO site “Samarkand – Crossroad of Cultures”.',
    zoom: 13,
  },
  {
    city: 'Shahrisabz',
    position: [66.8342, 39.0578],
    era: 'Birthplace of Timur',
    text: 'Timur was born here. The ruins of his Ak-Saray palace are part of a UNESCO World Heritage site.',
    zoom: 13,
  },
  {
    city: 'Bukhara',
    position: [64.4286, 39.7747],
    era: 'Holy Bukhara · UNESCO 1993',
    text: 'Bukhara’s trading domes, madrasas and the 12th-century Kalyan minaret made it a major stop. Its historic centre has hundreds of protected monuments.',
    zoom: 13,
  },
  {
    city: 'Khiva',
    position: [60.3639, 41.3783],
    era: 'Itchan Kala · UNESCO 1990',
    text: 'The walled inner town of Khiva was the last big stop before the Karakum desert and the road to Persia. Caravans took on water and supplies here before the crossing.',
    zoom: 14,
  },
];
