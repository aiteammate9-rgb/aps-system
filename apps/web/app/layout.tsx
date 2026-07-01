import type { ReactNode } from "react";

export const metadata = {
  title: "ดูดวงกราฟชีวิต",
  description: "พยากรณ์ศาสตร์เลข 12 ตัว — กราฟชีวิตรายปี",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#f5f7fb",
          color: "#26324d",
        }}
      >
        {children}
      </body>
    </html>
  );
}
