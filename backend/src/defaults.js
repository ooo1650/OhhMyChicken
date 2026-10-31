/* ==========================================================================
   Ohh My Chicken Pizza Hub — default menu + restaurant settings
   Factory defaults used to seed the database and by "Reset to defaults"
   in Admin. SIZES and CATEGORIES are also sent to the browser.
   The menu is the restaurant's printed menu (prices in NPR); edit it from Admin.
   ========================================================================== */
'use strict';

const SIZES = [
  { key: 'S',  label: '12" S'  },
  { key: 'M',  label: '15" M'  },
  { key: 'L',  label: '18" L'  },
  { key: 'XL', label: '22" XL' }
];

// icon: a symbol name from frontend/public/assets/icons.svg
// slug: URL of the category landing page (/menu/<slug>); seo/blurb: its
// search title and intro text. {city} is replaced with the store's city.
// Order = the order on the printed menu.
const CATEGORIES = [
  { id: 'nonveg',  name: 'Chicken Pizza',              short: 'Chicken Pizza', icon: 'cat-chicken-pizza', slug: 'chicken-pizza',
    seo: 'Chicken Pizza in {city}',
    blurb: 'Chicken BBQ, sausage, ham, bacon, salami, pepperoni, Hawaiian and tuna pizzas in 12", 15", 18" and our giant 22" XL.' },
  { id: 'porkbuff',name: 'Pork, Buff & Mix Pizza',     short: 'Pork & Buff',   icon: 'cat-pork-pizza', slug: 'pork-buff-pizza',
    seo: 'Pork & Buff Pizza in {city}',
    blurb: 'Pork BBQ, ham, bacon, pepperoni and Hawaiian pizzas, buff sausage and salami, and mixed-meat pizzas up to 22" XL.' },
  { id: 'veg',     name: 'Cheese & Veg Toppings Pizza', short: 'Veg Pizza',    icon: 'cat-veg-pizza', slug: 'veg-pizza',
    seo: 'Cheese & Veg Pizza in {city}',
    blurb: 'Cheese pizza and veg toppings: roasted garlic, mushroom, olive, pineapple, sweet corn, paneer, jalapeño and more, 12" to 22" XL.' },
  { id: 'special', name: 'OHH !!! MY CHICKEN',          short: 'Fried Chicken', icon: 'cat-fried-chicken', slug: 'fried-chicken',
    seo: 'Fried Chicken in {city}',
    blurb: 'Crispy fried chicken (full or half), chicken wings and hot wings.' },
  { id: 'momo',    name: 'MoMo, Fries & Add-ons',       short: 'MoMo & Fries',  icon: 'cat-momo', slug: 'momo',
    seo: 'MoMo & Fries in {city}',
    blurb: 'Steam or fried MoMo in veg, buff, chicken and pork, French fries, the veggie combo, and extra cheese or toppings for your pizza.' },
  { id: 'drinks',  name: 'Coffee, Tea & Drinks',        short: 'Drinks',        icon: 'cat-coffee', slug: 'drinks',
    seo: 'Coffee & Drinks in {city}',
    blurb: 'Espresso coffees, milk and lemon teas, iced coffees and frappes, plus soft drinks and water.' }
];

const PIZZA_CATEGORIES = ['nonveg', 'veg', 'porkbuff'];
const DIETS = ['veg', 'chicken', 'fish', 'buff', 'pork', 'mix'];

// The real menu of OHH !!! MY CHICKEN PIZZA HUB (prices in NPR).
// Pizza rows are [12" S, 15" M, 18" L, 22" XL].
const sizes = (s, m, l, xl) => SIZES.map((z, i) => ({ label: z.label, price: [s, m, l, xl][i] }));
const one = (label, price) => [{ label, price }];
// Built-in drawing for each dish (keys of the art catalogue in frontend/src/shared/food-art.js).
const ART = {
  'chicken-bbq-pizza': 'pizza-bbq', 'chicken-sausage-pizza': 'pizza-sausage', 'chicken-ham-pizza': 'pizza-ham', 'chicken-bacon-pizza': 'pizza-bacon',
  'chicken-salami-pizza': 'pizza-salami', 'smoky-chicken-pizza': 'pizza-smoky', 'chicken-pepperoni': 'pizza-pepperoni', 'chicken-lovers-pizza': 'pizza-lovers',
  'chicken-hawaiian': 'pizza-hawaiian', 'tuna-pizza': 'pizza-tuna', 'pork-bbq-pizza': 'pizza-bbq', 'ham-pizza': 'pizza-ham',
  'bacon-pizza': 'pizza-bacon', 'pork-pepperoni': 'pizza-pepperoni', 'pork-lovers-pizza': 'pizza-lovers', 'hawaiian-pizza': 'pizza-hawaiian',
  'buff-sausage-pizza': 'pizza-sausage', 'buff-salami-pizza': 'pizza-salami', 'smoky-buff-pizza': 'pizza-smoky', 'buff-lovers-pizza': 'pizza-lovers',
  'mix-non-veg-pizza': 'pizza-mix', 'mix-buff-pizza': 'pizza-mix', 'mix-chicken-pizza': 'pizza-mix', 'mix-pork-pizza': 'pizza-mix',
  'meat-lovers-pizza': 'pizza-meat-lovers', 'cheese-pizza': 'pizza-cheese', 'regular-veg-pizza': 'pizza-veg', 'roasted-garlic-pizza': 'pizza-garlic',
  'mushroom-pizza': 'pizza-mushroom', 'olive-pizza': 'pizza-olive', 'pineapple-pizza': 'pizza-pineapple', 'sweet-corn-pizza': 'pizza-corn',
  'paneer-pizza': 'pizza-paneer', 'jalapeno-pizza': 'pizza-jalapeno', 'mix-vegetable-pizza': 'pizza-veg-mix', 'veggie-lovers-pizza': 'pizza-veg-lovers',
  'crispy-fried-chicken': 'fried-chicken', 'chicken-wings': 'wings', 'hot-wings': 'hot-wings', 'veg-momo': 'momo-veg',
  'buff-momo': 'momo-buff', 'chicken-momo': 'momo-chicken', 'pork-momo': 'momo-pork', 'french-fries': 'fries',
  'french-fries-cheese': 'cheese-fries', 'veggie-combo': 'veggie-combo', 'extra-cheese': 'extra-cheese', 'extra-toppings': 'extra-toppings',
  'espresso': 'espresso', 'americano': 'americano', 'double-americano': 'double-americano', 'cappuccino': 'cappuccino',
  'double-cappuccino': 'double-cappuccino', 'cafe-latte': 'latte', 'latte-macchiato': 'latte-macchiato', 'honey-latte': 'honey-latte',
  'cafe-mocha': 'mocha', 'mocha-madness': 'mocha-madness', 'iced-espresso-shakerato': 'shakerato', 'iced-americano': 'iced-americano',
  'iced-cappuccino': 'iced-cappuccino', 'blended-mocha': 'blended-mocha', 'cafe-frappe': 'frappe', 'oreo-frappe': 'oreo-frappe',
  'milk-tea': 'milk-tea', 'black-tea': 'black-tea', 'lemon-tea': 'lemon-tea', 'hot-lemon': 'hot-lemon',
  'ginger-lemon-honey': 'ginger-lemon', 'apple-tea': 'apple-tea', 'peach-tea': 'peach-tea', 'hot-milk': 'hot-milk',
  'coke-fanta-sprite': 'soft-drinks', 'mineral-water': 'water'
};
// Drinks made at the counter don't travel; bottled ones do.
const BOTTLED = ['coke-fanta-sprite', 'mineral-water'];
function item(id, category, name, diet, prices, extra) {
  const noDelivery = category === 'drinks' && !BOTTLED.includes(id);
  return Object.assign({ id, category, name, diet, desc: '', prices, available: true, popular: false, noDelivery, art: ART[id] || '' }, extra);
}
const HOT = { popular: true }; // highlighted in red on the printed menu

const MENU = [
  // ---- Non-veg toppings pizza: chicken ----
  item('chicken-bbq-pizza',      'nonveg', 'Chicken BBQ Pizza',      'chicken', sizes(650, 800, 900, 1400)),
  item('chicken-sausage-pizza',  'nonveg', 'Chicken Sausage Pizza',  'chicken', sizes(700, 850, 950, 1450)),
  item('chicken-ham-pizza',      'nonveg', 'Chicken Ham Pizza',      'chicken', sizes(700, 850, 950, 1450)),
  item('chicken-bacon-pizza',    'nonveg', 'Chicken Bacon Pizza',    'chicken', sizes(700, 850, 950, 1450)),
  item('chicken-salami-pizza',   'nonveg', 'Chicken Salami Pizza',   'chicken', sizes(750, 900, 1000, 1500)),
  item('smoky-chicken-pizza',    'nonveg', 'Smoky Chicken Pizza',    'chicken', sizes(850, 1000, 1100, 2000)),
  item('chicken-pepperoni',      'nonveg', 'Chicken Pepperoni',      'chicken', sizes(850, 1000, 1100, 2000)),
  item('chicken-lovers-pizza',   'nonveg', 'Chicken Lovers Pizza',   'chicken', sizes(1000, 1150, 1250, 2250), HOT),
  item('chicken-hawaiian',       'nonveg', 'Chicken Hawaiian',       'chicken', sizes(870, 1050, 1200, 1820), HOT),
  item('tuna-pizza',             'nonveg', 'Tuna Pizza',             'fish',    sizes(650, 800, 900, 1400)),

  // ---- Non-veg toppings pizza: pork, buff, mix ----
  item('pork-bbq-pizza',         'porkbuff', 'Pork BBQ Pizza',       'pork', sizes(650, 800, 900, 1400)),
  item('ham-pizza',              'porkbuff', 'Ham Pizza',            'pork', sizes(750, 900, 1000, 1500)),
  item('bacon-pizza',            'porkbuff', 'Bacon Pizza',          'pork', sizes(750, 900, 1000, 1500)),
  item('pork-pepperoni',         'porkbuff', 'Pork Pepperoni',       'pork', sizes(850, 1000, 1100, 2000)),
  item('pork-lovers-pizza',      'porkbuff', 'Pork Lovers Pizza',    'pork', sizes(1000, 1150, 1250, 2250), HOT),
  item('hawaiian-pizza',         'porkbuff', 'Hawaiian Pizza',       'pork', sizes(870, 1050, 1200, 1820), HOT),
  item('buff-sausage-pizza',     'porkbuff', 'Buff Sausage Pizza',   'buff', sizes(650, 800, 900, 1400)),
  item('buff-salami-pizza',      'porkbuff', 'Buff Salami Pizza',    'buff', sizes(700, 850, 950, 1450)),
  item('smoky-buff-pizza',       'porkbuff', 'Smoky Buff Pizza',     'buff', sizes(700, 850, 950, 1450)),
  item('buff-lovers-pizza',      'porkbuff', 'Buff Lovers Pizza',    'buff', sizes(900, 1050, 1150, 2050), HOT),
  item('mix-non-veg-pizza',      'porkbuff', 'Mix Non Veg Pizza',    'mix',  sizes(850, 1000, 1100, 2000)),
  item('mix-buff-pizza',         'porkbuff', 'Mix Buff Pizza',       'buff', sizes(850, 1000, 1100, 2000)),
  item('mix-chicken-pizza',      'porkbuff', 'Mix Chicken Pizza',    'chicken', sizes(900, 1050, 1150, 2050)),
  item('mix-pork-pizza',         'porkbuff', 'Mix Pork Pizza',       'pork', sizes(900, 1050, 1150, 2050)),
  item('meat-lovers-pizza',      'porkbuff', 'Meat Lovers Pizza',    'mix',  sizes(1000, 1150, 1250, 2250), HOT),

  // ---- Cheese & veg toppings pizza ----
  item('cheese-pizza',           'veg', 'Cheese Pizza',              'veg', sizes(500, 650, 750, 1150)),
  item('regular-veg-pizza',      'veg', 'Regular Veg Pizza',         'veg', sizes(550, 700, 800, 1200)),
  item('roasted-garlic-pizza',   'veg', 'Roasted Garlic Pizza',      'veg', sizes(600, 750, 850, 1350)),
  item('mushroom-pizza',         'veg', 'Mushroom Pizza',            'veg', sizes(650, 800, 900, 1400)),
  item('olive-pizza',            'veg', 'Olive Pizza',               'veg', sizes(650, 800, 900, 1400)),
  item('pineapple-pizza',        'veg', 'Pineapple Pizza',           'veg', sizes(650, 800, 900, 1400)),
  item('sweet-corn-pizza',       'veg', 'Sweet Corn Pizza',          'veg', sizes(650, 800, 900, 1400)),
  item('paneer-pizza',           'veg', 'Paneer Pizza',              'veg', sizes(700, 850, 950, 1450)),
  item('jalapeno-pizza',         'veg', 'Jalapeno Pizza',            'veg', sizes(750, 900, 1000, 1500)),
  item('mix-vegetable-pizza',    'veg', 'Mix Vegetable Pizza',       'veg', sizes(850, 1000, 1100, 2000)),
  item('veggie-lovers-pizza',    'veg', 'Veggie Lovers Pizza',       'veg', sizes(1000, 1150, 1250, 2250), HOT),

  // ---- OHH !!! MY CHICKEN ----
  item('crispy-fried-chicken',   'special', 'Crispy Fried Chicken',  'chicken', [{ label: 'Half', price: 550 }, { label: 'Full', price: 1000 }], HOT),
  item('chicken-wings',          'special', 'Chicken Wings',         'chicken', one('6 pcs', 550)),
  item('hot-wings',              'special', 'Hot Wings',             'chicken', one('8 pcs', 500)),

  // ---- MoMo, fries & pizza add-ons ----
  item('veg-momo',               'momo', 'Veg Momo',                 'veg',     [{ label: 'Steam', price: 120 }, { label: 'Fried', price: 150 }]),
  item('buff-momo',              'momo', 'Buff Momo',                'buff',    [{ label: 'Steam', price: 160 }, { label: 'Fried', price: 190 }]),
  item('chicken-momo',           'momo', 'Chicken Momo',             'chicken', [{ label: 'Steam', price: 180 }, { label: 'Fried', price: 210 }]),
  item('pork-momo',              'momo', 'Pork Momo',                'pork',    [{ label: 'Steam', price: 180 }, { label: 'Fried', price: 210 }]),
  item('french-fries',           'momo', 'French Fries',             'veg', one('1 basket', 250)),
  item('french-fries-cheese',    'momo', 'French Fries with Cheese', 'veg', one('1 basket', 400)),
  item('veggie-combo',           'momo', 'Veggie Combo',             'veg', one('Regular', 300), { desc: 'Hash brown, smiley & French fries.' }),
  item('extra-cheese',           'momo', 'Extra Cheese (add-on)',    'veg', sizes(150, 200, 250, 450), { desc: 'Add to any pizza; priced by pizza size.' }),
  item('extra-toppings',         'momo', 'Extra Toppings (add-on)',  'mix', sizes(120, 170, 200, 300), { desc: 'Add to any pizza; priced by pizza size.' }),

  // ---- Coffee, tea & drinks ----
  item('espresso',               'drinks', 'Espresso',               'veg', [{ label: 'Single', price: 110 }, { label: 'Double', price: 140 }]),
  item('americano',              'drinks', 'Americano',              'veg', one('Regular', 130)),
  item('double-americano',       'drinks', 'Double Americano',       'veg', one('Regular', 170)),
  item('cappuccino',             'drinks', 'Cappuccino',             'veg', one('Regular', 150)),
  item('double-cappuccino',      'drinks', 'Double Cappuccino',      'veg', one('Regular', 180)),
  item('cafe-latte',             'drinks', 'Cafe Latte',             'veg', one('Regular', 150)),
  item('latte-macchiato',        'drinks', 'Latte Macchiato',        'veg', one('Regular', 160)),
  item('honey-latte',            'drinks', 'Honey Latte',            'veg', one('Regular', 180)),
  item('cafe-mocha',             'drinks', 'Cafe Mocha',             'veg', one('Regular', 190)),
  item('mocha-madness',          'drinks', 'Mocha Madness',          'veg', one('Regular', 230)),
  item('iced-espresso-shakerato','drinks', 'Iced Espresso Shakerato','veg', one('Regular', 190)),
  item('iced-americano',         'drinks', 'Iced Americano',         'veg', one('Regular', 200)),
  item('iced-cappuccino',        'drinks', 'Iced Cappuccino',        'veg', one('Regular', 220)),
  item('blended-mocha',          'drinks', 'Blended Mocha',          'veg', one('Regular', 250)),
  item('cafe-frappe',            'drinks', 'Cafe Frappe',            'veg', one('Regular', 250)),
  item('oreo-frappe',            'drinks', 'Oreo Frappe',            'veg', one('Regular', 280)),
  item('milk-tea',               'drinks', 'Milk Tea',               'veg', [{ label: 'Regular', price: 50 }, { label: 'Masala', price: 60 }]),
  item('black-tea',              'drinks', 'Black Tea',              'veg', [{ label: 'Regular', price: 40 }, { label: 'Masala', price: 50 }]),
  item('lemon-tea',              'drinks', 'Lemon Tea',              'veg', one('Regular', 50)),
  item('hot-lemon',              'drinks', 'Hot Lemon',              'veg', [{ label: 'Regular', price: 40 }, { label: 'With honey', price: 110 }]),
  item('ginger-lemon-honey',     'drinks', 'Ginger Lemon with Honey','veg', one('Regular', 120)),
  item('apple-tea',              'drinks', 'Apple Tea',              'veg', one('Regular', 90)),
  item('peach-tea',              'drinks', 'Peach Tea',              'veg', one('Regular', 90)),
  item('hot-milk',               'drinks', 'Hot Milk',               'veg', one('Regular', 60)),
  item('coke-fanta-sprite',      'drinks', 'Coke / Fanta / Sprite',  'veg', one('Regular', 80)),
  item('mineral-water',          'drinks', 'Mineral Water',          'veg', one('Bottle', 35))
];

const SETTINGS = {
  name: 'Ohh My Chicken Pizza Hub',
  // Main branch contact; each outlet below has its own.
  phone: '+977 984-1336695',
  whatsapp: '9779841103351',
  address: 'Jhamsikhel, Lalitpur',
  hoursOpen: '09:00',
  hoursClose: '21:00',
  // The outlet confirms the actual fee, so it isn't part of the order total.
  deliveryFeeMin: 0,
  deliveryFeeMax: 150,
  currency: 'Rs.',
  // Search engines & Google Business: structured address, map pin, services.
  street: '',
  city: 'Kathmandu', // page titles and search descriptions
  serviceArea: 'Kathmandu Valley & Pokhara', // what customers read on the pages
  region: 'Bagmati',
  postalCode: '',
  country: 'NP',
  currencyCode: 'NPR',
  lat: null,
  lng: null,
  mapsUrl: '',
  socialLinks: [],
  dineIn: true,
  takeaway: false,
  // Branches: shown in Find us; customers pick one when they order on WhatsApp.
  outlets: [
    {
      id: 'jhamsikhel', name: 'Jhamsikhel', area: 'Lalitpur', main: true, active: true,
      address: 'Jhamsikhel, Lalitpur',
      landmark: 'Opposite Vesper Cafe, on the left of the road from Pulchowk (Damkal Chowk) towards Jawalakhel.',
      phones: ['+977 984-1336695'], whatsapp: '9779841103351',
      delivery: 'Delivers across Lalitpur', hoursOpen: '', hoursClose: '',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ohh+My+Chicken+Pizza+Hub+Jhamsikhel+Lalitpur',
      lat: 27.6795, lng: 85.308, // approximate: Jhamsikhel road near Vesper Cafe
      instagram: 'https://www.instagram.com/ohh_mychicken_pizzahub/', facebook: ''
    },
    {
      id: 'maharajgunj', name: 'Maharajgunj', area: 'Kathmandu', main: false, active: true,
      address: 'Maharajgunj Sadak, Kathmandu 44600',
      landmark: 'Plus code P8QP+G78',
      phones: ['+977 986-0060005', '+977 984-1368821'], whatsapp: '9779709174249',
      delivery: 'Delivers in Kathmandu', hoursOpen: '', hoursClose: '',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=P8QP%2BG78+Kathmandu',
      lat: 27.7388, lng: 85.3355, // approximate: Maharajgunj
      instagram: '', facebook: ''
    },
    {
      id: 'bhaktapur', name: 'Bhaktapur', area: 'Radhe Radhe, Bhaktapur', main: false, active: true,
      address: 'Radhe Radhe, Bhaktapur',
      landmark: '',
      phones: ['+977 976-7319518', '+977 970-4835403'], whatsapp: '9779704835403',
      delivery: 'Home delivery in Bhaktapur', hoursOpen: '', hoursClose: '',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ohh+My+Chicken+Pizza+Hub+Radhe+Radhe+Bhaktapur',
      lat: 27.6787, lng: 85.4205, // approximate: Radhe Radhe chowk
      instagram: 'https://www.instagram.com/ohhmychickenpizzahub_bhaktapur/', facebook: ''
    },
    {
      // TODO(pokhara): the street address, landmark and neighbourhood (`area` is only the district for now).
      id: 'pokhara', name: 'Pokhara', area: 'Kaski', main: false, active: true,
      address: 'Pokhara',
      landmark: '',
      phones: ['+977 976-8046482', '+977 971-5073316'], whatsapp: '9779841103351',
      delivery: '', hoursOpen: '', hoursClose: '',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ohh+My+Chicken+Pizza+Hub+Pokhara',
      lat: null, lng: null, // outside the valley map: listed without a pin
      instagram: 'https://www.instagram.com/ohhmychickenpizzahubpokhara/', facebook: ''
    }
  ],
  promo: {
    enabled: true,
    popup: false, // the offer pop-up; the code works either way
    code: 'OHH22',
    percent: 15,
    headline: 'GET 15% OFF YOUR FIRST GIANT 22" PIZZA!',
    delaySec: 3
  }
};

module.exports = { SIZES, CATEGORIES, PIZZA_CATEGORIES, DIETS, MENU, SETTINGS };
