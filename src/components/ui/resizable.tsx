import * as React from "react"
import {
  Panel as PanelPrimitive,
  PanelGroup as PanelGroupPrimitive,
  PanelResizeHandle as PanelResizeHandlePrimitive,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = PanelGroupPrimitive

const ResizablePanel = PanelPrimitive

interface ResizableHandleProps
  extends React.ComponentPropsWithoutRef<typeof PanelResizeHandlePrimitive> {
  withHandle?: boolean
}

const ResizableHandle = React.forwardRef<
  React.ElementRef<typeof PanelResizeHandlePrimitive>,
  ResizableHandleProps
>(({ className, withHandle = false, ...props }, _ref) => (
  <PanelResizeHandlePrimitive
    className={cn(
      // Base vertical divider styles; library provides focus & keyboard a11y
      "relative flex w-px select-none items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:py-2",
      className
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border bg-background shadow" aria-hidden="true">
        <div className="h-4 w-0.5 bg-border" />
      </div>
    ) : null}
  </PanelResizeHandlePrimitive>
))
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }


