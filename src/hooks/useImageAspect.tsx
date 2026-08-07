import { useEffect, useMemo, useState } from 'react'

import { Image } from 'react-native'

export const useImageAspect = (image: string | any, isAsset?: boolean) => {
  const [aspect, setAspect] = useState(1)

  const imgObj = useMemo(() => {
    if (image && isAsset) {
      const resolved = Image.resolveAssetSource(image)
      if (resolved?.width && resolved?.height) {
        return resolved.width / resolved.height
      }
    }
    return 1
  }, [image, isAsset])

  useEffect(() => {
    if (!isAsset && typeof image === 'string') {
      Image.getSize(
        image,
        (w, h) => setAspect(w / h),
        () => setAspect(1)
      )
    }
  }, [image, isAsset])

  return isAsset ? imgObj : aspect
}
