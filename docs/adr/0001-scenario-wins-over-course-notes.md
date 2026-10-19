# The scenario wins over the course notes

The CU FDE3 class notes include a role matrix where Sales can *edit* products and customers, and a US-3 variant about inviting users. `docs/scenario.md` (from the workshop worksheet) gives Sales "edit customers" only, Warehouse "view products", and Admin "everything, including users and prices". The worksheet says "the scenario wins", so we follow `docs/scenario.md`:

- Only the Admin creates, edits, re-prices or deactivates Products.
- Order Line prices are copied from the Product and can't be edited.
- The Accountant sees Invoices but not Sales Orders.

Where the scenario is silent, we pick the narrowest permission that still lets each person do their job.
