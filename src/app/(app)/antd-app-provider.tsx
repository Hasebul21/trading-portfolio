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
          // Warm taupe palette (#A3897F base).
          colorBgLayout: "#a3897f",
          colorBgContainer: "rgba(255, 248, 244, 0.92)",
          colorBgElevated: "#fbf5f1",
          colorBorder: "rgba(74, 52, 43, 0.28)",
          colorPrimary: "#4a342b",
          colorSuccess: "#2f7d4f",
          colorWarning: "#b25c00",
          colorError: "#b3261e",
          colorInfo: "#5b6acb",
          colorText: "#2a201c",
          colorTextSecondary: "#4a3a32",
          colorTextTertiary: "#6a574c",
          colorTextHeading: "#1a120e",
        },
        components: {
          Card: {
            paddingLG: 22,
          },
          Button: {
            primaryShadow: "0 4px 14px rgba(74, 52, 43, 0.22)",
            fontWeight: 400,
            contentFontSize: 15,
          },
          Table: {
            fontSize: 15,
            cellFontSize: 15,
            cellFontSizeMD: 15,
            cellFontSizeSM: 15,
            headerColor: "#1a120e",
            colorText: "#2a201c",
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
