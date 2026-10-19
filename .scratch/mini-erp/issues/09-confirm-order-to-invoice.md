# 09: Confirm → stock out + Invoice in one transaction (US-1)

**What to build:** Confirming a Draft runs one DB function (`confirm_sales_order`, ADR-0002). In one transaction it:
1. checks every line has enough On Hand
2. writes one `sale` Stock Movement per line
3. takes the next `INV` number
4. writes the Invoice: Subtotal, VAT = round(Subtotal × 0.07, 2), Total, Invoice Date today in Bangkok, Due Date = date + the Customer's Payment Terms
5. sets the order to Confirmed

If any line is short, nothing changes and the API returns `409` "Not enough stock for <SKU>". Confirmed orders are read-only. Only Sales and the Admin may Confirm.

**Blocked by:** 07, 08

**Status:** ready-for-agent

**Branch:** `feature/sales-orders`

- [ ] US-1: with ARB-1KG at 170, confirming Café Lune's Draft of 20 × ARB-1KG at 450 → `200`.
  - On Hand is 150.
  - The response and `GET` of the Invoice show `INV-0001` with Subtotal 9,000.00, VAT 630.00 and Total 9,630.00.
  - The Due Date is invoice date + 30 days.
- [ ] US-1: confirming a line of 171 × ARB-1KG → `409` "Not enough stock for ARB-1KG".
  - On Hand is still 170 and the order is still Draft.
  - No Invoice exists, and the next successful Confirm still gets `INV-0001`.
- [ ] A Draft with no lines → `409` "Add at least one line". Confirming an already Confirmed or Cancelled order → `409`.
- [ ] US-3: Warehouse calling the Confirm endpoint directly → `403`, and nothing changes. Accountant → `403`.
- [ ] A Confirmed order can't be edited or cancelled (`409`).
- [ ] Screen:
  - "Confirm order" primary button with a confirmation dialog showing the Total
  - on success, the screen shows the Invoice number with a link
  - on `409`, the API message is shown
  - Confirmed orders are read-only
- [ ] Section 1 of `testing-manual.md` (steps 3–6) is verified against the real screens.
