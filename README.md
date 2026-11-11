# LENS 101 site

Public companion site for Kramer Gibson's freshman seminar at Berklee, *Engaging with the Artistic Space* (LENS 101, Fall 2026). Plain HTML + CSS, no build step, deployable to GitHub Pages as-is.

## Structure

```
lens101-site/
  index.html                      landing page
  assets/css/site.css             shared styles
  gallery/
  guides/
    procreate-stop-motion.html    Animation Assist guide, three embedded YouTube tutorials
```

Add new gallery pieces under `gallery/`, new guides under `guides/`, then link them from `index.html`.

## Run locally

Any static server works. From this folder:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy to GitHub Pages

1. Create a new GitHub repo, e.g. `lens101` under your account.
2. From this folder:
   ```
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin git@github.com:<your-user>/lens101.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**. Source: *Deploy from a branch*. Branch: `main`, folder: `/ (root)`. Save.
4. After a minute, the site is live at `https://<your-user>.github.io/lens101/`.

For a custom domain (e.g. `lens101.kramergibson.com`), add a `CNAME` file with the domain on a single line, then set the DNS CNAME record at your registrar to point at `<your-user>.github.io`.

## Design

Palette and tone borrow from the Belafonte itself: cream background, Zissou blue, deep navy, signal red. Helvetica Neue with widely spaced caps for headings. No bold weights, no em dashes. Light shadows, generous whitespace, big iframes.

## Notes for future sessions

- Drop new student work into `gallery/`, one folder per piece, one HTML page per piece.
- The Procreate guide is the template for other tool guides (Looom, Cavalry, Blender, TouchDesigner). Copy it, swap the videos, keep the three-step framing (tool tour → build-along → crit vocabulary) where it fits.
- The site is intentionally easy to hand-edit. If we move to a generator later, the content here lifts cleanly into Markdown.

## Explore: the die button and search (added 2026-11-11)

- `assets/js/explore.js` reads every tile off `index.html`, so a new tile is automatically in the dice pool and in search.
- The die button in the top bar rolls three dice (each face is a tile from the site, picks from three different chapters when it can), then opens the three as large cards. Escape, the X, or a click outside closes it.
- Search (hero box, the magnifier, or the `/` key) matches titles, tag lines, descriptions, and the extra words in `assets/js/search-tags.js`. It forgives small typos ("animaton") and shows which tag matched.
- When you add a tile, add a line to `search-tags.js` with the same `href` and a few dozen words a student might type instead of the tool's name ("cartoon" for an animation tool).
