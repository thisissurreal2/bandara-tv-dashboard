# PT Bandara Praniagatama — TV Dashboard Starter

This is a first visual prototype for a 16:9 office information screen.

## Files
- `index.html` — slide content and structure
- `style.css` — navy/blue aviation-inspired design
- `script.js` — clock, date and automatic slide rotation

## Run it locally
1. Extract the ZIP.
2. Open the folder in VS Code.
3. Install the **Live Server** extension, if you do not already have it.
4. Right-click `index.html` and select **Open with Live Server**.
5. Open the local address in your browser and press F11 for fullscreen.

## Current status
This is a visual prototype, not a live data product yet:
- Exchange-rate cards are placeholders; no live exchange-rate source is connected.
- News headlines are placeholders; no news feed is connected.
- The C-130H schedule is deliberately not included. Confirm with management what schedule information is approved for a display visible to visitors before adding any details.

## Before putting it on the TV
1. Test readability from across the room.
2. Confirm that each displayed data source is approved and reliable.
3. Host the dashboard on a company-approved web host so the TV can reach it.
4. Test the chosen signage player and browser compatibility on the exact TV model.
5. Avoid showing credentials, internal links, personal data or sensitive operational details.

## Slideshow timing
In `script.js`, change `SLIDE_DURATION_MS = 20000` to change the duration. For example, `30000` means 30 seconds per slide.
