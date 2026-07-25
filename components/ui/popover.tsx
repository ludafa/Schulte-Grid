'use client'

import * as React from 'react'
import { Popover } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

function PopoverWrapper({
  ...props
}: React.ComponentProps<typeof Popover.Root>) {
  return <Popover.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof Popover.Trigger>) {
  return <Popover.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof Popover.Popup> & {
  align?: 'center' | 'start' | 'end'
  sideOffset?: number
}) {
  return (
    <Popover.Portal>
      <Popover.Positioner align={align} sideOffset={sideOffset}>
        <Popover.Popup
          data-slot="popover-content"
          className={cn(
            'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
            className,
          )}
          {...props}
        />
      </Popover.Positioner>
    </Popover.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof Popover.Trigger>) {
  return <Popover.Trigger data-slot="popover-anchor" {...props} />
}

export {
  PopoverWrapper as Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
}
