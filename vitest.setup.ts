// Registers jest-dom matchers (toBeInTheDocument, etc.) on Vitest's `expect`
// and augments its assertion types. Safe to load in the Node environment too —
// the matchers are only exercised by jsdom component tests.
import '@testing-library/jest-dom/vitest'
