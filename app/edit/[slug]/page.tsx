import App from '@/components/App'

// Gated edit route — the client shell reads the slug from the pathname and
// renders the editor behind the unlock gate (see components/App). The recipe is
// loaded from the local store, so no server data is fetched here.
export default function EditPage() {
  return <App />
}
