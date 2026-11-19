# Intelligent Property Management System

A full-stack, hybrid-database application for managing properties, tenants, rent payments and maintenance requests.

Next.js provides the frontend and the API layer. PostgreSQL stores the relational data and keeps it consistent. Neo4j maps the relationships between landlords, properties, tenants and repair requests, and the app draws them as a graph.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React, custom CSS
- **API:** Next.js Route Handlers
- **Relational database:** PostgreSQL
- **Graph database:** Neo4j
- **Authentication:** JWT in an httpOnly cookie (`jose`), passwords hashed with `bcryptjs`

## Features

- **Role-based access:** separate Landlord and Tenant areas, enforced on both pages and API routes.
- **Properties:** landlords add, edit, delete, search and filter properties. Status switches between Available and Occupied automatically.
- **Tenants and leases:** landlords assign a tenant to a property with lease dates and an optional lease PDF (stored on local disk, name and path stored in the database), view lease history and end leases.
- **Rent:** landlords generate a bill per tenant per month and record payments. Late payments show as Overdue. Tenants see their own history, balance and late fee.
- **Maintenance:** tenants submit requests with a priority. Landlords move them from Submitted to In Progress to Resolved.
- **Dashboards:** landlord summary (properties, occupancy, open repairs, rent collected) and tenant summary (home, next rent, open repairs, lease download).
- **Network graph:** interactive graph of the data stored in Neo4j.

## Database Concepts Demonstrated

### PostgreSQL

1. **Transaction:** `/api/tenants/assign` inserts the tenant, marks the property Occupied and saves the lease document in one transaction. If any step fails, none are saved.
2. **Triggers:** `trg_auto_overdue` marks late pending payments as Overdue. `trg_auto_resolve` sets `resolved_at` when a request is resolved.
3. **Views:** `landlord_dashboard_summary_view` and `tenant_payment_history_view` feed the dashboards.
4. **Stored functions:** `calculate_tenant_overdue_rent()` and `calculate_tenant_late_fee()` do the overdue and late fee calculations inside the database.

### Neo4j

- Nodes `(:User)`, `(:Property)` and `(:MaintenanceRequest)`, connected by `[:OWNS]`, `[:RENTS]`, `[:SUBMITTED]` and `[:FOR_PROPERTY]`.
- The graph is updated with `MERGE` queries after each successful SQL change. If Neo4j is unreachable, the SQL change is still saved.

## Setup

### 1. Prerequisites

- Node.js 18 or higher
- PostgreSQL
- Neo4j Desktop

### 2. Install

```bash
git clone https://github.com/Stuti-136/intelligent-property-management-system.git
cd intelligent-property-management-system
npm install
```

### 3. PostgreSQL

Create a database in pgAdmin, then run these files from the `database/` folder in this order:

1. `Property_Management_System.sql` (tables)
2. `transactions_and_triggers.sql` (triggers)
3. `views_and_functions.sql` (views and stored functions)
4. `dummy_data.sql` (optional sample data)

### 4. Neo4j

1. Start a local Neo4j instance.
2. Optional: run `database/neo4j_seed.cypher` in Neo4j Browser for sample nodes.
3. Optional: copy existing PostgreSQL data into Neo4j with `npm run sync-graph`.

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=your_database_name

# Neo4j (use bolt://, not neo4j://)
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Auth
JWT_SECRET=a_long_random_string
```

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000 and register a Landlord and a Tenant account. The sample users in `dummy_data.sql` cannot log in, because their password hashes are placeholders.

A tenant sees an empty dashboard until a landlord assigns them to a property from the Tenants page.

Uploaded lease PDFs are saved in `uploads/leases/`, which is excluded from git.

## API Routes

| Method | Route | Purpose |
| :--- | :--- | :--- |
| **Auth** | | |
| POST | `/api/auth/register` | Create an account (Landlord or Tenant) and log in |
| POST | `/api/auth/login` | Log in and set the session cookie |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Current logged-in user |
| **Properties and tenants** | | |
| GET, POST | `/api/properties` | List or create properties |
| GET, PATCH, DELETE | `/api/properties/[id]` | View, edit or delete a property |
| GET | `/api/tenants` | List tenancies (filtered by role) |
| GET | `/api/tenants/candidates` | Tenants a landlord can assign |
| POST | `/api/tenants/assign` | Transaction: assign a tenant and upload the lease PDF |
| POST | `/api/tenants/[id]/end` | End a lease and free the property |
| **Leases** | | |
| GET | `/api/lease` | List lease documents |
| GET | `/api/lease/[id]` | Download a lease PDF |
| **Rent** | | |
| GET | `/api/payments` | Payment history |
| POST | `/api/payments/generate` | Landlord creates a rent bill |
| PATCH | `/api/payments/[id]` | Landlord records a payment |
| **Maintenance** | | |
| GET, POST | `/api/maintenance` | List or submit requests |
| PATCH | `/api/maintenance/[id]` | Landlord updates request status |
| **Dashboards and graph** | | |
| GET | `/api/dashboard` | Summary from the SQL views |
| GET | `/api/dashboard/tenant` | Tenant overview |
| GET | `/api/graph` | Nodes and edges from Neo4j |

---

**Course:** DBMS Experiential Learning, Level 3 Project
**Team:** Stuti Garg, Tanushree P
**Section:** C (AIML)
