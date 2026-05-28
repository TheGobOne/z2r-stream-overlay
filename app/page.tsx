"use client"

import { useState } from "react"

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")

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

        /* Left box — matches the blue-outlined rect lower-left */
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

        /* Right box — matches the blue-outlined rect lower-right */
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
          top: -20px;
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
      </div>
    </>
  )
}
