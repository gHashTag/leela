import React, { memo, useCallback, useEffect, useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { primary } from '../../constants'
import {
  AI_PERSONAS,
  AiPersona,
  loadAiPersona,
  saveAiPersona
} from '../../utils/aiPersona'

export const AiPersonaSelector = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const [selected, setSelected] = useState<AiPersona | null>(null)

  useEffect(() => {
    let mounted = true
    loadAiPersona().then((persona) => {
      if (mounted) setSelected(persona)
    })
    return () => {
      mounted = false
    }
  }, [])

  const select = useCallback(async (persona: AiPersona) => {
    setSelected(persona)
    await saveAiPersona(persona)
  }, [])

  if (!selected) return null

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.row}>
        <Text h="h11" title="✨" />
        <Space width={s(8)} />
        <Text
          h="h11"
          title={t('aiPersona.title')}
          oneColor={primary}
          textStyle={styles.title}
        />
      </View>
      <Space height={vs(8)} />
      <View style={styles.options}>
        {AI_PERSONAS.map((persona) => {
          const isSelected = selected === persona
          return (
            <TouchableOpacity
              key={persona}
              activeOpacity={0.8}
              onPress={() => select(persona)}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                isSelected && isDark && styles.optionSelectedDark
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={t(`aiPersona.${persona}`)}
            >
              <Text
                h="h9"
                title={t(`aiPersona.${persona}`)}
                oneColor={isSelected ? primary : '#FFFFFF'}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(255, 6, 244, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 6, 244, 0.4)'
  },
  containerDark: {
    backgroundColor: 'rgba(255, 6, 244, 0.20)'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    marginHorizontal: s(4),
    borderRadius: s(8),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  optionSelected: {
    borderColor: primary,
    backgroundColor: 'rgba(80, 227, 194, 0.15)'
  },
  optionSelectedDark: {
    backgroundColor: 'rgba(80, 227, 194, 0.25)'
  }
})
