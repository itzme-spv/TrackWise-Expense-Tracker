# Smart Expense Tracker — Backend

> Node.js + Express + MongoDB REST API (Phase 1 of the MERN Stack)

---

## Folder Structure

```
backend/
├── config/
│   └── db.js                  # Mongoose connection helper
├── controllers/
│   ├── authController.js      # register, login, getMe, updateBudget
│   └── transactionController.js  # CRUD + summary + insights + CSV export
├── middleware/
│   └── authMiddleware.js      # JWT protect middleware
├── models/
│   ├── User.js                # Mongoose User schema + bcrypt + JWT helpers
│   └── Transaction.js         # Mongoose Transaction schema + aggregation statics
├── routes/
│   ├── auth.js                # POST /register, POST /login, GET /me, PUT /budget
│   └── transactions.js        # GET|POST /, DELETE /:id, /summary, /insights, /export
├── .env.example               # Environment variable template
├── package.json
└── server.js                  # Express app entry point + global error handler
```

---

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `MONGO_URI` — Your MongoDB Atlas connection string
- `JWT_SECRET` — A long random string (e.g., run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `JWT_EXPIRE` — Token lifespan (e.g., `7d`)
- `CLIENT_ORIGIN` — Your frontend URL (e.g., `http://localhost:5173`)

### 3. Run the Server
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

---

## API Endpoints

### Auth Routes — `/api/auth`

| Method | Endpoint        | Auth | Description                    |
|--------|-----------------|------|-------------------------------|
| POST   | `/register`     | ❌   | Create a new user account     |
| POST   | `/login`        | ❌   | Authenticate + receive JWT    |
| GET    | `/me`           | ✅   | Get current user profile      |
| PUT    | `/budget`       | ✅   | Update monthly budget goal    |

### Transaction Routes — `/api/transactions`

| Method | Endpoint    | Auth | Description                                      |
|--------|-------------|------|--------------------------------------------------|
| GET    | `/`         | ✅   | Get all transactions (filter, search, paginate)  |
| POST   | `/`         | ✅   | Add a new transaction                            |
| DELETE | `/:id`      | ✅   | Delete a transaction by ID                       |
| GET    | `/summary`  | ✅   | Dashboard summary (totals + category breakdown)  |
| GET    | `/insights` | ✅   | Smart spending alerts                            |
| GET    | `/export`   | ✅   | Download all transactions as CSV                 |

### Query Parameters for GET `/api/transactions`

| Param      | Type   | Example           | Description                      |
|------------|--------|-------------------|----------------------------------|
| `page`     | number | `?page=2`         | Page number (default: 1)         |
| `limit`    | number | `?limit=10`       | Results per page (default: 10)   |
| `type`     | string | `?type=Expense`   | Filter by Income or Expense      |
| `category` | string | `?category=Food`  | Filter by category               |
| `search`   | string | `?search=coffee`  | Search by title (regex)          |

---

## Authentication Flow

```
1. Client: POST /api/auth/register  { name, email, password }
2. Server: Hash password → Save User → Return JWT + user object
3. Client: Stores JWT in localStorage

4. Client: POST /api/auth/login  { email, password }
5. Server: Compare bcrypt hash → If match → Return JWT + user object

6. Client: Subsequent requests include header:
           Authorization: Bearer <token>
7. Server: protect middleware verifies JWT → Attaches req.user → Route handler runs
```

---

## Mongoose Schema Summary

### User
| Field          | Type     | Required | Notes                              |
|----------------|----------|----------|------------------------------------|
| name           | String   | ✅       | min 2, max 60                      |
| email          | String   | ✅       | unique, lowercase, regex validated |
| password       | String   | ✅       | bcrypt hashed, `select: false`     |
| monthlyBudget  | Number   | default  | Default ₹50,000                    |
| avatarColor    | String   | default  | Hex colour for UI avatar           |

### Transaction
| Field     | Type     | Required | Notes                                      |
|-----------|----------|----------|--------------------------------------------|
| title     | String   | ✅       | min 2, max 100                             |
| amount    | Number   | ✅       | min 1                                      |
| type      | String   | ✅       | Enum: Income, Expense                      |
| category  | String   | ✅       | Enum: 8 categories                         |
| date      | Date     | default  | Date.now                                   |
| user_id   | ObjectId | ✅       | Ref: User, indexed                         |
| notes     | String   | ❌       | max 250                                    |
