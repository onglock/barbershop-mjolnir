import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Кнопка «Молот». Редакционный стиль: плоская поверхность (радиус 0),
 * тап-зона не меньше 44px, текст — мелкий UPPERCASE-лейбл из общей шкалы.
 * Варианты: accent (заливка латунью), outline (волосяная линия), ghost.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-none border border-transparent font-label text-label uppercase select-none transition-all duration-200 ease-hover outline-none disabled:pointer-events-none disabled:opacity-45 active:translate-y-px motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Заливка латунью: текст только цветом фона — 9.13:1 */
        accent: "bg-accent text-bg hover:bg-accent-hover hover:-translate-y-0.5",
        outline:
          "border-border bg-transparent text-text hover:border-accent-warm hover:text-accent-warm hover:-translate-y-0.5",
        ghost: "bg-transparent text-text-muted hover:text-accent-warm",
      },
      size: {
        sm: "h-8 gap-1 px-4",
        default: "h-11 px-6",
        lg: "h-12 px-8",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "accent",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
