# Pantone: Beyond the Color

Microsite for **The Pantone Color of the Year 2027 Experience: Beyond the Color**, Thursday, December 3, 2026, Miami.

A static, four-scene site (no build step): the flyer photograph acts as a camera that moves into the glass box and back out as you scroll, with an RSVP sheet.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup for the four scenes and the RSVP sheet |
| `styles.css` | All styling, motion and responsive rules |
| `app.js` | Camera, scroll glide, reveals, island nav, scrollbar, programming chips, countdown, RSVP flow |
| `flyer.webp` / `flyer-soft.webp` | Flyer photo and its blurred "inside the glass" layer (phones) |
| `flyer-fade.webp` / `flyer-soft-fade.webp` | Same, with the left-edge fade baked in (desktop) |
| `favicon.svg` | Tab icon |

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (default branch `main`).
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which publishes only the site files.

All asset paths are relative, so the site works from a project URL such as `https://<user>.github.io/<repo>/`.

## Notes

- The RSVP flow is a demo: no texts are sent and nothing is recorded. Any number works; the code is `1234`.
- The countdown targets 11:00 AM EST on December 3, 2026.
- Respects `prefers-reduced-motion` and `prefers-reduced-transparency`.
