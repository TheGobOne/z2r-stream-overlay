"use client"

import { useEffect, useRef, useState } from "react"

type DisplayMediaOptions = DisplayMediaStreamOptions & {
  selfBrowserSurface?: "include" | "exclude"
  surfaceSwitching?: "include" | "exclude"
}

/**
 * Live preview of what OBS captures. It shows a captured video of the overlay
 * window, so the VOD players only run once (in the overlay itself).
 * `win` is the tools popup: the picker must be asked for from the window that got the click.
 */
export function ProgramMonitor({ win }: { win: Window }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState("Pick the overlay tab or window to see what viewers see.")

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    const onEnded = () => {
      setStream(null)
      setStatus("Preview stopped.")
    }
    track?.addEventListener("ended", onEnded)
    return () => track?.removeEventListener("ended", onEnded)
  }, [stream])

  // Stop capturing when the tools window closes or this unmounts
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream])

  async function pick() {
    const media = win.navigator.mediaDevices
    if (!media?.getDisplayMedia) {
      setStatus("This browser can't capture a window here. Use Chrome.")
      return
    }
    try {
      const options: DisplayMediaOptions = {
        video: { frameRate: 30 },
        audio: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
      }
      const next = await media.getDisplayMedia(options)
      stream?.getTracks().forEach((t) => t.stop())
      setStream(next)
      setStatus(`Showing: ${next.getVideoTracks()[0]?.label || "picked window"}`)
    } catch (err) {
      setStatus(err instanceof Error && err.name === "NotAllowedError" ? "Picker cancelled." : "Couldn't start the preview.")
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setStatus("Preview stopped.")
  }

  return (
    <section className="booth-monitor" aria-label="Program monitor">
      <div className="booth-monitor-screen">
        <video ref={videoRef} autoPlay muted playsInline />
        {!stream && <p className="booth-monitor-empty">No preview</p>}
        {stream && <span className="booth-monitor-live">LIVE</span>}
      </div>
      <div className="booth-monitor-bar">
        <button type="button" className="vod-btn vod-btn-primary" onClick={pick}>
          {stream ? "Change window" : "Pick overlay window"}
        </button>
        {stream && (
          <button type="button" className="vod-btn" onClick={stop}>
            Stop preview
          </button>
        )}
        <p className="tools-hint booth-monitor-status">{status}</p>
      </div>
    </section>
  )
}
