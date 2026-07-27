"use client";

import React, { useEffect, useState } from "react";
import LoginScreen from "@/components/auth/LoginScreen";
import DashboardScreen from "@/components/DashboardScreen";

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rememberedUser = localStorage.getItem("global_hr_session");

    if (rememberedUser) {
      setCurrentUser(rememberedUser);
    }

    setLoading(false);
  }, []);

  const handleLogin = (username: string) => {
    setCurrentUser(username);
    localStorage.setItem("global_hr_session", username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("global_hr_session");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {currentUser ? (
        <DashboardScreen
          username={currentUser}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
}