import * as React from 'react'

import { cn } from '@/lib/utils'

function AspectRatio({
  className,
  ratio = 1 / 1,
  ...props
}: React.ComponentProps<'div'> & { ratio?: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn('relative w-full', className)}
      style={{ aspectRatio: ratio }}
      {...props}
    />
  )
}

export { AspectRatio }
