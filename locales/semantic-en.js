/* Whole-sentence templates preserve grammar around the chart's numeric data. */
Object.assign(window.NUO_EN = window.NUO_EN || {}, {
  '{count} 件样本的语义与情绪剖面': 'Themes and Expressions Across {count} Samples',
  '切换到第 {number} 张分析': 'Switch to analysis {number}',
  '该主题包含 {count} 件样本，是当前样本集中最主要的语义方向。它在后续特征矩阵中承担"基准层"的作用，可用于观察红黑重色、装饰密度与亲近性之间的差异。': 'With {count} samples, this is the most common theme in the current dataset. It provides a baseline for the feature matrix, helping compare strong red and black coloring, ornament density and approachability.',
  '在"{theme}"主题中，该视觉特征占比为 {share}%。矩阵用于把静态图表里的特征强度转为可比较的阅读路径。': 'This visual feature appears in {share}% of samples in the “{theme}” theme. The matrix makes the feature intensities in the original static charts easier to compare.',
  '"{dimension}"在该部位的强度为 {value}/100。这个视角将原始热区图转为面部部件的数值坐标，便于横向比较。': 'This facial area has an intensity score of {value}/100 for “{dimension}.” This view expresses the original heatmap as scores for individual facial areas, making comparisons easier.',
  '{province} · {roleType} · {quadrant}。坐标 X={x}，Y={y}。': '{province} · {roleType} · {quadrant}. Coordinates: X = {x}, Y = {y}.',
  '{share} · 平均怪诞 {grotesque}，平均威慑 {deterrence}。代表样本：{representative}': '{share} of samples · Average grotesque score: {grotesque}; average intimidation score: {deterrence}. Representative sample: {representative}',
  '该象限共 {count} 件样本，是当前数据中数量最高的情绪类型。四象限图将"威慑性"和"怪诞激烈性"从散点阅读转化为类型阅读。': 'With {count} samples, this quadrant is the largest expression category in the current dataset. The four-quadrant view groups the scatterplot’s intimidation and grotesque-intensity scores into categories.',
  '怪诞总分 {grotesque}，威慑总分 {deterrence}，属于"{quadrant}"。该列表用于把原始排行图转为可点选的样本入口。': 'Grotesque score: {grotesque}; intimidation score: {deterrence}. This sample belongs to the “{quadrant}” category. Select a ranked sample to explore the original ranking in detail.'
});
Object.assign(window.NUO_EN, {
  '语义分布': 'Theme distribution',
  '特征矩阵': 'Feature matrix',
  '部位热区': 'Facial zones',
  '情绪坐标': 'Expression coordinates',
  '四象限': 'Four quadrants',
  '排行等级': 'Rankings & levels'
});
