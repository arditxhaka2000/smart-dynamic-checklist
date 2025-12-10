import "./globals.css"

export const metadata = {
  title: "Smart Dynamic Checklist",
  description: "Dynamic onboarding checklists with Gemini-powered suggestions"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
