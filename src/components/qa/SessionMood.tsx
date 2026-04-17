'use client'

import Lottie from 'lottie-react'
import { useEffect, useState } from 'react'
import smileData from '@/animations/smile.json'
import grinData from '@/animations/grin.json'

interface SessionMoodProps {
  trigger: number
}

export function SessionMood({ trigger }: SessionMoodProps) {
  const [isGrinning, setIsGrinning] = useState(false)

  useEffect(() => {
    if (trigger === 0) return
    setIsGrinning(true)
  }, [trigger])

  return (
    <div className="w-10 h-10 shrink-0">
      {isGrinning ? (
        <Lottie
          key="grin"
          animationData={grinData}
          loop={false}
          autoplay
          onComplete={() => setIsGrinning(false)}
        />
      ) : (
        <Lottie
          key="smile"
          animationData={smileData}
          loop={false}
          autoplay
        />
      )}
    </div>
  )
}
