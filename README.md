# 🏦 TrackWise — Smart Personal Expense Tracker

> A production-grade full-stack **MERN** FinTech application featuring voice dictation, smart insights, recurring transactions, per-category budgets, analytics charts, and a complete settings suite.

---

## 📁 Complete Project Structure

```
smart-expense-tracker/
│
├── backend/
│   ├── config/
│   │   └── db.js                         # Mongoose connection helper
│   ├── controllers/
│   │   ├── authController.js             # register, login, getMe, updateBudget,
│   │   │                                 #   updateProfile, changePassword, deleteAccount
│   │   ├── budgetController.js           # getBudgets, createOrUpdate (upsert),
│   │   │                                 #   deleteBudget, getBudgetSummary
│   │   └── transactionController.js      # getAllTransactions, createTransaction,
│   │                                     #   editTransaction, deleteTransaction,
│   │                                     #   getSummary, getInsights, exportCSV,
│   │                                     #   getTitleSuggestions, getMonthlyTrend
│   ├── jobs/
│   │   └── recurringJob.js               # node-cron daily scheduler — auto-generates
│   │                                     #   copies of recurring transactions at 00:05 IST
│   ├── middleware/
│   │   └── authMiddleware.js             # JWT protect middleware
│   ├── models/
│   │   ├── Budget.js                     # Per-category monthly limit schema +
│   │   │                                 #   getBudgetsWithSpend() aggregation static
│   │   ├── Transaction.js                # Full transaction schema with isRecurring +
│   │   │                                 #   getMonthlyTrend(), getSummaryForUser(),
│   │   │                                 #   getCategoryBreakdownForUser(),
│   │   │                                 #   getTitleSuggestions() statics
│   │   └── User.js                       # User schema + bcrypt pre-save hook +
│   │                                     #   matchPassword() + getSignedJwtToken()
│   ├── routes/
│   │   ├── auth.js                       # /api/auth/* (7 endpoints)
│   │   ├── budgets.js                    # /api/budgets/* (4 endpoints)
│   │   └── transactions.js              # /api/transactions/* (9 endpoints)
│   ├── server.js                         # Express entry point, rate limiter,
│   │                                     #   global error handler, route mounting
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ExpenseChart.jsx           # Chart.js Doughnut — dark-mode reactive
    │   │   ├── Navbar.jsx                 # Logo, nav links (Dashboard/History/Reports/
    │   │   │                              #   Budgets), dark toggle, user dropdown,
    │   │   │                              #   Settings link, logout toast
    │   │   ├── Onboarding.jsx             # 3-step wizard modal shown once per user
    │   │   │                              #   (budget → income → expense → celebration)
    │   │   ├── SmartInsights.jsx          # Dismissible alert banners from insights API
    │   │   ├── ToastContainer.jsx         # Portal-rendered toast stack with progress bars
    │   │   ├── TransactionForm.jsx        # Add transaction form + 🎤 Web Speech API
    │   │   │                              #   voice dictation + recurring toggle
    │   │   └── TransactionTable.jsx       # History table + search autocomplete +
    │   │                                  #   edit modal + delete confirm modal +
    │   │                                  #   date range props + CSV export
    │   ├── context/
    │   │   ├── AuthContext.jsx            # JWT storage, axios header, session restore
    │   │   ├── ThemeContext.jsx           # Dark/light toggle, localStorage persist
    │   │   └── ToastContext.jsx           # Global toast state + useToast() hook
    │   ├── pages/
    │   │   ├── BudgetsPage.jsx            # Per-category budget cards, month navigator,
    │   │   │                              #   health strip, add/edit modal, delete
    │   │   ├── DashboardPage.jsx          # Stat cards, budget bar, insights, chart,
    │   │   │                              #   quick-add form, onboarding wizard
    │   │   ├── HistoryPage.jsx            # TransactionTable + date range filter +
    │   │   │                              #   quick-add slide panel + summary pills
    │   │   ├── LoginPage.jsx              # Login form + validation + success toast
    │   │   ├── NotFoundPage.jsx           # 404 with 10s auto-redirect countdown
    │   │   ├── RegisterPage.jsx           # Register + password strength meter +
    │   │   │                              #   success toast
    │   │   ├── ReportsPage.jsx            # Bar chart (Income vs Expense) + Line chart
    │   │   │                              #   (Trend + Savings) + Top 5 categories +
    │   │   │                              #   3M/6M/12M selector
    │   │   └── SettingsPage.jsx           # Profile (name/email/avatar colour) +
    │   │                                  #   password change + budget goal +
    │   │                                  #   3-step delete account gate
    │   ├── App.jsx                        # Router + ProtectedRoute + PublicRoute +
    │   │                                  #   ErrorBoundary + ToastContainer
    │   ├── index.css                      # Tailwind + CSS vars + .card/.btn-primary/
    │   │                                  #   .input-field/.badge/.alert-* component classes
    │   └── main.jsx                       # React 18 createRoot + global error listeners
    ├── index.html                         # Sora + JetBrains Mono Google Fonts
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js                 # darkMode: class, custom tokens, animations
    └── vite.config.js                     # /api proxy → Express (dev CORS-free)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- MongoDB Atlas account (free tier is sufficient)

### 1 — Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET in .env
npm run dev
# API live at http://localhost:5000
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
# App live at http://localhost:5173
```

The Vite proxy forwards all `/api/*` calls to `localhost:5000` — no CORS configuration needed in development.

---

## 🔌 Full API Reference

### Auth — `/api/auth`

> All write routes rate-limited: **15 requests / 15 minutes per IP**

| Method | Route       | Auth | Description                                       |
| ------ | ----------- | ---- | ------------------------------------------------- |
| POST   | `/register` | ❌   | Create account → JWT                              |
| POST   | `/login`    | ❌   | Authenticate → JWT                                |
| GET    | `/me`       | ✅   | Get current user profile                          |
| PUT    | `/budget`   | ✅   | Update monthly budget goal                        |
| PUT    | `/profile`  | ✅   | Update name, email, avatarColor                   |
| PUT    | `/password` | ✅   | Change password (requires currentPassword)        |
| DELETE | `/account`  | ✅   | Permanent account + data deletion (password gate) |

### Transactions — `/api/transactions`

> All routes JWT-protected via `router.use(protect)`

| Method | Route       | Description                                                       |
| ------ | ----------- | ----------------------------------------------------------------- |
| GET    | `/`         | List transactions — `?page&limit&type&category&search&from&to`    |
| POST   | `/`         | Create transaction (supports `isRecurring`, `recurringFrequency`) |
| PUT    | `/:id`      | Edit transaction (partial update via `$set`)                      |
| DELETE | `/:id`      | Delete transaction                                                |
| GET    | `/summary`  | Income/Expense/Balance totals + category breakdown (`?from&to`)   |
| GET    | `/insights` | Smart alert rules (food >40%, savings ≥20%, budget exceeded)      |
| GET    | `/export`   | Download all transactions as CSV (includes recurring fields)      |
| GET    | `/titles`   | Autocomplete suggestions — `?q=` (ranked by frequency + recency)  |
| GET    | `/monthly`  | Monthly trend data — `?months=6` (for Reports charts)             |

### Budgets — `/api/budgets`

> All routes JWT-protected

| Method | Route      | Description                                                     |
| ------ | ---------- | --------------------------------------------------------------- |
| GET    | `/`        | Budgets + actual spend for `?month=&year=`                      |
| GET    | `/summary` | Health stats: allocated, spent, over-budget count               |
| POST   | `/`        | Create or update (upsert) by `(user_id, category, month, year)` |
| DELETE | `/:id`     | Remove a budget entry                                           |

---

## 🧩 Mongoose Schema Reference

### User

| Field         | Type   | Notes                                           |
| ------------- | ------ | ----------------------------------------------- |
| name          | String | required, 2–60 chars                            |
| email         | String | required, unique, lowercase                     |
| password      | String | bcrypt hashed, `select: false`                  |
| monthlyBudget | Number | default ₹50,000 — drives dashboard progress bar |
| avatarColor   | String | hex colour for initials avatar                  |

### Transaction

| Field              | Type     | Notes                                                                                            |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| title              | String   | required, 2–100 chars                                                                            |
| amount             | Number   | required, min ₹1                                                                                 |
| type               | Enum     | `Income` \| `Expense`                                                                            |
| category           | Enum     | Housing / Food & Groceries / Transport / Utilities / Entertainment / Healthcare / Salary / Other |
| date               | Date     | default `Date.now`                                                                               |
| user_id            | ObjectId | ref: User, indexed                                                                               |
| notes              | String   | optional, max 250 chars                                                                          |
| isRecurring        | Boolean  | template flag — cron generates copies daily                                                      |
| recurringFrequency | Enum     | `Daily` \| `Weekly` \| `Monthly` \| null                                                         |
| lastGeneratedAt    | Date     | cron deduplication timestamp                                                                     |
| isGeneratedCopy    | Boolean  | true on auto-generated copies (shown as `AUTO` badge)                                            |

### Budget

| Field                    | Type     | Notes                                           |
| ------------------------ | -------- | ----------------------------------------------- |
| user_id                  | ObjectId | ref: User, indexed                              |
| category                 | Enum     | same 8 categories as Transaction                |
| limit                    | Number   | monthly spending limit in ₹                     |
| month                    | Number   | 1–12                                            |
| year                     | Number   | ≥ 2020                                          |
| _(virtual)_ spent        | Number   | injected by `getBudgetsWithSpend()` aggregation |
| _(virtual)_ percentage   | Number   | `(spent/limit)*100`                             |
| _(virtual)_ isOverBudget | Boolean  | `spent > limit`                                 |

Compound unique index: `(user_id, category, month, year)` — enforces one budget per category per month.

---

## 🔐 Authentication Flow

```
Register / Login
  │
  ├─ POST /api/auth/register { name, email, password, monthlyBudget }
  │    └─ bcrypt.hash (pre-save hook) → User.create() → jwt.sign() → { token, user }
  │
  ├─ POST /api/auth/login { email, password }
  │    └─ bcrypt.compare() → jwt.sign() → { token, user }
  │
  └─ React: AuthContext.login(token, user)
       ├─ localStorage.setItem('expenseToken', token)
       └─ axios.defaults.headers.common['Authorization'] = 'Bearer <token>'

Every subsequent protected request:
  axios call (Authorization: Bearer <token>)
  → authMiddleware.protect()
      ├─ jwt.verify(token, JWT_SECRET) → { id }
      ├─ User.findById(id) → req.user
      └─ next() → controller
```

---

## 🎤 Voice Dictation — Web Speech API

Available on the `title` and `notes` fields in `TransactionForm.jsx`:

```js
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
recognition.lang = "en-IN"; // Indian English locale
recognition.continuous = false; // Stops after first natural pause
recognition.interimResults = false; // Only final transcript used

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  setForm((prev) => ({ ...prev, [activeField]: transcript }));
};
```

Supported in Chrome and Edge. Gracefully hidden on unsupported browsers.

---

## 🔄 Recurring Transactions — node-cron

`backend/jobs/recurringJob.js` registers a cron at `00:05 IST` daily (`5 0 * * *`).

**Logic per tick:**

1. Fetch all `Transaction` documents where `isRecurring: true, isGeneratedCopy: false`
2. For each, check `isDueToday(lastGeneratedAt, recurringFrequency)`:
   - Daily → `daysDiff >= 1`
   - Weekly → `daysDiff >= 7`
   - Monthly → different calendar month from `lastGeneratedAt`
3. If due: `Transaction.create({ ...template, date: new Date(), isRecurring: false, isGeneratedCopy: true })`
4. Update `lastGeneratedAt` on the template (prevents double-generation on restart)
5. Also runs once on server startup to catch any missed generations

---

## 🏗️ Frontend Architecture

### Context Providers (App.jsx wrapping order)

```
ThemeProvider   → adds/removes `dark` class on <html>
BrowserRouter   → React Router v6
AuthProvider    → JWT session, axios default header
ToastProvider   → global toast[] array + addToast/removeToast
ErrorBoundary   → class component catching render errors
AppInner        → routes + ToastContainer portal
```

### Route Map

| Path         | Page                               | Access    |
| ------------ | ---------------------------------- | --------- |
| `/`          | → redirect                         | —         |
| `/login`     | LoginPage                          | Public    |
| `/register`  | RegisterPage                       | Public    |
| `/dashboard` | DashboardPage                      | Protected |
| `/history`   | HistoryPage                        | Protected |
| `/reports`   | ReportsPage                        | Protected |
| `/budgets`   | BudgetsPage                        | Protected |
| `/settings`  | SettingsPage                       | Protected |
| `*`          | NotFoundPage (404 + 10s countdown) | —         |

### Toast System

```js
// In any component:
const { toast } = useToast();
toast.success("Saved!", "Optional title");
toast.error("Something went wrong.", "Error", 8000); // custom duration
toast.warning("Approaching budget limit.");
toast.info("Tip: use 🎤 to dictate transactions.");
```

Auto-dismiss timers: success/info = 4s, warning = 5s, error = 6s. `duration: 0` = sticky.

---

## 🎨 Design System

### Typography

| Font               | Usage                                          |
| ------------------ | ---------------------------------------------- |
| **Sora**           | All UI text, headings, labels, buttons         |
| **JetBrains Mono** | Currency amounts, stat numbers, numeric inputs |

### Colour Tokens (CSS Variables)

| Token              | Light     | Dark      | Usage                 |
| ------------------ | --------- | --------- | --------------------- |
| `--bg-canvas`      | `#f8fafc` | `#0f172a` | Page background       |
| `--bg-card`        | `#ffffff` | `#1e293b` | Card backgrounds      |
| `--bg-navbar`      | `#0f172a` | `#020617` | Top navigation        |
| `--accent-emerald` | `#10b981` | same      | Income, success, CTAs |
| `--accent-rose`    | `#f43f5e` | same      | Expenses, danger      |
| `--accent-amber`   | `#f59e0b` | same      | Warnings              |
| `--chart-grid`     | `#f1f5f9` | `#1e293b` | Chart.js grid lines   |
| `--chart-text`     | `#94a3b8` | `#475569` | Chart.js tick labels  |

### Component Classes (index.css `@layer components`)

| Class                | Description                                       |
| -------------------- | ------------------------------------------------- |
| `.card`              | White rounded-2xl card with shadow + hover lift   |
| `.btn-primary`       | Emerald filled button with active scale           |
| `.btn-secondary`     | Muted slate button                                |
| `.btn-danger`        | Rose ghost button for delete actions              |
| `.btn-ghost`         | Icon-only transparent button                      |
| `.input-field`       | Consistent form input (dark mode aware)           |
| `.select-field`      | Extends `.input-field` with cursor-pointer        |
| `.form-label`        | Uppercase tracking label                          |
| `.badge-income`      | Emerald pill badge                                |
| `.badge-expense`     | Rose pill badge                                   |
| `.alert-warning`     | Amber banner with `animate-slide-down`            |
| `.alert-success`     | Emerald banner                                    |
| `.alert-danger`      | Rose banner                                       |
| `.table-row-alt`     | Alternating row colours + hover                   |
| `.skeleton`          | Shimmer loading placeholder                       |
| `.progress-bar-fill` | Animated width bar via `--progress-width` CSS var |
| `.page-section`      | White rounded card for full-width sections        |

---

## ✅ Complete Feature Checklist

### Core (Original Build)

- [x] JWT Authentication — register, login, session restore via `GET /api/auth/me`
- [x] Protected + Public route guards in React Router
- [x] React Error Boundary (class component)
- [x] Dark / Light mode — Tailwind `class` strategy, localStorage persist, OS detection
- [x] Smart Insights Engine (3 rules: food overspend, savings rate, budget exceeded)
- [x] Animated Budget Progress Bar (green → amber → rose thresholds)
- [x] Category Breakdown Doughnut Chart (dark-mode reactive via CSS vars)
- [x] 🎤 Voice Dictation — Web Speech API on title + notes fields
- [x] Transaction Table — search, type/category filter, pagination
- [x] 1-Click CSV Export (Blob URL download)
- [x] Alternating row colours + hover effects
- [x] Responsive Tailwind CSS Grid layouts
- [x] Semantic HTML5 (`<main>`, `<nav>`, `<section>`, `<article>`, `<header>`, `<footer>`)
- [x] MongoDB Aggregation Pipelines (no in-memory summing)
- [x] Global Express error handler

### Phase A — Backend Expansion

- [x] `express-rate-limit` — 15 req/15 min on `/api/auth/*`
- [x] `Budget` Mongoose model with `getBudgetsWithSpend()` static
- [x] Full Budget CRUD API (`/api/budgets`)
- [x] `PUT /api/transactions/:id` — partial `$set` edit endpoint
- [x] `DELETE /api/auth/account` — bcrypt-confirmed cascade delete
- [x] `GET /api/transactions/titles?q=` — frequency-ranked autocomplete
- [x] `GET /api/transactions/monthly?months=` — Chart.js aggregation data
- [x] `node-cron` daily scheduler — auto-generates recurring transaction copies
- [x] `isRecurring`, `recurringFrequency`, `lastGeneratedAt`, `isGeneratedCopy` fields

### Phase B — Global UI Infrastructure

- [x] `ToastContext` — global toast state, auto-dismiss timers, 5-toast cap
- [x] `ToastContainer` — portal to `<body>`, depleting progress bars, slide animations
- [x] `Onboarding` — 3-step wizard, `localStorage` flag, skip + complete paths
- [x] All `alert()` and `window.confirm()` calls eliminated — replaced with toasts + modals

### Phase C — New Pages

- [x] `SettingsPage` — avatar colour picker (10 swatches), profile edit, password change, budget goal, 3-step delete gate
- [x] `ReportsPage` — Bar + Line charts (Chart.js), 3M/6M/12M selector, Top 5 categories, savings rate pill
- [x] `BudgetsPage` — month navigator, health strip, budget cards with progress bars, add/edit modal (upsert), delete
- [x] `PUT /api/auth/profile` and `PUT /api/auth/password` backend endpoints

### Phase D — Feature Additions

- [x] Edit Transaction modal — pre-filled form, `PUT` on save, optimistic row update
- [x] Delete Confirm modal — replaces `window.confirm`, styled portal dialog
- [x] Search autocomplete — 300ms debounced `GET /titles?q=`, `onMouseDown` selection
- [x] Date range filter — `from` / `to` props on `TransactionTable`, "This month" shortcut
- [x] Recurring toggle in `TransactionForm` — pill switch + Daily/Weekly/Monthly selector
- [x] Navbar updated — Reports, Budgets links + Settings via React Router `<Link>`
- [x] Toast wired into login, register, logout, all CRUD operations

### Phase E — Final Polish

- [x] All routes present in `App.jsx` (`/settings`, `/reports`, `/budgets`)
- [x] Onboarding wizard triggered on first dashboard visit (localStorage gate)
- [x] Navbar settings link fixed to React Router `<Link>` (no hard page reload)
- [x] Login + Register success toasts (`Welcome back, {name}!`, `Welcome to TrackWise!`)
- [x] README fully updated with all endpoints, models, flows, and features

---

## 🔧 Environment Variables

```env
# backend/.env
PORT=5000
NODE_ENV=development

# MongoDB Atlas — replace with your connection string
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/expense_tracker?retryWrites=true&w=majority

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_char_random_secret_here
JWT_EXPIRE=7d

# Vite frontend dev server URL
CLIENT_ORIGIN=http://localhost:5173
```

---

## 📦 Dependencies

### Backend

| Package            | Version | Purpose                           |
| ------------------ | ------- | --------------------------------- |
| express            | ^4.19   | HTTP framework                    |
| mongoose           | ^8.4    | MongoDB ODM                       |
| bcryptjs           | ^2.4    | Password hashing                  |
| jsonwebtoken       | ^9.0    | JWT signing + verification        |
| express-validator  | ^7.1    | Request body validation           |
| express-rate-limit | ^7.3    | Auth route brute-force protection |
| node-cron          | ^3.0    | Recurring transaction scheduler   |
| cors               | ^2.8    | Cross-Origin Resource Sharing     |
| dotenv             | ^16.4   | Environment variable loading      |
| morgan             | ^1.10   | HTTP request logger               |

### Frontend

| Package                    | Version     | Purpose                          |
| -------------------------- | ----------- | -------------------------------- |
| react + react-dom          | ^18.3       | UI framework                     |
| react-router-dom           | ^6.24       | Client-side routing              |
| axios                      | ^1.7        | HTTP client (global auth header) |
| chart.js + react-chartjs-2 | ^4.4 / ^5.2 | Dashboard + Reports charts       |
| lucide-react               | ^0.383      | Icon library                     |
| tailwindcss                | ^3.4        | Utility-first CSS                |
| vite                       | ^5.3        | Build tool + dev server          |
