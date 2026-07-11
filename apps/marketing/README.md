# Ruler marketing site

Static landing page for Ruler, deployed to <https://nnavnita.github.io/ruler/> via GitHub Pages.

Plain HTML + CSS, no build step. Edit `index.html` / `style.css` and push — the workflow at `.github/workflows/pages.yml` republishes on any change under `apps/marketing/**`.

To view locally:

```bash
python -m http.server -d apps/marketing 8080
```

Then open <http://localhost:8080/>.

## First-time Pages setup

In the GitHub repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. After that, every push to `main` under `apps/marketing/` triggers a redeploy.
