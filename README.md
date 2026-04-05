# 🏦 TrackWise — Smart Personal Expense Tracker

> A full-stack MERN FinTech application with voice dictation, smart insights, and real-time dashboard analytics.

---

## 📁 Complete Project Structure

```
smart-expense-tracker/
├── backend/
│   ├── config/
│   │   └── db.js                        # Mongoose connection
│   ├── controllers/
│   │   ├── authController.js            # register, login, getMe, updateBudget
│   │   └── transactionController.js     # CRUD, summary, insights, CSV export
│   ├── middleware/
│   │   └── authMiddleware.js            # JWT protect middleware
│   ├── models/
│   │   ├── User.js                      # Mongoose User schema + bcrypt + JWT
│   │   └── Transaction.js              # Transaction schema + aggregation statics
│   ├── routes/
│   │   ├── auth.js                      # /api/auth/*
│   │   └── transactions.js             # /api/transactions/*
│   ├── server.js                        # Express entry point + global error handler
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx               # Logo, nav links, dark toggle, user dropdown
    │   │   ├── SmartInsights.jsx        # Alert banners (warning/success/danger)
    │   │   ├── ExpenseChart.jsx         # Chart.js Doughnut + dark mode sync
    │   │   ├── TransactionForm.jsx      # Form + 🎤 Web Speech API dictation
    │   │   └── TransactionTable.jsx     # Table + search + filter + CSV + pagination
    │   ├── context/
    │   │   ├── AuthContext.jsx          # JWT storage, Axios header, session restore
    │   │   └── ThemeContext.jsx         # Dark/light toggle, localStorage persist
    │   ├── pages/
    │   │   ├── LoginPage.jsx            # Login form + validation + error handling
    │   │   ├── RegisterPage.jsx         # Register form + password strength meter
    │   │   ├── DashboardPage.jsx        # Stat cards, budget bar, chart, form
    │   │   ├── HistoryPage.jsx          # Table + summary strip + slide-out add panel
    │   │   └── NotFoundPage.jsx         # 404 fallback
    │   ├── App.jsx                      # Router + ProtectedRoute + ErrorBoundary
    │   ├── main.jsx                     # React 18 root mount
    │   └── index.css                    # Tailwind directives + CSS vars + components
    ├── tailwind.config.js               # darkMode: class, Sora font, custom tokens
    ├── vite.config.js                   # Vite + /api proxy to Express
    ├── index.html                       # Google Fonts (Sora + JetBrains Mono)
    └── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas account (free tier works perfectly)

---

### 1. Clone / Download

```bash
# Navigate to the project root
cd smart-expense-tracker
```

---

### 2. Backend Setup

```bash
cd backend
npm install

# Copy the environment template
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/expense_tracker?retryWrites=true&w=majority
JWT_SECRET=your_very_long_random_secret_here
JWT_EXPIRE=7d
CLIENT_ORIGIN=http://localhost:5173
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the backend:
```bash
npm run dev        # Development (nodemon — auto-restarts on file changes)
# or
npm start          # Production
```

The API will be live at: `http://localhost:5000`
Health check: `GET http://localhost:5000/api/health`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The React app will be at: `http://localhost:5173`

> The Vite dev server proxies all `/api/*` requests to `http://localhost:5000` automatically — no CORS issues.

---

## 🔌 Full API Reference

### Auth — `/api/auth`

| Method | Route       | Access  | Description                        |
|--------|-------------|---------|-----------------------------------|
| POST   | `/register` | Public  | Create account, returns JWT        |
| POST   | `/login`    | Public  | Authenticate, returns JWT          |
| GET    | `/me`       | Private | Get current user profile           |
| PUT    | `/budget`   | Private | Update monthly budget goal         |

### Transactions — `/api/transactions` (all private)

| Method | Route       | Description                                           |
|--------|-------------|-------------------------------------------------------|
| GET    | `/`         | List transactions — `?page&limit&type&category&search`|
| POST   | `/`         | Create a transaction                                  |
| DELETE | `/:id`      | Delete by MongoDB ObjectId                            |
| GET    | `/summary`  | Totals + category breakdown (for chart & stat cards)  |
| GET    | `/insights` | Smart spending alert data                             |
| GET    | `/export`   | Download all transactions as CSV                      |

---

## 🧠 MERN Data Flow (For Viva)

```
┌─────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION FLOW                                                 │
│                                                                       │
│  RegisterPage/LoginPage                                              │
│    │  axios.post('/api/auth/login', { email, password })            │
│    ▼                                                                  │
│  Express → authController.loginUser()                                │
│    │  User.findOne({ email }).select('+password')                    │
│    │  bcrypt.compare(candidatePassword, hash)                        │
│    │  jwt.sign({ id: user._id }, JWT_SECRET)                        │
│    ▼                                                                  │
│  { success: true, token, user }                                      │
│    │                                                                  │
│  AuthContext.login(token, user)                                      │
│    │  localStorage.setItem('expenseToken', token)                   │
│    │  axios.defaults.headers.common['Authorization'] = `Bearer ...` │
│    ▼                                                                  │
│  Navigate('/dashboard')                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PROTECTED REQUEST FLOW                                              │
│                                                                       │
│  React Component                                                     │
│    │  axios.get('/api/transactions/summary')                        │
│    │  Header: Authorization: Bearer <token>                         │
│    ▼                                                                  │
│  Express → authMiddleware.protect()                                  │
│    │  jwt.verify(token, JWT_SECRET) → decoded.id                    │
│    │  User.findById(decoded.id) → req.user                          │
│    ▼                                                                  │
│  transactionController.getSummary()                                  │
│    │  Transaction.aggregate([                                        │
│    │    { $match: { user_id: req.user._id } },                      │
│    │    { $group: { _id: '$type', total: { $sum: '$amount' } } }    │
│    │  ])                                                              │
│    ▼                                                                  │
│  JSON response → React setState → UI re-renders                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎤 Voice Dictation (Web Speech API)

In `TransactionForm.jsx`, the 🎤 button uses `window.SpeechRecognition`:

```javascript
// Browser support check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.lang = 'en-IN';        // Indian English
recognition.continuous = false;    // Stops after first pause
recognition.interimResults = false; // Only final transcript

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  setForm(prev => ({ ...prev, [activeField]: transcript }));
};
```

Supported in: Chrome, Edge. Gracefully hidden in Firefox/Safari.

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Font | Sora (display) + JetBrains Mono (numbers) | All UI text |
| Navy | `#0f172a` (slate-900) | Navbar background |
| Canvas | `#f8fafc` light / `#0f172a` dark | Page background |
| Emerald | `#10b981` | Income, success states, CTA buttons |
| Rose | `#f43f5e` | Expenses, danger states |
| Amber | `#f59e0b` | Warning states, budget 50–80% |

### Component Classes (in `index.css`)
- `.card` — white card with shadow and rounded-2xl
- `.btn-primary` — emerald CTA button
- `.btn-secondary` — muted secondary button
- `.btn-danger` — rose delete button
- `.input-field` — consistent form inputs
- `.form-label` — uppercase tracking label
- `.badge-income` / `.badge-expense` — type badges
- `.alert-warning` / `.alert-success` / `.alert-danger` — insight banners
- `.table-row-alt` — alternating table row colours
- `.skeleton` — shimmer loading placeholder
- `.progress-bar-fill` — animated budget bar

---

## ✅ Feature Checklist

- [x] JWT Authentication (register, login, session restore)
- [x] Protected routes (ProtectedRoute + PublicRoute guards)
- [x] React Error Boundary (class component)
- [x] Dark / Light mode toggle (Tailwind `class` strategy, localStorage)
- [x] Smart Insights Engine (food >40%, savings >20%, budget exceeded)
- [x] Animated Budget Progress Bar (green/amber/red thresholds)
- [x] Category Breakdown Doughnut Chart (dark mode reactive)
- [x] 🎤 Voice Dictation (Web Speech API for title + notes)
- [x] Transaction Table with search, filter, pagination
- [x] 1-Click CSV Export (blob URL download)
- [x] Alternating row colours + hover effects
- [x] Responsive grid layout (`grid-cols-1 md:grid-cols-3`)
- [x] Semantic HTML5 (`<main>`, `<nav>`, `<section>`, `<article>`, `<header>`, `<footer>`)
- [x] MongoDB Aggregation Pipeline (no in-memory summing)
- [x] Global error handler (Express)
- [x] Inline MERN data flow comments throughout
