import { nanoid } from "nanoid/non-secure"
import React, { useRef } from "react"
import { Animated, FlatList, ImageBackground, Pressable, StyleSheet, View } from "react-native"
import { s, vs } from "react-native-size-matters"
import { W, white } from "../../constants"

interface renderItemsI {
    item: string
    index: number
}

function RenderSwiperItems({ item, index }: renderItemsI) {
    return <ImageBackground source={{ uri: item }} style={imageBg}>
        {/* ... */}
    </ImageBackground>
}

interface renderDotsI {
    index: number
}

interface SwiperI {
    images: string[]
    height: number
}

const dotWidth = vs(10)
const dotMargin = vs(5)
const fullDotWidth = dotWidth + (dotMargin * 2)

export function ImageSwiper({ images, height }: SwiperI) {
    const swiperRef = useRef<any>()
    const AnimDot = Animated.createAnimatedComponent(Pressable)
    const scrollX = useRef(new Animated.Value(0)).current

    const dotsCountInView = Math.floor(W / fullDotWidth)

    function RenderDots({ index }: renderDotsI) {
        const inputRange = [W * (index - 1), W * index, W * (index + 1)]
        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [1, 1.3, 1],
            extrapolate: 'clamp'
        })
        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [.6, 1, .6],
            extrapolate: 'clamp'
        })
        return <AnimDot onPressIn={() => swiperRef.current
            .scrollToIndex({ index: index, animated: true })}
            key={index.toString()} style={[dot, {
                transform: [{
                    scale
                }], opacity
            }]} />
    }

    return <View style={[container, { height }]}>
        <Animated.FlatList
            removeClippedSubviews
            disableIntervalMomentum
            data={images}
            initialNumToRender={images.length}
            keyExtractor={() => nanoid(8)}
            renderItem={RenderSwiperItems}
            decelerationRate={.8}
            ref={swiperRef}
            showsHorizontalScrollIndicator={false}
            horizontal
            snapToInterval={W}

            style={swiperContainer}
            onScroll={Animated.event(
                [{
                    nativeEvent: {
                        contentOffset: {
                            x: scrollX,
                        },
                    },
                }],
                { useNativeDriver: true },
            )}
        />
        {images.length > 0 &&
            <Animated.View style={[dotContainer, {
                translateX: scrollX.interpolate({
                    inputRange: [W * (dotsCountInView / 2), W * images.length + (W * (dotsCountInView / 2))],
                    outputRange: [0, (W * -1 * images.length / dotsCountInView)],
                    extrapolate: 'clamp'
                })
            }
            ]}>
                {images.map((a, id) => <RenderDots key={id.toString()} index={id} />)}
            </Animated.View>}
    </View>

}

const styles = StyleSheet.create({
    container: {
        width: W,
        height: vs(300)
    },
    swiperContainer: {
        width: W,
        height: vs(300)
    },
    imageBg: {
        width: W,
        height: '100%'
    },
    dot: {
        borderRadius: vs(50),
        width: dotWidth,
        height: dotWidth,
        backgroundColor: white,
        marginHorizontal: dotMargin
    },
    dotContainer: {
        position: 'absolute',
        flexDirection: 'row',
        zIndex: 1,
        bottom: vs(10)
    }
})

const { swiperContainer, imageBg, dotContainer, dot, container } = styles