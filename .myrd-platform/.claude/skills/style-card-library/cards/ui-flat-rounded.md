# style-card: ui-flat-rounded
- scope: global
- applies-to: ui
## 定义
- 圆角半径: 10px（卡片）/ 6px（按钮），全局一致
- 描边: 1px 边框 + 无投影（扁平）；按下态 = 亮度 -8%
- 字体层级: 标题 20px semibold / 正文 14px regular / 数字 16px tabular
- 色彩: 引用 palette 类卡片，按钮主色 = 强调色
## 生成提示词模板
flat rounded UI kit, 10px card radius, 6px button radius, 1px outline, no drop shadow,
pressed state darker, clear type hierarchy, {subject}, cohesive with palette card
## 反例（禁止）
- 拟物渐变 + 大投影（与扁平基调冲突）
- 同屏出现两种以上圆角半径
- 描边忽粗忽细
