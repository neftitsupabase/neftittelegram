import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-lg border-[2px] !border-[#5d43ef] !bg-[#0b0a14] !text-white shadow-lg",
          description: "!text-white",
          actionButton:
            "!bg-[#5d43ef] !text-white hover:!bg-[#4a35c7]",
          cancelButton:
            "!bg-gray-600 !text-white hover:!bg-gray-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
