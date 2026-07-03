import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ads Painel",
  description: "Acompanhe prazos da turma de ADS extraídos automaticamente das mensagens do WhatsApp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#FAFAF9] text-[#27272A]">{children}</body>
    </html>
  );
}
