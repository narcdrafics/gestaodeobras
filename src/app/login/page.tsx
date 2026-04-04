"use client";

import React, { useState, useEffect } from "react";
import { Card, Form, Input, Button, Typography, message, Divider } from "antd";
import { UserOutlined, LockOutlined, GoogleOutlined } from "@ant-design/icons";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ref, get, set } from "firebase/database";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      messageApi.success("Login efetuado com sucesso!");
    } catch (error: any) {
      messageApi.error("Credenciais inválidas. Tente novamente.");
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    auth.languageCode = "pt";

    try {
      const result = await signInWithPopup(auth, provider);
      // Legado da plataforma: O primeiro login pode exigir provisionar `profiles/${uid}` na mão,
      // aqui delegamos ao onAuthStateChanged que resolverá a sincronização final. 
      // Em SaaS robustos, se Profile não existir o AuthContext reportará e redirecionamos pro Onboarding.
    } catch (error: any) {
      messageApi.error("Erro ao fazer login com Google.");
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f4f5f8" }}>Carregando...</div>;
  }

  return (
    <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f4f5f8" }}>
      {contextHolder}
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} variant="borderless">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: "#1890ff" }}>Obra Real</Title>
          <Text type="secondary">Faça login para continuar</Text>
        </div>

        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="email" rules={[{ required: true, message: "Insira seu email!" }]}>
            <Input prefix={<UserOutlined />} placeholder="Email" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "Insira sua senha!" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Senha" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ backgroundColor: "#1890ff" }}>
              Entrar
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ borderColor: "#e2e8f0" }} plain>
          <Text type="secondary" style={{ fontSize: 12 }}>ou</Text>
        </Divider>

        <Button block icon={<GoogleOutlined />} onClick={loginWithGoogle} size="large">
          Continuar com Google
        </Button>
      </Card>
    </div>
  );
}
