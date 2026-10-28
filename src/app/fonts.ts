import localFont from "next/font/local";

export const satoshi = localFont({
  src: [
    { path: "../assets/fonts/Satoshi-Light.woff2", weight: "300", style: "normal" },
    { path: "../assets/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
