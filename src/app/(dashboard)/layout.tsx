"use client";

import React, { useState } from "react";
import { Layout, Menu, Typography, Avatar, Dropdown, Button } from "antd";
import { 
  HomeOutlined, 
  WalletOutlined, 
  CheckSquareOutlined, 
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
  TeamOutlined,
  FileSearchOutlined,
  ShoppingCartOutlined
} from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { auth } from "@/lib/firebase";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const menuItems = [
    { key: "/dashboard", icon: <HomeOutlined />, label: "Visão Geral" },
    { key: "/obras", icon: <ToolOutlined />, label: "Obras" },
    { key: "/tarefas", icon: <CheckSquareOutlined />, label: "Tarefas e Etapas" },
    { key: "/trabalhadores", icon: <TeamOutlined />, label: "Trabalhadores" },
    { key: "/medicoes", icon: <FileSearchOutlined />, label: "Medições" },
    { key: "/compras", icon: <ShoppingCartOutlined />, label: "Suprimentos / Compras" },
    { key: "/financeiro", icon: <WalletOutlined />, label: "Financeiro" },
  ];

  const handleMenuClick = (e: { key: string }) => {
    router.push(e.key);
  };

  const userMenu = {
    items: [
      { key: "profile", label: "Meu Perfil", icon: <UserOutlined /> },
      { key: "logout", label: "Sair", icon: <LogoutOutlined />, danger: true, onClick: () => auth.signOut() },
    ],
  };

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>Carregando Permissões...</div>;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0, color: "#1890ff", transition: 'all 0.2s', opacity: collapsed ? 0 : 1, whiteSpace: 'nowrap' }}>
            Obra Real
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          onClick={handleMenuClick}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 16 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: "0 24px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: '1px solid #f0f0f0' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64, marginLeft: -24 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                <Text strong>{user.name || "Admin"}</Text>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#f4f5f8' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
