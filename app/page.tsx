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
// Row 3: shield, jump, life, fairy, fire, reflect, spell, thunder
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
  { id: "shield",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shield-1ykMtmxCvcfpYBBoImNlAvClkwCXCh.png",          alt: "Shield" },
  { id: "jump",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/jump-CRoANAOlg9BaNCaluUdq0iTIB6Ejlg.png",            alt: "Jump" },
  { id: "life",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/life-bEtDgJjFmftdUXyk4VjzCDC5xetcc4.png",            alt: "Life" },
  { id: "fairy",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fairy-0mhukM512CWJOuemkBP9l10zrO6pO6.png",           alt: "Fairy" },
  { id: "fire",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fire-SbCeoCfgjlAPAYeIRdrFYL6Eq6jrIM.png",            alt: "Fire" },
  { id: "reflect",         src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/reflect-ViHrAXATIYAIR8nvHk29TU63Wn8YJc.png",         alt: "Reflect" },
  { id: "spell",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/spell-JRQjkytihtvztUGdbkioWpXhuyHlm9.png",           alt: "Spell" },
  { id: "thunder",         src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/thunder-acYwJLumZAKTqphP3AUuYki6M3oiKt.png",         alt: "Thunder" },
]

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")
  const [leftFontSize, setLeftFontSize] = useState(20)
  const [rightFontSize, setRightFontSize] = useState(20)
  const [gemCount, setGemCount] = useState<number | null>(null)
  const [gemPopupOpen, setGemPopupOpen] = useState(false)

  const [leftDefeated, setLeftDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))
  const [rightDefeated, setRightDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))
  const [leftCollected, setLeftCollected] = useState<Set<string>>(new Set(ITEMS.map(i => i.id)))
  const [rightCollected, setRightCollected] = useState<Set<string>>(new Set(ITEMS.map(i => i.id)))

  function calculateFontSize(text: string): number {
    if (text.length === 0) return 20
    if (text.length <= 6) return 20
    if (text.length <= 10) return 18
    if (text.length <= 14) return 14
    return 10
  }

  function handleLeftTextChange(value: string) {
    setLeftText(value)
    setLeftFontSize(calculateFontSize(value))
  }

  function handleRightTextChange(value: string) {
    setRightText(value)
    setRightFontSize(calculateFontSize(value))
  }

  function handleGemMouseDown(e: React.MouseEvent) {
    setIsDraggingGem(true)
    setDragOffsetX(e.clientX - gemX)
    setDragOffsetY(e.clientY - gemY)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingGem) return
    setGemX(e.clientX - dragOffsetX)
    setGemY(e.clientY - dragOffsetY)
  }

  function handleMouseUp() {
    setIsDraggingGem(false)
  }

  function toggleLeftBoss(id: string) {
    setLeftDefeated((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRightBoss(id: string) {
    setRightDefeated((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleLeftItem(id: string) {
    setLeftCollected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRightItem(id: string) {
    setRightCollected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
          background: transparent;
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
          background: transparent;
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
          mix-blend-mode: screen;
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
          font-size: var(--zelda-font-size, 20px);
          text-align: center;
          padding: 0 6px;
          caret-color: #7ef5ff;
          letter-spacing: 2px;
          box-sizing: border-box;
          text-transform: uppercase;
          line-height: 62px;
          position: relative;
          top: -5px;
          transition: font-size 0.1s ease;
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
          top: 595px;
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
          top: 595px;
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
          top: 645px;
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
          top: 695px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-3 {
          position: absolute;
          top: 745px;
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
          top: 645px;
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
          top: 695px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-3-right {
          position: absolute;
          top: 745px;
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

        .gem-image {
          position: absolute;
          top: 195px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          user-select: none;
          display: block;
          image-rendering: pixelated;
          width: auto;
          height: auto;
          filter: drop-shadow(-4px 0 0 #000) drop-shadow(4px 0 0 #000) drop-shadow(0 -4px 0 #000) drop-shadow(0 4px 0 #000);
          cursor: pointer;
          z-index: 5;
        }

        .gem-count {
          position: absolute;
          top: 445px;
          left: 50%;
          transform: translateX(-50%);
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 28px;
          letter-spacing: 4px;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(-4px 0 0 #000) drop-shadow(4px 0 0 #000) drop-shadow(0 -4px 0 #000) drop-shadow(0 4px 0 #000);
          z-index: 5;
        }

        .gem-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .gem-modal-box {
          background: #0a0a0a;
          border: 3px solid #2ec4b6;
          padding: 32px 40px;
          text-align: center;
          font-family: 'ZeldaII', monospace;
          color: #ffffff;
          min-width: 320px;
        }

        .gem-modal-title {
          font-size: 16px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #7ef5ff;
          margin-bottom: 28px;
        }

        .gem-modal-options {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .gem-modal-opt {
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 18px;
          width: 48px;
          height: 48px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .gem-modal-opt:hover,
        .gem-modal-opt.selected {
          background: #2ec4b6;
          color: #000000;
        }

        /* Transparent overlays for top black boxes */
        .transparent-overlay-left {
          position: absolute;
          top: 0;
          left: 0;
          width: 408px;
          height: 516px;
          background: rgba(0, 0, 0, 0);
          pointer-events: none;
          z-index: 10;
        }

        .transparent-overlay-right {
          position: absolute;
          top: 0;
          right: 0;
          width: 408px;
          height: 516px;
          background: rgba(0, 0, 0, 0);
          pointer-events: none;
          z-index: 10;
        }
      `}</style>

      <div className="overlay-wrapper">
        {/* Background overlay image */}
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/New%20Z2R%20Overlay-sLdN1Aj0x737pKVaQsZhaZE040esK9.png"
          alt="Zelda II Randomizer Stream Overlay"
          className="overlay-bg"
          draggable={false}
        />

        {/* Transparent overlay for top-left black box */}
        <div className="transparent-overlay-left" />

        {/* Transparent overlay for top-right black box */}
        <div className="transparent-overlay-right" />

        {/* Gem — click to set count */}
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/s_gem_overlay_0-hDegjlqJriaY5Z5xY4Cb924PFsBnS7.png"
          alt="Gem"
          className="gem-image"
          draggable={false}
          onClick={() => setGemPopupOpen(true)}
        />

        {/* Gem count display */}
        {gemCount !== null && (
          <span className="gem-count">{gemCount}</span>
        )}

        {/* Gem count popup */}
        {gemPopupOpen && (
          <div className="gem-modal-backdrop" onClick={() => setGemPopupOpen(false)}>
            <div className="gem-modal-box" onClick={(e) => e.stopPropagation()}>
              <p className="gem-modal-title">How many gems?</p>
              <div className="gem-modal-options">
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={`gem-modal-opt${gemCount === n ? " selected" : ""}`}
                    onClick={() => { setGemCount(n); setGemPopupOpen(false) }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Left editable text box */}
        <div className="text-box-left">
          <input
            type="text"
            className="zelda-input"
            value={leftText}
            onChange={(e) => handleLeftTextChange(e.target.value)}
            placeholder="PLAYER 1"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${leftFontSize}px` } as React.CSSProperties}
          />
        </div>

        {/* Right editable text box */}
        <div className="text-box-right">
          <input
            type="text"
            className="zelda-input"
            value={rightText}
            onChange={(e) => handleRightTextChange(e.target.value)}
            placeholder="PLAYER 2"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${rightFontSize}px` } as React.CSSProperties}
          />
        </div>

        {/* Boss tracker — left */}
        <div className="boss-row" role="group" aria-label="Player 1 boss tracker">
          {BOSSES.map((boss) => (
            <button
              key={boss.id}
              className={`boss-btn ${leftDefeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleLeftBoss(boss.id)}
              aria-label={`${boss.alt} — ${leftDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
            </button>
          ))}
        </div>

        {/* Boss tracker — right */}
        <div className="boss-row-right" role="group" aria-label="Player 2 boss tracker">
          {BOSSES.map((boss) => (
            <button
              key={`right-${boss.id}`}
              className={`boss-btn ${rightDefeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleRightBoss(boss.id)}
              aria-label={`${boss.alt} — ${rightDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 1 ��� left */}
        <div className="item-row-1" role="group" aria-label="Player 1 item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — left */}
        <div className="item-row-2" role="group" aria-label="Player 1 item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 1 — right */}
        <div className="item-row-1-right" role="group" aria-label="Player 2 item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — right */}
        <div className="item-row-2-right" role="group" aria-label="Player 2 item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 3 — left */}
        <div className="item-row-3" role="group" aria-label="Player 1 item tracker row 3">
          {ITEMS.slice(16, 24).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
            </button>
          ))}
        </div>

        {/* Item tracker row 3 — right */}
        <div className="item-row-3-right" role="group" aria-label="Player 2 item tracker row 3">
          {ITEMS.slice(16, 24).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
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
