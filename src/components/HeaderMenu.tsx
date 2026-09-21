import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';

type NavLink = { href: string; label: string };

interface Props {
  links: NavLink[];
}

const EASE_CURTAIN: [number, number, number, number] = [0.76, 0, 0.24, 1];
const EASE_HOVER: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Мобильное меню: бургер 44×44 + полноэкранный занавес.
 * Закрывается по Esc, по крестику и по клику на ссылку.
 * Подключается как остров client:idle — меню открывают редко.
 */
export default function HeaderMenu({ links }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Открыть меню"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center text-text transition-colors duration-200 ease-hover hover:text-accent lg:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 7h18M3 12h18M3 17h12" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-lenis-prevent
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.65, ease: EASE_CURTAIN }}
            className="fixed inset-0 z-[90] flex flex-col bg-bg-deep lg:hidden"
          >
            <div className="flex h-16 items-center justify-between px-6">
              <span className="text-label uppercase text-text">Молот</span>
              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center text-text transition-colors duration-200 ease-hover hover:text-accent"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-2 px-6">
              {links.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.06, ease: EASE_HOVER }}
                  className="py-2 text-display uppercase text-text transition-colors duration-200 ease-hover hover:text-accent"
                >
                  {link.label}
                </motion.a>
              ))}
            </nav>

            <div className="flex flex-col gap-4 border-t border-border px-6 py-8">
              {/* TODO: заменить на реальные контакты */}
              <a
                href="tel:+74951234567"
                className="text-label uppercase text-text-muted transition-colors duration-200 ease-hover hover:text-text"
              >
                +7 (495) 123-45-67
              </a>
              <Button asChild size="lg" className="w-full">
                <a href="#contact" onClick={() => setOpen(false)}>
                  Записаться
                </a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
