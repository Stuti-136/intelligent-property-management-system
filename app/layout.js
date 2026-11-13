export const metadata = {
  title: "Intelligent Property Management System",
  description: "Hybrid PostgreSQL + Neo4j property management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
