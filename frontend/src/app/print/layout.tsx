"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-dvh bg-paper-2 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] justify-between px-4">
        <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="size-4" /> Back</Button>
        <Button onClick={() => window.print()}><Printer className="size-4" /> Print / Save PDF</Button>
      </div>
      <div className="print-sheet mx-auto max-w-[820px] rounded-2xl border border-line bg-white p-6 text-[#1d1c19] shadow-tile sm:p-10">
        {children}
      </div>
    </div>
  );
}
