// A full document navigation (as opposed to a client-side soft navigation).
// Isolated so it can be stubbed in tests (jsdom makes window.location.assign
// non-configurable).
export function hardNavigate(href: string): void {
  window.location.assign(href)
}
