'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'

export function QRCodeDisplay({ url, label }: { url: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      color: { dark: '#ffffff', light: '#000000' },
      margin: 2,
    })
  }, [url])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${label.replace(/\s+/g, '-').toLowerCase()}-qr.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-lg" />
      <p className="text-xs text-zinc-400 text-center max-w-[200px] break-all font-mono">{url}</p>
      <button
        onClick={download}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
      >
        <Download size={12} />
        Download QR
      </button>
    </div>
  )
}
