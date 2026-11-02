# Vail

A small React desk for the projects you are actually working on. Vite builds the app, and nginx serves the static files.

Projects stay in this browser under `localStorage` key `vail.projects.v1`. Nothing on the desk is sent to a server.

On your own machine, put the project in `/Users/rwang/vail-projects` if that is where you want it to live.

## Run it

```bash
npm install
npm run serve
```

`npm run serve` builds the app and starts nginx in the foreground at [http://127.0.0.1:47291](http://127.0.0.1:47291).

- `/` is the desk
- `/about` explains how the app is served
- `/healthz` is nginx itself, and returns the text `ok`

Unknown paths return `index.html`, so a refresh on `/about` still opens the React app.

For UI work with hot reload, use the Vite dev server instead:

```bash
npm run dev
```

That listens on port `47311`. It does not use nginx.

## Docker

If you would rather not install nginx on the host:

```bash
docker build -t vail .
docker run --rm -p 47291:80 vail
```

The image builds the React app, then serves `dist` with nginx. The container listens on port 80.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 47311 |
| `npm run build` | Typecheck and write `dist/` |
| `npm run serve` | Build, then serve `dist/` with nginx on port 47291 |
| `npm run lint` | Run oxlint |
