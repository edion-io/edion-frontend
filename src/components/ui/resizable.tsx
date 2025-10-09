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
>(({ className, withHandle = false, ...props }, ref) => (
  <PanelResizeHandlePrimitive
    ref={ref}
    className={cn(
      // Base vertical handle styles; the library adds data attributes we can key off if needed
      "relative flex w-px select-none items-center justify-center bg-border data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:py-2",
      className
    )}
    {...props}
  >
    {withHandle ? (
      <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border bg-background shadow">
        <div className="h-4 w-0.5 bg-border" />
      </div>
    ) : null}
  </PanelResizeHandlePrimitive>
))
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }


