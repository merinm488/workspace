# Workspace

A unified, Google-Drive-style home for your necessary apps. One login, one landing page, all the applications.

Built with plain **HTML / CSS / JavaScript**

## ✨ Features

- 🔐 **One key for everything** — same authentication
  (SHA-256(key + pepper) server-side, auto account creation, TextDB/local-file
  storage). Logging in to Workspace logs you in to all the applications.
- 🗂️ **Recent files** — all the files, sorted by last-opened
  (re-opening bumps a file to the top), with fallback to last-modified.
- ➕ **+ New dropdowns** — in the header and the empty state; create a blank
  file in any registered app (Dox, Grids, …) and jump straight into its
  editor. Apps are defined in one `WS_APPS` registry in
  `public/js/workspace.js`.
- 🎛️ **App filter** — an "All files" pill plus one app-chooser dropdown
  listing every registered app, so new apps don't crowd the screen.
- 🔍 **Unified search** — searches titles of all files plus the markdown
  content of notes.
- 🔳 **Grid / List view toggle** — persisted per account (server-side).
- 🌗 **Dark / Light / System theme** — persisted per account, consistent
  with both child apps.
- ⚙️ **Settings dropdown** — View My Key, Theme submenu, Logout, Delete
  Account (deletes the unified account).
- ✏️ **Rename & delete files** from the landing page (including shared
  copies cleanup).

## 🏗️ Architecture

```
workspace/
├── public/                 # Workspace landing page (vanilla)
│   ├── index.html
│   ├── workspace.css
│   └── js/
│       ├── themes.js       # light/dark/system theme manager
│       ├── auth.js         # login + session (mirrors keys for dox & grids)
│       └── workspace.js    # landing page application
├── api/
│   ├── _lib/store.js       # shared storage: local files (dev) / textdb (prod)
│   ├── workspace.js        # workspace API: auth + unified file ops
│   ├── notes.js            # dox API (same shape as the original)
│   └── users.js            # grids API (same shape as the original)
├── dox/                    # dox build output (from dox-src, base /dox/)
├── dox-src/                # dox source (React+Vite copy of Notes, with:
│                           #   base '/dox/', ?note= deep link, shared sessions)
├── grids/                  # grids app (vanilla), paths adjusted to /grids/
├── server/dev-server.js    # one Express server mirroring the prod layout
├── vercel.json             # routing for production
├── .env                    # PEPPER_SECRET for local dev
└── package.json
```

### Unified data model

One document per user (local `db/users/{hash}.json` in dev, one textdb.dev
document per hash in production):

```json
{
  "notes": [ ... ],
  "tags": [ ... ],
  "spreadsheets": [ ... ],
  "settings": {
    "theme": "dark",
    "viewMode": "grid",
    "lastOpened": { "<fileId>": "<iso-date>" }
  }
}
```

All three APIs share `api/_lib/store.js` and save **section-merged**: Dox
only writes notes/tags, Grids only writes spreadsheets, Workspace writes
notes/tags/spreadsheets/settings etc — so no app can wipe another's data.

### Authentication flow


1. `POST /api/workspace { key, action: 'login' }`
2. `404 User not found` → `POST { key, action: 'create' }` (auto-create)
3. Session keys stored in `sessionStorage` for all the apps at once:


## 🛠️ Rebuilding Dox

After changing anything in `dox-src/`:

```bash
cd dox-src && npm install && npm run build
cd .. && rm -rf dox && cp -R dox-src/dist dox
```

### One key = one account

The hash is `sha256(key.trim() + PEPPER_SECRET)` and the hash *is* the
document id. One account, one document, consistent recents everywhere.

## 🔗 Deep links

- `/dox/?note=<id>` — opens a specific note (Workspace uses this for
  recent-docs clicks and New Doc).
- `/grids/editor.html?id=<id>` — opens a specific spreadsheet.
- `/grids/shared.html?shared=<id>`, `/dox/?shared=<id>` — public share views.

## 📄 License

MIT
