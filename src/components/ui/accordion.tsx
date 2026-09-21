import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * Аккордеон «Мьёльнир». Тонкая обёртка над Radix: библиотека отвечает только
 * за семантику и клавиатуру (роль, aria-expanded/aria-controls, Space/Enter,
 * стрелки, Home/End), внешний вид — наш.
 *
 * Анимации высоты здесь НАМЕРЕННО нет. Её ведёт Framer Motion в Faq.tsx.
 * Штатные shadcn-кейфреймы accordion-down/up через переменную
 * --radix-accordion-content-height не подключаем сознательно: иначе высоту
 * анимировали бы двое (CSS и Motion) и раскрытие получилось бы рваным.
 *
 * forceMount на Content: панель остаётся в DOM и в закрытом виде, поэтому
 * ответ находится поиском по странице (Ctrl+F). Скрытие закрытой панели от
 * скринридеров делает aria-hidden в потребителе.
 */

const Accordion = AccordionPrimitive.Root

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("group/item relative", className)}
      {...props}
    />
  )
}

function AccordionHeader({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Header>) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        /* Тап-зона строки: py 18px при тексте 18px даёт ~57px по высоте.
           Фокус-ринг не задаём сами — он глобальный (:focus-visible в global.css),
           и здесь важно только не гасить его через outline-none. */
        "flex w-full items-center gap-4 py-[18px] text-left",
        className
      )}
      {...props}
    >
      {children}
    </AccordionPrimitive.Trigger>
  )
}

function AccordionContent({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      forceMount
      className={cn(className)}
      {...props}
    />
  )
}

export { Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent }
