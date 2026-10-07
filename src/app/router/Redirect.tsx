import { useEffect } from 'react'
import { redirect } from './useRoute'

export function Redirect({ to }: { to: string }) {
  useEffect(() => redirect(to), [to])
  return null
}
