# Ozmep’s GIF Gallery

Static HTML/CSS/JS gallery that displays GIFs from the `ozmep` GIPHY channel.

## How it works

GitHub Pages is static, and browsers can’t fetch `giphy.com` HTML due to CORS.  
So this repo snapshots the channel at build time into `data/gifs.json`.

## Local run

Build the GIF list:

```bash
npm run fetch
```

Serve locally:

```bash
npm run serve
```

Then open `http://localhost:5173`.

## Update the gallery later

Run:

```bash
npm run fetch
```

Commit the updated `data/gifs.json`.

## GitHub Pages deploy

1. Create a repo named **`ozmep`** or **`ozmepgifs`**.
2. Push this project to that repo.
3. In GitHub repo settings → **Pages**:
   - **Build and deployment**: “Deploy from a branch”
   - **Branch**: `main` / **folder**: `/ (root)`

