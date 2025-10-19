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

// Accessible, pretty handle with larger hit area and hover/active feedback
const HANDLE_BASE_CLASSES =
  "relative group flex select-none items-center justify-center bg-transparent transition-[background,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:py-2 data-[panel-group-direction=horizontal]:w-3 data-[panel-group-direction=horizontal]:cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize"

const ResizableHandle = ({ className, withHandle = false, ...props }: ResizableHandleProps) => (
  <PanelResizeHandlePrimitive
    className={cn(
      // Accessible, pretty handle with larger hit area and hover/active feedback
      HANDLE_BASE_CLASSES,
      className
    )}
    {...props}
  >
    {/* Soft glow track on hover (orientation-agnostic via radial gradient) */}
    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.10),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_60%)]" />
    </div>

    {/* Hairlines: central line plus subtle twin highlights for a refined separator */}
    <div className="absolute inset-0 flex items-center justify-center">
      {/* central hairline */}
      <div className="transition-colors data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=horizontal]:w-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:h-px rounded-full bg-border/70 group-hover:bg-indigo-400/60 dark:group-hover:bg-indigo-300/60" />
      {/* twin highlights */}
      <div className="absolute transition-opacity opacity-0 group-hover:opacity-100 data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=horizontal]:w-px data-[panel-group-direction=horizontal]:translate-x-[1px] data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:translate-y-[1px] rounded-full bg-white/30 dark:bg-white/10" />
      <div className="absolute transition-opacity opacity-0 group-hover:opacity-100 data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=horizontal]:w-px data-[panel-group-direction=horizontal]:-translate-x-[1px] data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:-translate-y-[1px] rounded-full bg-white/30 dark:bg-white/10" />
    </div>

    {withHandle ? (
      <div
        className="group/knob relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-white/60 dark:bg-white/10 backdrop-blur-sm shadow-md shadow-black/5 dark:shadow-black/30 ring-1 ring-black/5 dark:ring-white/10 transition-transform group-hover:scale-105 group-active:scale-95"
        aria-hidden="true"
      >
        {/* radial accent on hover to match pane draggers */}
        <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover/knob:opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_60%)]" />
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span className="block h-0.5 w-3 rounded bg-border/90 transition-colors duration-200 group-hover/knob:bg-indigo-400/80 dark:group-hover/knob:bg-indigo-300/80" />
          <span className="block h-0.5 w-3 rounded bg-border/90 transition-colors duration-200 group-hover/knob:bg-indigo-400/80 dark:group-hover/knob:bg-indigo-300/80" />
          <span className="block h-0.5 w-3 rounded bg-border/90 transition-colors duration-200 group-hover/knob:bg-indigo-400/80 dark:group-hover/knob:bg-indigo-300/80" />
        </div>
      </div>
    ) : null}
  </PanelResizeHandlePrimitive>
)
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }


