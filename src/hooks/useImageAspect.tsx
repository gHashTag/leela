import React, { useEffect, useState } from 'react'
import { Image } from 'react-native'

export const useImageAspect = (uri: string) => {
  const [aspect, setAspect] = useState(1)

  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      setAspect(w / h)
    })
  }, [])

  return aspect
}
