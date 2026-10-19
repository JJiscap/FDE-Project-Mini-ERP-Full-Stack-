import { BrowserRouter, Route, Routes } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth, RequireScreen } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query-client'
import LoginPage from '@/pages/login'
import NotFoundPage from '@/pages/system/NotFound'
import { MODULE_ROUTES } from '@/routes'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                {MODULE_ROUTES.map(({ screen, path, Page }) => (
                  <Route
                    key={screen}
                    // Modules own everything under their path, so they can add sub-routes.
                    path={path === '/' ? '/' : `${path}/*`}
                    element={
                      <RequireScreen screen={screen}>
                        <Page />
                      </RequireScreen>
                    }
                  />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
