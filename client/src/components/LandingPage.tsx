"use client"

import { useRef, useEffect, useState } from "react"
import { APTOS_PIXEL_TEXT } from "../blockchain/aptos-pixel-text"
import styles from "../styles/LandingPage.module.css"

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const isTouchingRef = useRef(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    // update time every minute
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`)
    }

    updateTime()
    const timeInterval = setInterval(updateTime, 60000)
    return () => clearInterval(timeInterval)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      setIsMobile(window.innerWidth < 768)
    }

    updateCanvasSize()

    // Create starfield particles (background)
    const starfieldParticles: {
      x: number
      y: number
      z: number
      size: number
      color: string
      speed: number
    }[] = []

    // Create 150 stars with grayscale colors (reduced from 200 for less distraction)
    for (let i = 0; i < 250; i++) {
      const brightness = Math.floor(Math.random() * 200) + 55
      starfieldParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000,
        size: Math.random() * 2 + 0.5, // Smaller stars
        color: `rgba(${brightness},${brightness},${brightness},0.8)`, // Added transparency
        speed: Math.random() * 1.5 + 0.3, // Slightly slower movement
      })
    }

    // Text particles
    let particles: {
      x: number
      y: number
      baseX: number
      baseY: number
      size: number
      color: string
      scatteredColor: string
      life: number
      wavePhase: number
      waveAmplitude: number
      glitchOffset: number
      isCore: boolean // Flag for core pixels that should be more stable
    }[] = []

    let textImageData: ImageData | null = null

    function createTextImage() {
      if (!ctx) return 0

      const canvasWidth = canvas!.width || 0
      const canvasHeight = canvas!.height || 0

      ctx.fillStyle = "#FFFFFF"
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Define pixel size - increased for better visibility
      const pixelSize = isMobile ? 8 : 14
      const pixelGap = isMobile ? 2 : 3
      const totalPixelSize = pixelSize + pixelGap

      // Calculate text dimensions
      const text = "APTOSPIXEL"
      let totalWidth = 0
      const letterSpacing = isMobile ? 3 : 5 // Increased spacing between letters

      // Calculate total width
      for (let i = 0; i < text.length; i++) {
        const letter = text[i]
        const letterData = APTOS_PIXEL_TEXT[letter as keyof typeof APTOS_PIXEL_TEXT]
        if (letterData) {
          totalWidth += letterData[0].length * totalPixelSize
        }
      }

      // Add spacing between letters
      totalWidth += (text.length - 1) * (totalPixelSize + letterSpacing)

      // Calculate starting position to center the text
      const startX = (canvasWidth - totalWidth) / 2
      const startY = (canvasHeight - 5 * totalPixelSize) / 2
      let currentX = startX

      // Draw each letter
      for (let i = 0; i < text.length; i++) {
        const letter = text[i]
        const letterData = APTOS_PIXEL_TEXT[letter as keyof typeof APTOS_PIXEL_TEXT]

        if (letterData) {
          for (let y = 0; y < letterData.length; y++) {
            for (let x = 0; x < letterData[y].length; x++) {
              if (letterData[y][x] === 1) {
                // Draw larger shadow for better contrast
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
                ctx.fillRect(
                  currentX + x * totalPixelSize - 4,
                  startY + y * totalPixelSize - 4,
                  pixelSize + 8,
                  pixelSize + 8,
                )

                // Draw stronger glow
                ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
                ctx.fillRect(
                  currentX + x * totalPixelSize - 3,
                  startY + y * totalPixelSize - 3,
                  pixelSize + 6,
                  pixelSize + 6,
                )

                // Draw thicker outline for better readability
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
                ctx.fillRect(
                  currentX + x * totalPixelSize - 2,
                  startY + y * totalPixelSize - 2,
                  pixelSize + 4,
                  pixelSize + 4,
                )

                // Draw pixel
                ctx.fillStyle = "#FFFFFF"
                ctx.fillRect(currentX + x * totalPixelSize, startY + y * totalPixelSize, pixelSize, pixelSize)
              }
            }
          }

          // Move to next letter
          currentX += letterData[0].length * totalPixelSize + (totalPixelSize + letterSpacing)
        }
      }

      textImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      return pixelSize
    }

    function createParticle(scale: number) {
      if (!textImageData) return null

      const data = textImageData.data
      const canvasWidth = canvas!.width || 1
      const canvasHeight = canvas!.height || 1
      const particleSize = Math.random() * 3.5 + 3.8 // Slightly larger particles

      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * canvasWidth)
        const y = Math.floor(Math.random() * canvasHeight)

        if (data[(y * canvasWidth + x) * 4 + 3] > 128) {
          // Determine if this is a core pixel (more stable)
          // Core pixels are more likely to be in the center of each letter
          const isCore = Math.random() < 0.6

          const brightness = Math.floor(Math.random() * 100) + 155
          return {
            x,
            y,
            baseX: x,
            baseY: y,
            size: particleSize,
            color: isCore ? "#FFFFFF" : `rgba(255, 255, 255, 0.9)`,
            scatteredColor: `rgb(${brightness},${brightness},${brightness})`,
            life: Math.random() * 100 + 50,
            wavePhase: Math.random() * Math.PI * 2,
            waveAmplitude: isCore ? 0.2 : 0.4, // Core pixels have less movement
            glitchOffset: isCore ? 0 : Math.random() * 0.8 - 0.4, // Core pixels don't glitch
            isCore,
          }
        }
      }

      return null
    }

    function createInitialParticles(scale: number) {
      const baseParticleCount = 4000
      const canvasWidth = canvas!.width || 1
      const canvasHeight = canvas!.height || 1
      const particleCount = Math.floor(baseParticleCount * Math.sqrt((canvasWidth * canvasHeight) / (1920 * 1080)))

      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(scale)
        if (particle) particles.push(particle)
      }
    }

    // Effects
    function drawScanlines() {
      if (!ctx) return
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)" // Reduced opacity for less distraction
      for (let i = 0; i < canvas!.height; i += 3) {
        // Increased spacing between scanlines
        ctx.fillRect(0, i, canvas!.width, 1)
      }
    }

    function drawVignette() {
      if (!ctx) return
      const gradient = ctx.createRadialGradient(
        canvas!.width / 2,
        canvas!.height / 2,
        0,
        canvas!.width / 2,
        canvas!.height / 2,
        canvas!.width / 1.5,
      )
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)")
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.7)") // Slightly reduced opacity
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)
    }

    function drawNoise() {
      if (!ctx) return
      const imageData = ctx.getImageData(0, 0, canvas!.width, canvas!.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        if (Math.random() < 0.01) {
          // Reduced noise frequency
          const noise = Math.random() * 15 - 7.5 // Reduced noise intensity
          data[i] = Math.max(0, Math.min(255, data[i] + noise))
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
        }
      }
      ctx.putImageData(imageData, 0, 0)
    }

    function drawBackground() {
      if (!ctx) return
      // Create a subtle gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas!.height)
      gradient.addColorStop(0, "#000000")
      gradient.addColorStop(0.5, "#050505")
      gradient.addColorStop(1, "#000000")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)
    }

    function drawStarfield() {
      if (!ctx) return
      for (const p of starfieldParticles) {
        // Update z position
        p.z -= p.speed

        // Reset if star has passed viewer
        if (p.z <= 0) {
          p.z = 1000
          p.x = Math.random() * (canvas!.width || 0)
          p.y = Math.random() * (canvas!.height || 0)
        }

        // Calculate screen position based on 3D coordinates
        const canvasWidth = canvas!.width || 0
        const canvasHeight = canvas!.height || 0
        const screenX = (p.x - canvasWidth / 2) * (1000 / p.z) + canvasWidth / 2
        const screenY = (p.y - canvasHeight / 2) * (1000 / p.z) + canvasHeight / 2
        const size = p.size * (1000 / p.z)

        // Draw star
        ctx.fillStyle = p.color
        ctx.fillRect(screenX, screenY, size, size)
      }
    }

    let animationFrameId: number
    let frameCount = 0
    let globalWaveTime = 0

    function animate(scale: number) {
      if (!ctx) return

      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      drawBackground()
      drawStarfield()

      const { x: mouseX, y: mouseY } = mousePositionRef.current
      const maxDistance = 240
      frameCount++
      globalWaveTime += 0.015 // Slowed down the global wave time

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < maxDistance && (isTouchingRef.current || !("ontouchstart" in window))) {
          // Increase wave amplitude when interacting
          p.waveAmplitude = Math.min(p.waveAmplitude + 0.2, p.isCore ? 6 : 8)

          // Scatter behavior - core pixels move less
          const force = (maxDistance - distance) / maxDistance
          const angle = Math.atan2(dy, dx)
          const moveX = Math.cos(angle) * force * (p.isCore ? 30 : 60)
          const moveY = Math.sin(angle) * force * (p.isCore ? 30 : 60)
          p.x = p.baseX - moveX
          p.y = p.baseY - moveY

          // Add a subtle glow effect on interaction
          ctx.fillStyle = p.isCore ? "#FFFFFF" : p.scatteredColor

          // Draw a subtle glow around interactive particles
          if (!p.isCore) {
            ctx.globalAlpha = 0.3
            ctx.fillRect(p.x - 1, p.y - 1, p.size + 2, p.size + 2)
            ctx.globalAlpha = 1
          }
        } else {
          // Return to normal state with minimal animation for clarity
          p.waveAmplitude = Math.max(p.waveAmplitude - 0.1, p.isCore ? 0.1 : 0.3)

          // Add very subtle glitchy effect - core pixels are more stable
          if (frameCount % 30 === 0 && !p.isCore) {
            p.glitchOffset = Math.random() * 0.8 - 0.4
          }

          // Smooth return to base position - core pixels return faster
          p.x += (p.baseX - p.x) * (p.isCore ? 0.2 : 0.1) + (p.isCore ? 0 : p.glitchOffset)
          p.y += (p.baseY - p.y) * (p.isCore ? 0.2 : 0.1)

          ctx.fillStyle = p.color
        }

        // Apply wave effect - reduced for better readability
        if (p.waveAmplitude > 0) {
          // Core pixels have more controlled wave movement
          const waveOffset =
            Math.sin(p.baseX * 0.01 + globalWaveTime + p.wavePhase) *
            (p.isCore ? p.waveAmplitude * 0.5 : p.waveAmplitude)
          p.y += waveOffset
        }

        // Draw particle
        ctx.fillRect(p.x, p.y, p.size, p.size)

        // Particle lifecycle
        p.life--
        if (p.life <= 0) {
          const newParticle = createParticle(scale)
          if (newParticle) {
            particles[i] = newParticle
          } else {
            particles.splice(i, 1)
            i--
          }
        }
      }

      // Add effects
      drawScanlines()
      drawVignette()
      if (frameCount % 45 === 0) {
        // Reduced frequency of noise effect
        drawNoise()
      }

      // Maintain particle count
      const baseParticleCount = 3500
      const canvasWidth = canvas!.width || 1
      const canvasHeight = canvas!.height || 1
      const targetParticleCount = Math.floor(
        baseParticleCount * Math.sqrt((canvasWidth * canvasHeight) / (1920 * 1080)),
      )
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle(scale)
        if (newParticle) particles.push(newParticle)
      }

      animationFrameId = requestAnimationFrame(() => animate(scale))
    }

    const scale = createTextImage()
    createInitialParticles(scale)
    animate(scale)

    // Event handlers
    const handleResize = () => {
      updateCanvasSize()
      const newScale = createTextImage()
      particles = []
      createInitialParticles(newScale)
    }

    const handleMove = (x: number, y: number) => {
      mousePositionRef.current = { x, y }
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault()
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleTouchStart = () => {
      isTouchingRef.current = true
    }

    const handleTouchEnd = () => {
      isTouchingRef.current = false
      mousePositionRef.current = { x: 0, y: 0 }
    }

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 }
      }
    }

    // Add event listeners
    window.addEventListener("resize", handleResize)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("mouseleave", handleMouseLeave)
    canvas.addEventListener("touchstart", handleTouchStart)
    canvas.addEventListener("touchend", handleTouchEnd)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("mouseleave", handleMouseLeave)
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchend", handleTouchEnd)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isMobile, showStartMenu])

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Interactive retro monochrome particle effect with AptosPixel text"
      />

      {/* Retro Enter Button */}
      <div className={styles.enterButtonContainer}>
        <button className={styles.enterButton} onClick={onEnter} aria-label="Enter">
          <span className={styles.enterButtonGlow}></span>
          <span className={styles.enterButtonText}>
            <span className={styles.enterPrefix}>&gt;</span> ENTER
          </span>
          <span className={styles.enterButtonScanline}></span>
        </button>
      </div>

      {/* Retro DOS/Windows 3.1 style taskbar */}
      <div className={styles.taskbar}>
        <div className={styles.commandPrompt}>C:\APTOS&gt;_</div>

        <button onClick={() => setShowStartMenu(!showStartMenu)} className={styles.menuButton}>
          <span className={styles.menuButtonPrefix}>C:</span> MENU
        </button>

        <div className={styles.divider}></div>

        <div className={styles.taskbarSpacer}></div>

        <div className={styles.activeProgram}>
          <span className={styles.programPrefix}>$</span> APTOSPIXEL.EXE
        </div>

        <div className={styles.divider}></div>

        <div className={styles.clock}>{currentTime}</div>
      </div>

      {/* Retro DOS/Windows 3.1 style menu */}
      {showStartMenu && (
        <div className={styles.startMenu}>
          <div className={styles.startMenuHeader}>
            <span className={styles.startMenuTitle}>SYSTEM MENU</span>
            <span className={styles.startMenuVersion}>v1.0</span>
          </div>

          <div className={styles.startMenuContent}>
            <div className={styles.menuItem}>
              <span className={styles.menuItemPrefix}>&gt;</span> FILES.SYS
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuItemPrefix}>&gt;</span> CONFIG.SYS
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuItemPrefix}>&gt;</span> GAMES.EXE
            </div>
            <div className={styles.menuDivider}></div>
            <div className={styles.menuItem}>
              <span className={styles.menuItemPrefix}>&gt;</span> SETUP.BAT
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuItemPrefix}>&gt;</span> EXIT.COM
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 