import App from '@/components/App'

// Gated create route — the client shell renders the editor behind the unlock
// gate (see components/App). No server data needed.
export default function NewPage() {
  return <App />
}
