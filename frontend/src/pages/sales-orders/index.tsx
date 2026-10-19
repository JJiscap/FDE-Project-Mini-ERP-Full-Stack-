import { Route, Routes } from 'react-router'
import { NewOrder } from './NewOrder'
import { OrderDetail } from './OrderDetail'
import { OrderList } from './OrderList'

/**
 * Sales Orders (Admin and Sales): the list, the New order flow and one order.
 * Ticket 09 (Confirm) plugs into `OrderActions.tsx`, not here.
 */
export default function SalesOrdersPage() {
  return (
    <Routes>
      <Route index element={<OrderList />} />
      <Route path="new" element={<NewOrder />} />
      <Route path=":id" element={<OrderDetail />} />
    </Routes>
  )
}
