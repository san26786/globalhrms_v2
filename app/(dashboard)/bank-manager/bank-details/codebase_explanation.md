# Global HRMS - Project Structure & Code Explanation

This document outlines the architecture, directory structure, and key files of the **Global HRMS** project. It is structured to help you present the codebase clearly and confidently to your project coordinator/examiner ("Ma'am").

---

## ðŸš€ 1. Overview of the Project
This is a modern **Next.js (App Router)** web application designed for a Human Resource Management System (HRMS). It includes:
* **Dynamic Table Column Settings**: Allowing users to toggle which columns are visible in tables and forms.
* **Database Pooling & Local Emulation**: A robust data layer that connects to PostgreSQL via Prisma but can seamlessly fall back to local JSON file storage (`db_local.json`) if the database is offline.
* **Modular Reusable Form Blocks**: Unified form components (inputs, selects, textareas, etc.) driven by React Hook Form.

---

## ðŸ“ 2. Directory Structure (Folder Directory Tree)

Below is the structure of the project:

```yaml
globalhrms/
â”œâ”€â”€ app/                      # Main Next.js App Router directory
â”‚   â”œâ”€â”€ (auth)/               # Authentication pages (login, registration)
â”‚   â”œâ”€â”€ (dashboard)/          # Main dashboard views
â”‚   â”‚   â”œâ”€â”€ bank-details/     # Bank Account Details feature module
â”‚   â”‚   â”œâ”€â”€ common/           # Common data sync & master data configuration
â”‚   â”‚   â”œâ”€â”€ dashboard/        # Dashboard modules (attendance, leave, employee)
â”‚   â”‚   â””â”€â”€ layout.tsx        # Dashboard layout (Sidebar & Header wrapper)
â”‚   â”œâ”€â”€ api/                  # Backend REST API Route handlers
â”‚   â”‚   â”œâ”€â”€ bank-details/     # CRUD operations for Bank Accounts
â”‚   â”‚   â”œâ”€â”€ common/           # API routes for master/type syncing
â”‚   â”‚   â””â”€â”€ employees/        # Employee management API endpoints
â”‚   â”œâ”€â”€ components/           # Reusable UI & Logic components
â”‚   â”‚   â”œâ”€â”€ DynamicForm/      # Render forms dynamically from JSON config
â”‚   â”‚   â”œâ”€â”€ FormBlocks/       # Modular input field components (e.g. Input, Checkbox)
â”‚   â”‚   â”œâ”€â”€ layout/           # Global layout (Header, Sidebar, Tabs)
â”‚   â”‚   â””â”€â”€ ui/               # Base Tailwind CSS components (shadcn buttons, table, etc.)
â”‚   â”œâ”€â”€ lib/                  # Shared utility code (Prisma client config)
â”‚   â””â”€â”€ globals.css           # Global stylesheet containing core styling variables
â”œâ”€â”€ prisma/                   # Prisma ORM setup
â”‚   â””â”€â”€ schema.prisma         # Database schema containing all tables (employees, banks, etc.)
â”œâ”€â”€ db.ts                     # Database connection pool manager with JSON emulation fallback
â””â”€â”€ db_local.json             # Local database file used when PostgreSQL is offline
```

---

## ðŸ› ï¸ 3. Key Components & File Breakdown

### ðŸ”¹ Database & Backend
1. **`prisma/schema.prisma`**
   * **Role**: Defines the schema and relationships of all database tables (e.g., `bankdetails`, `employees`, `attendance`, `independent_mst`).
   * **Why it matters**: Prisma uses this schema to generate types and perform operations.

2. **[db.ts](file:///c:/Users/ashis/OneDrive/Desktop/NextJs/globalhrms/db.ts)**
   * **Role**: Connects to the database using `pg.Pool`.
   * **Emulation Fallback**: If PostgreSQL isn't configured, it emulates database operations locally by reading/writing to `db_local.json`. This keeps the app running offline.

### ðŸ”¹ Bank Details Module (`app/(dashboard)/bank-details/`)
This is the core module managing bank accounts:
1. **[page.tsx](file:///c:/Users/ashis/OneDrive/Desktop/NextJs/globalhrms/app/(dashboard)/bank-details/page.tsx)**
   * **Role**: The main list page. It fetches bank accounts from `/api/bank-details`, defines table columns dynamically based on user settings, and renders the `<DataTable>` component.
2. **[bank-detailsTable.tsx](file:///c:/Users/ashis/OneDrive/Desktop/NextJs/globalhrms/app/(dashboard)/bank-details/components/bank-detailsTable.tsx)**
   * **Role**: A premium TanStack Table component. It handles page numbers, sorting, row counts (e.g., showing 5, 10, or 25 entries), and pagination.
3. **[bank-detailsColumns.tsx](file:///c:/Users/ashis/OneDrive/Desktop/NextJs/globalhrms/app/(dashboard)/bank-details/components/bank-detailsColumns.tsx)**
   * **Role**: Defines table column properties (select rows, actions for editing/deleting, labels, and sort controls).
4. **[FormSettingsModal.tsx](file:///c:/Users/ashis/OneDrive/Desktop/NextJs/globalhrms/app/(dashboard)/bank-details/components/FormSettingsModal.tsx)**
   * **Role**: Settings popup where users can check/uncheck columns to toggle visibility dynamically in lists or forms.

### ðŸ”¹ Forms & Custom Controls (`app/components/FormBlocks/`)
Instead of duplicating input codes, we use atomic, modular blocks:
* **`InputBlock.tsx`**: Renders text/number input boxes with floating borders.
* **`CheckboxBlock.tsx`**: Renders custom checkboxes.
* **`TextAreaBlock.tsx`**: Text field wrapper for long notes/descriptions.
* **`SelectBlock.tsx`**: Standard dropdown selectors.
* **`DatePickerBlock.tsx`**: Calendar picker inputs.

---

## ðŸ”„ 4. How the Data Flows (Data Lifecycle Example)

When a user opens the **Bank Details** page:
```mermaid
sequenceDiagram
    participant User
    participant Frontend (Page.tsx)
    participant API (api/bank-details/route.ts)
    participant Database (Prisma / db_local.json)

    User->>Frontend (Page.tsx): Load Page
    Frontend (Page.tsx)->>API (api/bank-details/route.ts): Fetch GET /api/bank-details
    API (api/bank-details/route.ts)->>Database (Prisma / db_local.json): Fetch records
    Database (Prisma / db_local.json)-->>API (api/bank-details/route.ts): Return data
    API (api/bank-details/route.ts)-->>Frontend (Page.tsx): Return resolved JSON list
    Frontend (Page.tsx)-->>User: Show table with dynamic columns & pagination
```
