import './style.css'

export const metadata = {
  title: '개인 AI 오피스',
  description: 'An OpenClaw personal dashboard template',
}

export default function RootLayout({ children }) {
  return <html lang="ko"><body>{children}</body></html>
}
