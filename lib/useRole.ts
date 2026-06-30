import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Role = 'pm' | 'safety_manager' | 'tech' | null

export function useRole() {
  const [role, setRole] = useState<Role>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setLoading(false); return }
      if (!cancelled) setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!cancelled) {
        setRole((data?.role as Role) ?? null)
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return { role, userId, loading }
}
