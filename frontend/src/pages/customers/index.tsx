import { Route, Routes } from 'react-router'
import { CustomerDetail } from './CustomerDetail'
import { EditCustomer, NewCustomer } from './CustomerForm'
import { CustomerList } from './CustomerList'

/** Customers: list with search and pager, a Customer, and the new / edit forms (Admin and Sales). */
export default function CustomersPage() {
  return (
    <Routes>
      <Route index element={<CustomerList />} />
      <Route path="new" element={<NewCustomer />} />
      <Route path=":id" element={<CustomerDetail />} />
      <Route path=":id/edit" element={<EditCustomer />} />
    </Routes>
  )
}
