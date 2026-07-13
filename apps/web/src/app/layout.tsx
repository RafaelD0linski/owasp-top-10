import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OWASP Scan Lab",
  description:
    "Scanner web educacional do OWASP Top 10 com demo ao vivo e relatórios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="banner-legal">
          Use apenas em sistemas que você possui ou tem permissão por escrito.
          Testes não autorizados são ilegais.
        </div>
        {children}
      </body>
    </html>
  );
}
