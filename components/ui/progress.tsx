'use client'

import * as React from 'react'
import { Progress } from '@base-ui/react/progress'

import { cn } from '@/lib/utils'

function ProgressWrapper({
  className,
  value,
  ...props
}: React.ComponentProps<typeof Progress.Root>) {
  return (
    <Progress.Root value={value}
      data-slot="progress"
      className={cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        className,
      )}
      {...props}
    >
      <Progress.Track
        data-slot="progress-track"
        className="h-full w-full"
      >
        <Progress.Indicator
          data-slot="progress-indicator"
          className="bg-primary h-full transition-all"
          style={{ width: `${value || 0}%` }}
        />
      </Progress.Track>
    </Progress.Root>
  )
}

export { ProgressWrapper as Progress }
