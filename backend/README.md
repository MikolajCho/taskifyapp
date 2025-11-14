# Backend Application

This is the backend for an application built with **Node.js**, using **tRPC**, **Drizzle ORM**, and **pnpm** as the package manager. The database runs in **Docker**, providing isolated, consistent, and easily reproducible development environments. It's designed for performance, simplicity, and full end-to-end type safety.

## Quick Start

**Prerequisite:** Clone the repository and copy `.env.example` to `.env`, then fill in database connection details.

```bash
# Install dependencies
pnpm install

# Start database container
docker-compose up -d

# Sync database schema (recommended - uses db:push)
pnpm "db:reset"

# Launch development server
pnpm run dev
