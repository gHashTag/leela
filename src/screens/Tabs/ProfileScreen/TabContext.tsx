import React from 'react'

import { observer } from 'mobx-react'

import { useScrollGesture } from './useScrollGesture'
export const TabContext = React.createContext({})

export const TabContextProvider = observer(({ children }: TabContextProviderT) => {
  const values = useScrollGesture()
  return (
    <TabContext.Provider value={values}>
      {children?.(values) || children}
    </TabContext.Provider>
  )
})

interface TabContextProviderT {
  children: any
}
