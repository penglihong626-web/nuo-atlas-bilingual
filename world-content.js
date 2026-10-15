/* Object records checked against the linked collection sources, 2026-10-08.
 * Keep image observations separate from documented roles and use histories.
 */
(function () {
  'use strict';

  window.NUO_WORLD_CONTENT = {
    objects: [
      {
        id: 'chujo',
        title: '能面《中将》',
        region: '日本',
        period: '18世纪，江户时代',
        maker: '馆藏署名 Genkyu Michinaga',
        collection: '大都会艺术博物馆',
        accession: '1993.341.2',
        material: '桧木，白、黑、红色颜料',
        role: '可表现贵族青年，或战死的平家贵族武士。',
        context: '能乐角色用面。馆藏说明介绍此面型可承担的角色，未列出本件参加过的具体演出。',
        observation: '窄长眼形、额间皱褶和微张的嘴，使表情集中于眉眼与口部的细小变化。',
        image: 'assets/world/chujo.jpg',
        manifestIndex: 4,
        manifestSet: 'Japanese Noh masks / 日本能面',
        source: {
          title: '大都会艺术博物馆 · Chūjō Noh Mask',
          url: 'https://www.metmuseum.org/art/collection/search/45493'
        },
        imageCredit: '大都会艺术博物馆，公共领域图像；本站整理背景。',
        imageSource: {
          title: '大都会艺术博物馆 · 原藏品与图像',
          url: 'https://www.metmuseum.org/art/collection/search/45493'
        }
      },
      {
        id: 'elder',
        title: '老人面具',
        region: '韩国',
        period: '19世纪，朝鲜王朝',
        maker: '作者未载',
        collection: '克利夫兰艺术博物馆',
        accession: '1989.103',
        material: '木与马鬃',
        role: '老人形象；具体角色姓名未载。',
        context: '馆方认为，本件可能曾由舞者佩戴，在户外戏剧舞蹈中表现老人；具体舞种与演出记录未确定。',
        observation: '额部皱纹层叠，脸形向下收窄；附加的马鬃形成下垂胡须。',
        image: 'assets/world/elder.jpg',
        manifestIndex: 10,
        manifestSet: 'Korean Talchum masks / 韩国 Talchum',
        source: {
          title: '克利夫兰艺术博物馆 · Mask of an Elder',
          url: 'https://www.clevelandart.org/art/1989.103'
        },
        imageCredit: '克利夫兰艺术博物馆开放图像；本站整理背景。',
        imageSource: {
          title: '克利夫兰艺术博物馆 · 原藏品与开放图像',
          url: 'https://www.clevelandart.org/art/1989.103'
        }
      },
      {
        id: 'barong-ket',
        title: 'Barong Ket 面具',
        region: '印度尼西亚 · 巴厘岛',
        period: '2012年',
        maker: 'Ida Wayan Tangguh',
        collection: 'Second Face / Online Mask Museum',
        accession: 'ASID018',
        material: 'pule 木；彩绘、贴金、皮革、镜片、毛发和金属饰件',
        role: 'Barong 类型中的复合神兽，传统叙事中的村落保护者。',
        context: '馆藏记录将本件关联到 Barong 舞、Japatuan 与 Basur；同类传统涉及节庆及仪式。',
        observation: '红色兽面、圆睁双眼和向两侧展开的饰件，组成宽阔轮廓。',
        image: 'assets/world/barong-ket.jpg',
        manifestIndex: 12,
        manifestSet: 'Bali Barong / Rangda and related masks / 巴厘岛面具',
        source: {
          title: 'Second Face · Barong Ket',
          url: 'https://www.maskmuseum.org/mask/bali-barong-ket/'
        },
        imageCredit: 'Second Face 馆藏图像；本站整理背景。',
        imageSource: {
          title: 'Second Face · 原藏品与图像',
          url: 'https://www.maskmuseum.org/mask/bali-barong-ket/'
        }
      },
      {
        id: 'naga-sanniya',
        title: '可能为 Naga Sanniya 的面具',
        region: '斯里兰卡',
        period: '1771–1900年',
        maker: '作者未载',
        collection: 'Science Museum Group',
        accession: 'A300879',
        material: '彩绘木',
        role: '馆方认为可能为 Naga Sanniya，与蛇的噩梦相关；角色身份尚不确定。',
        context: '馆藏记录本件用于 tovil 仪式。',
        observation: '黑色面部配有凸起双眼和眼镜蛇头饰，眼下与口部留有开口。',
        image: 'assets/world/naga-sanniya.jpg',
        manifestIndex: 7,
        manifestSet: 'Sri Lankan Sanni masks / 斯里兰卡 Sanni 面具',
        source: {
          title: 'Science Museum Group · 可能为 Naga Sanniya 的 tovil 面具',
          url: 'https://collection.sciencemuseumgroup.org.uk/objects/co124329/demon-mask-worn-during-tovil-ceremonies-possibly-naga-sanniya'
        },
        imageCredit: 'Wellcome Library, London / Wellcome Images，CC BY 4.0；本站整理背景。',
        imageSource: {
          title: 'Wikimedia Commons · Wellcome L0036685 图像与许可',
          url: 'https://commons.wikimedia.org/wiki/File:Demon_mask_Wellcome_L0036685.jpg'
        }
      }
    ],
    pairs: [
      {
        id: 'judge-chujo',
        title: '眉眼怎样塑造不同角色',
        focus: '判官 × 能面《中将》',
        foreignId: 'chujo',
        domestic: {
          id: 317,
          name: '判官',
          creator: '彭国龙',
          image: 'assets/pilot/0317.jpg',
          source: {
            title: '中国傩戏网 · 判官（原页注明文旅湘东）',
            url: 'https://www.zgnuoxi.com/mianju/view_1374.html'
          }
        },
        dimensions: [
          { label: '形态', china: '圆睁双眼、上挑眉形和露齿嘴部，五官起伏较强。', foreign: '眼形较窄，以额间皱褶和微张嘴部表现细微表情。' },
          { label: '材料', china: '雕刻作品，原页未逐件说明材质与木种。', foreign: '馆藏明确记为桧木，施白、黑、红色颜料。' },
          { label: '使用场合', china: '资料介绍民俗中的赏善罚恶职责，本件仪式或演出经历未载。', foreign: '能乐中表现贵族或武士；本件具体演出经历未载。' },
          { label: '主要差异', china: '角色职责是赏善罚恶；圆睁的眉眼不能直接用来判断善恶。', foreign: '馆方将额间皱褶解释为悲伤；相似的眉部刻画不代表相同身份。' }
        ]
      },
      {
        id: 'earth-elder',
        title: '皱纹与胡须怎样表现长者',
        focus: '土地 × 老人面具',
        foreignId: 'elder',
        domestic: {
          id: 322,
          name: '土地',
          creator: '彭国龙',
          image: 'assets/pilot/0322.jpg',
          source: {
            title: '中国傩戏网 · 土地（原页注明文旅湘东）',
            url: 'https://www.zgnuoxi.com/mianju/view_1379.html'
          }
        },
        dimensions: [
          { label: '形态', china: '高冠、额纹、长眉与连续雕出的长须构成轮廓。', foreign: '额纹明显，脸形收窄，附加胡须向下延伸。' },
          { label: '材料', china: '原页未逐件说明材质与木种；图中胡须以雕刻线条表现。', foreign: '馆藏明确记为木与马鬃，胡须使用附加材料。' },
          { label: '使用场合', china: '角色属于地方社神，本件供奉或佩戴经历未载。', foreign: '可能用于户外戏剧舞蹈，具体舞种与演出记录未确定。' },
          { label: '主要差异', china: '长者外形用于表现与地方信仰相连的土地神。', foreign: '馆藏将其识别为老人形象；年龄线索相似，不等于同为神祇。' }
        ]
      },
      {
        id: 'zhongkui-naga',
        title: '夸张面孔不代表相同角色',
        focus: '钟馗 × 可能为 Naga Sanniya 的面具',
        foreignId: 'naga-sanniya',
        domestic: {
          id: 326,
          name: '钟馗',
          creator: '彭国龙',
          image: 'assets/pilot/0326.jpg',
          source: {
            title: '中国傩戏网 · 钟馗（原页注明文旅湘东）',
            url: 'https://www.zgnuoxi.com/mianju/view_1390.html'
          }
        },
        dimensions: [
          { label: '形态', china: '圆睁双眼，卷曲眉须与左右展开的帽饰突出人物面貌。', foreign: '凸眼、蛇冠与黑红面部构成精怪形象。' },
          { label: '材料', china: '原页未逐件说明材质与制作年月。', foreign: '馆藏记为彩绘木。' },
          { label: '使用场合', china: '原页介绍悬挂钟馗神像的民俗，本件悬挂或佩戴经历未载。', foreign: '本件记录用于 tovil 仪式，具体角色仍带有“可能为”的限定。' },
          { label: '主要差异', china: '钟馗在所引民俗叙事中承担驱邪者身份。', foreign: '可能表现与蛇的噩梦相关的精怪，叙事位置不同，不能统一解释为保护者。' }
        ]
      }
    ]
  };
}());
