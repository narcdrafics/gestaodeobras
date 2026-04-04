"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Para simplificar a demonstração inicial e scaffolding, redirecionamos da Home '/'
    // direto para '/dashboard' (Posteriormente o Middleware protegerá rotas sem Login)
    router.replace("/dashboard");
  }, [router]);

  return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f4f5f8' }}>Redirecionando...</div>;
}
