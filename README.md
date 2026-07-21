# Dealership

A full-stack dealership management platform with a public facing vehicle inventory site and a private staff portal for managing requests, inventory, and team operations.

---

## Overview

The platform is split into two surfaces:

**Public site** - allows visitors to browse inventory, shortlist and compare vehicles, submit contact enquiries, trade-in valuations, finance applications, and test drive bookings.

**Staff portal** - a role based internal dashboard for managing incoming requests, inventory, staff accounts, and system configuration across one or more dealership locations.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth |
| Deployment | Vercel |

---

## Features

### Public
- Vehicle inventory with filtering by make, body type, price, and transmission
- Shortlist (favourites) and side by side vehicle comparison
- Contact, trade-in, finance, and test drive request forms
- Per vehicle enquiry form

### Staff Portal
- Dashboard with live request counts and recent activity feed
- Request management - contact, trade-in, and finance queues with status tracking, assignment, and internal notes with edit/delete
- Inventory management - create, edit, and update vehicle status
- Staff management - invite based onboarding, role assignment, location assignment
- Role based access control with granular permissions
- Multi location support with per-location filtering
- Audit log of all staff actions
- System settings - business details, email notifications, data retention policy

---



## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in DATABASE_URL, NEXTAUTH_SECRET, and any email settings

# Push schema and generate client
npx prisma db push
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing |
| `NEXTAUTH_URL` | Base URL of the application |
| `CRON_SECRET` | Shared secret for protected cron endpoints |

---

## Access

The staff portal is invite only. The first owner account must be seeded directly in the database. All subsequent staff are onboarded via email invite links generated from the portal.
