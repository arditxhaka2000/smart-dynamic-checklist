import "./globals.css"

export const metadata = {
  title: "Smart Dynamic Checklist",
  description: "Dynamic onboarding checklists with Gemini-powered suggestions"
}

const themeStorageKey = "smart-checklist-theme-v1"

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("${themeStorageKey}");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (_) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  )
}
