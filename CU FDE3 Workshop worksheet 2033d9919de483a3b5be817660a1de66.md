# CU FDE3 Workshop worksheet

Duplicate this page for your team.

<aside>
🎯

**Assignment at a glance**

- **Build:** a Mini ERP for **Siam Bean Co.** (the scenario below, same for every team). ERP = one system where sales, stock, invoices and a dashboard share one database. Full stack, deployed online like a SaaS (an app people use in the browser with a login).
- **How:** with an AI coding agent (Claude Code, Codex, Copilot or Freebuff) and the Matt Pocock skills flow from CU FDE2
- **Team:** 3–4 students
- **Tonight (before 20:00, Thu 15 Oct):** repo, Supabase and agent set up, scenario grilled, spec and tickets in the repo, first ticket started with tests. Submit the repo link through the course form (link TBD).
- **Final (Class 4, Thu 22 Oct 2026, 17:00):** 10 minutes per team: 7 min live demo + 3 min Q&A, on your deployed URL
- **Points:** project = 20 points (+ up to 2 bonus, capped at 20)
</aside>

# The scenario: Siam Bean Co.

- This is your input. Do not invent a business. Save this section in your repo as `docs/scenario.md` and give it to your agent.

## Company

- Siam Bean Co. is a small coffee-bean distributor in Bangkok
- It imports and roasts beans, then sells 1 kg bags to about 80 cafés
- 5 staff, one office and one warehouse
- Today: orders come by LINE and phone, sales retype them into a spreadsheet, stock is in another sheet, invoices are made in Word and numbered by hand

## Users and roles

| Role | Who | Can do |
| --- | --- | --- |
| Admin (owner) | Khun Somchai | Everything, including users and prices |
| Sales | Nok, Ploy | Edit customers, create and confirm sales orders, view invoices |
| Warehouse | Lek | Stock in, stock out, adjustments. View products. |
| Accountant | Fon | Invoices and payments. View products and customers. |
- Everyone can see the dashboard

## Pain points (owner's words)

1. "Stock in the sheet is always wrong."
2. "Each invoice takes me an hour and the numbers get mixed up."
3. "I never know who still owes me money."
4. "Sales sometimes promise beans we don't have."
5. "Anyone can change anything in the spreadsheet."

## Scope

- **In scope (must have)**
    - Login with roles
    - Products and customers: create, list, edit, deactivate
    - Stock: stock-in form, stock goes down when an order is confirmed, low-stock alert
    - Sales order → invoice with 7% VAT
    - Record a payment against an invoice
    - Dashboard with at least 3 live numbers
    - Deployed with a public URL
- **Out of scope** (do not build unless it is your bonus)
    - Quotations and delivery notes
    - Purchasing (purchase orders, goods receipts): bonus only
    - More than one company: bonus only
    - HR and payroll, withholding tax, multiple warehouses, LINE integration

## User stories (given: do not rewrite them, build them)

- **US-1 Sales order → invoice.** As a sales staff, I want to create and confirm a sales order for a café so that stock is reserved and an invoice is issued.
    - Given 170 kg of `ARB-1KG` on hand, when I confirm an order for Café Lune of 20 kg at 450 THB, then on hand shows 150 kg and `INV-0001` shows 9,000 + 630 VAT = 9,630 THB
    - Given a line quantity greater than stock on hand, when I confirm, then I see "Not enough stock for ARB-1KG" and nothing changes
- **US-2 Low stock.** As a warehouse staff, I want to see which products are low on stock so that I can reorder in time.
    - Given a product below its reorder level, when I open the product list, then it shows a low-stock badge and the dashboard low-stock count includes it
- **US-3 Roles.** As the owner, I want each user to have a role so that they only see and do what they are allowed to.
    - Given a Sales user, when they open the Accounting screen, then they see an access-denied page and the API returns `403`
    - Given a Warehouse user, when they call the confirm-order API directly, then it returns `403`
    - Given an Admin, when they open the same screens, then they load
- **US-4 Payment.** As an accountant, I want to record a payment against an invoice so that I know what is still owed.
    - Given open invoice `INV-0001` of 9,630 THB, when I record a full payment, then its status becomes Paid and open receivables on the dashboard drop by 9,630 THB
- **US-5 Search.** As a sales staff, I want to search customers so that I find one quickly.
    - Given 200 customers, when I type part of a name, then the list filters within 1 second and shows at most 20 rows per page

## Sample master data

- Master data = the things the business deals with: products, customers, suppliers. Load these as your test data.

**Products**

| SKU | Name | Unit | Cost (THB) | Price (THB) | Reorder level | Opening stock |
| --- | --- | --- | --- | --- | --- | --- |
| ARB-1KG | Arabica, 1 kg bag | kg | 320 | 450 | 50 | 170 |
| ROB-1KG | Robusta, 1 kg bag | kg | 220 | 320 | 40 | 35 |
| BLD-1KG | House Blend, 1 kg bag | kg | 260 | 380 | 30 | 90 |
| DRP-10 | Drip bags, box of 10 | box | 90 | 150 | 100 | 240 |

**Customers**

| Name | Tax ID (fictional) | Payment terms |
| --- | --- | --- |
| Café Lune | 0105561000011 | 30 days |
| Brew Lab Ari | 0105562000022 | Cash |
| Sukhumvit Corner Café | 0105563000033 | 15 days |

**Suppliers** (only needed for the purchasing bonus)

| Name | Location | Lead time | Payment terms |
| --- | --- | --- | --- |
| Doi Chang Farm | Chiang Rai | 7 days | 30 days |
| Nan Highland Coffee | Nan | 14 days | 60 days |
- ROB-1KG starts below its reorder level on purpose: US-2 should show it as low stock

## Business rules

1. VAT is 7%. Store the unit price without VAT on the order line. The invoice stores subtotal, VAT and total.
2. Stock can never go negative. Confirming an order with too little stock fails and changes nothing.
3. Stock on hand = the sum of stock movements (+ in, − out). Nobody types the stock number.
4. Document numbers are sequential and never reused: `SO-0001` (sales order), `INV-0001` (invoice), `PO-0001` (purchase order, bonus)
5. Confirming an order creates the stock movements and the invoice together, in one transaction (all or nothing)
6. The price is copied onto the order line. Changing a product price never changes old orders or invoices.
7. Products and customers with documents are deactivated, never deleted
8. Roles are checked on the server: the API returns `403` for the wrong role, even if the button is hidden
9. Validation: price ≥ 0, quantity above 0, SKU unique, customer tax ID required

## Success criteria

- Café Lune's 20 kg order goes from order → stock → invoice → payment → dashboard on the live URL, and the numbers agree on every screen
- A Warehouse user cannot confirm an order, even by calling the API
- The owner sees today's sales, low-stock count and open invoices on the dashboard without asking anyone

# Scoring

- Scored live in Class 4. Same split as [‣](https://app.notion.com/p/3fabcb52c6278118917de71b14fc2da8?pvs=21).

| Criterion | Points | Full marks when |
| --- | --- | --- |
| Core features | 7 | US-1 to US-4 pass live on the deployed URL: login with roles, products and customers, stock, order → invoice, payment. Bad input is rejected with a clear message. |
| Data model & backend | 3 | Tables are linked with foreign keys. The business rules above are enforced on the server (or in the database), not only in the screen. |
| UI / UX | 3 | Nok from Sales can create an order without training. Money looks like money (9,630.00 THB). Errors say what to fix. Empty lists say so. |
| Deployment | 2 | A public URL that works on a phone, with no errors, and a demo account for each role in the README. |
| Code quality & docs | 2 | The skills docs are in the repo: `GLOSSARY.md`, spec, tickets. Tests were written before the code (red before green). Commits from every member. README with setup and schema. No secret keys in git. |
| Demo & presentation | 3 | You explain Siam Bean's problem, show US-1 end to end as 2 roles, answer questions, and finish in 7 + 3 minutes. |
| **Total** | **20** |  |
- **Bonus:** +1 per stretch goal that works end to end, max +2. The project total is capped at 20.
    - Counts only if all minimum requirements work, it is shown live, and it is in the README
    - Ideas: purchasing (PO → goods receipt → stock in), a second company with separate data, PDF invoice, low-stock email or LINE alert, a small AI feature that shows its SQL
- The course total is 25: 5 points of homework from the previous class + 20 for this project

# Tonight: step-by-step (19:20–20:00)

- Same flow as the change requests in [‣](https://app.notion.com/p/3f1bcb52c6278097adf8c8a02968680d?pvs=21): `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/tdd` → `/implement`
- The prompts say "Claude Code". Codex, Copilot and Freebuff take the same prompts (in Codex write `$grill-with-docs` instead of `/grill-with-docs`).

## Step 1. Team, repo, Supabase and agent

- **Time box:** 19:20–19:26
- **Goal:** a shared repo every member can push to, a database, and an agent with the skills installed
- **What to do**
    - Form a team of 3–4. One member creates a GitHub repo and adds the others as collaborators.
    - Create a Supabase project (the hosted Postgres database from CU FDE2). Put the keys in `backend/.env` yourself.
    - Add `.env` to `.gitignore` before the first commit. Copy **The scenario** section into `docs/scenario.md` and commit.
    - Install the skills and run the setup once. Choose **Local markdown** for tickets.
    
    ```bash
    npx skills@latest add mattpocock/skills
    claude
    ```
    
- **Prompt for Claude Code:**
    
    ```
    /setup-matt-pocock-skills Use local markdown files for tickets. Our project is a Mini ERP for the business described in docs/scenario.md.
    ```
    
- **Done when:** `docs/agents/issue-tracker.md` and `docs/agents/domain.md` exist, `docs/scenario.md` is committed, and every member has cloned the repo

## Step 2. Grill the scenario

- **Time box:** 19:26–19:31
- **Goal:** the agent and your team agree on what to build, and the decisions are written into the docs
- **What to do**
    - One member drives the agent, the others answer its questions together
    - Use the business rules in the scenario to answer. If unsure, ask the agent to recommend an option and explain why.
    - Typical questions: Supabase Auth or own users table? Where does "confirm order" run? How are numbers like `INV-0001` generated?
- **Prompt for Claude Code:**
    
    ```
    /grill-with-docs Read docs/scenario.md. It is the business brief for our Mini ERP for Siam Bean Co. Stack: Supabase Postgres and Auth, Python FastAPI with uv, React TypeScript with Vite, deployed on Cloudflare Workers. The user stories US-1 to US-5 and the business rules in the scenario are fixed. Grill us on anything that is still unclear, one question at a time.
    ```
    
- **Done when:** `GLOSSARY.md` exists (and `docs/adr/` if a decision was recorded)

## Step 3. Spec and tickets, then split the work

- **Time box:** 19:31–19:35
- **Goal:** a spec and small tickets, each owned by one member
- **What to do**
    - Run `/to-spec` in the same session. Read the spec and fix anything wrong.
    - Run `/to-tickets`. Each ticket should be a thin slice: table + API + screen.
    - Split tickets by module: master data, sales and invoices, stock, login and dashboard
- **Prompt for Claude Code:**
    
    ```
    /to-spec
    ```
    
    ```
    /to-tickets Keep each ticket small enough to finish and test in one sitting. Order them: auth and roles, products and customers, stock movements, confirm order to invoice, payments, dashboard.
    ```
    
- **Done when:** `.scratch/<feature>/spec.md` and `.scratch/<feature>/issues/` are committed and every ticket has an owner (write it in the README)

## Step 4. Break

- **Time box:** 19:35–19:45

## Step 5. First ticket: tests first, then code

- **Time box:** 19:45–19:57
- **Goal:** each member starts their first ticket on their own branch, with failing tests before any code
- **What to do**
    - Good first tickets: products CRUD (create, list, edit, deactivate) or auth and roles
    - New branch per ticket. Add pytest once: `uv add --dev pytest`
    - See the tests fail (red) before you let the agent write code
    - Push the branch and open a pull request (a draft PR is fine tonight)
    
    ```bash
    git switch main
    git pull
    git switch -c feature/products-crud
    ```
    
- **Prompt for Claude Code:**
    
    ```
    /tdd Work on the products CRUD ticket. Write the failing tests first: create a product, list products, edit a price, deactivate a product, reject a negative price, reject a duplicate SKU. Run them with uv run pytest, show me that they fail, then stop. Do not write any implementation yet.
    ```
    
    ```
    /implement the products CRUD ticket. Make the failing tests pass without changing the tests.
    ```
    
- **Done when:** your branch is pushed with the tests, and a pull request is open

## Step 6. Submit

- **Time box:** 19:57–20:00
- **Goal:** hand in tonight's work
- **What to do**
    - Submit the repo link through the course form: (link TBD)
- **Done when:** every box below is ticked, before 20:00
    - [ ]  Repo link submitted (link TBD)
    - [ ]  `docs/scenario.md`, `GLOSSARY.md`, spec and tickets are on `main`
    - [ ]  Every member has a pushed branch and an open pull request
    - [ ]  `.env` is not in git

# Team

Fill in: team name, members, and who owns which module.

- **Team name:**
- **Repo link:**
- **Supabase project URL:**

| Name | Student ID | Module owned | GitHub username |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
- Split by module, not by frontend / backend. Each owner builds the tables, API and screens for their module, so every member commits across the whole stack.

# This week until Class 4

Fill in: who owns each goal, and tick Done.

| When | Master data | Sales and invoices | Stock | Login and dashboard |
| --- | --- | --- | --- | --- |
| Fri 16 – Sat 17 Oct | Products and customers CRUD, sample data loaded | Sales order tables and screen (draft orders) | Stock movements table, stock-in form, on-hand view | Supabase Auth, roles, `403` checks, **first deploy** |
| Sun 18 – Mon 19 Oct | Search and pagination (US-5) | Confirm order → stock → invoice in one transaction (US-1) | Low-stock badge (US-2) | Payments (US-4) |
| Tue 20 – Wed 21 Oct | README: schema, ER diagram, demo accounts | Dashboard: 3+ live numbers | Polish: errors, empty lists, money format | Rehearse the 7-min demo with a timer |
| Thu 22 Oct, 17:00 | Class 4: present for scoring | Everyone speaks | Everyone speaks | Everyone speaks |
- Every ticket: branch → `/tdd` → `/implement` → pull request → teammate review → merge → redeploy

## Minimum requirements

- [ ]  **Login with roles (US-3).** Done means: Admin, Sales, Warehouse and Accountant accounts can do different things, and the server blocks the wrong role with `403`.
- [ ]  **Products and customers.** Done means: create, list, edit, deactivate, with required fields checked. The sample data is loaded.
- [ ]  **Stock (US-2).** Done means: a stock-in form exists, stock goes down by itself when an order is confirmed, and low stock shows a badge.
- [ ]  **Sales order → invoice (US-1).** Done means: confirming creates `INV-000x` with the same lines and total + 7% VAT. Too little stock = error, nothing changes.
- [ ]  **Payments (US-4).** Done means: a full payment marks the invoice Paid.
- [ ]  **Dashboard.** Done means: at least 3 numbers (e.g. sales today, low-stock count, open invoices), calculated from the data.
- [ ]  **Relational database.** Done means: the ER diagram in the README matches the real tables.
- [ ]  **Deployed.** Done means: the public URL opens on a phone, outside your network, with no errors.

## Class 4 demo: 10 minutes per team

- **Minute 0–1: the problem.** Siam Bean's pain points and what you built.
- **Minute 1–7: live demo on the deployed URL.** US-1 end to end: Café Lune orders 20 kg of `ARB-1KG` → confirm → stock 170 → 150 → open the invoice (9,630 THB) → record the payment → dashboard updates. Log in as 2 different roles. Show one rule failing, e.g. Warehouse gets `403`.
- **Minute 7–10: Q&A.** Any member answers. We may ask to see the code, the tests or the spec behind a screen.
- Hard stop at 10 minutes. Team order is drawn at 17:00, so be ready from the start.

## Demo checklist

- [ ]  Deployed URL open and logged in before your turn (not `localhost`)
- [ ]  Demo accounts for every role listed in the README
- [ ]  README: setup, schema, ER diagram, US-1 to US-5 marked done / not done, who did what
- [ ]  `GLOSSARY.md`, spec and tickets in the repo
- [ ]  Tests pass: `uv run pytest`
- [ ]  Instructors added as collaborators on the repo
- [ ]  Every member has commits and speaks at least once
- [ ]  No secret keys in git or in the frontend
- [ ]  Rehearsed with a timer: demo under 7 minutes
- [ ]  Backup screenshots or a screen recording, in case the network fails
- [ ]  Bonus features (if any) work live and are in the README

# Stuck?

- **Where is the full explanation?** [‣](https://app.notion.com/p/3fabcb52c6278118917de71b14fc2da8?pvs=21): ERP modules, the 9-table ER diagram with starter SQL, the confirm-order manual, the full rubric.
- **How do I set up Supabase, FastAPI, React or deploy?** Follow the manuals in [‣](https://app.notion.com/p/3f1bcb52c6278097adf8c8a02968680d?pvs=21).
- **Which agent?** Claude Code is recommended. Codex, Copilot (free with the student plan) and Freebuff work too. Install steps are in CU FDE2.
- **The agent wrote a lot of code at once.** Stop it. Ask for one ticket at a time, and read the diff before you commit.
- **The agent says "all tests pass" but changed a test.** Reject it. Restore the test and ask it to fix the code instead. Never let it delete or weaken a test.
- **The agent asks for the Supabase key.** Never paste a secret key into the chat. Put it in `.env` yourself and tell the agent the variable name.
- **The agent invents a rule.** Point it back to `docs/scenario.md`. The scenario wins.
- **Git asks for a password?** Sign in with `gh auth login`, or use a personal access token.
- **Blocked for more than 10 minutes?** Tonight: raise your hand. This week: post in the course channel with your repo link. Post early: Friday gets help, Wednesday night may not.