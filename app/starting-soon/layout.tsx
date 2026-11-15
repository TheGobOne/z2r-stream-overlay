import type { Metadata } from "next"

// The window title is what OBS lists in Window Capture, so the operator can find it
export const metadata: Metadata = { title: "Z2R starting screen" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
