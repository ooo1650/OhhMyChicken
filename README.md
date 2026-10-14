# Ohh My Chicken! 🍕🍗

A single-page website for **Ohh My Chicken!**: giant pizzas up to 22", crispy fried chicken and MoMo.

It's a static site with no build step. You can open `index.html` directly, or serve the folder with any static host (Netlify, Vercel, GitHub Pages, cPanel…).

```bash
npx http-server -c-1 .   # then open http://localhost:8080
```

> Host it online before you print QR stickers. The QR code links to the page's own URL, so a `file://` or `localhost` link won't open on customers' phones.

## Features

| Area | What it does |
| --- | --- |
| **Hero** | Wavy SVG title that moves (animated `textPath`), a 22" pizza that slides and spins in, floating toppings with pointer parallax, and a delivery rider crossing the road (tap the road for an express run). |
| **Offer pop-up** | Shows after 3 s, once per browser session. "Tap to copy" copies the code and applies it to the cart. You can edit it in Admin. |
| **Size guide** | Interactive 12" / 15" / 18" / 22" picker that scales the pizza and compares areas. |
| **Menu** | Every menu category, with instant search (by name, description, type or category), category tabs, diet chips (Veg / Chicken / Buff / Pork), and a variant picker for size, Steam/Fried or Half/Full. |
| **QR tool** | Scannable QR code that opens the menu, with an optional table number (`#/menu?table=7`). Print a sheet of branded stickers or download a PNG. |
| **Cart** | Quantities, promo code (`OHH22` takes 15% off one 22" pizza, once per device), delivery fee with a free-delivery threshold, and checkout through a pre-filled WhatsApp message. |
| **Chatbot "Chicky"** | Built-in knowledge base covering greetings, opening hours with live open/closed status, size advice ("size for 12 people"), diet options, MoMo, prices for any dish (with add-to-cart buttons), delivery, ordering, deals and contact details. It reads the live menu, so Admin edits show up right away. |
| **Admin** (`#/admin` or footer 🔒) | Passcode gate. **Menu Manager**: live search by text, price (`650`), comparison (`<500`, `>=1000`) or range (`500-800`); category filter; sortable columns; add, edit, duplicate and delete items; availability and featured toggles; JSON import/export; reset. **Store & Promo**: phone, WhatsApp, address, hours, delivery settings, offer pop-up settings and passcode. **Orders**: KPIs, top sellers and recent orders. |

The default admin passcode is **`ohh2026`**. Change it under *Store & Promo*.

## Important notes

- **Prices are placeholders** (in NPR). Set real prices in Admin → Menu Manager, then use *Export JSON* to keep a backup.
- **Data is stored in the browser** (`localStorage`). Admin edits only show on the device and browser where they were made. To publish a menu for everyone, export the JSON and replace the defaults in `js/data.js`, or connect a backend or headless CMS.
- **The admin passcode is a convenience gate, not real security.** It runs entirely in the browser. Use server-side auth before storing anything sensitive.
- Update the phone, WhatsApp number and address in Admin (or in `js/data.js` → `SETTINGS`).

## Structure

```
index.html        markup for every view, modal and drawer
css/styles.css    brand tokens, fluid type (clamp), mobile-first layout
js/data.js        default menu, categories, sizes, settings
js/store.js       state, localStorage, pub/sub, cart & promo maths
js/ui.js          helpers, accessible modals (focus trap / Esc), toast, confirm
js/art.js         hand-built SVG pizza, rider, toppings, food icons
js/hero.js        GSAP intro, wavy title, floaters, rider, size guide, reveals
js/menu.js        customer menu, search & filters, add to cart
js/qr.js          QR generation, sticker printing, PNG export
js/cart.js        cart drawer, totals, WhatsApp checkout
js/chatbot.js     Chicky's intents & UI
js/admin.js       dashboard, menu CMS, settings, orders
js/app.js         hash router, settings → DOM, offer pop-up
```

Libraries (CDN): [GSAP 3.12.5](https://gsap.com) and [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator). If GSAP fails to load, the site falls back to CSS animations. It also respects `prefers-reduced-motion`.
