import "./globals.css";

export const metadata = {
  title: "Circular Route Generator",
  description: "Generate unique, non-overlapping circular running routes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
