'use client'

import Lottie from 'lottie-react'
import { useEffect, useRef, useState } from 'react'
import smileData from '@/animations/smile.json'
import grinData from '@/animations/grin.json'

interface SessionMoodProps {
  trigger: number // increment to trigger the grin flash
}

export function SessionMood({ trigger }: SessionMoodProps) {
  const [isGrinning, setIsGrinning] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (trigger === 0) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsGrinning(true)
    timeoutRef.current = setTimeout(() => setIsGrinning(false), 2000)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [trigger])

  return (
    <div className="w-10 h-10 shrink-0">
      <Lottie
        animationData={isGrinning ? grinData : smileData}
        loop
        autoplay
      />
    </div>
  )
}
