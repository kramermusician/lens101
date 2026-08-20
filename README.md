# LENS 101 site

Public companion site for Kramer Gibson's freshman seminar at Berklee, *Engaging with the Artistic Space* (LENS 101, Fall 2026). Plain HTML + CSS, no build step, deployable to GitHub Pages as-is.

## Structure

```
lens101-site/
  index.html                      landing page
  assets/css/site.css             shared styles
  gallery/
    belafonte.html                framing page for the Three.js piece
    belafonte-aquatic/            the piece itself (its own index.html + vendor/)
  guides/
    procreate-stop-motion.html    Animation Assist guide, three embedded YouTube tutorials
```

Add new gallery pieces under `gallery/`, new guides under `guides/`, then link them from `index.html`.

## Run locally

Any static server works. From this folder:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Plain `file://` works for most of it but the Belafonte iframe loads cleaner over HTTP.)

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
