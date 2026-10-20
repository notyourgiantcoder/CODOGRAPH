# Codograph — landing page

A frontend-only landing page for **Codograph**, a concept for an AI-powered codebase dependency mapping tool.

Every interactive demo runs on a synthetic repository (`data/repository.ts`) in the browser. There is no backend, database, authentication, network API or language model.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Where things live

| Path | What it does |
| --- | --- |
| `data/repository.ts` | The synthetic storefront: 39 files with categories, imports, descriptions and code bodies |
| `lib/graph.ts` | Indexes, BFS impact traversal, shortest paths, metrics, search, file tree and code generation |
| `lib/assistant.ts` | The deterministic "assistant": it resolves file mentions and answers from graph queries |
| `components/demo/` | The shared demo state (`DemoProvider`), explorer, search, filters, inspector, impact panel and assistant |
| `components/graph/` | React Flow graph, custom file nodes and edges, layout, legend |
| `components/landing/` | Page sections (hero, problem, features, how it works, philosophy, playground, insights, CTA, footer) |
| `lib/site.ts` | Site config. Set `githubUrl` to show GitHub links |

Every count on the page (affected files, hops, chart values, assistant answers) is computed from `data/repository.ts`. Edit that file and the whole page updates.
