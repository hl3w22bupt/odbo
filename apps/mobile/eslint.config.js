// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'coverage/**',
    ],
    rules: {
      // React 19 新规则与 React Native Animated 惯用法冲突：
      // 组件内普遍使用 `useRef(new Animated.Value(...)).current` 创建稳定的动画值，
      // 该模式在渲染期读取的 ref 是稳定且不会被替换的，属合理用法，关闭此规则。
      'react-hooks/refs': 'off',
      // 「在 effect 中同步 props → state / 初始化动画」是 RN 常见模式
      //（弹窗打开时重置表单、入场动画初始化等），按项目实际关闭。
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
