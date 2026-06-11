'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { QRCodeDisplay } from '@/components/admin/QRCodeDisplay'

export function RiseRegisterQR({ slug }: { slug: string }) {
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLink(`${window.location.origin}/rise/${slug}/register`)
  }, [slug])

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!link) return null

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-[#2f5fe0]/10 border border-[#2f5fe0]/30 p-4">
        <QRCodeDisplay url={link} label={`${slug}-register`} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] text-white rounded-md font-semibold transition-colors">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#16224a] hover:bg-[#1d2c5c] text-white rounded-md transition-colors">
          <ExternalLink size={13} /> Open
        </a>
      </div>
    </div>
  )
}
