import "./globals.css";

export const metadata = {
  title: {
    default: "Property Management",
    template: "%s | Property Management",
  },
  description: "Properties, tenants, rent and repairs in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
