/**
 * Word list for random key generation
 */

// Common English words - easy to remember and type
const WORD_LIST = [
  // Nature words
  'lily', 'rose', 'tulip', 'iris', 'fern', 'moss', 'vine', 'tree', 'leaf', 'bloom',
  'daisy', 'ivy', 'oak', 'elm', 'ash', 'pine', 'reed', 'rush', 'herb', 'thyme',
  'mint', 'sage', 'basil', 'flax', 'hemp', 'jute', 'reed', 'cane', 'wheat', 'corn',

  // Animal words
  'cat', 'dog', 'bird', 'fish', 'bear', 'wolf', 'fox', 'hawk', 'owl', 'swan',
  'duck', 'goose', 'crane', 'heron', 'stork', 'crow', 'raven', 'dove', 'lark', 'wren',
  'finch', 'robin', 'swift', 'shark', 'whale', 'dolphin', 'otter', 'beaver', 'rabbit', 'hare',
  'mouse', 'rat', 'ferret', 'weasel', 'mink', 'sable', 'tiger', 'lion', 'leopard', 'cheetah',
  'panther', 'lynx', 'bobcat', 'coyote', 'jackal', 'hyena', 'badger', 'skunk', 'raccoon', 'opossum',

  // Color words
  'yellow', 'blue', 'red', 'green', 'purple', 'orange', 'pink', 'brown', 'black', 'white',
  'gray', 'silver', 'gold', 'bronze', 'crimson', 'scarlet', 'violet', 'indigo', 'azure', 'cyan',
  'magenta', 'amber', 'ochre', 'umber', 'sepia', 'pearl', 'ivory', 'ebony', 'jet', 'onyx',

  // Element words
  'stone', 'rock', 'sand', 'dust', 'clay', 'mud', 'earth', 'soil', 'dirt', 'gravel',
  'pebble', 'boulder', 'slate', 'marble', 'granite', 'quartz', 'flint', 'chalk', 'coal', 'iron',
  'steel', 'brass', 'copper', 'bronze', 'silver', 'golden', 'metal', 'alloy', 'rust', 'tarnish',

  // Sky and weather words
  'cloud', 'rain', 'snow', 'wind', 'storm', 'breeze', 'gale', 'mist', 'fog', 'haze',
  'frost', 'dew', 'ice', 'hail', 'sleet', 'thunder', 'lightning', 'rainbow', 'sunset', 'sunrise',
  'dawn', 'dusk', 'twilight', 'midnight', 'noon', 'midday', 'moon', 'sun', 'star', 'sky',

  // Water words
  'river', 'stream', 'brook', 'creek', 'lake', 'pond', 'pool', 'sea', 'ocean', 'wave',
  'tide', 'surf', 'spray', 'foam', 'bubble', 'ripple', 'splash', 'drip', 'drop', 'trickle',
  'flow', 'current', 'eddy', 'whirl', 'swirl', 'flood', 'deluge', 'torrent', 'cascade', 'waterfall',

  // Time words
  'moment', 'second', 'minute', 'hour', 'day', 'night', 'week', 'month', 'year', 'decade',
  'spring', 'summer', 'autumn', 'winter', 'season', 'past', 'present', 'future', 'history', 'tomorrow',

  // Movement words
  'walk', 'run', 'jump', 'hop', 'skip', 'leap', 'dance', 'spin', 'turn', 'twist',
  'fly', 'soar', 'glide', 'float', 'drift', 'swim', 'dive', 'plunge', 'sink', 'rise',
  'climb', 'fall', 'drop', 'roll', 'slide', 'slip', 'stumble', 'trip', 'stumble', 'catch'
];

/**
 * Generate a random key
 * @param {Object} options - Configuration options
 * @param {number} options.length - Length of the random part (default: 16)
 * @param {boolean} options.memorable - If true, generates a memorable word-based key
 * @returns {string} - A random key
 */
export function generateRandomKey(options = {}) {
  const { length = 16, memorable = false } = options;

  if (memorable) {
    // Generate memorable word-based key (3 words)
    const words = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * WORD_LIST.length);
      words.push(WORD_LIST[randomIndex]);
    }
    return words.join('-');
  }

  // Generate a random alphanumeric key
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

