"use client";
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSeller from '../hooks/useSeller'

const Page = () => {
  const { seller, isLoading, isError, refetch } = useSeller()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isError) {
      if (!seller && !isError) {
        router.push('/login')
      } else {
        router.push('/dashboard')
      }
    }
  }, [seller, isLoading, isError, router])

  return isError ? <div className="p-8">Unable to check your session. <button onClick={() => refetch()}>Retry</button></div> : null
}

export default Page
