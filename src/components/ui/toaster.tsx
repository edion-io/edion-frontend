import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle className="!text-base !font-semibold">
                {title}
              </ToastTitle>}
              {description && (
                <ToastDescription className="!text-sm !mt-1">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="fixed !bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-4 w-full max-w-xl px-4"/>
    </ToastProvider>
  )
}
