"use client"
import React, { useState, useSyncExternalStore } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  User, Lock, Eye, EyeOff, UserPlus, Building, ArrowLeft, Mail, Phone, Globe, ShieldCheck,
  ArrowBigUp, CircleAlert, CircleCheck, KeyRound, Lightbulb,
} from 'lucide-react';
import GlobalHRLogo from '@/components/auth/GlobalHRLogo';
import {
  BrandPanel, CHECKBOX, ChoiceButton, Field, LINK, PrimaryButton, SelectField, ThemeToggle,
  cascade, poppins, readTheme, reveal, rise, serverTheme, subscribeTheme,
} from '@/components/auth/AuthUi';

interface LoginScreenProps {
  /** Called after a successful login; `redirectTo` is the server's choice (e.g. forced password change). */
  onLogin: (username: string, redirectTo?: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  // Navigation mode
  const [mode, setMode] = useState<'login' | 'register' | 'create-org'>('login');

  // General States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- LOGIN STATE ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // --- USER REGISTRATION STATE ---
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOrgCode, setRegOrgCode] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regMemorableWord, setRegMemorableWord] = useState('');
  const [regAgree, setRegAgree] = useState(false);

  // --- ORGANISATION REGISTRATION STATE ---
  const [orgCode, setOrgCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgCountry, setOrgCountry] = useState('United Kingdom');
  const [orgContact, setOrgContact] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgSubscription, setOrgSubscription] = useState('Subscription Level');
  const [orgPasscode, setOrgPasscode] = useState('');
  const [orgMemorableWord, setOrgMemorableWord] = useState('');
  const [orgAgree, setOrgAgree] = useState(false);

  // --- FORM SUBMIT HANDLERS ---

  // Handle Login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username/Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid username or password. Please try again.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onLogin(data.user.username, data.redirectTo);
    } catch (err) {
      setLoading(false);
      setError('Unable to reach the server. Please try again.');
    }
  };

  // Handle User Account Registration
  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation checks
    if (!regUsername.trim()) return setError('Username is required');
    if (!regPassword) return setError('Password is required');
    if (regPassword !== regConfirmPassword) return setError('Passwords do not match');
    if (!regEmail.trim()) return setError('Email address is required');
    if (!regOrgCode.trim()) return setError('Organisation code is required');
    if (!regPasscode || regPasscode.length !== 6) return setError('Please enter a 6-digit passcode');
    if (!regMemorableWord.trim()) return setError('A memorable word is required for security retrieval');
    if (!regAgree) return setError('You must agree to the Terms and Privacy agreement');

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
          email: regEmail.trim(),
          orgCode: regOrgCode.toUpperCase().trim(),
          passcode: regPasscode,
          memorableWord: regMemorableWord.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Unable to create account.');
        setLoading(false);
        return;
      }

      setLoading(false);
      setSuccess('Account created successfully! You can now log in.');

      // Auto pre-fill login
      setUsername(regUsername);
      setPassword(regPassword);

      // Switch back to login mode after successful registration
      setTimeout(() => {
        setMode('login');
        setSuccess('');
      }, 2000);

      // Clear register fields
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegEmail('');
      setRegOrgCode('');
      setRegPasscode('');
      setRegMemorableWord('');
      setRegAgree(false);
    } catch (err) {
      setLoading(false);
      setError('Unable to reach the server. Please try again.');
    }
  };

  // Handle Organization Creation
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation checks
    if (!orgCode.trim()) return setError('Organisation code is required');
    if (!orgName.trim()) return setError('Organisation name is required');
    if (!orgEmail.trim()) return setError('Organisation email is required');
    if (!orgContact.trim()) return setError('Contact number is required');
    if (!orgPasscode || orgPasscode.length !== 6) return setError('Please enter a 6-digit passcode');
    if (!orgMemorableWord.trim()) return setError('Please provide a memorable word');
    if (!orgAgree) return setError('You must agree to the Terms and Privacy agreement');

    setLoading(true);

    try {
      const res = await fetch('/api/auth/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: orgCode.toUpperCase().trim(),
          name: orgName.trim(),
          email: orgEmail.trim(),
          country: orgCountry,
          contact: orgContact.trim(),
          website: orgWebsite.trim() || undefined,
          subscription: orgSubscription,
          passcode: orgPasscode,
          memorableWord: orgMemorableWord.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Unable to create organisation.');
        setLoading(false);
        return;
      }

      setLoading(false);
      setSuccess(`Organisation "${orgName}" registered successfully with Code: ${data.org.code}`);

      // Pre-fill organisation code on register state
      setRegOrgCode(data.org.code);

      setTimeout(() => {
        setMode('register'); // Go to register screen so they can create an admin account for it
        setSuccess('');
      }, 2200);

      // Clear fields
      setOrgCode('');
      setOrgName('');
      setOrgEmail('');
      setOrgCountry('United Kingdom');
      setOrgContact('');
      setOrgWebsite('');
      setOrgSubscription('Subscription Level');
      setOrgPasscode('');
      setOrgMemorableWord('');
      setOrgAgree(false);
    } catch (err) {
      setLoading(false);
      setError('Unable to reach the server. Please try again.');
    }
  };

  // ---------------------------------------------------------------------------
  // UI-only state below. Nothing here changes how login, registration or
  // organisation creation behave; it only drives presentation.
  // ---------------------------------------------------------------------------
  const reduceMotion = useReducedMotion() ?? false;
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const [capsLock, setCapsLock] = useState(false);
  // Bumped on every submit so a repeated error message shakes again.
  const [attempt, setAttempt] = useState(0);

  const switchMode = (next: 'login' | 'register' | 'create-org') => {
    setError('');
    setSuccess('');
    setMode(next);
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  const copy = {
    login: { title: 'Sign in to your account', subtitle: 'Welcome back! Please enter your details.' },
    register: { title: 'Create your account', subtitle: "Join your organisation's Global HR workspace." },
    'create-org': { title: 'Register your organisation', subtitle: 'Set up Global HR for your whole team.' },
  }[mode];

  return (
    <MotionConfig reducedMotion="user">
      <div className={theme === 'dark' ? 'dark' : undefined} style={{ colorScheme: theme }}>
      <div
        className={`${poppins.className} min-h-screen bg-[#f4f6fb] text-[#1a1818] transition-colors duration-300 dark:bg-[#0b1220] dark:text-[#f1f3f8] flex flex-col lg:grid lg:grid-cols-12 overflow-x-clip`}
      >
        <BrandPanel reduceMotion={reduceMotion} />

        {/* RIGHT PANEL - LOGIN / REGISTRATION CARD */}
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
            className={`relative w-full ${mode === 'create-org' ? 'max-w-xl' : 'max-w-md'} rounded-[28px] bg-white p-7 sm:px-10 sm:py-8 ring-1 ring-slate-200 shadow-[0_24px_60px_-24px_rgba(6,27,49,0.25)] transition-[max-width,background-color] duration-300 dark:bg-[#111a2e] dark:ring-white/10 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode} variants={cascade} initial="hidden" animate="show" exit="exit">
                {mode === 'login' && (
                  <motion.div variants={rise} className="mb-4 flex justify-center">
                    <GlobalHRLogo size="md" />
                  </motion.div>
                )}
                <motion.div variants={rise} className="text-center">
                  <h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-[#1a1818] dark:text-[#f1f3f8]">{copy.title}</h1>
                  <p className="mt-1.5 text-[15px] text-[#535768] dark:text-[#aab3c5]">{copy.subtitle}</p>
                </motion.div>

                {/* Status alerts */}
                <div aria-live="polite">
                  <AnimatePresence initial={false}>
                    {error && (
                      <motion.div
                        key={`error-${attempt}-${error}`}
                        role="alert"
                        initial={{ opacity: 0 }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: [0, -8, 8, -6, 6, -3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45 }}
                        className="mt-5 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[14px] text-red-900 dark:border-red-400/40 dark:bg-red-950/50 dark:text-red-100"
                      >
                        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                    {success && (
                      <motion.div
                        key={`success-${success}`}
                        role="status"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-100"
                      >
                        <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        <span>{success}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 1. LOGIN MODE */}
                {mode === 'login' && (
                  <>
                    <form
                      onSubmit={(e) => {
                        setAttempt((n) => n + 1);
                        handleSubmit(e);
                      }}
                      className="mt-5 space-y-4 text-left"
                    >
                      <motion.div variants={rise}>
                        <Field
                          id="login-username"
                          label="Username or email"
                          icon={User}
                          type="text"
                          autoComplete="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g. DEMOadmin"
                        />
                      </motion.div>

                      <motion.div variants={rise}>
                        <Field
                          id="login-password"
                          label="Password"
                          icon={Lock}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={trackCapsLock}
                          onKeyUp={trackCapsLock}
                          onBlur={() => setCapsLock(false)}
                          placeholder="Enter your password"
                          trailing={
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              aria-pressed={showPassword}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#535768] transition-colors hover:bg-[#fbe6dd] hover:text-[#1a1818] dark:text-[#aab3c5] dark:hover:bg-white/10 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-[#da5427] cursor-pointer"
                            >
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                  key={showPassword ? 'hide' : 'show'}
                                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                                  transition={{ duration: 0.15 }}
                                  className="block"
                                >
                                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </motion.span>
                              </AnimatePresence>
                            </button>
                          }
                          hint={
                            <AnimatePresence>
                              {capsLock && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-amber-900 dark:text-amber-300"
                                >
                                  <ArrowBigUp aria-hidden="true" className="h-4 w-4" />
                                  Caps Lock is on
                                </motion.p>
                              )}
                            </AnimatePresence>
                          }
                        />
                      </motion.div>

                      <motion.div variants={rise} className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className={CHECKBOX}
                          />
                          <span className="text-[14px] text-[#323338] dark:text-[#d5dae4]">Remember me</span>
                        </label>
                        <a href="/login/forgot_pass" className={`text-[14px] ${LINK}`}>
                          Forgot password?
                        </a>
                      </motion.div>

                      <motion.div variants={rise}>
                        <PrimaryButton id="login-submit-button" loading={loading} loadingText="Signing you in…">
                          Log in
                        </PrimaryButton>
                      </motion.div>
                    </form>

                    <motion.div variants={rise} className="my-5 flex items-center gap-4">
                      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      <span className="text-[14px] text-[#535768] dark:text-[#aab3c5]">New to Global HR?</span>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    </motion.div>

                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ChoiceButton icon={UserPlus} title="New user" onClick={() => switchMode('register')} />
                      <ChoiceButton icon={Building} title="New organisation" onClick={() => switchMode('create-org')} />
                    </motion.div>
                  </>
                )}

                {/* 2. REGISTER USER ACCOUNT MODE */}
                {mode === 'register' && (
                  <form
                    onSubmit={(e) => {
                      setAttempt((n) => n + 1);
                      handleUserRegister(e);
                    }}
                    className="mt-5 space-y-3 text-left"
                  >
                    <motion.div variants={rise}>
                      <Field
                        id="reg-username"
                        label="Username"
                        icon={User}
                        type="text"
                        autoComplete="username"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="e.g. jsmith"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        id="reg-password"
                        label="Password"
                        icon={Lock}
                        type="password"
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                      />
                      <Field
                        id="reg-confirm-password"
                        label="Confirm password"
                        icon={Lock}
                        type="password"
                        autoComplete="new-password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise}>
                      <Field
                        id="reg-email"
                        label="Email"
                        icon={Mail}
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        id="reg-org-code"
                        label="Organisation code"
                        icon={Building}
                        type="text"
                        value={regOrgCode}
                        onChange={(e) => setRegOrgCode(e.target.value)}
                        placeholder="e.g. GEECON"
                        inputClassName="uppercase"
                        required
                      />
                      <Field
                        id="reg-passcode"
                        label="6-digit passcode"
                        icon={KeyRound}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={regPasscode}
                        onChange={(e) => setRegPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise}>
                      <Field
                        id="reg-memorable-word"
                        label="Memorable word"
                        icon={Lightbulb}
                        type="text"
                        value={regMemorableWord}
                        onChange={(e) => setRegMemorableWord(e.target.value)}
                        placeholder="Something only you will remember"
                        required
                      />
                    </motion.div>

                    <motion.label variants={rise} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regAgree}
                        onChange={(e) => setRegAgree(e.target.checked)}
                        className={`${CHECKBOX} mt-0.5`}
                        required
                      />
                      <span className="text-[14px] leading-snug text-[#323338] dark:text-[#d5dae4]">
                        I agree to the Global HR Application <a href="#terms" className={LINK}>Terms and Privacy</a>
                      </span>
                    </motion.label>

                    <motion.div variants={rise}>
                      <PrimaryButton loading={loading} loadingText="Creating your account…">
                        Create account
                      </PrimaryButton>
                    </motion.div>
                  </form>
                )}

                {/* 3. CREATE ORGANISATION MODE */}
                {mode === 'create-org' && (
                  <form
                    onSubmit={(e) => {
                      setAttempt((n) => n + 1);
                      handleCreateOrg(e);
                    }}
                    className="mt-5 space-y-3 text-left"
                  >
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        id="org-code"
                        label="Organisation code"
                        icon={Building}
                        type="text"
                        value={orgCode}
                        onChange={(e) => setOrgCode(e.target.value)}
                        placeholder="e.g. GEECON"
                        inputClassName="uppercase"
                        required
                      />
                      <Field
                        id="org-name"
                        label="Organisation name"
                        icon={Building}
                        type="text"
                        autoComplete="organization"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Geecon Systems"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        id="org-email"
                        label="Organisation email"
                        icon={Mail}
                        type="email"
                        autoComplete="email"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        placeholder="hello@company.com"
                        required
                      />
                      <SelectField id="org-country" label="Country" icon={Globe} value={orgCountry} onChange={(e) => setOrgCountry(e.target.value)}>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="India">India</option>
                        <option value="United States">United States</option>
                        <option value="Singapore">Singapore</option>
                        <option value="UAE">UAE</option>
                      </SelectField>
                    </motion.div>
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        id="org-contact"
                        label="Contact number"
                        icon={Phone}
                        type="text"
                        autoComplete="tel"
                        value={orgContact}
                        onChange={(e) => setOrgContact(e.target.value)}
                        placeholder="+44 20 1234 5678"
                        required
                      />
                      <Field
                        id="org-website"
                        label="Website"
                        optional
                        icon={Globe}
                        type="text"
                        autoComplete="url"
                        value={orgWebsite}
                        onChange={(e) => setOrgWebsite(e.target.value)}
                        placeholder="www.company.com"
                      />
                    </motion.div>
                    <motion.div variants={rise} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelectField id="org-subscription" label="Subscription level" icon={ShieldCheck} value={orgSubscription} onChange={(e) => setOrgSubscription(e.target.value)}>
                        <option value="Subscription Level">Subscription Level</option>
                        <option value="Basic">Basic</option>
                        <option value="Professional">Professional</option>
                        <option value="Premium">Premium</option>
                        <option value="Enterprise">Enterprise</option>
                      </SelectField>
                      <Field
                        id="org-passcode"
                        label="6-digit passcode"
                        icon={KeyRound}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={orgPasscode}
                        onChange={(e) => setOrgPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        required
                      />
                    </motion.div>
                    <motion.div variants={rise}>
                      <Field
                        id="org-memorable-word"
                        label="Memorable word"
                        icon={Lightbulb}
                        type="text"
                        value={orgMemorableWord}
                        onChange={(e) => setOrgMemorableWord(e.target.value)}
                        placeholder="Something only you will remember"
                        required
                      />
                    </motion.div>

                    <motion.label variants={rise} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgAgree}
                        onChange={(e) => setOrgAgree(e.target.checked)}
                        className={`${CHECKBOX} mt-0.5`}
                        required
                      />
                      <span className="text-[14px] leading-snug text-[#323338] dark:text-[#d5dae4]">
                        I agree to the Global HR Application <a href="#terms" className={LINK}>Terms and Privacy</a>
                      </span>
                    </motion.label>

                    <motion.div variants={rise}>
                      <PrimaryButton loading={loading} loadingText="Creating your organisation…">
                        Create organisation
                      </PrimaryButton>
                    </motion.div>
                  </form>
                )}

                {/* Back / forgot links on the registration screens */}
                {mode !== 'login' && (
                  <motion.div
                    variants={rise}
                    className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4 text-[14px] dark:border-white/10"
                  >
                    <button type="button" onClick={() => switchMode('login')} className={`group flex items-center gap-1.5 cursor-pointer ${LINK}`}>
                      <ArrowLeft aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                      Back to login
                    </button>
                    <a href="/login/forgot_pass" className={LINK}>
                      Forgot password?
                    </a>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {mode === 'login' && (
            <p className="relative text-center text-[13px] text-[#323338] dark:text-[#c9cfdb] lg:absolute lg:inset-x-0 lg:bottom-4">© 2026 Global HR Application.</p>
          )}
        </main>
      </div>
      </div>
    </MotionConfig>
  );
}
