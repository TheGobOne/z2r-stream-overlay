"use client"

import { useState } from "react"

const BOSSES = [
  { id: "horsehead",   src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/horsehead-ihboyP4yCXZnzXoI2AtoZIFBnkDEKN.png",   alt: "Horsehead" },
  { id: "helmethead",  src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/helmethead-KfyfAeeYOhwquQq1uRs3fZUfQHeCe6.png",  alt: "Helmethead" },
  { id: "rebonack",    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/rebonack-zxfzxTTdw7gVkGbediDpNzXQaKiVZb.png",    alt: "Rebonack" },
  { id: "karock",      src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/karock-Ygs9STWmocAZjGJy6uBGyDs9qQif11.png",      alt: "Karock" },
  { id: "gooma",       src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/gooma-rJomB6KNKyZ7GPJuHAGQI6degiEArl.png",       alt: "Gooma" },
  { id: "barba",       src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/barba-pdhNRfOzPJla7oRYees6hb9WT1SI6U.png",       alt: "Barba" },
  { id: "thunderbird", src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/thunderbird-yJKu35CrTvTV46jN5zDqqB9aDJDNaq.png", alt: "Thunderbird" },
]

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")
  const [defeated, setDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))

  function toggleBoss(id: string) {
    setDefeated((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'ZeldaII';
          src: url('/fonts/ZELDA-II-THE-ADVENTURE-OF-LINK.TTF') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #000;
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .overlay-wrapper {
          position: relative;
          width: 1456px;
          height: 816px;
          flex-shrink: 0;
        }

        .overlay-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
          user-select: none;
          display: block;
        }

        /* Left box */
        .text-box-left {
          position: absolute;
          left: 42px;
          top: 516px;
          width: 284px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Right box */
        .text-box-right {
          position: absolute;
          right: 42px;
          top: 516px;
          width: 284px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zelda-input {
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 20px;
          text-align: center;
          padding: 0 6px;
          caret-color: #7ef5ff;
          letter-spacing: 2px;
          box-sizing: border-box;
          text-transform: uppercase;
          line-height: 62px;
          position: relative;
          top: -5px;
        }

        .zelda-input::placeholder {
          color: rgba(126, 245, 255, 0.25);
          font-family: 'ZeldaII', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .zelda-input:focus {
          color: #7ef5ff;
        }

        /* Boss tracker row — left black bottom section */
        .boss-row {
          position: absolute;
          top: 596px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        /* Boss tracker row — right black bottom section */
        .boss-row-right {
          position: absolute;
          top: 596px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .boss-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .boss-btn img {
          width: 44px;
          height: 44px;
          image-rendering: pixelated;
          display: block;
        }

        .boss-btn.active {
          opacity: 1;
          filter: none;
        }

        .boss-btn.defeated {
          opacity: 0.6;
          filter: grayscale(100%);
        }

        /* Black overlay for center bottom section */
        .center-overlay {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 220px;
          height: 220px;
          background: #000000;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>

      <div className="overlay-wrapper">
        {/* Background overlay image */}
        <img
          src="/New Z2R Overlay.png"
          alt="Zelda II Randomizer Stream Overlay"
          className="overlay-bg"
          draggable={false}
        />

        {/* Left editable text box */}
        <div className="text-box-left">
          <input
            type="text"
            className="zelda-input"
            value={leftText}
            onChange={(e) => setLeftText(e.target.value)}
            placeholder="PLAYER 1"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Right editable text box */}
        <div className="text-box-right">
          <input
            type="text"
            className="zelda-input"
            value={rightText}
            onChange={(e) => setRightText(e.target.value)}
            placeholder="PLAYER 2"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Boss tracker — left */}
        <div className="boss-row" role="group" aria-label="Boss tracker">
          {BOSSES.map((boss) => (
            <button
              key={boss.id}
              className={`boss-btn ${defeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleBoss(boss.id)}
              aria-label={`${boss.alt} — ${defeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
            </button>
          ))}
        </div>

        {/* Boss tracker — right */}
        <div className="boss-row-right" role="group" aria-label="Boss tracker">
          {BOSSES.map((boss) => (
            <button
              key={`right-${boss.id}`}
              className={`boss-btn ${defeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleBoss(boss.id)}
              aria-label={`${boss.alt} — ${defeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
            </button>
          ))}
        </div>

        {/* Center bottom overlay to hide brick pattern */}
        <div className="center-overlay" />
      </div>
    </>
  )
}
