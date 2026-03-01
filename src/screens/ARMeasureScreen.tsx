/**
 * ARMeasureScreen
 *
 * Displays an AR camera view. When the user taps on any surface the app
 * performs an AR hit-test (ARKit on iOS / ARCore on Android), calculates the
 * distance from the device camera to the hit point, and shows the result in
 * a floating overlay.
 *
 * Distance measurement works by:
 * 1. Shooting a ray from the camera through the tapped screen coordinate.
 * 2. Finding where that ray intersects with a detected real-world surface.
 * 3. Computing the Euclidean distance between the camera position and the
 *    intersection point, both expressed in world space.
 */

import React, {useCallback, useRef, useState} from 'react';
import {
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroNode,
  ViroSphere,
} from '@viro-community/react-viro';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CameraTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  forward: [number, number, number];
  up: [number, number, number];
}

interface ARHitTestResult {
  type: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

interface ARSceneProps {
  onDistanceUpdate: (distance: number | null) => void;
  tapCoords: {x: number; y: number; id: number} | null;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

ViroMaterials.createMaterials({
  markerMaterial: {
    diffuseColor: '#FF3B30',
    lightingModel: 'Constant',
  },
  markerRingMaterial: {
    diffuseColor: '#FFFFFF',
    lightingModel: 'Constant',
  },
});

// ---------------------------------------------------------------------------
// AR Scene (rendered inside ViroARSceneNavigator)
// ---------------------------------------------------------------------------

const ARScene = ({onDistanceUpdate, tapCoords}: ARSceneProps) => {
  const arSceneRef = useRef<any>(null);
  const cameraPositionRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastTapIdRef = useRef<number>(-1);
  const [markerPosition, setMarkerPosition] =
    useState<[number, number, number] | null>(null);

  // Track camera world position every frame so we can compute distances.
  const onCameraTransformUpdate = useCallback(
    (transform: CameraTransform) => {
      cameraPositionRef.current = transform.position;
    },
    [],
  );

  // Perform hit-test whenever tapCoords changes (new tap from the outer View).
  React.useEffect(() => {
    if (!tapCoords || !arSceneRef.current) {
      return;
    }
    if (tapCoords.id === lastTapIdRef.current) {
      return; // Deduplicate re-renders
    }
    lastTapIdRef.current = tapCoords.id;

    arSceneRef.current
      .performARHitTestWithPoint(tapCoords.x, tapCoords.y)
      .then((results: ARHitTestResult[]) => {
        if (!results || results.length === 0) {
          return;
        }

        // Prefer plane hits over raw feature points for better accuracy.
        const preferred =
          results.find(r =>
            ['ExistingPlaneUsingExtent', 'ExistingPlane'].includes(r.type),
          ) ??
          results.find(r => r.type === 'EstimatedHorizontalPlane') ??
          results[0];

        const hp = preferred.transform.position; // hit point in world space
        const cp = cameraPositionRef.current; // camera in world space

        const dx = hp[0] - cp[0];
        const dy = hp[1] - cp[1];
        const dz = hp[2] - cp[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        setMarkerPosition(hp);
        onDistanceUpdate(distance);
      })
      .catch(() => {
        // Hit-test may fail if tracking is not ready yet; ignore silently.
      });
  }, [tapCoords, onDistanceUpdate]);

  return (
    <ViroARScene
      ref={arSceneRef}
      onCameraTransformUpdate={onCameraTransformUpdate}>
      {markerPosition && (
        <ViroNode position={markerPosition}>
          {/* Outer white ring */}
          <ViroSphere
            radius={0.025}
            materials={['markerRingMaterial']}
            position={[0, 0, 0]}
          />
          {/* Inner red dot */}
          <ViroSphere
            radius={0.018}
            materials={['markerMaterial']}
            position={[0, 0, 0]}
          />
        </ViroNode>
      )}
    </ViroARScene>
  );
};

// ---------------------------------------------------------------------------
// Outer screen component
// ---------------------------------------------------------------------------

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const ARMeasureScreen = () => {
  const [distance, setDistance] = useState<number | null>(null);
  const [tapCoords, setTapCoords] = useState<{
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const tapIdRef = useRef(0);

  const handleTap = useCallback((event: any) => {
    const {locationX, locationY} = event.nativeEvent;
    setTapCoords({x: locationX, y: locationY, id: ++tapIdRef.current});
  }, []);

  const handleDistanceUpdate = useCallback((d: number | null) => {
    setDistance(d);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* AR view */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          <ViroARSceneNavigator
            autofocus
            style={StyleSheet.absoluteFill}
            initialScene={{
              scene: ARScene,
              passProps: {
                onDistanceUpdate: handleDistanceUpdate,
                tapCoords,
              },
            }}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Crosshair overlay */}
      <View style={styles.crosshair} pointerEvents="none">
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />
        <View style={styles.crosshairDot} />
      </View>

      {/* Distance card */}
      <View style={styles.cardContainer} pointerEvents="none">
        {distance !== null ? (
          <View style={styles.card}>
            <Text style={styles.distanceValue}>{formatDistance(distance)}</Text>
            <Text style={styles.distanceLabel}>to object</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.hint}>Tap any surface to measure</Text>
          </View>
        )}
      </View>

      {/* Corner guides */}
      <View style={styles.cornerTL} pointerEvents="none" />
      <View style={styles.cornerTR} pointerEvents="none" />
      <View style={styles.cornerBL} pointerEvents="none" />
      <View style={styles.cornerBR} pointerEvents="none" />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDistance(meters: number): string {
  if (meters < 0.01) {
    return '< 1 cm';
  }
  if (meters < 1) {
    return `${(meters * 100).toFixed(1)} cm`;
  }
  if (meters < 10) {
    return `${meters.toFixed(2)} m`;
  }
  return `${meters.toFixed(1)} m`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = 'rgba(255, 255, 255, 0.85)';
const CORNER_MARGIN = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ---- Crosshair ----
  crosshair: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 20,
    left: SCREEN_WIDTH / 2 - 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 30,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1.5,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  crosshairDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF3B30',
  },

  // ---- Distance card ----
  cardContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  distanceValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  distanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },

  // ---- Corner guides ----
  cornerTL: {
    position: 'absolute',
    top: CORNER_MARGIN,
    left: CORNER_MARGIN,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: 3,
  },
  cornerTR: {
    position: 'absolute',
    top: CORNER_MARGIN,
    right: CORNER_MARGIN,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: 3,
  },
  cornerBL: {
    position: 'absolute',
    bottom: CORNER_MARGIN,
    left: CORNER_MARGIN,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: 3,
  },
  cornerBR: {
    position: 'absolute',
    bottom: CORNER_MARGIN,
    right: CORNER_MARGIN,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: 3,
  },
});
