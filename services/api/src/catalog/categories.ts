/** Icons the storefront knows how to draw; a category picks one of these. */
export const CATEGORY_ICONS = [
  'cpu', 'radio', 'cog', 'battery', 'bot', 'wrench', 'printer', 'cable', 'package', 'box', 'zap', 'layers', 'plane',
  'lightbulb', 'monitor', 'shield',
] as const;

export interface CategorySeed {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  icon: string;
}

/** The starting shelf layout. Admins can rename, reorder, add and remove categories afterwards. */
export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    id: 'dev-boards',
    name: 'Dev Boards & MCUs',
    description: 'Microcontroller boards, single board computers and edge AI compute.',
    keywords: ['arduino', 'esp32*', 'raspberry pi', 'stm32*', 'pico', 'jetson', 'microcontroller', 'mcu', 'development board', 'devkit*', 'single board computer', 'flight controller', 'plc', 'edge ai', 'motherboard'],
    icon: 'cpu',
  },
  {
    id: 'sensors',
    name: 'Sensors & Modules',
    description: 'Sensors and sensing modules for distance, position, motion, vision and environment.',
    keywords: ['sensor', 'ultrasonic', 'lidar', 'gps', 'imu', 'camera', 'distance sensor', 'temperature sensor', 'gyroscope', 'accelerometer', 'laser scanner', 'grove'],
    icon: 'radio',
  },
  {
    id: 'motors',
    name: 'Motors & Drivers',
    description: 'DC, geared, stepper, servo and brushless motors with their drivers and ESCs.',
    keywords: ['motor', 'dc motor', 'gear motor', 'geared motor', 'stepper motor', 'servo', 'brushless motor', 'bldc', 'motor driver', 'esc', 'h-bridge', 'encoder', 'spindle', 'coreless'],
    icon: 'cog',
  },
  {
    id: 'power',
    name: 'Batteries & Power',
    description: 'Batteries, chargers and power supplies.',
    keywords: ['battery', 'lipo', 'li-ion', 'battery pack', 'charger', 'balance charger', 'power supply', 'smps', 'usb-c pd', 'gan', 'mah', 'voltage regulator'],
    icon: 'battery',
  },
  {
    id: 'mechanical',
    name: 'Robotics & Mechanical',
    description: 'Robot chassis, wheels, grippers, arms, belts, pulleys, gears and brackets.',
    keywords: ['robot chassis', 'car chassis', 'chassis', 'wheel', 'omni wheel', 'gripper', 'robotic arm', 'timing belt', 'pulley', 'gear', 'bracket', 'hexapod', 'robot platform', 'propeller', 'suspension'],
    icon: 'bot',
  },
  {
    id: 'accessories',
    name: 'Tools & Soldering',
    description: 'Soldering stations, multimeters and hand tools for the bench.',
    keywords: ['soldering', 'soldering station', 'multimeter', 'wire stripper', 'cutter tool', 'tweezers', 'esd safe', 'tool', 'bench'],
    icon: 'wrench',
  },
  {
    id: '3d-printing',
    name: '3D Printing & CNC',
    description: '3D printers, filament and resin, laser engravers and cutters, CNC machines and their accessories.',
    keywords: ['3d printer', '3d printing', 'resin printer', 'pla', 'petg', 'filament', 'laser engraver', 'laser cutter', 'cnc', 'cnc router', 'engraving', 'rotary roller', 'curing station', 'washing and curing', 'creality', 'bambu lab', 'atomstack', 'laser marking'],
    icon: 'printer',
  },
  {
    id: 'components',
    name: 'Components & Hardware',
    description: 'Passive components, LEDs, breadboards, jumper wires, switches and small interface boards.',
    keywords: ['resistor', 'led', 'capacitor', 'breadboard', 'jumper wires', 'push button', 'tactile switch', 'connector', 'usb to ttl', 'uart converter', 'amplifier board', 'trigger module', 'assortment kit'],
    icon: 'cable',
  },
  {
    id: 'diy-kits',
    name: 'DIY Kits',
    description: 'Starter, learning and project kits that bundle parts for a complete build.',
    keywords: ['starter kit', 'learning kit', 'learning suite', 'robot kit', 'robotics kit', 'stem education', 'project kit', 'inventor kit', 'creator kit', 'bundle'],
    icon: 'package',
  },
];

/** The text a category is embedded from; products are embedded from name and description the same way. */
export function categoryAnchorText(c: { name: string; description: string; keywords: string[] }): string {
  return `${c.name}\n${c.description}\n${c.keywords.join(', ')}`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A keyword matches at a word start and ends at a word end, with an optional plural "s".
 * A trailing "*" makes it a prefix ("stm32*" matches "stm32f103"). Multi-word keywords count
 * for more, so "robot chassis" beats a stray "motor" in the same title.
 */
function keywordScore(text: string, keywords: string[]): number {
  const lower = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const raw of keywords) {
    const prefix = raw.endsWith('*');
    const kw = (prefix ? raw.slice(0, -1) : raw).toLowerCase().trim();
    if (!kw) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}${prefix ? '' : 's?(?=[^a-z0-9]|$)'}`);
    if (re.test(lower)) score += kw.split(/\s+/).length;
  }
  return score;
}

export interface CategoryScore {
  categoryId: string;
  score: number;
  keywordHits: number;
  similarity: number | null;
}

/**
 * Hybrid shelf placement, mirroring the hybrid search: keyword hits from the category's own
 * definition (the title counts four times the description), plus the pgvector cosine similarity
 * between the product and the category's embedded description, which settles ties and covers
 * titles that name no keyword at all.
 */
export function scoreCategories(
  product: { name: string; description: string | null },
  categories: { id: string; keywords: string[] }[],
  similarity: Record<string, number>,
): CategoryScore[] {
  return categories
    .map((c) => {
      const titleHits = keywordScore(product.name, c.keywords);
      const descHits = keywordScore(product.description ?? '', c.keywords);
      const sim = similarity[c.id] ?? null;
      return {
        categoryId: c.id,
        keywordHits: titleHits,
        similarity: sim,
        score: titleHits + descHits * 0.25 + (sim ?? 0) * 2,
      };
    })
    .sort((a, b) => b.score - a.score);
}
