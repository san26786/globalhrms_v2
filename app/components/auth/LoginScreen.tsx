"use client"
import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, UserPlus, Building, ArrowRight, ArrowLeft, Mail, Phone, Globe, ShieldCheck } from 'lucide-react';
import GlobalHRLogo from '@/components/auth/GlobalHRLogo';

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  // Navigation mode
  const [mode, setMode] = useState<'login' | 'register' | 'create-org'>('login');

  // General States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // --- LOGIN STATE ---
  const [username, setUsername] = useState('DEMOadmin');
  const [password, setPassword] = useState('c');
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
      onLogin(data.user.username);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:grid md:grid-cols-12 overflow-x-hidden font-sans select-none">

      {/* LEFT PANEL - IMMERSIVE COBALT BRANDING (5 Cols) */}
      <div className="relative md:col-span-5 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white p-8 sm:p-12 md:p-16 flex flex-col justify-between overflow-hidden shadow-2xl min-h-[400px] md:min-h-screen">
        {/* Abstract vector wave background */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            <circle cx="20%" cy="10%" r="200" fill="url(#grid-grad)" />
            <circle cx="90%" cy="80%" r="350" fill="url(#grid-grad)" />
            <path
              d="M-50,300 C150,250 350,450 550,350 L550,800 L-50,800 Z"
              fill="url(#grid-grad)"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Floating grid design dots */}
        <div className="absolute left-6 top-1/3 opacity-20 hidden md:grid grid-cols-5 gap-2 z-0">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />
          ))}
        </div>

        {/* Hero Copy */}
        <div className="relative z-10 my-auto space-y-6 max-w-md text-left">
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-300 bg-sky-950/40 px-3.5 py-1.5 rounded-full border border-sky-800/30">
              Enterprise HR System
            </span>
            <p className="text-sm font-medium text-blue-200">Welcome to</p>
            <h2 className="text-4xl sm:text-5xl font-display font-black tracking-tight leading-tight">
              Global HR
            </h2>
          </div>

          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed font-medium">
            Empowering People. Elevating Performance. A complete HR management solution to streamline your workforce operations.
          </p>

          {/* Interactive laptop mockup drawing */}
          <div className="pt-8 relative group">
            <div className="absolute inset-x-8 bottom-0 top-12 bg-sky-500/20 rounded-full filter blur-2xl group-hover:bg-sky-500/30 transition-all duration-500" />

            <div className="relative border-4 border-slate-700/80 rounded-2xl bg-slate-900 shadow-2xl p-2.5 max-w-[340px] mx-auto transform hover:-translate-y-2 hover:rotate-1 transition-all duration-500">
              <div className="bg-slate-950 rounded-lg aspect-[16/10] overflow-hidden p-1 flex flex-col gap-1 relative border border-slate-800">
                <div className="h-2 w-full flex items-center justify-between px-1">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-red-500 rounded-full" />
                    <span className="w-1 h-1 bg-yellow-500 rounded-full" />
                    <span className="w-1 h-1 bg-green-500 rounded-full" />
                  </div>
                  <div className="w-1/2 h-1 bg-slate-800 rounded-full" />
                </div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  <div className="col-span-3 bg-slate-900 rounded p-0.5 flex flex-col gap-0.5">
                    <div className="h-1.5 w-full bg-blue-600 rounded" />
                    <div className="h-1 w-2/3 bg-slate-800 rounded mt-1" />
                    <div className="h-1 w-3/4 bg-slate-800 rounded" />
                    <div className="h-1 w-1/2 bg-slate-800 rounded" />
                  </div>
                  <div className="col-span-9 bg-slate-900 rounded p-1 flex flex-col gap-1">
                    <div className="h-1.5 w-1/3 bg-slate-800 rounded" />
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      <div className="bg-slate-800/60 rounded p-0.5 flex flex-col justify-between">
                        <div className="w-3 h-3 rounded-full border border-sky-500 mx-auto" />
                        <div className="h-1 w-3/4 bg-slate-700 rounded mx-auto" />
                      </div>
                      <div className="bg-slate-800/60 rounded p-0.5 flex flex-col justify-between">
                        <div className="h-1 w-full bg-slate-700 rounded" />
                        <div className="h-1.5 w-full bg-blue-500 rounded" />
                        <div className="h-1 w-2/3 bg-slate-700 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Float Bubbles */}
            <div className="absolute -left-2 top-10 bg-indigo-950/80 border border-indigo-800/50 rounded-xl p-2 flex items-center gap-2 shadow-lg animate-bounce duration-1000">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-[9px] font-bold tracking-wider font-mono">152 Total</span>
            </div>
            <div className="absolute -right-2 top-24 bg-blue-950/80 border border-blue-800/50 rounded-xl p-2 flex items-center gap-2 shadow-lg animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold tracking-wider font-mono">98% Match</span>
            </div>
          </div>
        </div>

        {/* Footer brand detail */}
        <p className="text-[10px] text-blue-300 font-semibold tracking-wider uppercase relative z-10 mt-6 select-none">
          Global HR Suite v4.2.1
        </p>
      </div>

      {/* RIGHT PANEL - PORTAL CARD AND LOGIN/REGISTRATION (7 Cols) */}
      <div className="md:col-span-7 flex flex-col justify-between p-6 sm:p-12 md:p-16 min-h-[500px]">
        <div className="hidden md:block" />

        {/* Login Central Container */}
        <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-100 p-8 sm:p-10 shadow-xl shadow-slate-100/50">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <GlobalHRLogo size="lg" />
          </div>

          {/* Status alerts */}
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-4 py-3 rounded-xl text-left">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold px-4 py-3 rounded-xl text-left">
              {success}
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* Username/Email Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pl-1">
                  Username or Email
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 focus:border-blue-400 focus:bg-white text-xs font-bold text-slate-700 pl-11 pr-4 py-3.5 rounded-xl outline-none transition-all placeholder:text-slate-300"
                    placeholder="DEMOadmin"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pl-1">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/60 focus:border-blue-400 focus:bg-white text-xs font-bold text-slate-700 pl-11 pr-11 py-3.5 rounded-xl outline-none transition-all placeholder:text-slate-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Extra Row: Remember & Forgot */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-50 border-slate-200 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-500">
                    Remember me
                  </span>
                </label>
                <a
                  href="#forgot-password"
                  className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('For demonstration purposes, you can login with the pre-filled credentials immediately!');
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              {/* Login Action Button */}
              <button
                type="submit"
                id="login-submit-button"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-4 px-4 rounded-xl shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-200/70 active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Authenticating Session...
                  </>
                ) : (
                  <>
                    LOGIN
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. REGISTER USER ACCOUNT MODE */}
          {mode === 'register' && (
            <form onSubmit={handleUserRegister} className="space-y-4 text-left">
              <div className="space-y-3">
                {/* Username */}
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Password */}
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Confirm Password */}
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Email */}
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Org Code */}
                <input
                  type="text"
                  value={regOrgCode}
                  onChange={(e) => setRegOrgCode(e.target.value)}
                  placeholder="Org Code"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm uppercase"
                  required
                />

                {/* 6 Digit Passcode */}
                <input
                  type="text"
                  maxLength={6}
                  value={regPasscode}
                  onChange={(e) => setRegPasscode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6 Digit Passcode"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Memorable Word */}
                <input
                  type="text"
                  value={regMemorableWord}
                  onChange={(e) => setRegMemorableWord(e.target.value)}
                  placeholder="ENTER A MEMORABLE WORD"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                {/* Agreement Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={regAgree}
                    onChange={(e) => setRegAgree(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-50 border-slate-200 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
                    required
                  />
                  <span className="text-[11px] font-semibold text-slate-500 leading-normal">
                    I agree to the Global HR Application <a href="#terms" className="text-blue-500 hover:underline">Terms and Privacy</a>
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-blue-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none mt-3"
              >
                {loading ? 'CREATING ACCOUNT...' : 'CREATE AN ACCOUNT'}
              </button>
            </form>
          )}

          {/* 3. CREATE ORGANISATION MODE */}
          {mode === 'create-org' && (
            <form onSubmit={handleCreateOrg} className="space-y-4 text-left">
              {/* Form Grid corresponding to second screenshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  placeholder="Organisation Code"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm uppercase"
                  required
                />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organisation Name"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="Organisation Email"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />

                <select
                  value={orgCountry}
                  onChange={(e) => setOrgCountry(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-600 px-3 py-2.5 rounded-xl outline-none transition-all shadow-sm"
                >
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="Singapore">Singapore</option>
                  <option value="UAE">UAE</option>
                </select>

                <input
                  type="text"
                  value={orgContact}
                  onChange={(e) => setOrgContact(e.target.value)}
                  placeholder="Contact Number"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />
                <input
                  type="text"
                  value={orgWebsite}
                  onChange={(e) => setOrgWebsite(e.target.value)}
                  placeholder="Website"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                />

                <select
                  value={orgSubscription}
                  onChange={(e) => setOrgSubscription(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-600 px-3 py-2.5 rounded-xl outline-none transition-all shadow-sm"
                >
                  <option value="Subscription Level">Subscription Level</option>
                  <option value="Basic">Basic</option>
                  <option value="Professional">Professional</option>
                  <option value="Premium">Premium</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
                <input
                  type="text"
                  maxLength={6}
                  value={orgPasscode}
                  onChange={(e) => setOrgPasscode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6 Digit Passcode"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />
              </div>

              {/* Enter a Memorable Word */}
              <div className="mt-3">
                <input
                  type="text"
                  value={orgMemorableWord}
                  onChange={(e) => setOrgMemorableWord(e.target.value)}
                  placeholder="Enter a Memorable Word"
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-xs font-bold text-slate-700 px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />
              </div>

              {/* Agreement check */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={orgAgree}
                  onChange={(e) => setOrgAgree(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-50 border-slate-200 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
                  required
                />
                <span className="text-[11px] font-semibold text-slate-500 leading-normal">
                  I agree to the Global HR Application <a href="#terms" className="text-blue-500 hover:underline">Terms and Privacy</a>
                </span>
              </label>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-lg shadow-blue-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2 select-none mt-3"
              >
                {loading ? 'CREATING ORGANISATION...' : 'CREATE AN ORGANISATION'}
              </button>
            </form>
          )}

          {/* Card Footer Links (matches layouts) */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-xs font-bold text-slate-400">
            {mode !== 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setMode('login');
                }}
                className="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Go back to Login
              </button>
            ) : (
              <span className="opacity-0">Placeholder</span>
            )}

            <a
              href="#forgot-password"
              className="hover:text-blue-500 transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                alert('Contact system administration or type your memorable word to trigger security recovery protocols.');
              }}
            >
              Forgot Password?
            </a>
          </div>

          {/* Divider & Switch buttons only visible on Login screen */}
          {mode === 'login' && (
            <>
              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  or
                </span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setMode('register');
                  }}
                  className="flex items-center justify-center gap-2 px-3.5 py-3 border border-blue-100 hover:border-blue-200 bg-blue-50/20 hover:bg-blue-50/50 rounded-xl text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-all active:scale-95 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  NEW USER
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccess('');
                    setMode('create-org');
                  }}
                  className="flex items-center justify-center gap-2 px-3.5 py-3 border border-blue-100 hover:border-blue-200 bg-blue-50/20 hover:bg-blue-50/50 rounded-xl text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-all active:scale-95 cursor-pointer"
                >
                  <Building className="w-3.5 h-3.5 shrink-0" />
                  NEW ORGANISATION
                </button>
              </div>
            </>
          )}

        </div>

        {/* Footer info text */}
        <div className="text-center text-[10px] text-slate-400 font-bold tracking-wide mt-12 py-2 uppercase">
          (C)COPYRIGHT 2026. Global HR Application.
        </div>
      </div>
    </div>
  );
}
