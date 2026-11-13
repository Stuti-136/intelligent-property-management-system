# Intelligent Property Management System

Next.js + PostgreSQL + Neo4j.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your values (never commit `.env.local`).
3. Make sure the PostgreSQL tables from the SQL scripts exist.
4. `npm run dev` then open http://localhost:3000

## Auth API
| Method | Route | Purpose |
|---|---|---|
| POST | /api/auth/register | Create account (Landlord or Tenant) and log in |
| POST | /api/auth/login | Log in, sets httpOnly session cookie |
| POST | /api/auth/logout | Clears the session cookie |
| GET | /api/auth/me | Current logged-in user |

Protect any route with:
```js
const { session, error } = await requireAuth(["Landlord"]);
if (error) return error;
```
