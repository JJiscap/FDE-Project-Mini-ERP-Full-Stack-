import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { LoginError, useAuth } from '@/auth/AuthProvider'
import { Brand } from '@/components/Brand'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageSpinner } from '@/components/PageSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email, like nok@siambean.test'),
  password: z.string().min(1, 'Enter your password'),
})
type LoginValues = z.infer<typeof schema>

/** Demo accounts for the course (the shared password is in the README, not on screen). */
const DEMO_ACCOUNTS = [
  { role: 'Admin', name: 'Somchai', email: 'somchai@siambean.test' },
  { role: 'Sales', name: 'Nok', email: 'nok@siambean.test' },
  { role: 'Warehouse', name: 'Lek', email: 'lek@siambean.test' },
  { role: 'Accountant', name: 'Fon', email: 'fon@siambean.test' },
]

export default function LoginPage() {
  const { session, signIn } = useAuth()
  const location = useLocation()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (session === undefined) return <PageSpinner className="min-h-dvh" />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  async function onSubmit(values: LoginValues) {
    setLoginError(null)
    try {
      await signIn(values.email, values.password)
    } catch (error) {
      setLoginError(error instanceof LoginError ? error.message : 'Cannot log in right now. Please try again.')
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Card className="shadow-sm">
          <CardHeader className="items-center gap-2 pt-2 text-center">
            <h1>
              <Brand className="justify-center text-primary" markClassName="size-10" />
            </h1>
            <p className="text-muted-foreground">Log in with your work email.</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
                {loginError ? <ErrorAlert error={loginError} title="Cannot log in" /> : null}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="username"
                          inputMode="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="you@siambean.test"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            className="pr-12"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-0 right-0"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {submitting ? 'Logging in...' : 'Log in'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <section aria-labelledby="demo-title" className="mt-6 rounded-lg border bg-card/60 p-4">
          <h2 id="demo-title" className="text-sm font-semibold">
            Demo accounts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap one to fill the email. The shared password is in the README.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full flex-col items-start gap-0 py-2 text-left"
                  onClick={() => {
                    form.setValue('email', a.email, { shouldValidate: true })
                    form.setFocus('password')
                  }}
                >
                  <span className="font-medium">{a.role}</span>
                  <span className="text-xs font-normal text-muted-foreground">{a.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
