# Ruler – AR Distance Measurement

A React Native app that uses **ARKit (iOS)** and **ARCore (Android)** to measure
the real-world distance from the device camera to any surface the user taps on.

## How it works

1. The app opens directly to a full-screen AR camera view.
2. Point the camera at a surface and let AR tracking initialise (a second or two).
3. Tap anywhere on screen.
4. The AR engine shoots a ray from the camera through the tapped pixel and finds
   where it hits a detected surface.
5. The Euclidean distance between the camera and the hit point is displayed in
   a floating card (shown in cm for < 1 m, m otherwise).
6. A red sphere marker is placed at the hit point so you can see exactly what
   was measured.

## Requirements

| Platform | Minimum OS | Required hardware |
|----------|-----------|-------------------|
| iOS | iOS 13 | Any ARKit-capable device (iPhone 6s / iPad 5th gen or newer) |
| Android | Android 7.0 (API 24) | ARCore-supported device |

## Project structure

```
src/
└── screens/
    └── ARMeasureScreen.tsx   # AR camera + tap-to-measure logic
App.tsx                       # Root component
android/                      # Android (Kotlin + Gradle) project
ios/                          # iOS (Objective-C / Swift) project
```

## Setup

```bash
# Install JS dependencies
npm install

# iOS – install CocoaPods
cd ios && pod install && cd ..

# Run on device (simulator does not support AR)
npx react-native run-ios --device
npx react-native run-android
```

> **Note:** AR features require a physical device. Simulators / emulators will
> show a black screen or crash because they have no camera or AR engine.

## Key dependency

[`@viro-community/react-viro`](https://github.com/ViroCommunity/viro) wraps
ARKit and ARCore behind a unified React Native API.
The hit-test call `arScene.performARHitTestWithPoint(x, y)` is the core of the
distance measurement feature.
