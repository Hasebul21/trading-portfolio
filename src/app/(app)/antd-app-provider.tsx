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
          borderRadiusLG: 10,
        },
        components: {
          Card: {
            paddingLG: 20,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
