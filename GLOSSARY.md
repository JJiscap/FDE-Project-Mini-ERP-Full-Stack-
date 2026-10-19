# Siam Bean Mini ERP

One shared system where Siam Bean Co.'s sales, stock, invoices, payments and dashboard read and write the same data. It replaces the LINE-to-spreadsheet-to-Word process described in `docs/scenario.md`.

## Parties and people

**Company**:
The business that owns all the data in the system (the tenant). Siam Bean Co. is the only real Company; every record belongs to exactly one.
_Avoid_: Tenant, organisation, account

**Customer**:
A café that buys from Siam Bean and receives Invoices. Identified to the tax office by its Tax ID.
_Avoid_: Client, buyer, account, café (in code)

**Supplier**:
A farm that sells beans to Siam Bean. Only used by the purchasing bonus, which is not being built.
_Avoid_: Vendor

**User**:
A staff member who logs in. Belongs to one Company and has exactly one Role.
_Avoid_: Account, member, employee

**Role**:
What a User is allowed to do: Admin, Sales, Warehouse or Accountant. The server enforces it; hiding a button is not enforcement.
_Avoid_: Permission level, group

## Master data

**Product**:
Something Siam Bean sells, identified by a unique SKU (e.g. `ARB-1KG`), with today's Price, Cost, Unit and Reorder Level.
_Avoid_: Item, article, good

**SKU**:
The short unique code of a Product within a Company, e.g. `ARB-1KG`.
_Avoid_: Product code, item number

**Price**:
The Product's current selling price per Unit, excluding VAT. Only the Admin changes it.
_Avoid_: Sale price, list price, rate

**Cost**:
What one Unit of a Product costs Siam Bean. Used for Stock Value.
_Avoid_: Purchase price, buy price

**Unit**:
How a Product is counted and sold: `kg` (one 1 kg bag) or `box`. Quantities are whole numbers of Units.

**Active / Deactivated**:
A Deactivated Product or Customer can't be used on new Sales Orders but stays on old documents. Nothing with documents is ever deleted.
_Avoid_: Deleted, archived, disabled

## Inventory

**Stock Movement**:
One signed change to a Product's stock (+ in, − out), with a type, a reference document, a time and the User who caused it. It is never edited or deleted.
_Avoid_: Stock transaction, inventory log, stock entry

**On Hand**:
The quantity of a Product in the warehouse: the sum of all its Stock Movements. Nobody types it.
_Avoid_: Stock level, quantity, balance, inventory

**Reorder Level**:
The On Hand quantity below which a Product needs reordering.
_Avoid_: Minimum stock, threshold, safety stock

**Low Stock**:
A Product whose On Hand is strictly below its Reorder Level.
_Avoid_: Out of stock (that means On Hand = 0)

**Stock-in**:
A positive Stock Movement recorded by the warehouse when beans arrive, numbered `IN-0001`.
_Avoid_: Goods receipt (that is the purchasing bonus document)

**Stock-out**:
A negative Stock Movement recorded by the warehouse for beans that leave without a Sales Order (samples, write-offs), with a required reason. Numbered `OUT-0001`.
_Avoid_: Delivery, write-off (as a separate concept)

**Adjustment**:
A signed Stock Movement that corrects On Hand after a physical count, with a required reason. Numbered `ADJ-0001`. The difference is entered, never the counted quantity.
_Avoid_: Stock correction, recount, set stock

**Opening Stock**:
The Stock Movement that sets a Product's On Hand when the system starts.

**Stock Value**:
The sum of On Hand × Cost over all Active Products.

## Sales and billing

**Sales Order**:
A Customer's request for Products, numbered `SO-0001`, made of Order Lines. It is Draft, Confirmed or Cancelled.
_Avoid_: Order (alone, in code), quotation, purchase

**Draft**:
A Sales Order still being written: its Customer and Order Lines can change, and it has no effect on stock or money.
_Avoid_: Pending, open (for orders), quotation

**Confirmed**:
A Sales Order that has been Confirmed. It is final: no edits and no cancelling.
_Avoid_: Approved, processed, closed

**Cancelled**:
A Draft Sales Order that was abandoned. It keeps its Document Number, which is never reused.
_Avoid_: Deleted, voided

**Order Line**:
One Product on a Sales Order: Quantity and the Unit Price copied from the Product at that moment.
_Avoid_: Order item, row, line item

**Unit Price**:
The price per Unit on an Order Line, excluding VAT, frozen when the line is added. Later Price changes never touch it.
_Avoid_: Price (on a line)

**Confirm**:
The single action that turns a Draft Sales Order into a Confirmed one. It takes the Products out of stock and issues the Invoice, all together or not at all.
_Avoid_: Approve, submit, finalise, post

**Invoice**:
The frozen bill issued when a Sales Order is Confirmed, numbered `INV-0001`, storing Subtotal, VAT and Total. It is Open until fully paid, then Paid.
_Avoid_: Bill (that means a supplier's bill), receipt, tax invoice (in code)

**Subtotal / VAT / Total**:
On an Invoice: Subtotal is the sum of Order Line amounts excluding VAT. VAT is 7% of the Subtotal. Total is Subtotal + VAT.

**Open / Paid**:
An Invoice is Open while its Balance is above zero and Paid once it reaches zero.
_Avoid_: Unpaid, settled, closed

**Overdue**:
An Open Invoice whose Due Date has passed. It is a label, not a separate status.
_Avoid_: Late, past due

**Payment**:
Money received from a Customer against one Invoice. It may be partial, but never more than the Balance.
_Avoid_: Receipt, transaction, settlement

**Balance**:
What is still owed on an Invoice: its Total minus its Payments.
_Avoid_: Outstanding, remaining, due amount

**Open Receivables**:
The sum of Balances of all Open Invoices: what Customers still owe Siam Bean.
_Avoid_: AR, debt, outstanding

**Payment Terms**:
How many days a Customer has to pay an Invoice (Cash = 0 days).
_Avoid_: Credit term

**Due Date**:
Invoice date + the Customer's Payment Terms.

**Document Number**:
The sequential, never-reused number of a document within a Company: `SO-0001` (Sales Order), `INV-0001` (Invoice), and `IN-`, `OUT-` or `ADJ-0001` (manual Stock Movements).
_Avoid_: ID, reference, code

## Reporting

**Dashboard**:
The screen every User sees with live numbers computed from the same data: Sales Today, Low Stock count, Open Invoices and Stock Value.
_Avoid_: Report, home, overview

**Sales Today**:
The sum of Totals (including VAT) of Invoices dated today in Bangkok time.
_Avoid_: Revenue, turnover
