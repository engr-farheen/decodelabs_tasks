# Smart Task &amp; Project Management System

A full-stack task manager with JWT authentication, projects, priorities,
search/filter/pagination, a dashboard summary, Swagger API docs, and a
custom-designed frontend.

```
smart-task-manager/
├── backend/     Node.js + Express + MongoDB (Mongoose) REST API
└── frontend/    Static HTML/CSS/JS client (no build step)
```

## Feature checklist

| Feature | Where |
|---|---|
| 🔐 Register / Login with JWT | `backend/controllers/authController.js`, `backend/middleware/auth.js` |
| 📁 Projects (CRUD) | `backend/controllers/projectController.js` |
| ✅ Tasks (CRUD) | `backend/controllers/taskController.js` |
| 🔗 Relationships: 1:1, 1:Many, Many:Many | `UserProfile` (1:1), `Project→Task` (1:Many), `Task↔Tag` (Many:Many) — see §5 |
| 🎯 Priority: Low / Medium / High | `Task.priority` enum |
| 📌 Status: Todo / In Progress / Completed | `Task.status` enum |
| 📅 Due dates (+ overdue highlighting in the UI) | `Task.dueDate` |
| 🔎 Search & filter | `GET /api/tasks?search=&status=&priority=&project=&tag=` |
| 👤 Per-user data isolation | every query is scoped to `req.user._id` |
| 📊 Dashboard (total / pending / completed / high-priority) | `GET /api/tasks/dashboard/summary` |
| 📄 Pagination | `page` / `limit` params, returned with `totalPages` / `totalCount` |
| 🛡️ Validation + error handling | `express-validator` + centralized `errorHandler`, NoSQL-injection-safe search |
| 📚 Swagger docs | `swagger-jsdoc` + `swagger-ui-express`, served at `/api-docs` |
| 🚀 Deploy on Railway / Render | see below |

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smart_task_manager   # or an Atlas URI
JWT_SECRET=some_long_random_string
JWT_EXPIRES_IN=7d
```

Start it:

```bash
npm run dev      # nodemon, auto-restarts
# or
npm start
```

You should see `Server running on port 5000 — docs at /api-docs`.

**Swagger UI**: open `http://localhost:5000/api-docs` in a browser to see
and try every endpoint interactively (click "Authorize" and paste
`Bearer <your JWT>` after logging in once).

## 2. Frontend setup

No build step — it's plain HTML/CSS/JS. Two ways to run it:

**Option A — just open the file**
Double-click `frontend/index.html` (or open it via your browser's
File → Open). It talks to `http://localhost:5000/api` by default.

**Option B — serve it locally** (avoids some browsers' quirks with `file://`)
```bash
cd frontend
npx serve .
# or: python3 -m http.server 5500
```
Then visit the URL it prints (e.g. `http://localhost:5500`).

If your API runs somewhere else, click the connection status pill (or
"API endpoint settings" on the login screen) and update the base URL —
it's saved in the browser automatically.

## 3. Using the app

1. Register an account (or log in if you already have one) — this also
   creates your **profile** automatically (1:1 with your account).
2. Create a **project** from the left rail — you need at least one before
   you can add tasks. Optionally add a few **tags** below it (Many:Many —
   any tag can be attached to any task).
3. Click **+ New Task**: set title, project, tags, priority, status, due date.
4. Use the search box and the status/priority/tag dropdowns above the
   table to filter; the table paginates automatically.
5. The four cards at the top summarize your total, pending, completed,
   and open high-priority tasks.
6. Click **Profile** in the header to edit your bio, phone, and avatar URL.
7. Only your own projects, tasks, tags, and profile are ever returned by
   the API — every query is scoped to your logged-in account.

## 4. Deployment (Railway or Render)

Both platforms work the same way for this project — deploy `backend/`
as a web service, and host `frontend/` as a static site (or open it
locally pointed at the deployed API).

**Backend (Railway)**
1. Push this repo to GitHub.
2. Railway → New Project → Deploy from GitHub repo → select `backend/`
   as the root directory.
3. Add environment variables: `MONGO_URI` (use MongoDB Atlas — Railway
   doesn't provision Mongo by default, add the Atlas free tier and paste
   its connection string), `JWT_SECRET`, `JWT_EXPIRES_IN`.
4. Railway auto-detects `npm start`. Note the generated public URL.

**Backend (Render)**
1. Render → New → Web Service → connect the repo, root directory `backend/`.
2. Build command: `npm install`. Start command: `npm start`.
3. Add the same environment variables as above under "Environment".
4. Deploy — Render gives you a public URL like `https://your-app.onrender.com`.

**Frontend**
- Simplest: update the API endpoint in the app's settings popover to your
  deployed backend URL + `/api` (e.g. `https://your-app.onrender.com/api`),
  then open `frontend/index.html` locally or host the `frontend/` folder
  on Netlify/Vercel/Render Static Site (no build command needed — it's
  static files).
- The backend already has `cors()` enabled for all origins, so the
  frontend can be hosted anywhere.

**Swagger docs in production**: available at `https://<your-backend-url>/api-docs`.

## 5. Data model

```
User (1) ──── (1) UserProfile          [1:1]
User (1) ──── (Many) Project           [1:Many]
                  │
                  │ (1) ──── (Many) Task   [1:Many]
                  │                          │
User (1) ──────────────────────── (Many) Task   [1:Many, direct owner ref]
                                             │
Tag  (Many) ──────────────────── (Many) Task   [Many:Many, via Task.tags[]]
```

- **1:1** — every `User` gets exactly one `UserProfile` (created automatically
  on registration; the `unique` index on `UserProfile.user` enforces it).
- **1:Many** — a `User` owns many `Project`s; a `Project` owns many `Task`s;
  a `User` also owns many `Task`s directly (denormalized owner reference,
  used for fast per-user queries).
- **Many:Many** — a `Task` can carry many `Tag`s and a `Tag` can be applied
  to many `Task`s, via the `tags` array on `Task` (the Mongoose equivalent
  of a junction table).
- Every `Project`, `Task`, and `Tag` stores a `user` reference; controllers
  filter every query by `req.user._id` so accounts never see each other's data.
- Deleting a project cascades to delete its tasks. Deleting a tag pulls it
  out of every task that referenced it.

## 6. New endpoints (profile + tags)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/profile` | Get the current user's 1:1 profile (auto-created) |
| PUT | `/api/profile` | Update bio / phone / avatar URL |
| POST | `/api/tags` | Create a tag |
| GET | `/api/tags` | List the current user's tags |
| DELETE | `/api/tags/:id` | Delete a tag (removes it from every task) |
| GET | `/api/tasks?tag=<id>` | Filter tasks by tag (in addition to search/status/priority/project) |

All documented interactively in Swagger at `/api-docs`.

