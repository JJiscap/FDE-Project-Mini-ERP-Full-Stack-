import { Receivables } from './Receivables'

/**
 * Accounting (Admin and Accountant only; the route guard and the API both enforce it).
 * Open Invoices with Balances, Overdue first, the Open Receivables total, and the Record payment dialog.
 */
export default function AccountingPage() {
  return <Receivables />
}
