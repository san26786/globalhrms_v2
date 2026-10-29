"use client";
// Shared look for the dashboards after login: the same fonts, colours and motion as the
// sign-in pages (Poppins, brand orange #da5427 as primary, blue as secondary, geeconglobal.com
// style fade-up reveals). Text colours are at least 7:1 against their background.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from 'motion/react';
import { CircleCheck, Moon, Sun, type LucideIcon } from 'lucide-react';
import { EASE, poppins, saveTheme, useAuthTheme } from '@/components/auth/AuthUi';

export { poppins };

export const pageStagger: Variants ={ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
export const pageRise: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { opacity: { duration: 0.6, ease: EASE }, y: { duration: 0.7, ease: EASE } } },
};

/**
 * Applies the light/dark theme chosen on the sign-in pages (shared choice) to everything inside.
 * `contents` keeps the wrapper out of the layout, for sticky/fixed children such as the header.
 */
export function ThemeScope({ contents = false, children }: { contents?: boolean; children: React.ReactNode }) {
  const theme = useAuthTheme();
  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} ${contents ? 'contents' : ''}`} style={contents ? undefined : { colorScheme: theme }}>
      {children}
    </div>
  );
}

/** Sun/moon button that switches the theme for the whole signed-in area (and the sign-in pages). */
export function ThemeSwitch({ className }: { className: string }) {
  const theme = useAuthTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => saveTheme(next)} className={className} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="flex"
        >
          {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/**
 * Root of a dashboard: Poppins, and its sections fade up one after another. Each time a
 * dashboard opens (e.g. switching tabs), a page turns away like opening a book.
 */
export function DashboardPage({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <ThemeScope>
      <div className="relative">
        <motion.div variants={pageStagger} initial="hidden" animate="show" className={`${poppins.className} space-y-6 text-[#1a1818] dark:text-[#f1f3f8]`}>
          {children}
        </motion.div>
        {!reduceMotion && <PageTurn />}
      </div>
    </ThemeScope>
  );
}

/** How long the open-book page turn takes, in seconds. */
const PAGE_TURN_SECONDS = 2.6;
/** The sheet is cut into vertical strips hinged to each other, so it can curl in 3D. */
const PAGE_STRIPS = 6;
const PAGE_TURN_EASE = [0.65, 0, 0.35, 1] as const;

/**
 * Open-book effect: a sheet of paper covers the freshly loaded page, lifts at its free edge
 * and turns away to the left around its left edge (the spine), curling as it goes, revealing
 * the dashboard underneath. It sits on top of the content rather than transforming it, and
 * removes itself when the turn is done.
 */
function PageTurn() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 [--paper-a:#e6ebf3] [--paper-b:#ffffff] [--paper-c:#f3f5f9] [--paper-line:#e2e6ee] dark:[--paper-a:#0a101d] dark:[--paper-b:#141f36] dark:[--paper-c:#0e1628] dark:[--paper-line:rgba(255,255,255,0.05)]"
      style={{ height: 'min(100%, calc(100vh - 11rem))', perspective: 2400, perspectiveOrigin: '0% 45%' }}
    >
      {/* Shadow near the spine on the new page; it fades as the page settles. */}
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2 rounded-l-2xl bg-gradient-to-r from-[#061b31]/30 to-transparent"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: PAGE_TURN_SECONDS, ease: 'easeIn' }}
      />
      {/* Shadow the lifting page casts onto the new page. */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-[#061b31]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.16, 0] }}
        transition={{ duration: PAGE_TURN_SECONDS, times: [0, 0.45, 1], ease: 'easeInOut' }}
      />
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        <PageStrip index={0} onDone={() => setDone(true)} />
      </div>
    </div>
  );
}

/**
 * One strip of the turning sheet. The first strip is hinged at the spine and carries the whole
 * page round; every further strip is hinged to the one before it and bends ahead of it early in
 * the turn, then flattens again, which is what makes the page curl.
 */
function PageStrip({ index, onDone }: { index: number; onDone?: () => void }) {
  const isSpine = index === 0;
  const isEdge = index === PAGE_STRIPS - 1;
  // Strips nearer the free edge bend a little more.
  const curl = -(8 + index * 3);

  return (
    <motion.div
      className="absolute inset-y-0"
      style={{
        left: isSpine ? 0 : 'calc(100% - 1px)',
        width: isSpine ? `${100 / PAGE_STRIPS}%` : 'calc(100% + 1px)',
        transformOrigin: 'left center',
        transformStyle: 'preserve-3d',
      }}
      initial={{ rotateY: 0 }}
      animate={{ rotateY: isSpine ? [0, -7, -180] : [0, curl, curl * 0.4, 0] }}
      transition={
        isSpine
          ? { duration: PAGE_TURN_SECONDS, times: [0, 0.22, 1], ease: ['easeOut', PAGE_TURN_EASE] }
          : { duration: PAGE_TURN_SECONDS, times: [0, 0.38, 0.75, 1], ease: 'easeInOut' }
      }
      onAnimationComplete={onDone}
    >
      {/* Paper face: one slice of a page-wide gradient, plus ruled lines. */}
      <div
        className={`absolute inset-0 overflow-hidden ${isSpine ? 'rounded-l-2xl' : ''} ${isEdge ? 'rounded-r-2xl' : ''}`}
        style={{
          backfaceVisibility: 'hidden',
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--paper-line) 31px, var(--paper-line) 32px), linear-gradient(to right, var(--paper-a), var(--paper-b) 45%, var(--paper-c))',
          backgroundSize: `auto, ${PAGE_STRIPS * 100}% 100%`,
          backgroundPosition: `0 0, ${(index / (PAGE_STRIPS - 1)) * 100}% 0`,
        }}
      >
        {isSpine && <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#e15425] via-[#0b5394] to-[#e15425]" />}
        {isEdge && <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/70 to-transparent dark:from-white/10" />}
        {/* Darkens as it turns away from the light; strips further out darken a little later. */}
        <motion.div
          className="absolute inset-0 bg-[#061b31]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.06 + index * 0.03, 0.42] }}
          transition={{ duration: PAGE_TURN_SECONDS, times: [0, 0.4, 1], ease: 'easeIn' }}
        />
        {/* A soft highlight that slides across the curl. */}
        <motion.div
          className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-white/10"
          initial={{ x: '120%', opacity: 0 }}
          animate={{ x: ['120%', '-120%'], opacity: [0, 1, 0] }}
          transition={{ duration: PAGE_TURN_SECONDS * 0.7, delay: PAGE_TURN_SECONDS * 0.12 + index * 0.05, ease: 'easeInOut' }}
        />
      </div>
      {!isEdge && <PageStrip index={index + 1} />}
    </motion.div>
  );
}

/**
 * Wraps a redesigned module page (e.g. Bank Manager): brand font and colours, the shared
 * light/dark theme, and the page-turn entrance. The page itself is only faded in (never moved),
 * so fixed overlays inside it keep positioning against the window.
 */
export function BrandModule({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const theme = useAuthTheme();

  // Dialogs and menus render in a portal on <body>: give <body> the same brand scope and theme
  // while the module is open, and take them away again when it closes.
  useEffect(() => {
    document.body.classList.add('brand-scope');
    if (theme === 'dark') document.body.classList.add('dark');
    return () => document.body.classList.remove('brand-scope', 'dark');
  }, [theme]);

  return (
    <ThemeScope>
      <div className={`brand-scope ${poppins.className} relative text-[#1a1818] dark:text-[#f1f3f8]`}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: EASE }}>
          {children}
        </motion.div>
        {!reduceMotion && <PageTurn />}
      </div>
    </ThemeScope>
  );
}

/** A grid or row inside a dashboard page; its children reveal in turn. */
export function Section({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={pageStagger} className={className}>
      {children}
    </motion.div>
  );
}

/** How far (px) a card is drawn towards the middle of its grid before it settles into place. */
const CONVERGE_PULL = { x: 40, y: 24 };
/** Lets the cards trail the scroll a little instead of jumping with every wheel tick. */
const CONVERGE_SPRING = { stiffness: 110, damping: 28, restDelta: 0.0005 };
/** Cards further along a row start and finish a little later. */
const CONVERGE_STAGGER = 0.08;

/**
 * Scroll-linked entrance modelled on monday.com's "context" scene, where floating cards are drawn
 * into a central figure (and the figure turns from sketch to colour) as you scroll. Here each card
 * waits slightly drawn in towards the middle of its grid, a little smaller, faded and in greyscale,
 * and settles into its place in full colour as it scrolls into view. It follows the scroll in both
 * directions, trails it slightly for smoothness, and staggers along each row.
 *
 * Wraps one grid cell (`index` of `count`); the card inside still fills the cell. Only transform,
 * opacity and filter change, so the layout never shifts. Nothing moves for reduced-motion users.
 */
export function ScrollConverge({ index, count, children }: { index: number; count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // 0 when the cell's top edge reaches the bottom of the window, 1 once the whole cell is in view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const progress = useSpring(scrollYProgress, CONVERGE_SPRING);

  // Which way the cell is drawn in (-1…1 per axis) and its stagger window, from its place in the grid.
  const towardX = useMotionValue(0);
  const towardY = useMotionValue(0);
  const from = useMotionValue(0);
  const to = useMotionValue(1);

  useEffect(() => {
    const cell = ref.current;
    const grid = cell?.parentElement;
    if (!cell || !grid) return;
    // The column count changes with the screen width, so measure it rather than assume it.
    const measure = () => {
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
      const rows = Math.ceil(count / cols);
      const col = index % cols;
      const row = Math.floor(index / cols);
      const toward = (n: number, i: number) => (n > 1 ? ((n - 1) / 2 - i) / ((n - 1) / 2) : 0);
      towardX.set(toward(cols, col));
      // A single-column stack (phones) only grows and fades in; it is not pulled up or down.
      towardY.set(cols > 1 ? toward(rows, row) : 0);
      from.set(col * CONVERGE_STAGGER);
      to.set(1 - (cols - 1 - col) * CONVERGE_STAGGER);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [index, count, towardX, towardY, from, to]);

  // Cards already on screen when the page opens start in place instead of animating in.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => progress.jump(scrollYProgress.get()));
    });
    return () => cancelAnimationFrame(frame);
  }, [progress, scrollYProgress]);

  // With reduced motion the cards simply stay in place. Set after mount, so the first render
  // matches the server's (React does not patch mismatched styles when hydrating).
  const still = useMotionValue(0);
  useEffect(() => still.set(reduceMotion ? 1 : 0), [reduceMotion, still]);

  // Eased (out) progress through this card's stagger window: the reverse of the reference's ease-in pull.
  const settle = useTransform([progress, from, to, still], ([p, a, b, s]: number[]) => {
    if (s) return 1;
    const t = Math.min(1, Math.max(0, (p - a) / (b - a)));
    return 1 - (1 - t) * (1 - t);
  });
  const x = useTransform([settle, towardX], ([t, d]: number[]) => d * CONVERGE_PULL.x * (1 - t));
  const y = useTransform([settle, towardY], ([t, d]: number[]) => d * CONVERGE_PULL.y * (1 - t));
  const scale = useTransform(settle, [0, 1], [0.92, 1]);
  const opacity = useTransform(settle, [0, 0.6], [0, 1]);
  // Colour comes in over the middle of the move; 'none' at rest so no filter lingers on the card.
  const filter = useTransform(settle, (t) => {
    const grey = 1 - Math.min(1, Math.max(0, (t - 0.2) / 0.5));
    return grey > 0 ? `grayscale(${grey})` : 'none';
  });

  return (
    <motion.div ref={ref} className="grid" style={{ x, y, scale, opacity, filter }}>
      {children}
    </motion.div>
  );
}

export type Tone = 'orange' | 'blue' | 'sky' | 'emerald' | 'rose' | 'amber' | 'slate';

/** Tinted icon chip, strong text colour, dot colour, pill badge and soft glow per tone. */
export const TONES: Record<Tone, { chip: string; text: string; dot: string; badge: string; glow: string; avatar: string }> = {
  orange: {
    chip: 'bg-[#fbe6dd] text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]',
    text: 'text-[#7a2e12] dark:text-[#f8d3c3]',
    dot: 'bg-[#da5427]',
    badge: 'bg-[#fbe6dd] text-[#7a2e12] ring-[#da5427]/25 dark:bg-[#da5427]/15 dark:text-[#f8d3c3] dark:ring-[#da5427]/40',
    glow: 'bg-[#da5427]/15',
    avatar: 'bg-[#fbe6dd] text-[#7a2e12] dark:bg-[#da5427]/20 dark:text-[#f8d3c3]',
  },
  blue: {
    chip: 'bg-[#dbe8f8] text-[#0b5394] dark:bg-[#8cb8f0]/15 dark:text-[#8cb8f0]',
    text: 'text-[#0b5394] dark:text-[#8cb8f0]',
    dot: 'bg-[#0b5394] dark:bg-[#8cb8f0]',
    badge: 'bg-[#e3edf9] text-[#083f72] ring-[#0b5394]/20 dark:bg-[#8cb8f0]/15 dark:text-[#cfe1fa] dark:ring-[#8cb8f0]/30',
    glow: 'bg-[#0b5394]/15 dark:bg-[#8cb8f0]/15',
    avatar: 'bg-[#e3edf9] text-[#083f72] dark:bg-[#8cb8f0]/15 dark:text-[#cfe1fa]',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    text: 'text-sky-900 dark:text-sky-300',
    dot: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-900 ring-sky-600/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/30',
    glow: 'bg-sky-500/15',
    avatar: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200',
  },
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    text: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/30',
    glow: 'bg-emerald-500/15',
    avatar: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200',
  },
  rose: {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
    text: 'text-rose-800 dark:text-rose-300',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/30',
    glow: 'bg-rose-500/15',
    avatar: 'bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    text: 'text-amber-900 dark:text-amber-300',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30',
    glow: 'bg-amber-500/15',
    avatar: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    text: 'text-slate-800 dark:text-slate-200',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 ring-slate-400/30 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15',
    glow: 'bg-slate-400/15',
    avatar: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  },
};

/**
 * Counts up to `value` when it appears or changes. Shows the plain number for reduced-motion users,
 * and "—" when the server sent no number (e.g. a KPI that could not be computed).
 */
export function CountUp({ value }: { value: number | null | undefined }) {
  const reduceMotion = useReducedMotion();
  const from = useRef(0);
  const [shown, setShown] = useState(0);
  const isNumber = typeof value === 'number' && Number.isFinite(value);

  useEffect(() => {
    if (reduceMotion || typeof value !== 'number' || !Number.isFinite(value)) return;
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  if (!isNumber) return <span>—</span>;
  return <span className="tabular-nums">{reduceMotion ? value : shown}</span>;
}

/** KPI tile: tinted icon, counting number, short explanation. Lifts on hover. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone: Tone;
  loading?: boolean;
}) {
  const t = TONES[tone];
  return (
    <motion.div
      variants={pageRise}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] p-5 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-20px_rgba(6,27,49,0.35)]"
    >
      <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${t.glow} blur-2xl transition-transform duration-500 group-hover:scale-125`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Labels arrive in capitals; shown in sentence case for easier reading. */}
          <p className="text-[13px] font-medium leading-snug text-[#535768] dark:text-[#aab3c5] lowercase first-letter:uppercase">{label}</p>
          <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.02em] text-[#1a1818] dark:text-[#f1f3f8]">
            {loading ? '—' : <CountUp value={value} />}
          </p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.chip} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      {hint && <p className="relative mt-3 text-[12.5px] leading-snug text-[#535768] dark:text-[#aab3c5]">{hint}</p>}
    </motion.div>
  );
}

/** White card with a titled header row; reveals with its section. */
export function Panel({
  title,
  icon: Icon,
  tone = 'orange',
  badge,
  className = '',
  bodyClassName = '',
  children,
}: {
  title: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  badge?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={pageRise}
      className={`flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#111a2e] ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone].chip}`}>
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
          )}
          <h3 className="truncate text-[15px] font-semibold text-[#1a1818] dark:text-[#f1f3f8]">{title}</h3>
        </div>
        {badge}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </motion.section>
  );
}

/** Small rounded status label. `pulse` adds a live dot. */
export function Badge({ tone = 'slate', pulse = false, children }: { tone?: Tone; pulse?: boolean; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${t.badge}`}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${t.dot}`} />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
        </span>
      )}
      {children}
    </span>
  );
}

/** Round initials badge for a person. */
export function Avatar({ tone = 'blue', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${TONES[tone].avatar}`}>
      {children}
    </span>
  );
}

/** Ranked people list (leaderboards): position, name, value. */
export function RankTable({
  nameHeader,
  valueHeader,
  rows,
  tone,
  formatValue,
}: {
  nameHeader: string;
  valueHeader: string;
  rows: { name: string; count: number }[];
  tone: Tone;
  formatValue: (count: number) => React.ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-[12px] font-medium text-[#535768] dark:text-[#aab3c5]">
          <th className="px-5 pb-2 pt-3 font-medium">{nameHeader}</th>
          <th className="px-5 pb-2 pt-3 text-right font-medium">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-slate-100 dark:border-white/10 transition-colors duration-200 hover:bg-[#f6f7f9] dark:hover:bg-white/5">
            <td className="px-5 py-2.5">
              <span className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${i === 0 ? `${TONES[tone].dot} text-white` : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200'}`}>
                  {i + 1}
                </span>
                <span className="text-[14px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">{row.name}</span>
              </span>
            </td>
            <td className={`px-5 py-2.5 text-right text-[14px] font-semibold tabular-nums ${TONES[tone].text}`}>{formatValue(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Dark insight card in the secondary blue, with a slow drifting glow. */
export function InsightCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      variants={pageRise}
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1f44] to-[#0b4a85] p-6 text-white shadow-[0_18px_40px_-24px_rgba(6,27,49,0.6)] ${className}`}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#da5427]/25 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, 16, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative flex h-full flex-col justify-between gap-5">{children}</div>
    </motion.section>
  );
}

/** Bottom-right confirmation that slides in. */
export function Toast({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`${poppins.className} fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1a1818] px-5 py-4 text-white shadow-2xl`}
    >
      <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-400" />
      <span className="text-[14px] font-medium">{children}</span>
    </motion.div>
  );
}

/** Form label and input styles, matching the sign-in pages. */
export const fieldLabel = 'mb-1.5 block text-[13px] font-medium text-[#1a1818] dark:text-[#f1f3f8]';
export const fieldInput =
  'h-11 w-full rounded-xl border border-[#e2e4ea] dark:border-[#2a3550] bg-[#f6f7f9] dark:bg-[#0e1628] px-3.5 text-[14px] text-[#1a1818] dark:text-[#f1f3f8] outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-[#676879] dark:placeholder:text-[#8b95ab] hover:border-[#c9ccd6] dark:hover:border-[#3a4767] hover:bg-white dark:hover:bg-[#101a30] focus:border-[#da5427] focus:bg-white dark:focus:bg-[#0e1628] focus:ring-4 focus:ring-[#f9ddd1] dark:focus:ring-[#da5427]/25';
