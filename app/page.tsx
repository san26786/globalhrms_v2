"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginScreen from "@/components/auth/LoginScreen";

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem("global_hr_session");

    if (user) {
      router.replace("/dashboard");
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleLogin = (username: string) => {
    localStorage.setItem("global_hr_session", username);
    router.replace("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return <LoginScreen onLogin={handleLogin} />;
}