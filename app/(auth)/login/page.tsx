"use client"
import { useRouter } from 'next/navigation';
import LoginScreen from "@/components/auth/LoginScreen";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/dashboard');
  };

  return <LoginScreen onLogin={handleLogin} />;
}