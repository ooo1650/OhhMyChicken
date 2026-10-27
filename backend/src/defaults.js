/* ==========================================================================
   Ohh My Chicken! — default menu + restaurant settings
   Factory defaults used to seed the database and by "Reset to defaults"
   in Admin. SIZES and CATEGORIES are also sent to the browser.
   NOTE: prices are placeholder values in NPR — update them from Admin.
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
const CATEGORIES = [
  { id: 'nonveg',  name: 'Non-Veg Toppings Pizza',     short: 'Chicken Pizza', icon: 'cat-chicken-pizza', slug: 'chicken-pizza',
    seo: 'Chicken Pizza in {city}',
    blurb: 'Chicken BBQ, sausage, ham, bacon and salami pizzas, stone-baked to order in 12", 15", 18" and our giant 22" XL.' },
  { id: 'veg',     name: 'Cheese & Veg Toppings Pizza', short: 'Veg Pizza',     icon: 'cat-veg-pizza', slug: 'veg-pizza',
    seo: 'Veg & Cheese Pizza in {city}',
    blurb: 'Vegetarian pizzas loaded with cheese, mushrooms, sweet corn, olives and peppers, made on a separate veg prep line.' },
  { id: 'porkbuff',name: 'Pork, Buff & Mix Pizza',      short: 'Pork & Buff',   icon: 'cat-pork-pizza', slug: 'pork-buff-pizza',
    seo: 'Pork & Buff Pizza in {city}',
    blurb: 'Pork, buff and mixed-meat pizzas for serious meat lovers, from a 12" for one to a 22" XL for the whole table.' },
  { id: 'special', name: 'OHH !!! MY CHICKEN Specials', short: 'Specials',      icon: 'cat-fried-chicken', slug: 'fried-chicken',
    seo: 'Fried Chicken & Wings in {city}',
    blurb: 'Crispy fried chicken, hot wings and chicken combos, the specials our restaurant is named after.' },
  { id: 'momo',    name: 'MoMo & Extras',               short: 'MoMo & Extras', icon: 'cat-momo', slug: 'momo',
    seo: 'MoMo, Fries & Drinks in {city}',
    blurb: 'Steam and fried MoMo in veg, buff, chicken and pork, plus fries, sides and cold drinks.' }
];

const PIZZA_CATEGORIES = ['nonveg', 'veg', 'porkbuff'];
const DIETS = ['veg', 'chicken', 'fish', 'buff', 'pork', 'mix'];

// Build S/M/L/XL price rows from a 12" base price.
function pizza(base) {
  const mult = [1, 1.55, 2.2, 3.2];
  return SIZES.map((s, i) => ({ label: s.label, price: Math.round((base * mult[i]) / 10) * 10 }));
}

let seq = 0;
function item(cat, name, diet, prices, desc, extra) {
  seq += 1;
  return Object.assign({
    id: 'm' + seq,
    category: cat,
    name,
    diet,          // veg | chicken | fish | buff | pork | mix
    desc: desc || '',
    prices,
    available: true,
    popular: false
  }, extra);
}

const MENU = [
  // 1. Non-Veg Toppings Pizza
  item('nonveg', 'Chicken BBQ',       'chicken', pizza(650), 'Smoky BBQ glaze, tender chicken chunks, onion & mozzarella.', { popular: true }),
  item('nonveg', 'Chicken Sausage',   'chicken', pizza(620), 'Juicy chicken sausage slices over a rich tomato base.'),
  item('nonveg', 'Chicken Ham',       'chicken', pizza(620), 'Classic chicken ham with stretchy mozzarella.'),
  item('nonveg', 'Chicken Bacon',     'chicken', pizza(680), 'Crispy chicken bacon strips & golden cheese.'),
  item('nonveg', 'Chicken Salami',    'chicken', pizza(640), 'Peppery chicken salami, oregano & mozzarella.'),
  item('nonveg', 'Smoky Chicken',     'chicken', pizza(660), 'Wood-smoked chicken with caramelised onion.'),
  item('nonveg', 'Chicken Pepperoni', 'chicken', pizza(680), 'Loaded with spicy chicken pepperoni cups.', { popular: true }),
  item('nonveg', 'Chicken Lovers',    'chicken', pizza(750), 'Every chicken topping we have. All of it.', { popular: true }),
  item('nonveg', 'Chicken Hawaiian',  'chicken', pizza(660), 'Chicken ham, sweet pineapple, mozzarella.'),
  item('nonveg', 'Tuna Pizza',        'fish',    pizza(700), 'Flaked tuna, onion, olives & sweet corn.'),

  // 2. Cheese & Veg Toppings Pizza
  item('veg', 'Cheese Pizza',   'veg', pizza(480), 'Triple mozzarella blend. Simple. Perfect.', { popular: true }),
  item('veg', 'Regular Veg',    'veg', pizza(520), 'Capsicum, onion, tomato & mozzarella.'),
  item('veg', 'Roasted Garlic', 'veg', pizza(540), 'Slow-roasted garlic cloves & herb butter.'),
  item('veg', 'Mushroom',       'veg', pizza(560), 'Sautéed button mushrooms & oregano.'),
  item('veg', 'Olive',          'veg', pizza(560), 'Black & green olives, mozzarella.'),
  item('veg', 'Pineapple',      'veg', pizza(540), 'Sweet pineapple chunks & cheese.'),
  item('veg', 'Sweet Corn',     'veg', pizza(540), 'Buttery sweet corn & mozzarella.'),
  item('veg', 'Paneer',         'veg', pizza(600), 'Spiced paneer cubes, onion & capsicum.'),
  item('veg', 'Jalapeno',       'veg', pizza(560), 'Fiery jalapeños for heat lovers.'),
  item('veg', 'Mix Vegetable',  'veg', pizza(580), 'A garden of fresh veggies.'),
  item('veg', 'Veggie Lovers',  'veg', pizza(640), 'Every veg topping, piled high.', { popular: true }),

  // 3. Pork, Buff & Mix Pizza
  item('porkbuff', 'Pork BBQ',       'pork', pizza(700), 'Pulled pork in smoky BBQ sauce.'),
  item('porkbuff', 'Ham',            'pork', pizza(660), 'Classic pork ham & mozzarella.'),
  item('porkbuff', 'Bacon',          'pork', pizza(720), 'Crispy pork bacon, lots of it.'),
  item('porkbuff', 'Pork Pepperoni', 'pork', pizza(720), 'Authentic pork pepperoni cups.'),
  item('porkbuff', 'Pork Lovers',    'pork', pizza(800), 'Ham, bacon, pepperoni & BBQ pork.'),
  item('porkbuff', 'Hawaiian',       'pork', pizza(680), 'Pork ham & pineapple — the classic.'),
  item('porkbuff', 'Buff Sausage',   'buff', pizza(620), 'Buff sausage slices & mozzarella.'),
  item('porkbuff', 'Buff Salami',    'buff', pizza(640), 'Spiced buff salami & oregano.'),
  item('porkbuff', 'Smoky Buff',     'buff', pizza(660), 'Smoked buff with onion & chilli.'),
  item('porkbuff', 'Buff Lovers',    'buff', pizza(760), 'Every buff topping on one pie.'),
  item('porkbuff', 'Mix Non-Veg',    'mix',  pizza(780), 'Chicken, buff & pork together.'),
  item('porkbuff', 'Mix Buff',       'buff', pizza(740), 'Buff sausage, salami & smoky buff.'),
  item('porkbuff', 'Mix Chicken',    'chicken', pizza(740), 'Chicken sausage, ham, salami & BBQ.'),
  item('porkbuff', 'Mix Pork',       'pork', pizza(780), 'Ham, bacon & pork pepperoni.'),
  item('porkbuff', 'Meat Lovers',    'mix',  pizza(850), 'The heaviest pizza we make. Bring friends.', { popular: true }),

  // 4. OHH !!! MY CHICKEN Specials
  item('special', 'Crispy Fried Chicken', 'chicken', [{ label: 'Half', price: 650 }, { label: 'Full', price: 1200 }], 'Our signature golden, crunchy, juicy fried chicken.', { popular: true }),
  item('special', 'Chicken Wings (6 pcs)', 'chicken', [{ label: '6 pcs', price: 450 }], 'Crispy wings tossed in house sauce.'),
  item('special', 'Hot Wings (8 pcs)',     'chicken', [{ label: '8 pcs', price: 580 }], 'Fiery hot wings. Milk on standby.', { popular: true }),

  // 5. MoMo & Extras
  item('momo', 'Veg MoMo',     'veg',     [{ label: 'Steam', price: 160 }, { label: 'Fried', price: 190 }], 'Ten handmade dumplings with achar.'),
  item('momo', 'Buff MoMo',    'buff',    [{ label: 'Steam', price: 190 }, { label: 'Fried', price: 220 }], 'Ten juicy buff dumplings with achar.', { popular: true }),
  item('momo', 'Chicken MoMo', 'chicken', [{ label: 'Steam', price: 200 }, { label: 'Fried', price: 230 }], 'Ten chicken dumplings with achar.'),
  item('momo', 'Pork MoMo',    'pork',    [{ label: 'Steam', price: 220 }, { label: 'Fried', price: 250 }], 'Ten pork dumplings with achar.'),
  item('momo', 'French Fries',  'veg', [{ label: 'Regular', price: 220 }], 'Golden, salted, crispy.'),
  item('momo', 'Cheese Fries',  'veg', [{ label: 'Regular', price: 320 }], 'Fries drowned in melted cheese.'),
  item('momo', 'Veggie Combo',  'veg', [{ label: 'Combo', price: 380 }], 'Fries, veg momo & a dip.'),
  item('momo', 'Cold Drinks',   'veg', [{ label: '500 ml', price: 90 }, { label: '1.5 L', price: 220 }], 'Coke, Fanta, Sprite & more.')
];

const SETTINGS = {
  name: 'Ohh My Chicken!',
  phone: '+977 9800000000',
  whatsapp: '9779800000000',
  address: 'Kathmandu, Nepal',
  hoursOpen: '10:00',
  hoursClose: '22:00',
  deliveryMins: 35,
  deliveryFee: 100,
  freeDeliveryOver: 2000,
  currency: 'Rs.',
  // Search engines & Google Business: structured address, map pin, services.
  street: '',
  city: 'Kathmandu',
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
  promo: {
    enabled: true,
    code: 'OHH22',
    percent: 15,
    headline: 'GET 15% OFF YOUR FIRST GIANT 22" PIZZA!',
    delaySec: 3
  }
};

const DEFAULT_PASSCODE = 'ohh2026';

module.exports = { SIZES, CATEGORIES, PIZZA_CATEGORIES, DIETS, MENU, SETTINGS, DEFAULT_PASSCODE };
