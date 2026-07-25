import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

/**
 * Merges its props onto its immediate child, forwarding ref.
 * Replaces @radix-ui/react-slot.
 */
const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, className, ...restProps }, ref) => {
    if (!children || !React.isValidElement(children)) {
      return null
    }

    const slotProps = restProps as Record<string, unknown>
    const childProps = children.props as Record<string, unknown>

    // Merge classNames
    const mergedClassName = cn(
      childProps.className as string | undefined,
      className,
    )

    // Build merged props - child props take precedence for known keys
    const mergedProps: Record<string, unknown> = { ...slotProps }
    
    for (const key of Object.keys(childProps)) {
      if (key === 'className' || key === 'style') continue
      if (key === 'ref') {
        // Chain refs
        mergedProps.ref = (node: HTMLElement | null) => {
          const childRef = childProps.ref
          if (typeof childRef === 'function') childRef(node)
          else if (childRef && typeof childRef === 'object' && 'current' in childRef)
            (childRef as React.MutableRefObject<HTMLElement | null>).current =
              node
          if (typeof ref === 'function') ref(node)
          else if (ref && 'current' in ref)
            (ref as React.MutableRefObject<HTMLElement | null>).current = node
        }
        continue
      }
      if (
        typeof key === 'string' &&
        key.startsWith('on') &&
        typeof childProps[key] === 'function' &&
        typeof slotProps[key] === 'function'
      ) {
        mergedProps[key] = (...args: unknown[]) => {
          ;(childProps[key] as (...a: unknown[]) => void)(...args)
          ;(slotProps[key] as (...a: unknown[]) => void)(...args)
        }
        continue
      }
      // Child props take precedence for non-event props
      if (!(key in mergedProps)) {
        mergedProps[key] = childProps[key]
      }
    }

    mergedProps.className = mergedClassName

    return React.cloneElement(
      children as React.ReactElement,
      mergedProps,
      childProps.children as React.ReactNode,
    )
  },
)
Slot.displayName = 'Slot'

export { Slot }
