import { useEffect, useState } from 'react'

const TOUCH_QUERY = '(pointer: coarse), (hover: none)'

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(
    () =>
      typeof window !== 'undefined' && window.matchMedia(TOUCH_QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(TOUCH_QUERY)
    const onChange = () => setIsTouch(mql.matches)
    mql.addEventListener('change', onChange)
    setIsTouch(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isTouch
}
