import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !fixed !z-40 !right-2"
      position="top-right"
      offset="8"
      style={{
        top: '72px',
        right: '8px',
        left: 'auto'
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/95 group-[.toaster]:dark:bg-gray-900/95 group-[.toaster]:text-gray-900 group-[.toaster]:dark:text-gray-100 group-[.toaster]:border group-[.toaster]:border-gray-200/50 group-[.toaster]:dark:border-gray-700/50 group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-xl group-[.toaster]:min-h-[60px] group-[.toaster]:w-64 group-[.toaster]:sm:w-80 group-[.toaster]:max-w-[calc(100vw-16px)] group-[.toaster]:ml-auto group-[.toaster]:z-40",
          description: "group-[.toast]:text-gray-600 group-[.toast]:dark:text-gray-400 group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-indigo-500 group-[.toast]:dark:bg-blue-600 group-[.toast]:text-white group-[.toast]:hover:bg-indigo-600 group-[.toast]:dark:hover:bg-blue-700 group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:dark:bg-gray-800 group-[.toast]:text-gray-700 group-[.toast]:dark:text-gray-300 group-[.toast]:hover:bg-gray-200 group-[.toast]:dark:hover:bg-gray-700 group-[.toast]:rounded-lg",
          icon: "group-[.toast]:mr-3",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold group-[.toast]:text-gray-900 group-[.toast]:dark:text-gray-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
