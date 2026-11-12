"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased bg-paper">
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
