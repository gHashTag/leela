import { observer } from 'mobx-react'
import React, { useMemo } from 'react'
import { Image, StyleSheet, View, useColorScheme } from 'react-native'
import { ms, mvs, s } from 'react-native-size-matters'
import { useTranslation } from 'react-i18next'

import { Text } from '../'
import { H, W } from '../../constants'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../store'
import { Gem } from '../Gem'
import { ICONS } from './images'

const marginTop = H - W > 350 ? 20 : 0

const imageHeight = s(248) + s(32)
const maxImageHeight = ms(248, 0.5) + s(32)

const imageTopMargin = Math.min(ms(27, 0.5), s(27))
const curImageHeight = Math.min(maxImageHeight, imageHeight) + imageTopMargin

const imageWidth = s(279) + s(18)
const maxImageWidth = ms(279, 0.5) + s(18)
const curImageWidth = imageWidth >= maxImageWidth ? maxImageWidth : imageWidth

const getPlaneNumber = (cell: number): number => {
  if (cell <= 8) return 1
  if (cell <= 17) return 2
  if (cell <= 26) return 3
  if (cell <= 35) return 4
  if (cell <= 44) return 5
  if (cell <= 53) return 6
  if (cell <= 62) return 7
  return cell
}

export const GameBoard = observer(() => {
  const scheme = useColorScheme()
  const { t } = useTranslation()

  const imgObj = useMemo(() => {
    const image = ICONS.find((x) => {
      return x.title === scheme
    })?.path
    if (image) {
      const { width, height } = Image.resolveAssetSource(image)
      const aspect = width / height
      return { image, aspect }
    } else {
      return { image: '', aspect: 1 }
    }
  }, [scheme])

  const rows = [
    [72, 71, 70, 69, 68, 67, 66, 65, 64],
    [55, 56, 57, 58, 59, 60, 61, 62, 63],
    [54, 53, 52, 51, 50, 49, 48, 47, 46],
    [37, 38, 39, 40, 41, 42, 43, 44, 45],
    [36, 35, 34, 33, 32, 31, 30, 29, 28],
    [19, 20, 21, 22, 23, 24, 25, 26, 27],
    [18, 17, 16, 15, 14, 13, 12, 11, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  ]

  const currentPlan = DiceStore.online
    ? OnlinePlayer.store.plan
    : OfflinePlayers.store.plans[DiceStore.players - 1]

  const currentPlane = getPlaneNumber(currentPlan)
  const planeNameKey = `accessibility.planeNames.${currentPlane}` as const
  const planeName =
    currentPlane <= 7
      ? (t(planeNameKey, { defaultValue: t('liberation') }) as string)
      : (t('liberation') as string)
  const boardLabel = t('accessibility.gameBoard')
  const currentCellLabel = t('accessibility.currentCell', {
    cell: currentPlan,
    plane: planeName
  })

  const history = DiceStore.online
    ? OnlinePlayer.store.history
    : OfflinePlayers.store.histories[DiceStore.players - 1]
  const lastMove = history && history.length > 0 ? history[0] : null
  const previousPlan = lastMove && lastMove.plan !== currentPlan ? lastMove.plan : null
  const nextPlan =
    currentPlan >= 1 && currentPlan < 68
      ? Math.min(68, currentPlan + (lastMove ? lastMove.count : 1))
      : null

  return (
    <View
      style={[styles.imageContainer, { width: curImageHeight * imgObj.aspect }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${boardLabel}: ${currentCellLabel}`}
      accessibilityLiveRegion="polite"
    >
      <Image source={imgObj.image} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.gameBoardContainer}>
        <View style={styles.container}>
          {rows.map((a, i) => (
            <View style={styles.row} key={i}>
              {a.map((b, index) => {
                const isCurrentCell = b === currentPlan
                const isPreviousCell = previousPlan !== null && b === previousPlan
                const isNextCell = nextPlan !== null && b === nextPlan
                const cellPlane = getPlaneNumber(b)
                const cellPlaneNameKey = `accessibility.planeNames.${cellPlane}` as const
                const cellPlaneName =
                  cellPlane <= 7
                    ? (t(cellPlaneNameKey, { defaultValue: t('liberation') }) as string)
                    : (t('liberation') as string)
                return (
                  <View
                    key={index}
                    style={[
                      styles.box,
                      isCurrentCell && styles.activeBox,
                      isPreviousCell && styles.previousBox,
                      isNextCell && styles.nextBox
                    ]}
                    accessible={isCurrentCell}
                    accessibilityLabel={
                      isCurrentCell
                        ? t('accessibility.currentCell', {
                            cell: b,
                            plane: cellPlaneName
                          })
                        : undefined
                    }
                  >
                    <View style={styles.numberStyle} key={index}>
                      <Gem
                        key={b.toString()}
                        plan={b}
                        player={DiceStore.players}
                        index={index}
                      />
                      <Text
                        key={index}
                        h={'h11'}
                        title={b !== 68 ? b.toString() : ' '}
                      />
                    </View>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: imageTopMargin
  },
  imageContainer: {
    height: curImageHeight,
    alignSelf: 'center',
    alignItems: 'center'
  },
  row: {
    flexDirection: 'row'
  },
  gameBoardContainer: {
    width: curImageWidth,
    height: curImageHeight,
    marginTop
  },
  box: {
    width: s(31),
    height: s(31),
    maxHeight: ms(31, 0.5),
    maxWidth: ms(31, 0.5),
    marginVertical: s(2),
    marginHorizontal: s(1),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(31) / 2
  },
  activeBox: {
    backgroundColor: 'rgba(80, 227, 194, 0.35)',
    borderWidth: 1.5,
    borderColor: '#50E3C2'
  },
  previousBox: {
    backgroundColor: 'rgba(252, 40, 71, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(252, 40, 71, 0.55)'
  },
  nextBox: {
    backgroundColor: 'rgba(255, 183, 77, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 152, 0, 0.55)'
  },
  bgImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: mvs(26, 1.6) - imageTopMargin
  },
  numberStyle: { bottom: 3 }
})

export default GameBoard
