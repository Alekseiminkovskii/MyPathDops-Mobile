import { Image } from 'expo-image'
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const { width: SW, height: SH } = Dimensions.get('window')

interface Props {
  uri: string
  onClose: () => void
}

export function ImageZoomModal({ uri, onClose }: Props) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * e.scale))
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (scale.value <= 1) return
      tx.value = savedTx.value + e.translationX
      ty.value = savedTy.value + e.translationY
    })
    .onEnd(() => {
      savedTx.value = tx.value
      savedTy.value = ty.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1)
        savedScale.value = 1
        tx.value = withTiming(0)
        ty.value = withTiming(0)
        savedTx.value = 0
        savedTy.value = 0
      } else {
        scale.value = withTiming(2.5)
        savedScale.value = 2.5
      }
    })

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap)

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }))

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={s.root}>
        <View style={s.backdrop}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[s.imgWrap, animStyle]}>
              <Image source={{ uri }} style={s.img} contentFit="contain" />
            </Animated.View>
          </GestureDetector>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>×</Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            {'Pinch to zoom · double-tap to zoom/reset · drag to pan'}
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgWrap: {
    width: SW,
    height: SH * 0.78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: SW, height: SH * 0.78 },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { color: '#fff', fontSize: 22, lineHeight: 26 },
  hint: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
})
