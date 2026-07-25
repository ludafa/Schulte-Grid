'use client'

import * as React from 'react'
import { Toast } from '@base-ui/react/toast'

// Global toast manager for imperative usage outside of React
const globalToastManager = Toast.createToastManager()

type Toast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
}

function toast(props: Omit<Toast, 'id'>) {
  const id = globalToastManager.add({
    title: props.title,
    description: props.description,
    type: props.variant,
  })
  return {
    id,
    dismiss: () => globalToastManager.close(id),
    update: (props: Partial<Toast>) =>
      globalToastManager.update(id, {
        title: props.title,
        description: props.description,
        type: props.variant,
      }),
  }
}

function useToast() {
  const [toasts, setToasts] = React.useState<Array<{
    id: string
    title?: React.ReactNode
    description?: React.ReactNode
    type?: string
  }>>([])

  React.useEffect(() => {
    const unsubscribe = globalToastManager[' subscribe']((event) => {
      // Re-read toasts on any change
      // Since globalToastManager doesn't expose getToasts, we track via events
      setToasts((prev) => {
        if (event.action === 'add') {
          const toast = event.options
          return [{ id: toast.id, title: toast.title, description: toast.description, type: toast.type }, ...prev]
        }
        if (event.action === 'close') {
          const id = event.options
          return prev.filter((t) => t.id !== id)
        }
        if (event.action === 'update') {
          const { id, ...updates } = event.options
          return prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        }
        return prev
      })
    })
    return unsubscribe
  }, [])

  return {
    toasts: toasts.map((t) => ({
      ...t,
      id: t.id,
      title: t.title,
      description: t.description,
      variant: (t.type === 'destructive' ? 'destructive' : 'default') as 'default' | 'destructive',
    })),
    toast,
    dismiss: (toastId?: string) => {
      globalToastManager.close(toastId)
    },
  }
}

export { useToast, toast }
