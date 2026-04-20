'use client'

import Lottie from 'lottie-react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useEffect, useState } from 'react'
import smileData from '@/animations/smile.json'

// Positive
import positiveGrin from '@/animations/positive_grin.json'
import positiveGrinning from '@/animations/positive_grinning.json'
import positiveHearteyes from '@/animations/positive_hearteyes.json'
import positiveHeartface from '@/animations/positive_heartface.json'
import positiveHoldingbacktears from '@/animations/positive_holdingbacktears.json'
import positiveJoy from '@/animations/positive_joy.json'
import positiveLaughing from '@/animations/positive_laughing.json'
import positivePartyingface from '@/animations/positive_partyingface.json'
import positiveReleived from '@/animations/positive_releived.json'
import positiveRofl from '@/animations/positive_rofl.json'
import positiveSquintingtongue from '@/animations/positive_squintingtongue.json'
import positiveStarstruck from '@/animations/positive_starstruck.json'
import positiveStuckouttoung from '@/animations/positive_stuckouttoung.json'
import positiveWink from '@/animations/positive_wink.json'
import positiveSmilinghand from '@/animations/positive_smilinghand.json'
import positiveCowboy from '@/animations/positive_cowboy.json'
import positiveHalo from '@/animations/positive_halo.json'
import positiveHug from '@/animations/positive_hug.json'
import positiveMindblown from '@/animations/positive_mindblown.json'
import positiveNerd from '@/animations/positive_nerd.json'
import positiveSalute from '@/animations/positive_salute.json'
import positiveSunglasses from '@/animations/positive_sunglasses.json'

// Negative
import negativeGrimacing from '@/animations/negative_grimacing.json'
import negativeHappycry from '@/animations/negative_happycry.json'
import negativeHeadshake from '@/animations/negative_headshake.json'
import negativeLoudlycrying from '@/animations/negative_loudlycrying.json'
import negativeMelting from '@/animations/negative_melting.json'
import negativePleading from '@/animations/negative_pleading.json'
import negativeUpsidedownface from '@/animations/negative_upsidedownface.json'
import negativeWoozy from '@/animations/negative_woozy.json'
import negativeXeyes from '@/animations/negative_xeyes.json'
import negativeAnguished from '@/animations/negative_anguished.json'
import negativeAnxious from '@/animations/negative_anxious.json'
import negativeConcerned from '@/animations/negative_concerned.json'
import negativeCry from '@/animations/negative_cry.json'
import negativeDistraught from '@/animations/negative_distraught.json'
import negativeDizzy from '@/animations/negative_dizzy.json'
import negativePeaking from '@/animations/negative_peaking.json'
import negativeRaisedEyebrow from '@/animations/negative_raised_eyebrow.json'
import negativeRollingEyes from '@/animations/negative_rolling_eyes.json'
import negativeSad from '@/animations/negative_sad.json'
import negativeScared from '@/animations/negative_scared.json'
import negativeScreaming from '@/animations/negative_screaming.json'
import negativeShushing from '@/animations/negative_shushing.json'
import negativeScrunchedMouth from '@/animations/negative_scrunched_mouth.json'
import negativeThinking from '@/animations/negative_thinking.json'
import negativeUnamused from '@/animations/negative_unamused.json'
import negativeWeary from '@/animations/negative_weary.json'
import negativeExpression from '@/animations/negative_expressionless.json'
import negativeClouds from '@/animations/negative_clouds.json'

const POSITIVE = [
  positiveGrin, positiveGrinning, positiveHearteyes, positiveHeartface,
  positiveHoldingbacktears, positiveJoy, positiveLaughing, positivePartyingface,
  positiveReleived, positiveRofl, positiveSquintingtongue, positiveStarstruck,
  positiveStuckouttoung, positiveWink, positiveSmilinghand, positiveCowboy,
  positiveHalo, positiveHug, positiveMindblown, positiveNerd, positiveSalute,
  positiveSunglasses,
]

const NEGATIVE = [
  negativeGrimacing, negativeHappycry, negativeHeadshake, negativeLoudlycrying,
  negativeMelting, negativePleading, negativeUpsidedownface, negativeWoozy,
  negativeXeyes, negativeAnguished, negativeAnxious, negativeConcerned,
  negativeCry, negativeDistraught, negativeDizzy, negativePeaking,
  negativeRaisedEyebrow, negativeRollingEyes, negativeSad, negativeScared,
  negativeScreaming, negativeShushing, negativeScrunchedMouth, negativeThinking,
  negativeUnamused, negativeWeary, negativeExpression, negativeClouds,
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface SessionMoodProps {
  passTrigger: number
  failTrigger: number
  isComplete: boolean
}

export function SessionMood({ passTrigger, failTrigger, isComplete }: SessionMoodProps) {
  const [activeAnim, setActiveAnim] = useState<{ data: unknown; key: string } | null>(null)

  useEffect(() => {
    if (isComplete || passTrigger === 0) return
    setActiveAnim({ data: pickRandom(POSITIVE), key: `pass-${passTrigger}` })
  }, [passTrigger, isComplete])

  useEffect(() => {
    if (isComplete || failTrigger === 0) return
    setActiveAnim({ data: pickRandom(NEGATIVE), key: `fail-${failTrigger}` })
  }, [failTrigger, isComplete])

  if (isComplete) {
    return (
      <div className="w-10 h-10 shrink-0">
        <DotLottieReact src="/animations/thankyou.lottie" loop autoplay />
      </div>
    )
  }

  return (
    <div className="w-10 h-10 shrink-0">
      {activeAnim ? (
        <Lottie
          key={activeAnim.key}
          animationData={activeAnim.data}
          loop={false}
          autoplay
          onComplete={() => setActiveAnim(null)}
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
