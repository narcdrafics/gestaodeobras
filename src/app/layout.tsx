import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ConfigProvider, App } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import ptBR from "antd/locale/pt_BR";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestão de Obras - Admin Corporativo",
  description: "Redesign Corporativo Minimalista com Next.js & Ant Design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className} style={{ margin: 0, padding: 0, backgroundColor: "#f4f5f8" }}>
        <AntdRegistry>
          <ConfigProvider
            locale={ptBR}
            theme={{
              token: {
                colorPrimary: "#1890ff",
                colorBgLayout: "#f4f5f8",
                colorTextBase: "#334155",
                borderRadius: 8,
                fontFamily: inter.style.fontFamily,
              },
              components: {
                Menu: {
                  itemBg: "transparent",
                },
                Layout: {
                  siderBg: "#ffffff",
                  headerBg: "#ffffff",
                },
              },
            }}
          >
            <App>
              <AuthProvider>
                {children}
              </AuthProvider>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
