"use client";
// Shared look and feel for the sign-in pages (login and account recovery):
// fonts, colours, motion, form controls, the blue brand panel and the light/dark theme.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  AnimatePresence, MotionConfig, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform,
  type MotionValue, type Variants,
} from 'motion/react';
import { Poppins } from 'next/font/google';
import {
  ArrowLeft, ArrowRight, ArrowUp, Award, Briefcase, CalendarCheck, ChevronDown, ChevronsDown, CircleAlert,
  CircleCheck, Clock3, Fingerprint, HeartHandshake, History, LoaderCircle, Lock, Moon, Pause, Play,
  ShieldCheck, Sun, TimerReset, UserRound, Users, UsersRound, Wallet, type LucideIcon,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Presentation helpers — styled after geeconglobal.com (Poppins, pill buttons,
// fade-up reveals). Orange is the primary colour, blue the secondary.
// Text colours are at least 7:1 against their background (WCAG AAA); the exception is the
// brand-orange button, whose large bold white label meets the large-text rule.
// -----------------------------------------------------------------------------

export const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap' });

/** geeconglobal.com's easing curve. */
export const EASE = [0.515, 0.147, 0.25, 1] as const;

/** Page-level reveal, as on geeconglobal.com: fade in while rising 28px. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { opacity: { duration: 0.8, ease: EASE }, y: { duration: 0.9, ease: EASE } } },
};
/** Smaller rise for the items inside the card. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
/** Children appear one after another; the whole screen fades out when switching screens. */
export const cascade: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

export const INPUT =
  'h-11 w-full rounded-xl border border-[#e2e4ea] bg-[#f6f7f9] text-[15px] text-[#1a1818] outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-[#676879] hover:border-[#c9ccd6] hover:bg-white focus:border-[#da5427] focus:bg-white focus:ring-4 focus:ring-[#f9ddd1] dark:border-[#2a3550] dark:bg-[#0e1628] dark:text-[#f1f3f8] dark:placeholder:text-[#8b95ab] dark:hover:border-[#3a4767] dark:hover:bg-[#101a30] dark:focus:bg-[#0e1628] dark:focus:ring-[#da5427]/25';
export const CHECKBOX = 'h-4 w-4 shrink-0 cursor-pointer rounded border-slate-400 accent-[#da5427] dark:border-slate-500';
export const LINK =
  'font-medium text-[#0b5394] underline-offset-4 transition-colors duration-200 hover:text-[#083f72] hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b5394] dark:text-[#8cb8f0] dark:hover:text-[#b5d1f6] dark:focus-visible:outline-[#8cb8f0]';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Rendered inside the input box on the right, e.g. the show-password button. */
  trailing?: React.ReactNode;
  /** Rendered under the input, e.g. the Caps Lock warning. */
  hint?: React.ReactNode;
  optional?: boolean;
  inputClassName?: string;
};

export function Field({ id, label, icon: Icon, trailing, hint, optional, inputClassName = '', className = '', ...input }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[14px] font-medium text-[#1a1818] dark:text-[#e6e9f0]">
        {label}
        {optional && <span className="text-[13px] font-normal text-[#535768] dark:text-[#aab3c5]">Optional</span>}
      </label>
      <div className="group relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#676879] transition-colors duration-200 group-focus-within:text-[#da5427] dark:text-[#8b95ab]"
          />
        )}
        <input id={id} {...input} className={`${INPUT} ${Icon ? 'pl-11' : 'pl-4'} ${trailing ? 'pr-12' : 'pr-4'} ${inputClassName}`} />
        {trailing}
      </div>
      {hint}
    </div>
  );
}

export function SelectField({
  id,
  label,
  icon: Icon,
  children,
  className = '',
  ...select
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; icon?: LucideIcon }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-[#1a1818] dark:text-[#e6e9f0]">
        {label}
      </label>
      <div className="group relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#676879] transition-colors duration-200 group-focus-within:text-[#da5427] dark:text-[#8b95ab]"
          />
        )}
        <select id={id} {...select} className={`${INPUT} appearance-none cursor-pointer ${Icon ? 'pl-11' : 'pl-4'} pr-10`}>
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#535768] dark:text-[#aab3c5]" />
      </div>
    </div>
  );
}

/** Button lifts on hover and presses in on tap; the sweep below follows the same hover state. */
const buttonMotion: Variants = { rest: { y: 0, scale: 1 }, hover: { y: -2 }, tap: { scale: 0.98 } };
/** A band of light that crosses the button on hover and jumps back out of sight when the pointer leaves. */
const sweepMotion: Variants = {
  rest: { x: '-150%', transition: { duration: 0 } },
  hover: { x: '450%', transition: { duration: 0.7, ease: 'easeOut' } },
};

/** Brand-orange pill button. The white label is large and bold (19px), the size at which #da5427 meets the large-text contrast rule. */
const BUTTON_TONES = {
  brand:
    'bg-[#da5427] shadow-[0_10px_24px_-10px_rgba(218,84,39,0.6)] hover:bg-[#c04a21] hover:shadow-[0_14px_30px_-10px_rgba(218,84,39,0.7)] focus-visible:ring-[#f5c4b0]',
  // Used for "stop"-type actions (e.g. Punch out) so they read differently from the main action.
  dark: 'bg-[#1a1818] shadow-[0_10px_24px_-12px_rgba(26,24,24,0.6)] hover:bg-[#323338] hover:shadow-[0_14px_30px_-12px_rgba(26,24,24,0.7)] focus-visible:ring-slate-300',
} as const;

export function PrimaryButton({
  id,
  loading,
  loadingText,
  tone = 'brand',
  children,
}: {
  id?: string;
  loading: boolean;
  loadingText: string;
  tone?: keyof typeof BUTTON_TONES;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="submit"
      id={id}
      disabled={loading}
      variants={buttonMotion}
      initial="rest"
      animate="rest"
      whileHover={loading ? undefined : 'hover'}
      whileTap={loading ? undefined : 'tap'}
      className={`group relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-full px-6 text-[19px] font-bold tracking-[-0.01em] text-white transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.515,0.147,0.25,1)] focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait cursor-pointer ${BUTTON_TONES[tone]}`}
    >
      {/* light sweep on hover */}
      <motion.span
        aria-hidden="true"
        variants={sweepMotion}
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{ width: '33%', skewX: -12, background: 'rgba(255, 255, 255, 0.22)' }}
      />
      <span className="relative flex items-center justify-center gap-2">
        {loading ? (
          <>
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            {children}
            <ArrowRight aria-hidden="true" className="h-5 w-5 transition-transform duration-200 ease-[cubic-bezier(0.515,0.147,0.25,1)] group-hover:translate-x-1" />
          </>
        )}
      </span>
    </motion.button>
  );
}

/** Blue outline pill, like geeconglobal.com's secondary "Contact us" button. */
export function ChoiceButton({ icon: Icon, title, onClick }: { icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b5394]/40 bg-white px-3 text-[14px] font-medium text-[#083f72] transition-colors duration-200 ease-[cubic-bezier(0.515,0.147,0.25,1)] hover:border-[#0b5394] hover:bg-[#e8f0fb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d8e8ff] dark:border-[#8cb8f0]/40 dark:bg-transparent dark:text-[#cfe1fa] dark:hover:border-[#8cb8f0] dark:hover:bg-[#16233d] dark:focus-visible:ring-[#8cb8f0]/30 cursor-pointer"
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#0b5394] transition-transform duration-200 group-hover:scale-110 dark:text-[#8cb8f0]" />
      {title}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Left brand panel (blue, the secondary colour, with orange accents)
// -----------------------------------------------------------------------------

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Fingerprint, title: 'Attendance made effortless', text: 'Clock in from the app or biometric devices and see your day at a glance.' },
  { icon: CalendarCheck, title: 'Leave in a few taps', text: 'Apply, approve and plan time off without the paperwork.' },
  { icon: Wallet, title: 'Payroll you can trust', text: 'Payslips, tax and salary details, always up to date.' },
  { icon: Users, title: 'Your people, one place', text: 'Every employee journey, from the first day to every milestone.' },
];

// Time-based text is read through useSyncExternalStore: the server renders the
// neutral fallback and the browser fills in the local value after hydration.
const noTimeOnServer = () => null;
const everyMinute = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};
const readGreeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
const readClock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function BrandPanel({ reduceMotion, showMore = true }: { reduceMotion: boolean; showMore?: boolean }) {
  const greeting = useSyncExternalStore(everyMinute, readGreeting, noTimeOnServer);
  const [slide, setSlide] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const autoplay = !hovering && !userPaused && !reduceMotion;

  useEffect(() => {
    if (!autoplay) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % HIGHLIGHTS.length), 5000);
    return () => clearInterval(timer);
  }, [autoplay]);

  const item = HIGHLIGHTS[slide];
  const ItemIcon = item.icon;

  // Scroll-linked parallax on the long sign-in page: the hero drifts up and fades as you
  // scroll past it, and the background glows move at different speeds for depth.
  const { scrollY } = useScroll();
  const parallax = showMore && !reduceMotion;
  const heroY = useTransform(scrollY, [0, 700], [0, -90]);
  const heroOpacity = useTransform(scrollY, [0, 650], [1, 0.25]);
  const glowSlow = useTransform(scrollY, [0, 3000], [0, 320]);
  const glowFast = useTransform(scrollY, [0, 3000], [0, -480]);

  return (
    <aside className="relative lg:col-span-5 flex flex-col overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 px-6 py-7 text-white transition-colors duration-300 dark:from-[#050a1c] dark:via-[#0a1740] dark:to-[#0b0a26] sm:px-12 sm:py-10 lg:px-14 lg:pt-10 lg:pb-14">
      {/* Slow-moving light. Kept faint so every text colour stays above 7:1 on top of it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <motion.div className="absolute inset-0" style={parallax ? { y: glowSlow } : undefined}>
          <motion.div
            className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-[115vh] left-1/4 hidden h-96 w-96 rounded-full bg-sky-400/10 blur-3xl lg:block"
            animate={reduceMotion ? undefined : { x: [0, 40, 0], y: [0, -40, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <motion.div className="absolute inset-0" style={parallax ? { y: glowFast } : undefined}>
          <motion.div
            className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#da5427]/15 blur-3xl"
            animate={reduceMotion ? undefined : { x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-[230vh] -right-24 hidden h-96 w-96 rounded-full bg-[#da5427]/10 blur-3xl lg:block"
            animate={reduceMotion ? undefined : { x: [0, -40, 0], y: [0, 30, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={parallax ? { y: heroY, opacity: heroOpacity } : undefined}
        className="relative z-10 flex max-w-[30rem] flex-col justify-center gap-5 lg:min-h-[calc(100vh-6rem)]"
      >
        <div className="space-y-4">
          <motion.span
            variants={reveal}
            className="hidden lg:inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium uppercase tracking-widest text-sky-100"
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#da5427]" />
            Enterprise HR system
          </motion.span>
          <motion.div variants={reveal}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={greeting ?? 'welcome'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[17px] text-indigo-100"
              >
                {greeting ?? 'Hello'} 👋
              </motion.p>
            </AnimatePresence>
          </motion.div>
          <motion.h2
            variants={reveal}
            className="text-[32px] font-medium leading-[1.1] tracking-[-0.04em] sm:text-[40px] lg:text-[47px]"
          >
            Welcome to{' '}
            <span className="lg:block bg-gradient-to-r from-[#f8d3c3] to-[#eea486] bg-clip-text text-transparent">Global HR</span>
          </motion.h2>
          <motion.p variants={reveal} className="hidden sm:block text-[17px] leading-[1.6] text-indigo-100">
            Empowering people. Elevating performance. Everything your team needs for a great day at work, in one place.
          </motion.p>
        </div>

        {/* Rotating highlights: pause on hover, with a pause button and dots for manual control */}
        <motion.div
          variants={reveal}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="hidden lg:block rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"
        >
          <div className="min-h-[92px]" aria-live={autoplay ? 'off' : 'polite'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="flex items-start gap-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#da5427]">
                  <ItemIcon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[17px] font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-white">{item.text}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {HIGHLIGHTS.map((h, i) => (
                <button
                  key={h.title}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Show: ${h.title}`}
                  aria-current={i === slide}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    i === slide ? 'w-7 bg-[#da5427]' : 'w-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
            {!reduceMotion && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? 'Play highlights' : 'Pause highlights'}
                className="rounded-full p-1.5 text-indigo-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
              >
                {userPaused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
              </button>
            )}
          </div>
        </motion.div>

        <motion.div variants={reveal}>
          <ProductPreview reduceMotion={reduceMotion} />
        </motion.div>
      </motion.div>

      {showMore && (
        <>
          <ScrollProgressBar />
          <FloatingBackToTop />
          <ScrollCue />
          <MoreAboutGlobalHR reduceMotion={reduceMotion} />
        </>
      )}
    </aside>
  );
}

/** A small illustration of the product: today's clock-in card plus two notifications. */
function ProductPreview({ reduceMotion }: { reduceMotion: boolean }) {
  const clock = useSyncExternalStore(everyMinute, readClock, noTimeOnServer);
  const bob = (delay: number) =>
    reduceMotion
      ? {}
      : { animate: { y: [0, -6, 0] }, transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay } };

  return (
    <div aria-hidden="true" className="relative hidden h-[190px] lg:block [@media(max-height:765px)]:hidden!">
      <div className="absolute left-0 top-3 w-[290px] rounded-2xl bg-white p-5 text-[#1a1818] shadow-2xl shadow-blue-950/40">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#535768]">Today</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{clock ?? '--:--'}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-medium text-emerald-900">
            <span className="relative flex h-2 w-2">
              {!reduceMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Clocked in
          </span>
        </div>
        <div className="mt-4 flex h-16 items-end gap-2">
          {[30, 42, 36, 48, 22].map((height, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                className={`w-full rounded-md bg-gradient-to-t ${i === 3 ? 'from-[#da5427] to-[#e9825c]' : 'from-[#0b5394] to-sky-400'}`}
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ delay: 0.9 + i * 0.08, duration: 0.7, ease: EASE }}
              />
              <span className="text-[11px] font-medium text-[#535768]">{'MTWTF'[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <motion.div {...bob(0)} className="absolute right-0 top-0 flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[13px] font-medium text-[#1a1818]">Leave approved</span>
          <span className="block text-[12px] text-[#535768]">Enjoy your break!</span>
        </span>
      </motion.div>

      <motion.div {...bob(1.5)} className="absolute bottom-0 right-8 flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fbe6dd] text-[#b4441f]">
          <Wallet className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[13px] font-medium text-[#1a1818]">Payslip ready</span>
          <span className="block text-[12px] text-[#535768]">This month&apos;s salary</span>
        </span>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Light / dark theme for the login page only. Follows the system setting until
// the visitor picks one, then remembers that choice in this browser.
// -----------------------------------------------------------------------------

export type Theme = 'light' | 'dark';
const THEME_KEY = 'globalhr-login-theme';
const themeListeners = new Set<() => void>();
// Used when the browser blocks storage, so the switch still works for this visit.
let chosenThisVisit: Theme | null = null;

export const subscribeTheme = (onChange: () => void) => {
  themeListeners.add(onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    themeListeners.delete(onChange);
    media.removeEventListener('change', onChange);
  };
};
export const readTheme = (): Theme => {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable
  }
  if (chosenThisVisit) return chosenThisVisit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
export const serverTheme = (): Theme => 'light';
export const saveTheme = (theme: Theme) => {
  chosenThisVisit = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage unavailable
  }
  themeListeners.forEach((notify) => notify());
};

export function ThemeToggle({ theme }: { theme: Theme }) {
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <motion.button
      type="button"
      onClick={() => saveTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1a1818] shadow-sm transition-colors duration-300 hover:bg-[#fbe6dd] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f5c4b0] dark:border-white/10 dark:bg-[#111a2e] dark:text-[#f1f3f8] dark:hover:bg-white/10 sm:right-6 sm:top-6 cursor-pointer"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="block"
        >
          {theme === 'dark' ? <Sun aria-hidden="true" className="h-5 w-5 text-[#f8d3c3]" /> : <Moon aria-hidden="true" className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// -----------------------------------------------------------------------------
// Left panel, below the first screen: sections that reveal as they scroll into
// view (geeconglobal.com style). Desktop only; on phones the form comes first.
// -----------------------------------------------------------------------------

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Fingerprint, title: 'Attendance & biometrics', text: 'App and device punches land in one clean timeline.' },
  { icon: CalendarCheck, title: 'Leave & holidays', text: 'Balances, approvals and team calendars in one view.' },
  { icon: Wallet, title: 'Payroll & payslips', text: 'Salary, tax and payslips handled with care every month.' },
  { icon: Clock3, title: 'Timesheets', text: 'Log hours against projects and get them approved quickly.' },
  { icon: Briefcase, title: 'Recruitment', text: 'Post jobs, follow applicants and welcome new starters.' },
  { icon: Award, title: 'Performance', text: 'Goals, achievements and reviews that celebrate progress.' },
];

const DAY: { icon: LucideIcon; time: string; title: string; text: string }[] = [
  { icon: Fingerprint, time: '09:00', title: 'Clock in', text: 'One tap from your phone or the office device, and your day is on record.' },
  { icon: CalendarCheck, time: '13:00', title: 'Plan time off', text: 'Request leave in seconds; your manager can approve it on the go.' },
  { icon: Clock3, time: '17:30', title: 'Wrap up', text: 'Submit your timesheet and head home knowing everything is done.' },
];

const ROLES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UserRound, title: 'Employees', text: 'See your payslips, leave and attendance whenever you need them.' },
  { icon: UsersRound, title: 'Managers', text: 'Approve requests quickly and keep an eye on your team.' },
  { icon: HeartHandshake, title: 'HR teams', text: 'Run every people process from one organised place.' },
  { icon: ShieldCheck, title: 'Administrators', text: 'Control access, brands and settings with confidence.' },
];

// Only protections the sign-in code actually enforces (see auth-service.ts).
const SAFEGUARDS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: 'Account protection', text: 'Accounts lock after repeated failed sign-ins, as set by your company.' },
  { icon: TimerReset, title: 'Automatic sign-out', text: "Idle sessions end on their own, following your company's policy." },
  { icon: History, title: 'Sign-in history', text: 'Every sign-in is recorded, so unusual activity is easy to spot.' },
];

const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.2 } } as const;


/** Sits at the bottom of the first screen and invites the visitor to scroll. */
function ScrollCue() {
  return (
    <button
      type="button"
      onClick={() => document.getElementById('more-about-global-hr')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="absolute left-14 top-[calc(100vh-3.25rem)] z-10 hidden items-center gap-2 rounded-full text-[14px] text-indigo-100 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:flex cursor-pointer"
    >
      <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} className="flex">
        <ChevronsDown aria-hidden="true" className="h-4 w-4" />
      </motion.span>
      Scroll to explore
    </button>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <motion.div variants={reveal} className="max-w-[30rem]">
      <p className="flex items-center gap-3 text-[13px] font-medium uppercase tracking-widest text-[#f8d3c3]">
        {/* A short orange rule that draws in as the heading arrives. */}
        <motion.span
          aria-hidden="true"
          className="h-0.5 rounded-full bg-[#e15425]"
          variants={{ hidden: { width: 0 }, show: { width: 28, transition: { duration: 0.7, ease: EASE, delay: 0.15 } } }}
        />
        {eyebrow}
      </p>
      <h3 className="mt-3 text-[32px] font-medium leading-[1.15] tracking-[-0.03em] text-white">{title}</h3>
      {text && <p className="mt-3 text-[17px] leading-[1.6] text-indigo-100">{text}</p>}
    </motion.div>
  );
}

// Scroll-in variants for the sections below the first screen.
/** Cards tip up into place in 3D. */
const tiltIn: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: 28 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.8, ease: EASE } },
};
/** Alternate rows slide in from the left and the right. */
const slideIn: Variants = {
  hidden: (i: number) => ({ opacity: 0, x: i % 2 ? 56 : -56 }),
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
};
/** Icons pop in with a little spring. */
const popIn: Variants = {
  hidden: { scale: 0, rotate: -30 },
  show: { scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 14 } },
};
/** The closing card zooms gently into place. */
const zoomIn: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

/** One time slot in "A day with Global HR": its dot lights up when the scroll-linked line reaches it. */
function DayStep({
  progress,
  at,
  icon: Icon,
  time,
  title,
  text,
}: {
  progress: MotionValue<number>;
  at: number;
  icon: LucideIcon;
  time: string;
  title: string;
  text: string;
}) {
  const dotColor = useTransform(progress, [Math.max(0, at - 0.08), at], ['rgba(255,255,255,0.14)', '#e15425']);
  const dotScale = useTransform(progress, [Math.max(0, at - 0.08), at, Math.min(1, at + 0.08)], [0.85, 1.15, 1]);
  const textOpacity = useTransform(progress, [Math.max(0, at - 0.12), at], [0.45, 1]);
  return (
    <div className="relative pb-10 last:pb-0">
      <motion.span
        style={{ backgroundColor: dotColor, scale: dotScale }}
        className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-[#e15425]/20"
      >
        <Icon aria-hidden="true" className="h-4 w-4 text-white" />
      </motion.span>
      <motion.div style={{ opacity: textOpacity }}>
        <p className="text-[13px] font-medium uppercase tracking-widest text-[#f8d3c3]">{time}</p>
        <p className="mt-1 text-[18px] font-medium text-white">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-indigo-100">{text}</p>
      </motion.div>
    </div>
  );
}

function MoreAboutGlobalHR({ reduceMotion }: { reduceMotion: boolean }) {
  // The timeline line grows with the scroll position while "A day with Global HR" passes by.
  const dayRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: dayScroll } = useScroll({ target: dayRef, offset: ['start 75%', 'end 55%'] });
  const dayProgress = useTransform(dayScroll, (v) => (reduceMotion ? 1 : v));

  return (
    <div id="more-about-global-hr" className="relative z-10 hidden max-w-[30rem] scroll-mt-10 lg:block">
      {/* Features */}
      <motion.section variants={stagger} {...inView} className="pt-20">
        <SectionHeading
          eyebrow="Everything in one place"
          title="All your HR, beautifully simple"
          text="From the first clock-in to the last payslip, every part of working life has a home."
        />
        <div className="mt-8 grid grid-cols-2 gap-3" style={{ perspective: 1000 }}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <motion.div
              key={title}
              variants={tiltIn}
              whileHover={{ y: -4 }}
              style={{ transformOrigin: 'top center' }}
              className="rounded-2xl border border-white/15 bg-white/10 p-5 transition-colors duration-300 hover:border-white/30"
            >
              <motion.span variants={popIn} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#da5427]">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </motion.span>
              <p className="mt-4 text-[16px] font-medium text-white">{title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-white">{text}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* A day with Global HR */}
      <motion.section variants={stagger} {...inView} className="pt-24">
        <SectionHeading eyebrow="A day with Global HR" title="From first clock-in to a well-earned evening" />
        <div ref={dayRef} className="relative mt-8 pl-10">
          <span aria-hidden="true" className="absolute bottom-3 left-[15px] top-3 w-px bg-white/15" />
          <motion.span
            aria-hidden="true"
            className="absolute bottom-3 left-[15px] top-3 w-px origin-top bg-gradient-to-b from-[#e15425] via-[#f8a27e] to-[#e15425]"
            style={{ scaleY: dayProgress }}
          />
          {DAY.map((step, i) => (
            <DayStep key={step.time} progress={dayProgress} at={i / (DAY.length - 1)} {...step} />
          ))}
        </div>
      </motion.section>

      {/* Roles */}
      <motion.section variants={stagger} {...inView} className="pt-24">
        <SectionHeading eyebrow="Made for everyone" title="One home for every role" />
        <div className="mt-8 space-y-3">
          {ROLES.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              custom={i}
              variants={slideIn}
              whileHover={{ x: 6 }}
              className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 transition-colors duration-300 hover:border-white/30"
            >
              <motion.span variants={popIn} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0b5394]">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </motion.span>
              <div>
                <p className="text-[16px] font-medium text-white">{title}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-white">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Security */}
      <motion.section variants={stagger} {...inView} className="pt-24">
        <SectionHeading eyebrow="Secure by design" title="Your people's data, carefully protected" />
        <div className="mt-8 space-y-5">
          {SAFEGUARDS.map(({ icon: Icon, title, text }) => (
            <motion.div key={title} variants={reveal} className="flex items-start gap-4">
              <motion.span
                variants={popIn}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[#f8d3c3]"
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </motion.span>
              <div>
                <p className="text-[16px] font-medium text-white">{title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-indigo-100">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Closing note */}
      <motion.section variants={stagger} {...inView} className="pt-24">
        <motion.div variants={zoomIn} className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 p-7">
          <p className="text-[26px] font-medium leading-snug tracking-[-0.02em] text-white">Ready when you are.</p>
          <p className="mt-2 text-[16px] leading-relaxed text-white">
            Your workspace is one sign-in away. We&apos;ll keep everything right where you left it.
          </p>
        </motion.div>
        <motion.div variants={reveal} className="mt-10 flex items-center justify-between">
          <p className="text-[13px] tracking-wide text-indigo-200">Global HR Suite v4.2.1</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-1.5 rounded-full text-[14px] text-indigo-100 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white cursor-pointer"
          >
            Back to top
            <ArrowUp aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
          </button>
        </motion.div>
      </motion.section>
    </div>
  );
}

/** Thin orange bar along the top of the brand panel showing how far down the page you are. */
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      aria-hidden="true"
      className="fixed left-0 top-0 z-30 hidden h-1 w-5/12 origin-left bg-gradient-to-r from-[#e15425] via-[#f8a27e] to-[#e15425] lg:block"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

/** Round "back to top" button that appears once the visitor has scrolled down. */
function FloatingBackToTop() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setVisible(y > 900));
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 12 }}
          whileHover={{ y: -3 }}
          className="fixed bottom-6 left-[calc(41.6667%-4.25rem)] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-lg backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:flex cursor-pointer"
        >
          <ArrowUp aria-hidden="true" className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// Building blocks for the account-recovery pages
// -----------------------------------------------------------------------------

/** Current light/dark choice for the sign-in pages. */
export function useAuthTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
}

/** Success or error message under a form. Errors give a short shake; give it a new `key` to replay. */
export function StatusMessage({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      role={ok ? 'status' : 'alert'}
      initial={{ opacity: 0, y: ok ? -6 : 0 }}
      animate={ok ? { opacity: 1, y: 0 } : { opacity: 1, x: [0, -8, 8, -6, 6, -3, 0] }}
      transition={{ duration: 0.45 }}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${
        ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-100'
          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-400/40 dark:bg-red-950/50 dark:text-red-100'
      }`}
    >
      {ok ? (
        <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
      )}
      <span>{children}</span>
    </motion.div>
  );
}

/** "Checking…" line with a spinner, for short waits. */
export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-2 py-4 text-[15px] text-[#535768] dark:text-[#aab3c5]">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-[#da5427]" />
      {children}
    </p>
  );
}

/**
 * Page frame shared by the account-recovery pages: the blue brand panel on the left,
 * a card on the right with an icon, title and subtitle, the theme switch, and a
 * "Back to login" link. Matches the login page.
 */
export function AuthShell({
  icon: Icon,
  title,
  subtitle,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Shown on the right of the "Back to login" row, e.g. a related recovery link. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const theme = useAuthTheme();

  return (
    <MotionConfig reducedMotion="user">
      <div className={theme === 'dark' ? 'dark' : undefined} style={{ colorScheme: theme }}>
        <div
          className={`${poppins.className} min-h-screen bg-[#f4f6fb] text-[#1a1818] transition-colors duration-300 dark:bg-[#0b1220] dark:text-[#f1f3f8] flex flex-col lg:grid lg:grid-cols-12 overflow-x-clip`}
        >
          <BrandPanel reduceMotion={reduceMotion} showMore={false} />

          <main className="relative lg:col-span-7 flex flex-col items-center justify-center gap-6 px-4 pb-8 pt-16 sm:px-10 lg:sticky lg:top-0 lg:self-start lg:h-screen lg:overflow-y-auto lg:py-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#d8e8ff]/70 blur-3xl dark:bg-[#1d3a6e]/40" />
              <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#f9ddd1]/70 blur-3xl dark:bg-[#5a2412]/40" />
            </div>

            <ThemeToggle theme={theme} />

            <motion.div
              variants={reveal}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.1 }}
              className="relative w-full max-w-md rounded-[28px] bg-white p-7 sm:px-10 sm:py-9 ring-1 ring-slate-200 shadow-[0_24px_60px_-24px_rgba(6,27,49,0.25)] transition-colors duration-300 dark:bg-[#111a2e] dark:ring-white/10 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]"
            >
              <motion.div variants={cascade} initial="hidden" animate="show">
                <motion.div variants={rise} className="flex justify-center">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fbe6dd] text-[#da5427] dark:bg-[#da5427]/15 dark:text-[#f8d3c3]">
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl ring-2 ring-[#da5427]/40"
                      animate={reduceMotion ? undefined : { scale: [1, 1.25], opacity: [0.6, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <Icon aria-hidden="true" className="h-7 w-7" />
                  </span>
                </motion.div>

                <motion.div variants={rise} className="mt-4 text-center">
                  <h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-[#1a1818] dark:text-[#f1f3f8]">{title}</h1>
                  {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-[#535768] dark:text-[#aab3c5]">{subtitle}</p>}
                </motion.div>

                <motion.div variants={rise} className="mt-6">
                  {children}
                </motion.div>

                <motion.div
                  variants={rise}
                  className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200 pt-4 text-[14px] dark:border-white/10"
                >
                  <Link href="/login" className={`group flex items-center gap-1.5 ${LINK}`}>
                    <ArrowLeft aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                    Back to login
                  </Link>
                  {footer}
                </motion.div>
              </motion.div>
            </motion.div>

            <p className="relative text-center text-[13px] text-[#323338] dark:text-[#c9cfdb] lg:absolute lg:inset-x-0 lg:bottom-4">
              © 2026 Global HR Application.
            </p>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
