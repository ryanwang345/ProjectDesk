# sample-shop

A deliberately broken page for exercising the Project Desk AI loop.

- `index.html` has a Search button without the shared `.btn` class.
- `test.mjs` fails until every button carries `.btn`.
- `.projectdesk.json` tells the sandbox runner to execute `node test.mjs` in `node:22-alpine`.

Project Desk never edits this directory; each agent run copies it into a
throwaway workspace.
