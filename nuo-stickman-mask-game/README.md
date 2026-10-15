# 趣味小游戏 · 傩火行旅

当前入口为中国省域地图探索。操控小人走到省份，阅读当地面具线索，从右侧行囊选一道具，再点“使用道具”。省份、当前面具和道具三项相合，点亮一张面具；十张全亮通关。同省各面具独立计数，整省完成后地表亮起。

## 操作

- 点击地图陆地或灯台：小人沿陆地路径行走；并非瞬移。
- 电脑可用方向键 / WASD 手动移动，沿省界判断位置；手机轻触地图即可行走。已移除底部四个方向按钮，将空间用于地图。
- 步行动画按实际移动距离推进，手臂、膝盖和抬脚同步；停下自然回到站姿，继续走时接续上一次步伐。
- 同省面具：在场景下方切换。
- 默认拉近的倾斜俯视镜头，以原站的缓动速度跟随小人；人物保持在中部偏下。地图根据场景宽高铺满，手机同样使用近景。
- 放大、缩小、全图：查看全图后可点“跟随”回到小人；开始移动也会自动回到跟随视角。系统开启减少动态效果时镜头直接跟随，不作缓动。
- 行囊可滚动；没有计时和扣分。
- 玩法、面具册和通关页使用原生弹窗。离屏、失焦、切后台或开弹窗时停止行走。

## 十项任务

|省份|面具|道具|用途|
|---|---|---|---|
|贵州|判官|笔与印|地方剧目记录|
|福建|增长天王|双尺|大源表演线索|
|福建|弥勒佛|木鱼|邵武传承人表演线索|
|广西|土地|刻刀|木雕制作工具|
|湖南|开山|开山斧|平云村角色记录|
|贵州|钟馗|轮廓拼片|照片观察道具|
|广西|雷公|雨纹牌|用途联想道具|
|贵州|傩公|供台|傩头用途线索|
|湖南|傩公傩母|双人画框|成对关系观察|
|江西|小鬼|戏中酒壶|石邮表演教学路线|

当前十面具覆盖五个省份，不能误写为十省。道具不是全部传统法器；每件的地方资料、照片来源、署名和教学改编说明见 `map-quest-data.js` 及游戏面具册。小鬼照片与石邮表演的对应未证实，江西站明确标为教学路线。

## 文件与接入

- `map-quest.js`：SVG地图、行走、陆地寻路、省域判定、任务匹配、存档、通关。
- `map-quest-data.js`：十项任务与来源。
- `map-quest.css`：沿用原站暖黑、金色、朱红和青色的小人地图风格。
- `data/china-provinces.geojson`：[DataV省级地理数据](https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json)，2026-10-14获取。34省级区域与附属线划，南海要素以附图展示，游戏图不作测绘用途。
- 主站 `../index.html#stickman-game`、独立页 `index.html`、接入例 `embed.html` 均加载相同实现。

```html
<link rel="stylesheet" href="nuo-stickman-mask-game/map-quest.css">
<div id="nuo-game"></div>
<script src="nuo-stickman-mask-game/map-quest-data.js"></script>
<script src="nuo-stickman-mask-game/map-quest.js"></script>
<script>NuoCultureGame.mount('#nuo-game', {assetBase:'nuo-stickman-mask-game/',createHref:'index.html#galaxy'});</script>
```

新进度使用 `nuo-map-quest-v1`，按浏览器来源独立存储，只保留十项完成ID与小人位置。原 `nuo-culture-panguan-v1`、`nuo-culture-chapters-v1` 存档不变；旧关卡源码保留作前版参考，不再作为主入口加载。

## 验证

从仓库根目录执行：

```sh
node tests/map-quest.test.cjs
node tests/journey.test.cjs
python3 tests/site_structure.py
```

地图测试涵盖洞与多岛、真实省份命中、陆地路线和绕湾、不同面具/道具/省份匹配、重复点燃与异常存档恢复。浏览器另验证十任务通关、刷新恢复、错误道具、手机布局。仅本地更新，未发布线上。
