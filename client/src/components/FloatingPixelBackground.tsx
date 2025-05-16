import { useRef, useEffect } from "react"
import styles from "../styles/FloatingPixelBackground.module.css"

interface FloatingPixelBackgroundProps {
  className?: string;
}

export default function FloatingPixelBackground({ className }: FloatingPixelBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const isTouchingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
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

    // Create stars with grayscale colors
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

    let animationFrameId: number
    let frameCount = 0

    function animate() {
      if (!ctx) return

      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      drawBackground()
      drawStarfield()

      frameCount++

      // Add effects
      drawScanlines()
      drawVignette()
      if (frameCount % 45 === 0) {
        // Reduced frequency of noise effect
        drawNoise()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    // Event handlers
    const handleResize = () => {
      updateCanvasSize()
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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className}`}
      aria-label="Interactive retro monochrome particle background effect"
    />
  )
} 