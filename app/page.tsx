import App from '@/components/App'

// The list route. The client shell renders from the local store (IndexedDB) with
// a background API refresh — filters are client state, so an SSR list snapshot
// would only add a visible swap for the owners (who already have the cache).
export default function HomePage() {
  return <App />
}
