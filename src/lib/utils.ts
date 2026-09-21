import { createCn } from "cn/config"

/**
 * cn с расширенной конфигурацией движка слияния классов.
 *
 * По умолчанию движок разбирает `text-*` как цвет текста и вырезает
 * неизвестный ему размер: в паре `text-label` + `text-bg` остаётся только
 * `text-bg`, и кнопка теряет кегль из нашей шкалы. Поэтому явно сообщаем,
 * что text-display, text-body и text-label — это font-size.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "body", "label"] }],
    },
  },
})
