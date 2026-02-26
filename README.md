# Yuanming Lu — Academic Personal Website (Editable, Open Source)

This is a lightweight, fully static academic website (HTML/CSS/JS) you can host for free on **GitHub Pages**.
It is intentionally simple: no build step, no dependencies, and easy-to-edit content.

## Preview locally (recommended)
Because the Publications page loads `data/publications.json` using `fetch()`, you should preview via a tiny local web server:

```bash
# from the website folder:
python -m http.server 8000
```

Then open: `http://localhost:8000`

(Opening the HTML files directly with `file://` may block JSON loading in some browsers.)

## Deploy on GitHub Pages (recommended)
1. Create a new GitHub repository (e.g., `yuanming-lu.github.io`).
2. Upload all files from this folder to the repository root (or push via git).
3. In GitHub: **Settings → Pages → Build and deployment**
   - Source: Deploy from a branch
   - Branch: `main` / root
4. Your site will be live at:
   - `https://<your-username>.github.io/` (if repo is `<your-username>.github.io`)
   - or `https://<your-username>.github.io/<repo>/` (if it’s a normal repo)

## What to edit
- **Bio / homepage content**: `index.html`
- **Research page**: `research.html`
- **Teaching page**: `teaching.html`
- **Contact page**: `contact.html`
- **Publications**:
  - Edit `data/publications.json` (recommended) and the publications page will update automatically.
- **Add your CV PDF**:
  - Put your CV at `assets/docs/CV_YuanmingLu.pdf` and the CV button will work.
- **Profile photo**:
  - Add an image to `assets/img/profile.jpg` (or update the filename in `index.html`).

## License
MIT License — you can reuse and modify freely.
