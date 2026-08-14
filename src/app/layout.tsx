import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendshare",
  description: "Send a stock token as a link.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@1,2,3,4,5,6,7&display=swap"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
