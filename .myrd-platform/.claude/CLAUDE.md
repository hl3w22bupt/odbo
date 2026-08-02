# 项目规范

执行任务时必须严格遵守以下规范。

## TypeScript 编码规范

### 类型定义
- 使用 interface 定义对象类型
- 避免使用 any，尽量使用精确的类型
- 使用联合类型代替枚举

### 命名规范
- 类名：PascalCase
- 函数名：camelCase
- 常量：UPPER_SNAKE_CASE
- 接口名：PascalCase（不加 I 前缀）

---

## Git 提交规范

### Commit Message 格式
```
<type>(<scope>): <subject>

<body>
```

### Type 类型
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试相关
- chore: 构建/工具链更新

---

## React 组件规范

### 文件结构
- 每个组件单独一个文件
- 组件名与文件名一致（PascalCase）
- 使用函数组件 + Hooks

### Props 处理
- 使用 TypeScript 定义 Props 类型
- 默认参数使用 ES6 默认值
- 避免过度解构

### 性能优化
- 使用 useMemo 和 useCallback 避免不必要的重渲染
- 使用 React.memo 包裹纯展示组件
