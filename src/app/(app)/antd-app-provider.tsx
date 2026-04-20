"use client";

import { ConfigProvider, theme } from "antd";

export function AntdAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          fontSize: 15,
          lineHeight: 1.6,
          borderRadius: 10,
          borderRadiusLG: 14,
          colorPrimary: "#0d9488",
          colorSuccess: "#059669",
          colorWarning: "#d97706",
          colorError: "#dc2626",
          colorInfo: "#6366f1",
        },
        components: {
          Card: {
            paddingLG: 22,
          },
          Button: {
            primaryShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
          },
          Alert: {
            borderRadiusLG: 12,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
