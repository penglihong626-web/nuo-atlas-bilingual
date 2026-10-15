/* First-round pilot: a small, traceable selection from the existing archive.
 * Keep historical accounts, image observations and project adaptations separate.
 * Local artwork images and the existing SVG line drawings are separate references.
 */
window.NUO_JOURNEY_CONTENT = {
  verifiedAt: '2026-10-03',
  intro: {
    title: '先认识一张傩面',
    region: '江西 · 萍乡 · 湘东',
    lead: '先认识傩面具和它的使用背景，再留下感兴趣的参考，创作一份给自己或他人的心意。',
    context: '傩面具是傩文化中表现角色的面具。这里从江西萍乡湘东认识它：面部神情、冠饰与雕刻手法，都与当地的文化传统有关。',
    craft: '这一站选取彭国龙的六件当代雕刻作品。你可以切换作品图与线稿，比较角色和细节，沿出处理解背景，再决定用什么作为自己的创作参考。',
    performance: '在当地的萍乡耍傩神中，表演者佩戴面具，以舞蹈表现角色。唐、葛、周三位将军是主神，相关傩事活动寄托着祈福纳吉的愿望。',
    boundary: '资料介绍角色的传统背景；作品里的个人心意由你赋予，并与文化出处一同保留。',
    sourceUrl: 'https://www.ihchina.cn/project_details/14030.html',
    sourceTitle: '国家非遗名录 · 萍乡湘东傩面具',
    sources: [
      {
        kind: '地方工艺背景',
        title: '中国非物质文化遗产网 · 萍乡湘东傩面具',
        url: 'https://www.ihchina.cn/project_details/14030.html'
      },
      {
        kind: '表演与使用背景',
        title: '中国非物质文化遗产网 · 傩舞（萍乡耍傩神）',
        url: 'https://www.ihchina.cn/project_details/23660'
      }
    ]
  },
  labels: {
    story: '资料记载',
    observation: '一起观察',
    translation: '创作尝试',
    palette: '项目设计配色',
    paletteNote: '这些颜色供当代创作试用，由本项目搭配，不是原作取色或传统标准色，也不代表固定寓意。',
    imageNote: '可切换作品图像与线稿，比较色彩、轮廓和细节',
    personalMeaning: '这是你赋予作品的个人意义，可以与传统角色的解释不同。'
  },
  samples: [
    {
      id: 324,
      name: '唐将军',
      workTitle: '古傩迎宾',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0324.svg',
      imageAlt: '唐将军《古傩迎宾》线稿，冠饰和面部周围有繁密雕刻纹样',
      photo: 'assets/pilot/0324.jpg',
      photoAlt: '彭国龙唐将军《古傩迎宾》作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1383.html',
      sourceTitle: '唐将军《古傩迎宾》· 彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿。',
      story: '这是彭国龙创作的唐将军《古傩迎宾》。唐将军是萍乡当地傩文化中的重要角色；作者用了两个月，将繁密的冠饰和人物细节刻进这件作品。',
      roleTags: ['地方主神', '祈福纳吉'],
      visualTags: ['繁密冠饰', '左右展开'],
      tradition: {
        scope: '萍乡傩事活动',
        text: '在萍乡的傩事活动中，人们借戴面具的舞蹈表达驱疫逐鬼、祈福纳吉的愿望，唐、葛、周三位将军是当地的主神。这里展示的是彭国龙的雕刻作品，资料未记载它的具体仪式使用经历。',
        sourceUrl: 'https://www.ihchina.cn/project_details/23660',
        sourceTitle: '国家非遗名录 · 萍乡耍傩神'
      },
      wishTags: ['平安', '支持'],
      wishBridge: '祈求平安的传统，可以启发一句今天的关心：“愿你走向新的生活时，始终知道有人支持你。”',
      observation: '先看眼睛上方：冠饰向两侧展开，密集纹样围绕中轴排列。再看整张脸，哪些线条最先吸引了你？',
      visualFocus: 'forehead',
      translation: '可以借鉴冠饰围绕中轴展开的布局，用更少的线条试画。保留你喜欢的节奏，并记录自己简化了什么。',
      prompt: '你希望把哪一份平安或支持，留给自己或重要的人？',
      palette: ['#D8B777', '#AE4A35', '#302721', '#F0E2C5'],
      paletteNote: '项目设计配色；用于试画，不复原这件作品的原色。',
      sources: [
        { kind: '作品身份与创作记述', title: '中国傩戏网 · 唐将军《古傩迎宾》', url: 'https://www.zgnuoxi.com/mianju/view_1383.html' },
        { kind: '当地角色背景', title: '国家非遗名录 · 萍乡耍傩神', url: 'https://www.ihchina.cn/project_details/23660' }
      ]
    },
    {
      id: 317,
      name: '判官',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0317.svg',
      imageAlt: '判官线稿，圆睁双眼、上挑眉形和张开的嘴部清晰可见',
      photo: 'assets/pilot/0317.jpg',
      photoAlt: '彭国龙判官作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1374.html',
      sourceTitle: '判官 · 萍乡湘东彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿；角色介绍属于民俗叙事。',
      story: '判官是民俗叙事中判断善恶、施行赏罚的角色。这件湘东雕刻出自彭国龙：威严的面相与资料强调的公正职责，共同构成了角色的特点。',
      roleTags: ['赏善罚恶', '公正'],
      visualTags: ['圆睁双眼', '上挑眉形'],
      tradition: {
        scope: '角色民俗背景',
        text: '判官出现在民俗的阴间审判叙事中，负责判断生死、赏善罚恶。资料强调他外貌凶猛、内心公正的反差；这件面具的具体演出或仪式用途，原页没有记载。',
        sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1374.html',
        sourceTitle: '判官 · 彭国龙作品（原页注明文旅湘东）'
      },
      wishTags: ['正直', '公平相待'],
      wishBridge: '公正的职责，可以启发你对自己的提醒：“希望我面对不同的人，都愿意先了解，再判断。”',
      observation: '看一看向上延伸的眉形、圆睁的眼睛，以及露齿的嘴。单看外形时，你对这个角色的第一印象是什么？',
      visualFocus: 'eyes',
      translation: '试着只改变眉线的方向或眼睛的大小，观察表情怎样变化。这样的变化是你的视觉实验，不替代传统角色的含义。',
      prompt: '了解判官的职责后，你最想提醒自己坚持什么原则？',
      palette: ['#A74937', '#D5AE72', '#2A2826', '#EEE0C4'],
      paletteNote: '项目设计配色；颜色不对应角色品德或性格判断。',
      sources: [
        { kind: '作品身份与角色介绍', title: '中国傩戏网 · 判官（原页注明文旅湘东）', url: 'https://www.zgnuoxi.com/mianju/view_1374.html' }
      ]
    },
    {
      id: 319,
      name: '文财神',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0319.svg',
      imageAlt: '文财神线稿，宽阔冠饰上排列圆形装饰，胡须向下分开',
      photo: 'assets/pilot/0319.jpg',
      photoAlt: '彭国龙文财神作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1376.html',
      sourceTitle: '文财神 · 萍乡湘东彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿；原页未把这件作品确定为某一位具体财神。',
      story: '文财神是民间财神形象的一类，常以冠服齐整、面带笑容的形象出现。这件作品是彭国龙的湘东雕刻版本；资料没有进一步确定它对应哪一位具体人物。',
      roleTags: ['民间财神', '新春喜庆'],
      visualTags: ['宽阔冠饰', '圆形装饰'],
      tradition: {
        scope: '角色民俗背景',
        text: '作品资料介绍，文财神形象常见于民间雕塑、木版年画，也用于新春喜庆时的堂室张挂。这讲的是角色形象的生活场景，不是这件雕刻已知的使用经历。',
        sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1376.html',
        sourceTitle: '文财神 · 彭国龙作品（原页注明文旅湘东）'
      },
      wishTags: ['生活安稳', '乐于分享'],
      wishBridge: '从喜庆的生活愿望，你可以写下自己对富足的理解：“希望我们努力生活，也留有余力照顾彼此。”',
      observation: '冠饰比脸部更宽，圆形装饰一层层排列。留意宽阔的上部与向下收束的胡须，怎样共同构成轮廓。',
      visualFocus: 'forehead',
      translation: '可以从冠饰中选一种重复排列的方式，用圆点或短线重新组合，比较疏与密的效果。',
      prompt: '对你而言，值得祝愿的“好生活”具体是什么样的？',
      palette: ['#D8B777', '#A66843', '#EEE0C4', '#34312B'],
      paletteNote: '项目设计配色；不表示财富、运势或其他功效。',
      sources: [
        { kind: '作品身份与称谓说明', title: '中国傩戏网 · 文财神（原页注明文旅湘东）', url: 'https://www.zgnuoxi.com/mianju/view_1376.html' }
      ]
    },
    {
      id: 322,
      name: '土地',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0322.svg',
      imageAlt: '土地线稿，可见额部皱纹、长眉、长须以及冠饰中的重复纹样',
      photo: 'assets/pilot/0322.jpg',
      photoAlt: '彭国龙土地作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1379.html',
      sourceTitle: '土地 · 萍乡湘东彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿；背景文字为资料中的民俗解释。',
      story: '土地神又称福德正神，是民俗中管理一方的社神。彭国龙用长眉、皱纹与长须来呈现这件作品，让与地方生活相连的角色有了具体面貌。',
      roleTags: ['地方社神', '福德正神'],
      visualTags: ['额部皱纹', '长眉长须'],
      tradition: {
        scope: '角色民俗背景',
        text: '土地神的民俗身份与人们生活的一方土地有关，作品资料称其在民间广泛受到奉祀。原页未交代这件雕刻曾在哪座庙或哪次傩事活动中使用。',
        sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1379.html',
        sourceTitle: '土地 · 彭国龙作品（原页注明文旅湘东）'
      },
      wishTags: ['归属', '照顾'],
      wishBridge: '与地方相连的角色，可以让你想到归属：“愿我们无论走到哪里，都有一个安心回来歇脚的地方。”',
      observation: '顺着额头、眼角和胡须的线条看下去：哪些是短而弯的，哪些是长而连续的？它们让你联想到怎样的年龄与神态？',
      visualFocus: 'eyes',
      translation: '选取一种弯曲线条，用不同长度和间距试画。你可以让线条更舒展，也可以保留原来紧密的节奏。',
      prompt: '有没有一个地方或一群人，是你希望安好、想认真照顾的？',
      palette: ['#C99561', '#D8B777', '#6B5141', '#EEE0C4'],
      paletteNote: '项目设计配色；不是这件原作的色彩测量值。',
      sources: [
        { kind: '作品身份与角色介绍', title: '中国傩戏网 · 土地（原页注明文旅湘东）', url: 'https://www.zgnuoxi.com/mianju/view_1379.html' }
      ]
    },
    {
      id: 325,
      name: '龙王',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0325.svg',
      imageAlt: '龙王线稿，头顶双角、额部鳞状纹样与向两侧伸展的须线清晰可见',
      photo: 'assets/pilot/0325.jpg',
      photoAlt: '彭国龙龙王作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1389.html',
      sourceTitle: '龙王 · 萍乡湘东彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿；降雨等职责属于神话叙事。',
      story: '龙王是神话中统领水族、掌管降雨的角色。这件湘东雕刻由彭国龙创作，用双角、鳞状纹样和向外展开的须线塑造龙的形象。',
      roleTags: ['兴云降雨', '平安丰收'],
      visualTags: ['头顶双角', '鳞状纹样'],
      tradition: {
        scope: '角色民俗背景',
        text: '作品资料把龙的形象与人们祈求平安、丰收的民俗愿望联系起来。原页未记载这件湘东面具的具体使用场景，不能据此认定它用于求雨仪式或舞龙。',
        sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1389.html',
        sourceTitle: '龙王 · 彭国龙作品（原页注明文旅湘东）'
      },
      wishTags: ['顺遂', '珍惜自然'],
      wishBridge: '从对风雨和收成的期待，你可以联想到今天的生活：“愿这一年的付出有收获，也愿我们珍惜土地与水。”',
      observation: '双角向上伸展，须线向两侧展开，额头排列着鳞状纹样。先遮住细节，只看外轮廓，还能认出哪些特点？',
      visualFocus: 'outline',
      translation: '尝试保留向外展开的轮廓，减少内部细节；再加入一组自己画的曲线，比较简化前后的变化。',
      prompt: '你希望接下来的生活中，什么事情能够顺遂，又有什么值得好好珍惜？',
      palette: ['#6F9290', '#D8B777', '#A74937', '#EEE0C4'],
      paletteNote: '项目设计配色；青绿色是创作选项，不是这件原作的采样色。',
      sources: [
        { kind: '作品身份与角色介绍', title: '中国傩戏网 · 龙王（原页注明文旅湘东）', url: 'https://www.zgnuoxi.com/mianju/view_1389.html' }
      ]
    },
    {
      id: 326,
      name: '钟馗',
      region: '江西 · 萍乡 · 湘东',
      creator: '彭国龙',
      image: 'assets/masks/0326.svg',
      imageAlt: '钟馗线稿，双眼圆睁，眉须向两侧卷曲，帽饰左右展开',
      photo: 'assets/pilot/0326.jpg',
      photoAlt: '彭国龙钟馗作品图像',
      sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1390.html',
      sourceTitle: '钟馗 · 萍乡湘东彭国龙作品',
      sourceNote: '中国傩戏网作品资料，原页注明来源为“文旅湘东”。本站同时提供整理后的作品图像和SVG线稿；驱邪含义为传统民俗叙事。',
      story: '钟馗是民俗中驱邪的角色，人们通过他的形象寄托消灾的愿望。彭国龙的这件湘东雕刻，以圆睁的双眼和卷曲的眉须呈现其神态。',
      roleTags: ['驱邪角色', '消灾愿望'],
      visualTags: ['圆睁双眼', '卷曲眉须'],
      tradition: {
        scope: '角色民俗背景',
        text: '作品资料提到民间悬挂钟馗神像、寄托辟邪除灾愿望的习俗。这是角色的民俗背景，原页没有记录这件雕刻的悬挂或佩戴经历。',
        sourceUrl: 'https://www.zgnuoxi.com/mianju/view_1390.html',
        sourceTitle: '钟馗 · 彭国龙作品（原页注明文旅湘东）'
      },
      wishTags: ['安心', '彼此照应'],
      wishBridge: '希望远离灾患的愿望，可以启发一份今天的支持：“遇到让你不安的事时，记得你不必独自面对。”',
      observation: '从眉梢到胡须，可以找到多处卷曲线条。比较它与判官的眉眼：同样圆睁的双眼，周围的线条有什么不同？',
      visualFocus: 'eyes',
      translation: '画一组卷曲线条，再改变弯曲程度与粗细。可以参考它的走向，做出自己的组合，并写下你改变的理由。',
      prompt: '如果这件作品能留下一句让人安心的话，你最想说什么？',
      palette: ['#A74937', '#312B29', '#D8B777', '#EEE0C4'],
      paletteNote: '项目设计配色；选择颜色是当代创作决定，不附带传统功效。',
      sources: [
        { kind: '作品身份与角色介绍', title: '中国傩戏网 · 钟馗（原页注明文旅湘东）', url: 'https://www.zgnuoxi.com/mianju/view_1390.html' }
      ]
    }
  ]
};
