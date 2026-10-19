import { Route, Routes } from 'react-router'
import { InvoiceDetail } from './InvoiceDetail'
import { InvoiceList } from './InvoiceList'

/** Invoices (Admin, Sales, Accountant): the list and one Invoice. Payments are recorded from the Accounting screen or the detail. */
export default function InvoicesPage() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path=":id" element={<InvoiceDetail />} />
    </Routes>
  )
}
