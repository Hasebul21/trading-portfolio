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
          colorBgLayout: "#1c2029",
          colorBgContainer: "rgba(38, 43, 54, 0.65)",
          colorBgElevated: "#2a303c",
          colorBorder: "rgba(110, 120, 140, 0.38)",
          colorPrimary: "#129187",
          colorSuccess: "#34d399",
          colorWarning: "#fbbf24",
          colorError: "#f87171",
          colorInfo: "#818cf8",
          colorText: "#d4d9e4",
          colorTextSecondary: "#b8bfcc",
          colorTextTertiary: "#8b95a8",
          colorTextHeading: "#e6eaf2",
        },
        components: {
          Card: {
            paddingLG: 22,
          },
          Button: {
            primaryShadow: "0 4px 14px rgba(18, 145, 135, 0.32)",
            fontWeight: 400,
            contentFontSize: 15,
          },
          Table: {
            fontSize: 15,
            cellFontSize: 15,
            cellFontSizeMD: 15,
            cellFontSizeSM: 15,
            headerColor: "#e6eaf2",
            colorText: "#d4d9e4",
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
