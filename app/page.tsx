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

// Row 1: candle, glove, raft, boots, flute, cross, downstab, upstab
// Row 2: hammer, magickey, trophy, mirror, noteforriverman, wateroflife, water, kid
const ITEMS = [
  { id: "candle",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/candle-215T0VkrriKMMF3KNj996UclZvjPrm.png",          alt: "Candle" },
  { id: "glove",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/glove-OEDPJotBIReqdX3PYHnjH8Bi7cte8Q.png",           alt: "Glove" },
  { id: "raft",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/raft-Njv9edZYYpIp9fAlh4IkfQInw0Bu6S.png",            alt: "Raft" },
  { id: "boots",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/boots-3YlIFbtnVXATYwX3G8enKtd9LBtR6u.png",           alt: "Boots" },
  { id: "flute",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/flute-c5UguBIJ4FpbVmBGMY02fLQtRYzI4o.png",           alt: "Flute" },
  { id: "cross",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cross-0xVtnawiBF2w3Rv2lz5jsYtX3rFCbY.png",           alt: "Cross" },
  { id: "downstab",        src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/downstab-LChMwvu5kaovx9zC9dsCk8iFZ3Z2QV.png",        alt: "Downstab" },
  { id: "upstab",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/upstab-R04iJ6nCHpREpaKmLCyAG69wJtG82A.png",          alt: "Upstab" },
  { id: "hammer",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hammer-gMBYciaxpn3ddlwv2yvx3DDCDHjEPv.png",          alt: "Hammer" },
  { id: "magickey",        src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/magickey-EzGnClZo5xEMTEJhzc0wJaRsKuD17X.png",        alt: "Magic Key" },
  { id: "trophy",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/trophy-bLgI9Q0JTDoNJWSM2wK6ohPw6GTFSS.png",          alt: "Trophy" },
  { id: "mirror",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mirror-9ZAZVG4Lh8ZhAXIBs8X6dN3Ec1EI7H.png",          alt: "Mirror" },
  { id: "noteforriverman", src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/noteforriverman-9tVlIuEHCATEIHy9QPM1weChDulMfC.png", alt: "Note for Riverman" },
  { id: "wateroflife",     src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wateroflife-oDZH7bh4kmZ2zwi2S7xsgk4P7HSnGM.png",     alt: "Water of Life" },
  { id: "water",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/water-1g1wpR7bGmXT6hjLiRSkQxgmmWrC8D.png",           alt: "Water" },
  { id: "kid",             src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kid-pAWRqLS8Yg8R6Y8b23EUdV82q052cM.png",             alt: "Child" },
]

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")
  const [defeated, setDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))
  const [collected, setCollected] = useState<Set<string>>(new Set(ITEMS.map(i => i.id)))

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

  function toggleItem(id: string) {
    setCollected((prev) => {
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

        /* Item tracker rows — left black bottom section */
        .item-row-1 {
          position: absolute;
          top: 650px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-2 {
          position: absolute;
          top: 704px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        /* Item tracker rows — right black bottom section */
        .item-row-1-right {
          position: absolute;
          top: 650px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-2-right {
          position: absolute;
          top: 704px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .item-btn img {
          width: 44px;
          height: 44px;
          image-rendering: pixelated;
          display: block;
        }

        .item-btn.active {
          opacity: 1;
          filter: none;
        }

        .item-btn.collected {
          opacity: 0.6;
          filter: grayscale(100%);
        }
      `}</style>

      <div className="overlay-wrapper">
        {/* Background overlay image */}
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/New%20Z2R%20Overlay-WK0dOjNqj0YXzW4v18zmvSNLkqaih1.png"
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

        {/* Item tracker row 1 — left */}
        <div className="item-row-1" role="group" aria-label="Item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${collected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleItem(item.id)}
              aria-label={`${item.alt} — ${collected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — left */}
        <div className="item-row-2" role="group" aria-label="Item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${collected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleItem(item.id)}
              aria-label={`${item.alt} — ${collected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 1 — right */}
        <div className="item-row-1-right" role="group" aria-label="Item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${collected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleItem(item.id)}
              aria-label={`${item.alt} — ${collected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — right */}
        <div className="item-row-2-right" role="group" aria-label="Item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${collected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleItem(item.id)}
              aria-label={`${item.alt} — ${collected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
