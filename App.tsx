import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ARMeasureScreen} from './src/screens/ARMeasureScreen';

export default function App() {
  return (
    <View style={styles.root}>
      <ARMeasureScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
