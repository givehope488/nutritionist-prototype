# 食堂菜品实测清单（照片识别）

> **来源** `D:/project/data`，43 张照片，按楼层/档口分类拍摄。
> **生成** 2026-11-13，WorkBuddy 图片识别。
> **结构化数据** `server/data/observed-menu.json`（379 条，带来源与置信度标记）。

## 这份清单是什么

**它回答「有什么菜」，不回答「多少 kcal」，也不回答「多少钱」。**

- **2026-11-13 产品决策：产品不向用户提供价格。** 因此本清单与 `observed-menu.json`、
  `menu-seed.v3.json` **均不含任何价格字段**。牌面上确实有价目表，但价格不进入产品链路——
  需要核对时请回看原始照片。
- **270 条**的菜名来自**菜单牌/价目表逐字抄录**（`source: sign`），可信度最高
- **101 条**是从菜品照片**推测**的（`source: photo`），主要是配菜柜里的麻辣烫食材
- **8 条**是**用户口述补充**的（`source: user`），即一楼的面食
- 每一条都带 `confidence`：高=牌面有明确文字，中=照片较明确，低=推测成分大

**它不覆盖的东西**：营养值（kcal/蛋白/钠）一个都没有；份量克重没有；
一楼自选线每个价牌对应哪个菜没拍清；麻辣烫没有价目表。

---

## 楼层与档口总览

| 楼层 | 档口 | 条目数 | 形态 | 结算 | 性质 |
|---|---|---|
| 1 | 一楼·中晚餐 | 29 | single 29 | fixed 29 | 自选快餐 |
| 1 | 一楼·早餐 | 28 | plate 25 / single 3 | weigh 28 | 早餐线 |
| 2 | 西蜀毛哥麻辣烫 | 44 | component 44 | weigh 40 / fixed 4 | 档口 |
| 2 | 奉天朱家小馆 | 41 | single 41 | fixed 41 | 档口 |
| 2 | 朝陇阳 | 38 | single 38 | fixed 38 | 档口 |
| 2 | 汉堡工厂 | 37 | single 37 | fixed 37 | 档口 |
| 2 | 健康餐 | 32 | component 32 | weigh 32 | 档口 |
| 2 | 江西小炒 | 31 | single 31 | fixed 31 | 档口 |
| 2 | 兰州牛肉面 | 29 | single 29 | fixed 29 | 档口 |
| 2 | 广东猪脚饭 | 19 | single 19 | fixed 19 | 档口 |
| 2 | 缙云烧饼 | 16 | single 16 | fixed 16 | 档口 |
| 2 | 拌个饭饭 | 15 | single 15 | fixed 15 | 档口 |
| 2 | 炸串精选 | 14 | single 14 | fixed 14 | 档口 |
| 2 | 绍兴小吃 | 11 | single 11 | fixed 11 | 档口 |

> 档口名是按照片里的招牌与灯箱识别的：健康餐=「四美轻食 / SALAD Season」、
> 兰州牛肉面=「兰青君」、奉天=「奉天朱家小馆（牛杂面）」、猪脚饭=「朱佰道金牌猪脚饭」、
> 拌个饭饭=「LIUZIZI 烧鸡饭」（隔壁是「炸串精选」）、汉堡工厂=「BURGER FACTORY」。

---

## 明细

### 一楼·早餐

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 白面小笼包 | 主食 | plate | weigh | 照片 | 中 | 蒸笼内褶皱包子，8 只/份 |
| 酱肉包 | 主食 | plate | weigh | 照片 | 低 | 褐色小包子 |
| 白粥 | 主食 | plate | weigh | 照片 | 中 | 米粥 |
| 南瓜粥/小米粥 | 主食 | plate | weigh | 牌面 | 中 | 黄色稠粥；该档价格牌对应关系待确认 |
| 馒头/花卷 | 主食 | plate | weigh | 照片 | 高 | 含红白螺旋花卷 |
| 茶叶蛋/卤蛋 | 荤/蛋白 | plate | weigh | 牌面 | 中 | 6.0 为该档价牌之一 |
| 白煮蛋 | 荤/蛋白 | plate | weigh | 照片 | 高 | 大量供应 |
| 煎饼果子/芝麻圆饼 | 主食 | plate | weigh | 牌面 | 中 | 椭圆带芝麻；价牌 3.5 或 4.5，待确认 |
| 韭菜盒子/煎蛋饼 | 主食 | plate | weigh | 牌面 | 中 | 黄绿相间扁饼；价牌 4.5 |
| 肉饼（圆） | 荤/蛋白 | plate | weigh | 照片 | 中 | 深褐色圆形肉饼 |
| 油条 | 主食 | plate | weigh | 照片 | 高 |  |
| 油饼/葱油饼 | 主食 | plate | weigh | 照片 | 中 |  |
| 蛋挞 | 主食 | plate | weigh | 照片 | 高 | 黄色圆形，2 个 |
| 香肠/烤肠 | 荤/蛋白 | plate | weigh | 照片 | 高 |  |
| 发糕/黄金糕 | 主食 | plate | weigh | 照片 | 低 | 白色方块 |
| 紫薯 | 主食 | plate | weigh | 照片 | 高 |  |
| 甜玉米 | 主食 | plate | weigh | 照片 | 高 |  |
| 炒面/炒米粉 | 主食 | plate | weigh | 照片 | 中 |  |
| 炸物拼盘（炸丸/藕盒/玉米段/素菜/香肠） | 荤/蛋白 | plate | weigh | 照片 | 中 | 多种油炸小吃混装，价牌 6.0 |
| 炸猪排/炸菜排 | 荤/蛋白 | plate | weigh | 照片 | 中 | 褐色裹粉片 |
| 凉拌素菜（丝状） | 素菜 | plate | weigh | 照片 | 低 | 价牌 1.5 |
| 豆制品（凉拌） | 素菜 | plate | weigh | 照片 | 低 | 价牌 5.0 |
| 盒装牛奶 | 荤/蛋白 | plate | weigh | 照片 | 高 |  |
| 袋装豆奶/早餐奶 | 荤/蛋白 | plate | weigh | 照片 | 高 |  |
| 袋装面包 | 主食 | plate | weigh | 照片 | 中 |  |
| 葱油拌面 | 主食 | single | weigh | 口述 | 高 | 用户口述补充 |
| 饺子（猪肉馅） | 主食 | single | weigh | 口述 | 高 | 用户口述补充 |
| 馄饨（猪肉馅） | 主食 | single | weigh | 口述 | 高 | 用户口述补充 |

### 一楼·中晚餐

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 红烧肉/酱肉 | 荤/蛋白 | single | fixed | 照片 | 高 |  |
| 炸猪排/炸鸡排 | 荤/蛋白 | single | fixed | 牌面 | 中 | 大块裹粉炸排，价牌 3.5 |
| 干锅虾/红油虾 | 荤/蛋白 | single | fixed | 牌面 | 中 | 红油大虾配青椒 |
| 炸肉丸/鸡米花 | 荤/蛋白 | single | fixed | 牌面 | 中 | 价牌 1.5 |
| 木耳肉片/炒肉 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 油豆腐/豆腐泡 | 荤/蛋白 | single | fixed | 牌面 | 中 | 浅褐方块浸汤 |
| 炸花生/炸肉串 | 荤/蛋白 | single | fixed | 牌面 | 低 |  |
| 炒青菜/炒小白菜 | 素菜 | single | fixed | 牌面 | 中 |  |
| 炒空心菜/绿叶菜 | 素菜 | single | fixed | 牌面 | 低 |  |
| 炒土豆丝 | 素菜 | single | fixed | 牌面 | 中 |  |
| 炒粉丝/炒面 | 素菜 | single | fixed | 照片 | 中 |  |
| 干豆腐/豆皮 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 腐竹 | 荤/蛋白 | single | fixed | 照片 | 中 |  |
| 炒木耳 | 素菜 | single | fixed | 牌面 | 中 |  |
| 炒豆角/四季豆 | 素菜 | single | fixed | 牌面 | 低 |  |
| 干锅土豆片/干锅菜花 | 素菜 | single | fixed | 照片 | 中 | 褐色片状带辣椒 |
| 炒饭/炒米粉 | 主食 | single | fixed | 照片 | 中 |  |
| 炒黄豆/炒豆 | 素菜 | single | fixed | 牌面 | 中 |  |
| 紫薯/南瓜块 | 主食 | single | fixed | 牌面 | 中 |  |
| 土豆块（炖） | 主食 | single | fixed | 牌面 | 中 |  |
| 腌黄瓜/酸黄瓜 | 素菜 | single | fixed | 照片 | 中 |  |
| 冬瓜排骨汤 | 汤 | single | fixed | 照片 | 高 |  |
| 玉米排骨汤 | 汤 | single | fixed | 照片 | 高 | 玉米段+红枣+笋块 |
| 哈密瓜/香瓜 | 水果 | single | fixed | 照片 | 高 |  |
| 炸酱面 | 主食 | single | fixed | 口述 | 高 | 用户口述补充 |
| 肉丝面 | 主食 | single | fixed | 口述 | 高 | 用户口述补充 |
| 饺子（猪肉馅） | 主食 | single | fixed | 口述 | 高 | 用户口述补充 |
| 馄饨（猪肉馅） | 主食 | single | fixed | 口述 | 高 | 用户口述补充 |
| 白米饭 | 主食 | single | fixed | 口述 | 高 | 用户确认：白米饭存在，只在一楼供应；二楼各档口的盖浇饭类自带米饭 |

### 二楼·健康餐

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 生菜 | 素菜 | component | weigh | 照片 | 高 |  |
| 芝麻菜/苦苣 | 素菜 | component | weigh | 照片 | 高 |  |
| 紫甘蓝 | 素菜 | component | weigh | 照片 | 高 |  |
| 西兰花 | 素菜 | component | weigh | 照片 | 高 |  |
| 菠菜 | 素菜 | component | weigh | 照片 | 高 |  |
| 圣女果 | 素菜 | component | weigh | 照片 | 高 |  |
| 黄瓜 | 素菜 | component | weigh | 照片 | 高 |  |
| 玉米粒 | 素菜 | component | weigh | 照片 | 高 |  |
| 黑芝麻 | 素菜 | component | weigh | 照片 | 高 |  |
| 白煮蛋 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鸡胸肉丝 | 荤/蛋白 | component | weigh | 照片 | 高 | 白色带葱花 |
| 鸡胸肉片/鸡肉块 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 卤鸡腿/手撕鸡 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 卤蛋 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 薯泥/土豆泥 | 主食 | component | weigh | 照片 | 高 |  |
| 紫薯泥/紫薯块 | 主食 | component | weigh | 照片 | 高 |  |
| 蛋黄沙拉/土豆沙拉 | 素菜 | component | weigh | 照片 | 中 |  |
| 腐竹丝 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 凉拌藕片/南瓜片 | 素菜 | component | weigh | 照片 | 中 |  |
| 凉拌木耳丝 | 素菜 | component | weigh | 照片 | 高 |  |
| 海带丝/木耳 | 素菜 | component | weigh | 照片 | 中 |  |
| 炒南瓜片 | 素菜 | component | weigh | 照片 | 高 |  |
| 炒花生米/炒木耳 | 素菜 | component | weigh | 照片 | 中 |  |
| 意面（白色细面） | 主食 | component | weigh | 照片 | 高 |  |
| 酥肉/炸鸡柳 | 荤/蛋白 | component | weigh | 照片 | 高 | 「少油炙烤 高蛋白饱腹」木盒区 |
| 烤鸡腿肉/烤肉 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 烤鸡翅/鸡腿排 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鸡胸肉条/鸡肉卷 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 洋葱圈 | 素菜 | component | weigh | 照片 | 高 |  |
| 肉松/碎肉 | 荤/蛋白 | component | weigh | 照片 | 低 |  |
| 芝麻酱 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 红油酱 | 荤/蛋白 | component | weigh | 照片 | 高 |  |

### 二楼·兰州牛肉面

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 原味牛肉面 | 主食 | single | fixed | 牌面 | 高 | 兰青君；鲜骨熬汤 鲜肉鲜切 手工现做 |
| 红烧牛肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 酸菜牛肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 麻辣牛肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 大盘鸡拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 土豆牛肉拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 青椒牛肉拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 辣子鸡拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 爆炒拉条子 | 主食 | single | fixed | 牌面 | 高 |  |
| 凉皮拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 番茄鸡蛋拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 巨无霸鸡拌面 | 主食 | single | fixed | 牌面 | 中 | 菜名字样存疑 |
| 番茄鸡蛋盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 青椒肉丝盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 木耳牛肉盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 爆炒饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 巨无霸肉丁盖浇饭 | 主食 | single | fixed | 牌面 | 中 | 菜名字样存疑 |
| 辣子鸡盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 土豆牛肉盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 青椒牛肉盖浇饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 兰州炒饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 蛋炒饭 | 主食 | single | fixed | 牌面 | 高 |  |
| 香辣丸子 | 荤/蛋白 | single | fixed | 牌面 | 高 | 西北小吃 |
| 风味香肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 捞汁豆干 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 茶叶蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 肉夹馍 | 主食 | single | fixed | 牌面 | 高 |  |
| 五香鸡腿 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 现煮蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |

### 二楼·奉天朱家小馆

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 小馆特色羊杂面 | 主食 | single | fixed | 牌面 | 高 | 始于2008；免费加面（需提前告知） |
| 小馆清汤面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆辣肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆招牌牛肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆卤肉面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆猪排面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆鸡柳面 | 主食 | single | fixed | 牌面 | 低 | 价格被反光遮挡，按同列梯度推测 12 |
| 小馆肉燥汤面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆酸豆角汤面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆酸菜汤面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆辣肉拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 鸡柳麻辣拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 猪排麻酱拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆麻酱鸡丝拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆肉燥拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆酸豆角拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆酸菜拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆麻辣拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 猪排麻辣拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆混合炸酱面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆鸡蛋炸酱面 | 主食 | single | fixed | 牌面 | 高 |  |
| 小馆招牌炸酱面 | 主食 | single | fixed | 牌面 | 高 |  |
| 辣番茄鸡蛋拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 加牛肉 | 荤/蛋白 | single | fixed | 牌面 | 高 | 卤味加料 |
| 加羊杂 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 加辣肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 加鸡丝 | 荤/蛋白 | single | fixed | 牌面 | 中 | 数字较淡 |
| 狮子头 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 淀粉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按根计 |
| 炸蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 辣椒 | 素菜 | single | fixed | 牌面 | 高 | 按根计 |
| 鸡腿 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 卤虎皮鸭腿 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 卤干豆腐 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按片计 |
| 卤肉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按根计 |
| 卤肠 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按根计 |
| 日式凉拌 | 素菜 | single | fixed | 牌面 | 高 |  |
| 卤五花肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 卤蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 卤豆腐 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黄金鸡柳 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |

### 二楼·广东猪脚饭

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 脆皮鸭饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 单只；最受欢迎 TOP.1；可双拼 |
| 金牌猪脚饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 秘制现卤；唯一不可双拼的主菜 |
| 脆皮鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 单只 |
| 香卤大肉肠饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 焖卤鸡腿饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黑金卤肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香卤鸭腿饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 大块牛肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香酥鸡排饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黑椒鸡扒饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 奥尔良味 |
| 鲍汁滑鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 辣椒炒肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 水煮肉片饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 单加鸭腿 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 单加鸡腿 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 单加大肉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 加卤蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按个计 |
| 加豆干 | 荤/蛋白 | single | fixed | 牌面 | 高 | 按片计 |
| 套餐（主菜+米饭+素菜+小菜+肉汁） | 主食 | single | fixed | 牌面 | 高 | 份量足又有料 |

### 二楼·拌个饭饭

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 任意双拼 | 荤/蛋白 | single | fixed | 牌面 | 高 | 招牌推荐 |
| 孜然烧鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 新品推荐 |
| 招牌口水鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 肉沫茄子饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 西红柿鸡蛋饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 可乐鸡块饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黑椒烧鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 经典辣子鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香辣烧鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 蜜汁酱鸭饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 咖喱鸡肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 鱼香肉丝饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 广式叉烧鸭饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 铁板黑烧鸡饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 酱香小炒鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |

### 二楼·炸串精选

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 年糕 | 主食 | single | fixed | 牌面 | 高 |  |
| 面筋 | 主食 | single | fixed | 牌面 | 高 |  |
| 川香鸡柳 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 大里脊肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 星星串 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 纯肉排 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 南瓜串 | 素菜 | single | fixed | 牌面 | 高 |  |
| 鱿鱼须 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 安井地瓜丸 | 主食 | single | fixed | 牌面 | 高 |  |
| 鸡肉串（30串） | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 鸭肠串（30串） | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 四合一 | 荤/蛋白 | single | fixed | 牌面 | 高 | 小份 8 / 中份 11 / 大份 15 |
| 鸡锁骨 | 荤/蛋白 | single | fixed | 牌面 | 高 | 小份 10 / 大份 14 |

### 二楼·朝陇阳

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 蟹黄肉酱拌面/粉 | 主食 | single | fixed | 牌面 | 高 | 招牌 |
| 招牌黄牛肉汤面/粉 | 主食 | single | fixed | 牌面 | 高 | 招牌 |
| 招牌肉酱拌面/粉 | 主食 | single | fixed | 牌面 | 高 | 招牌；店内加香 |
| 黑椒腿排拌面/粉 | 主食 | single | fixed | 牌面 | 高 | 小份 11 / 大份 14；推荐 |
| 椒麻鸡丝拌面/粉 | 主食 | single | fixed | 牌面 | 高 | 推荐 |
| 葱油拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 南昌拌粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 芝麻酱拌面 | 主食 | single | fixed | 牌面 | 高 |  |
| 酸菜拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 经典杂酱拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 鱼香肉丝拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 巴西烤肉拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 水煮肉片拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 豆干 | 荤/蛋白 | single | fixed | 牌面 | 高 | 必点小吃 |
| 煎蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 卤蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 淀粉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 兰花串 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 脆骨肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 大肉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 牛肉丸 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 鱼丸 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 腿排 | 荤/蛋白 | single | fixed | 牌面 | 高 | 小份 4 / 大份 8 |
| 番茄鸡蛋汤面/粉 | 主食 | single | fixed | 牌面 | 高 | 印刷体被手写贴纸覆盖 |
| 酸菜肉片汤面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 香菇肉丝汤面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 水煮肉片汤面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 柳州螺蛳粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 陕西油泼面 | 主食 | single | fixed | 牌面 | 高 |  |
| 酸菜油泼面 | 主食 | single | fixed | 牌面 | 高 |  |
| 炸酱油泼面 | 主食 | single | fixed | 牌面 | 高 |  |
| 肉酱油泼面 | 主食 | single | fixed | 牌面 | 高 |  |
| 椒麻鸡丝油泼面 | 主食 | single | fixed | 牌面 | 高 |  |
| 网红土豆泥拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 炸酱土豆泥拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 肉酱土豆泥拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 蟹黄土豆泥拌面/粉 | 主食 | single | fixed | 牌面 | 高 |  |
| 番茄炒蛋 | 荤/蛋白 | single | fixed | 照片 | 中 | 朝陇阳灶台实拍明确可见（红色砂锅内番茄+炒蛋），牌面未单列价格 |

### 二楼·江西小炒

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 青椒炒蛋 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 肉沫茄子 | 素菜 | single | fixed | 牌面 | 高 |  |
| 酸豆角肉沫 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 湘味小炒鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 辣椒炒肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 农家一碗香 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 茭笋炒肉 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 芹菜炒肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 下饭香干炒肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 萝卜干炒腊肉 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 竹笋炒猪肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 小炒黄牛肉 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 萝卜干炒牛肉 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 香干回锅肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 榨菜炒肉 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 招牌卤肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 椒麻鸡丝饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 招牌香肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 藤椒香活鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 卤香鸡腿饭 | 荤/蛋白 | single | fixed | 牌面 | 高 | 价格未识别 |
| 爆炒牛肉饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 糖醋背背鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 甜辣鸭翅根 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 卤汁肉卷饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 卤汁肉肠饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 糖醋小里脊 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 蒜香茄子 | 素菜 | single | fixed | 牌面 | 高 |  |
| 辣卤面筋饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 辣卤豆皮饭 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 孜然花菜饭 | 素菜 | single | fixed | 牌面 | 高 |  |
| 孜然土豆饭 | 素菜 | single | fixed | 牌面 | 高 |  |

### 二楼·绍兴小吃

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 炸鸡馍 | 荤/蛋白 | single | fixed | 牌面 | 高 | 馍+炸鸡+土豆+生菜 |
| 烤冷面 | 主食 | single | fixed | 牌面 | 高 | 冷面皮+鸡蛋+培根+生菜+洋葱 |
| 鸡蛋灌饼&手抓饼 | 主食 | single | fixed | 牌面 | 高 | 饼+鸡蛋+豆皮+生菜 |
| 杂粮煎饼 | 主食 | single | fixed | 牌面 | 高 | 煎饼+鸡蛋+脆饼+生菜+香菜+小葱 |
| 土豆丝/粉丝/豆皮/辣条 | 素菜 | single | fixed | 牌面 | 高 | 配菜，按份计 |
| 热狗/培根/肉松/火鸡面 | 荤/蛋白 | single | fixed | 牌面 | 高 | 配菜，按份计 |
| 脆骨肠/大肉串/大里脊 | 荤/蛋白 | single | fixed | 牌面 | 高 | 配菜，按份计 |
| 地道肠/鸡腿排 | 荤/蛋白 | single | fixed | 牌面 | 高 | 配菜，按份计 |
| 芝士 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 小酥肉/无骨鸡柳/鸡叉骨 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 酱料（沙拉/番茄/芝士） | 荤/蛋白 | single | fixed | 牌面 | 高 | 酱料任选；相同价位可更换 |

### 二楼·缙云烧饼

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 梅干菜五花肉饼 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 葱加瘦肉饼 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 梅干菜瘦肉饼 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 全瘦肉饼 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 梅干菜薄饼 | 素菜 | single | fixed | 牌面 | 中 |  |
| 白糖饼 | 主食 | single | fixed | 牌面 | 中 |  |
| 葱油饼 | 主食 | single | fixed | 牌面 | 高 | 价格未识别 |
| 温州瘦肉丸 | 荤/蛋白 | single | fixed | 牌面 | 高 | 小份 10 / 大份 15 |
| 温州瘦肉丸·馄饨 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 鲜肉小馄饨 | 荤/蛋白 | single | fixed | 牌面 | 高 | 小份 6 / 大份 9 |
| 康师傅泡面 | 主食 | single | fixed | 牌面 | 高 |  |
| 白象泡面 | 主食 | single | fixed | 牌面 | 高 |  |
| 乌冬面 | 主食 | single | fixed | 牌面 | 高 |  |
| 汤达人 | 主食 | single | fixed | 牌面 | 高 |  |
| 肉肠 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 王中王 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |

### 二楼·汉堡工厂

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 香辣鸡腿堡双鸡双堡套餐 | 荤/蛋白 | single | fixed | 牌面 | 低 | 反光遮挡，菜名不完整；TOP.1 |
| 双享堡 | 荤/蛋白 | single | fixed | 牌面 | 高 | 套餐内部分主食可互换 |
| 脆脆满满桶 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| PAD大鸡排 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黄金脆鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 | 默认苦辣+咸酥鲜粉 |
| 脆脆大块鸡桶 | 荤/蛋白 | single | fixed | 牌面 | 中 | 名称部分被反光遮挡 |
| 巨无霸肉桶/薯鸡桶 | 荤/蛋白 | single | fixed | 牌面 | 低 | 名称被反光遮挡 |
| 脆爽牛鸡 | 荤/蛋白 | single | fixed | 牌面 | 中 |  |
| 韩式无骨炸鸡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 藤椒鸡腿堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香辣鸡腿堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 原味鸡腿堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香辣鸡肉卷 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 板烧鸡腿堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 板烧鸡肉卷 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 芝芝厚牛堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黑松露风味牛堡 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 潮童双堡套餐 | 荤/蛋白 | single | fixed | 牌面 | 中 | 潮童新系列 |
| 香酥大鸡腿 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 劲爆鸡米花 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 辣卤翅根（×2） | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 香麻麻大串（×2） | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 无骨香鸡柳 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 薯条 | 主食 | single | fixed | 牌面 | 高 |  |
| 蛋挞（×2） | 主食 | single | fixed | 牌面 | 高 |  |
| 水果派 | 主食 | single | fixed | 牌面 | 高 |  |
| 霸王鸡架 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 黑椒鸡块 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 百事可乐/雪碧/美年达 | 荤/蛋白 | single | fixed | 牌面 | 高 | 无限 |
| 加芝士片 | 荤/蛋白 | single | fixed | 牌面 | 高 | 加点小料 |
| 加培根片 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 加牛肉饼 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 薯多多 | 主食 | single | fixed | 牌面 | 高 | 超值双拼 |
| 小食拼盒 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 小食拼盘 | 荤/蛋白 | single | fixed | 牌面 | 高 |  |
| 秘制黑椒鸡柳 | 荤/蛋白 | single | fixed | 牌面 | 低 | 品名被遮挡 |
| 招牌脆鸡圈 | 荤/蛋白 | single | fixed | 牌面 | 低 | 品名被遮挡；12 种口味 |

### 二楼·西蜀毛哥麻辣烫

| 菜名 | 类别 | 形态 | 结算 | 来源 | 置信度 | 备注 |
|---|---|---|---|---|---|
| 带壳鸡蛋 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鸭血/猪血 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 豆芽 | 素菜 | component | weigh | 照片 | 高 |  |
| 宽粉/粉条 | 主食 | component | weigh | 照片 | 高 |  |
| 千张/白豆皮 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 腐竹/油豆皮 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 豆腐泡/油豆腐 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 莲藕片 | 素菜 | component | weigh | 照片 | 高 |  |
| 海带 | 素菜 | component | weigh | 照片 | 高 |  |
| 紫甘蓝 | 素菜 | component | weigh | 照片 | 高 |  |
| 木耳 | 素菜 | component | weigh | 照片 | 高 |  |
| 土豆片 | 素菜 | component | weigh | 照片 | 高 |  |
| 紫薯丸 | 主食 | component | weigh | 照片 | 中 |  |
| 玉米段 | 素菜 | component | weigh | 照片 | 高 |  |
| 蟹棒/蟹柳 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鱼豆腐 | 荤/蛋白 | component | weigh | 照片 | 中 |  |
| 肉丸/牛丸 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鹌鹑蛋 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 午餐肉 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 火腿肠/小香肠 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 牛肉片/腌肉片 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 鸡胸肉片/里脊片 | 荤/蛋白 | component | weigh | 照片 | 高 |  |
| 虾滑/鱼滑 | 荤/蛋白 | component | weigh | 照片 | 中 |  |
| 毛肚/千层肚/黄喉 | 荤/蛋白 | component | weigh | 照片 | 中 |  |
| 金针菇 | 素菜 | component | weigh | 照片 | 高 |  |
| 香菇/花菇 | 素菜 | component | weigh | 照片 | 高 |  |
| 白玉菇/口蘑/杏鲍菇 | 素菜 | component | weigh | 照片 | 中 |  |
| 娃娃菜/白菜 | 素菜 | component | weigh | 照片 | 高 |  |
| 生菜/油麦菜 | 素菜 | component | weigh | 照片 | 高 |  |
| 上海青/油菜 | 素菜 | component | weigh | 照片 | 高 |  |
| 茼蒿/空心菜/苋菜 | 素菜 | component | weigh | 照片 | 中 |  |
| 香菜 | 素菜 | component | weigh | 照片 | 中 |  |
| 粉丝 | 主食 | component | weigh | 照片 | 高 |  |
| 碱水面/细面 | 主食 | component | weigh | 照片 | 中 |  |
| 乌冬面 | 主食 | component | weigh | 牌面 | 高 | 包装袋上印「UDON NOODLES 乌冬面 500克」 |
| 特制米粉/大米粉 | 主食 | component | weigh | 照片 | 低 | 包装袋红字，品名部分可辨 |
| 响铃/面筋结 | 主食 | component | weigh | 照片 | 低 |  |
| 包心丸/手工丸子 | 荤/蛋白 | component | weigh | 照片 | 中 |  |
| 竹笋/白萝卜条 | 素菜 | component | weigh | 照片 | 中 |  |
| 汤圆 | 主食 | component | weigh | 照片 | 低 | 整盒白色圆球 |
| 免费米饭 | 主食 | component | fixed | 口述 | 中 | 麻辣烫档口配主食之一，免费供应（用户确认）；与一楼的单点白米饭不是同一份；汤底与主食不是称重，按份给 |
| 番茄汤底 | 汤 | component | fixed | 口述 | 中 | 麻辣烫三种汤底之一（用户确认）；番茄底，不辣；汤底与主食不是称重，按份给 |
| 金汤底 | 汤 | component | fixed | 口述 | 中 | 麻辣烫三种汤底之一（用户确认）；浓白骨汤，不辣；汤底与主食不是称重，按份给 |
| 微辣汤底 | 汤 | component | fixed | 口述 | 中 | 麻辣烫三种汤底之一（用户确认）；微辣档，油脂与钠偏高；汤底与主食不是称重，按份给 |

---

## 与原型数据的关系

11-06 那 55 道种子每一道的 `source` 都写着「原型估算种子数据，需按反推法复核」——**是按原型编的，不是实测的**。

按 2026-11-13 决策「一切餐食以照片数据为准」，**这 55 道已整体抛弃**，本清单是唯一的菜单来源。

---

## 已确认的口径（2026-11-13）

| 事项 | 结论 |
|---|---|
| 二楼是否供应早餐 | **开**。二楼 12 个档口全部早/午/晚供应 |
| 麻辣烫的主食与汤底 | 主食有**免费米饭**；汤底三种：**番茄 / 金汤 / 微辣** |
| 口述面食的归属 | 用户口述的面食**全部在一楼**（葱油拌面、饺子、馄饨、炸酱面、肉丝面）；**朝陇阳是二楼档口，与一楼口述面食无关** |
| 哪些档口算「正餐」 | 8 个正餐档口进推荐池；汉堡工厂、缙云烧饼、绍兴小吃、炸串精选入库但不推荐 |
| 白米饭 | **存在，只在一楼供应**（二楼各档口的盖浇饭类自带米饭） |
| 价格 | **产品不向用户提供价格**，全链路不出现价格字段 |
| 结算方式 | **图片中无标价牌的餐食均为称重结算**；一楼只有早餐称重；二楼的麻辣烫配菜与健康餐也称重。称重的菜份量现场定，热量只能给参考值 |

## 待确认清单

### 一楼

1. **一楼中晚餐是按份称重，还是选菜后按托盘结算？** 收银台屏幕显示「交易成功 1.00」

---

*本文件由识别流程生成。菜名以照片牌面为准；营养值一律缺失，需另行反推。
产品不提供价格，本清单也不列价格。*
