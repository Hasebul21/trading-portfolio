"use client";

import { useTheme } from "@/components/theme-provider";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useMemo } from "react";

/**
 * Maps the eye-safe CSS token palette into Ant Design v5 ConfigProvider
 * tokens. Two themes are defined explicitly so Ant components in dropdowns,
 * modals, and overlays (which render outside the React tree) still pick up
 * the right colours.
 */

const sharedTokens = {
  fontFamily: "var(--font-sans), system-ui, sans-serif",
  fontSize: 14,
  fontSizeLG: 16,
  fontSizeSM: 12,
  fontSizeXL: 18,
  lineHeight: 1.55,
  borderRadius: 6,
  borderRadiusLG: 8,
  borderRadiusSM: 4,
  fontWeightStrong: 500,
};

const lightAntdTheme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...sharedTokens,
    colorBgBase: "#EFECE5",
    colorBgContainer: "#F7F4EC",
    colorBgElevated: "#F7F4EC",
    colorBgLayout: "#EFECE5",
    colorBorder: "#D4CDB9",
    colorBorderSecondary: "#E2DCCC",
    colorText: "#2A2620",
    colorTextSecondary: "#3D362C",
    colorTextTertiary: "#6E6557",
    colorTextQuaternary: "#97907F",
    colorPrimary: "#2D3B5B",
    colorSuccess: "#3A6B46",
    colorError: "#964234",
    colorWarning: "#8B6A2E",
    colorLink: "#2D3B5B",
  },
  components: {
    Table: {
      headerBg: "#EBE6D8",
      headerColor: "#3D362C",
      borderColor: "#E2DCCC",
      rowHoverBg: "#F1EDE3",
    },
    Card: {
      colorBgContainer: "#F7F4EC",
      colorBorderSecondary: "#E2DCCC",
    },
    Button: {
      fontWeight: 500,
    },
  },
};

const darkAntdTheme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...sharedTokens,
    colorBgBase: "#1F1E1A",
    colorBgContainer: "#26241F",
    colorBgElevated: "#26241F",
    colorBgLayout: "#1F1E1A",
    colorBorder: "#332F28",
    colorBorderSecondary: "#2A2823",
    colorText: "#E8E2D4",
    colorTextSecondary: "#C9C2B0",
    colorTextTertiary: "#97907F",
    colorTextQuaternary: "#7B7464",
    colorPrimary: "#8896B5",
    colorSuccess: "#7EAA7C",
    colorError: "#C77A6A",
    colorWarning: "#BFA268",
    colorLink: "#8896B5",
  },
  components: {
    Table: {
      headerBg: "#2E2C26",
      headerColor: "#C9C2B0",
      borderColor: "#2A2823",
      rowHoverBg: "#23211D",
    },
    Card: {
      colorBgContainer: "#26241F",
      colorBorderSecondary: "#2A2823",
    },
    Button: {
      fontWeight: 500,
    },
  },
};

export function AntdAppProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const config = useMemo(
    () => (theme === "dark" ? darkAntdTheme : lightAntdTheme),
    [theme],
  );
  return <ConfigProvider theme={config}>{children}</ConfigProvider>;
}
