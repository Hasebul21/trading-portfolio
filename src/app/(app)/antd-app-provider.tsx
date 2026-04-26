"use client";

import { ConfigProvider, theme } from "antd";

export function AntdAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          fontSize: 15,
          fontSizeLG: 15,
          fontSizeSM: 15,
          fontSizeXL: 15,
          fontSizeHeading1: 15,
          fontSizeHeading2: 15,
          fontSizeHeading3: 15,
          fontSizeHeading4: 15,
          fontSizeHeading5: 15,
          lineHeight: 1.55,
          lineHeightLG: 1.55,
          lineHeightSM: 1.55,
          fontWeightStrong: 400,
          borderRadius: 10,
          borderRadiusLG: 14,
          colorPrimary: "#0d9488",
          colorSuccess: "#34d399",
          colorWarning: "#fbbf24",
          colorError: "#f87171",
          colorInfo: "#818cf8",
          colorText: "#ffffff",
          colorTextSecondary: "#e4e4e7",
          colorTextTertiary: "#a1a1aa",
          colorTextHeading: "#ffffff",
        },
        components: {
          Card: {
            paddingLG: 22,
          },
          Button: {
            primaryShadow: "0 4px 14px rgba(13, 148, 136, 0.35)",
            fontWeight: 400,
            contentFontSize: 15,
          },
          Table: {
            fontSize: 15,
            cellFontSize: 15,
            cellFontSizeMD: 15,
            cellFontSizeSM: 15,
            headerColor: "#ffffff",
            colorText: "#ffffff",
          },
          Typography: {
            fontWeightStrong: 400,
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
