import { motion } from 'framer-motion';

const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Услуги с ценами. Единственный остров в пачке: stagger появления карточек
 * требует JS, поэтому client:visible. Название и цена — один кегль из шкалы,
 * иерархия держится на цвете и весе, а не на размере.
 */
export const services = [
  {
    duration: '45–60 мин',
    name: 'Мужская стрижка',
    price: '3 500 ₽',
    text: 'Разбор формы головы и типа волос, машинка и ножницы, укладка. Форма держится месяц без ежедневной укладки.',
  },
  {
    duration: '30 мин',
    name: 'Стрижка машинкой',
    price: '2 000 ₽',
    text: 'Одна длина, чистые переходы, окантовка опасной бритвой. Для тех, кто приходит раз в три недели.',
  },
  {
    duration: '40 мин',
    name: 'Оформление бороды',
    price: '2 500 ₽',
    text: 'Контур опасной бритвой, форма по направлению роста, горячее полотенце и масло в конце.',
  },
  {
    duration: '50 мин',
    name: 'Королевское бритьё',
    price: '3 000 ₽',
    text: 'Две проходки — по росту и против. Пар, преshave-масло, холодное полотенце вместо лосьона.',
  },
  {
    duration: '30 мин',
    name: 'Камуфляж седины',
    price: '1 500 ₽',
    text: 'Тон в тон вашего цвета, без эффекта краски. Держится 3–4 недели, сходит незаметно.',
  },
  {
    duration: '70 мин',
    name: 'Отец и сын',
    price: '5 000 ₽',
    text: 'Две стрижки подряд в одном кресле. Детская — с 5 лет, на первой делаем скидку 50%.',
  },
];

export default function Services() {
  return (
    <section id="services" className="scroll-mt-24 border-b border-border px-6 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1400px]">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_HOVER }}
          className="font-label text-label uppercase text-text-muted"
        >
          Услуги
        </motion.p>

        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_HOVER }}
          className="mt-6 max-w-[14ch] text-h2 uppercase text-text"
        >
          Что делаем
        </motion.h2>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <motion.article
              key={service.name}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_HOVER } },
              }}
              whileHover={{ y: -7, transition: { duration: 0.3, ease: EASE_HOVER } }}
              className="flex flex-col border border-border p-8"
            >
              <p className="font-label text-label uppercase text-text-muted">{service.duration}</p>
              <h3 className="mt-6 text-body font-medium uppercase text-text">{service.name}</h3>
              <p className="mt-4 flex-1 text-body text-text-muted">{service.text}</p>
              <p className="mt-8 font-price text-body font-medium whitespace-nowrap text-accent">{service.price}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
