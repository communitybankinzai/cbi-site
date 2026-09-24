const INZAI_BOUNDS = L.latLngBounds([35.735, 140.055], [35.875, 140.245]);
const STORAGE_KEY = "inzai-disaster-records-v1";
const SEARCH_LOG_KEY = "inzai-disaster-search-log-v1";
const WORK_LOG_KEY = "inzai-disaster-work-log-v1";
const OPERATOR_KEY = "inzai-disaster-operator-v1";
const GUIDE_SEEN_KEY = "inzai-disaster-guide-seen-v1";
const SOURCE_CHECKED_AT = "2026-08-15";
const APP_CONFIG = window.CBI_DISASTER_CONFIG || {};
const PUBLIC_VIEW = new URLSearchParams(window.location.search).get("view") === "public";
const INZAI_CITY_CODE = "1223100";
// ⚠ 2026-09-23 追加：CiDAO（Vercel）の関数呼び出しが無料枠 100万回/月 に達したため、
// CiDAO から取る情報（公式発表・避難所・SNS巡回・水位・避難情報・通行止め）の取り直しを 2倍の間隔に延ばしている。
// **次の災害のときは 1 に戻す**（気象庁から直接取る雨雲・キキクル・警報は対象外なので影響しない）。
const CIDAO_POLL_SLOWDOWN = 2;

const weatherWarningDefinitions = {
  "33": { name: "レベル5大雨特別警報", element: "rain", level: 50, alertLevel: 5 },
  "43": { name: "レベル4大雨危険警報", element: "rain", level: 40, alertLevel: 4 },
  "03": { name: "レベル3大雨警報", element: "rain", level: 30, alertLevel: 3 },
  "10": { name: "レベル2大雨注意報", element: "rain", level: 20, alertLevel: 2 },
  "39": { name: "レベル5土砂災害特別警報", element: "landslide", level: 50, alertLevel: 5 },
  "49": { name: "レベル4土砂災害危険警報", element: "landslide", level: 40, alertLevel: 4 },
  "09": { name: "レベル3土砂災害警報", element: "landslide", level: 30, alertLevel: 3 },
  "29": { name: "レベル2土砂災害注意報", element: "landslide", level: 20, alertLevel: 2 },
  "38": { name: "レベル5高潮特別警報", element: "tide", level: 50, alertLevel: 5 },
  "48": { name: "レベル4高潮危険警報", element: "tide", level: 40, alertLevel: 4 },
  "08": { name: "レベル3高潮警報", element: "tide", level: 30, alertLevel: 3 },
  "19": { name: "レベル2高潮注意報", element: "tide", level: 20, alertLevel: 2 },
  "35": { name: "暴風特別警報", element: "wind", level: 50 },
  "05": { name: "暴風警報", element: "wind", level: 30 },
  "15": { name: "強風注意報", element: "wind", level: 20 },
  "32": { name: "暴風雪特別警報", element: "windSnow", level: 50 },
  "02": { name: "暴風雪警報", element: "windSnow", level: 30 },
  "13": { name: "風雪注意報", element: "windSnow", level: 20 },
  "36": { name: "大雪特別警報", element: "snow", level: 50 },
  "06": { name: "大雪警報", element: "snow", level: 30 },
  "12": { name: "大雪注意報", element: "snow", level: 20 },
  "37": { name: "波浪特別警報", element: "wave", level: 50 },
  "07": { name: "波浪警報", element: "wave", level: 30 },
  "16": { name: "波浪注意報", element: "wave", level: 20 },
  "14": { name: "雷注意報", element: "thunder", level: 20 },
  "17": { name: "融雪注意報", element: "snowMelt", level: 20 },
  "20": { name: "濃霧注意報", element: "fog", level: 20 },
  "21": { name: "乾燥注意報", element: "dry", level: 20 },
  "22": { name: "なだれ注意報", element: "avalanche", level: 20 },
  "23": { name: "低温注意報", element: "cold", level: 20 },
  "24": { name: "霜注意報", element: "frost", level: 20 },
  "25": { name: "着氷注意報", element: "ice", level: 20 },
  "26": { name: "着雪注意報", element: "snowAccretion", level: 20 }
};

const weatherWarningActions = {
  rain: "低い土地の浸水や中小河川の増水に警戒し、キキクルと印西市の避難情報を確認してください。",
  landslide: "がけや急斜面から離れ、土砂キキクルと印西市の避難情報を確認してください。",
  tide: "海岸・河口付近から離れ、高潮と河川の情報を確認してください。",
  wind: "飛来物、倒木、停電に注意し、屋外物を固定して不要不急の外出を控えてください。",
  windSnow: "暴風雪による視界不良と交通障害に警戒し、不要不急の外出を控えてください。",
  snow: "積雪や路面凍結、交通障害に注意し、移動予定と備蓄を確認してください。",
  wave: "海岸や河口付近には近づかず、最新の波浪情報を確認してください。",
  thunder: "屋外活動を控えて頑丈な建物内へ移り、落雷、突風、ひょう、急な強い雨に注意してください。",
  snowMelt: "融雪による浸水や土砂災害に注意し、斜面や増水した水路に近づかないでください。",
  fog: "視界不良に注意し、運転時は速度を落として十分な車間距離を確保してください。",
  dry: "火の取り扱いと延焼に注意し、屋外での火気使用を控えてください。",
  avalanche: "積雪のある斜面や谷筋に近づかず、最新の道路・気象情報を確認してください。",
  cold: "水道管の凍結、農作物、体調管理に注意してください。",
  frost: "農作物の霜害に注意し、必要な保護対策を行ってください。",
  ice: "電線や設備への着氷と交通障害に注意してください。",
  snowAccretion: "電線や樹木への着雪、停電、交通障害に注意してください。"
};

const statusLabels = {
  unconfirmed: "未確認",
  corroborated: "複数根拠",
  verified: "確認済",
  actioning: "対応中",
  resolved: "解消済"
};

const categoryLabels = {
  road_flood: "道路冠水",
  inundation: "浸水",
  river: "河川増水",
  landslide: "土砂",
  traffic: "道路通行情報",
  rescue_request: "救助・安否確認要請",
  earthquake_damage: "地震被害",
  lifeline: "ライフライン",
  shelter: "避難所",
  other: "その他"
};

const passabilityLabels = {
  none: "該当なし・未設定",
  closed: "通行止め",
  impassable: "通行不能・通れない",
  restricted: "通行注意・規制あり",
  reopened: "通行再開",
  passed: "通行実績あり"
};

const passabilityModeLabels = {
  unknown: "不明",
  all: "全般",
  "passenger-car": "乗用車",
  "large-vehicle": "大型車",
  motorcycle: "二輪車",
  bicycle: "自転車",
  pedestrian: "歩行者"
};

const roadDirectionLabels = {
  unknown: "方向不明",
  both: "両方向",
  up: "上り",
  down: "下り"
};

const sourceLabels = {
  official: "公式",
  staff: "職員確認",
  citizen: "住民通報",
  sns: "SNS",
  news: "報道",
  web: "Web"
};

const photoLabels = {
  "needs-photo": "写真待ち",
  "has-photo": "写真リンクあり",
  "official-verified": "職員写真確認済",
  unavailable: "取得不可"
};

const locationStatusLabels = {
  unknown: "場所未特定",
  asked: "投稿者へ確認中",
  identified: "場所判明・ピン未設定",
  pinned: "ピン設定済"
};

const locationContactLabels = {
  comment: "投稿コメント",
  dm: "DM",
  phone: "電話・通報",
  onsite: "現地確認",
  other: "その他"
};

const platformLabels = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  "yahoo-realtime": "Yahoo!リアルタイム検索",
  web: "Web検索",
  other: "その他"
};

const searchMethodLabels = {
  "manual-search": "画面検索",
  screenshot: "スクショ登録",
  link: "投稿リンク登録",
  api: "連携API",
  json: "JSON取込",
  host: "CBI連携"
};

const alignmentLabels = {
  expected: "想定内被害",
  unexpected: "想定外被害",
  highRisk: "高リスク未確認",
  uncertain: "情報不確実",
  resolved: "解消済"
};

// 千葉国道事務所「千葉県内におけるアンダーパス部等の道路冠水注意箇所」（令和8年6月30日更新・95か所）を
// 国土地理院の住所検索で位置に直したもの（2026-09-22）。番地まで分かるものは「住所の代表点」、
// 町名・丁目までのものは「町丁目の代表点」で、実際のアンダーパスから大きくずれることがある。
// 住所の書かれていない15か所（施設名だけのもの）は位置を決められず載せていない：No.22 松戸市 指向アンダーパス／No.23 松戸市 忠仲アンダーパス／No.24 松戸市 新松戸アンダーパス／No.25 松戸市 幸谷アンダーパス(じゃんけん道路)／No.26 松戸市 宮前アンダーパス／No.27 野田市 川間ガード下／No.51 鴨川市 太海地下道／No.64 松戸市 矢切トンネル／No.69 我孫子市 布佐アンダー／No.70 袖ケ浦市 袖ケ浦アンダーパス／No.71 松戸市 新松戸1丁目アンダーパス／No.75 我孫子市 JR常磐線(久寺家ガード)／No.76 市川市 二俣アンダーパス／No.78 松戸市 上矢切トンネル／No.95 流山市 木地区(つくばエクスプレスガード下)
const ROAD_FLOOD_SOURCE_URL = "https://www.ktr.mlit.go.jp/chiba/chiba_index030.html";
// 🚗 アンダーパスの警告（2026-09-24）
// 内閣府の調査では、立退き避難の手段の75.5%が自動車で、台風19号の屋外の死者50名のうち54%が車で移動中だった。
// 2026年8月の千葉豪雨では、水没した車に閉じ込められて3名が亡くなっている。
// ⚠ ここに書いてよいのは出典のある事実だけ。CBIの判断（通れる・危ない等の断定）は足さないこと。
const UNDERPASS_WARNING_HTML = `
  <div class="underpass-warn">
    <strong>大雨のときは近づかないでください。</strong>
    <ul>
      <li>水深60cmになると、車のドアは水圧でほぼ開かなくなります（<a href="https://jaf.or.jp/common/safety-drive/car-learning/user-test/disaster/door" target="_blank" rel="noreferrer">JAFの実験</a>）。水深30cmでも走ったあとに動かなくなることがあります。</li>
      <li>アンダーパスの<strong>排水ポンプは停電で止まります</strong>（2026年8月の千葉市の事故で報じられた点。<a href="https://www.nikkei.com/article/DGXZQOUD151PB0V10C26A8000000/" target="_blank" rel="noreferrer">日本経済新聞</a>）。</li>
    </ul>
  </div>
`;
const roadFloodSites = [
  {
    "id": "road-1",
    "no": 1,
    "city": "習志野市",
    "roadType": "市道",
    "route": "習志野市 市道00-002号線",
    "name": "袖ケ浦1丁目11番地先",
    "lat": 35.67411,
    "lng": 140.016983,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-2",
    "no": 2,
    "city": "習志野市",
    "roadType": "市道",
    "route": "習志野市 市道00-003号線",
    "name": "津田沼3丁目11番地先",
    "lat": 35.685478,
    "lng": 140.026306,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-3",
    "no": 3,
    "city": "習志野市",
    "roadType": "市道",
    "route": "習志野市 市道00-005号線",
    "name": "鷺沼台1丁目1番地先",
    "lat": 35.684303,
    "lng": 140.029343,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-4",
    "no": 4,
    "city": "市原市",
    "roadType": "国道(県管理)",
    "route": "297号",
    "name": "五井(五井アンダーパス)",
    "lat": 35.518326,
    "lng": 140.085892,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-5",
    "no": 5,
    "city": "市原市",
    "roadType": "県道",
    "route": "茂原五井線",
    "name": "廿五里(廿五里アンダーパス)",
    "lat": 35.489525,
    "lng": 140.083405,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-6",
    "no": 6,
    "city": "市原市",
    "roadType": "市道",
    "route": "市原市 10号線",
    "name": "五井中央西3丁目(五井本仲ガード下)",
    "lat": 35.51585,
    "lng": 140.090927,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-7",
    "no": 7,
    "city": "市原市",
    "roadType": "市道",
    "route": "市原市 2084号線",
    "name": "村上(市原ICアンダーパス)",
    "lat": 35.495647,
    "lng": 140.097839,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-8",
    "no": 8,
    "city": "市原市",
    "roadType": "市道",
    "route": "市原市 2110号線",
    "name": "西広(西広アンダーパス)",
    "lat": 35.487316,
    "lng": 140.113419,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-9",
    "no": 9,
    "city": "市原市",
    "roadType": "市道",
    "route": "市原市 3529号線",
    "name": "古市場(古町橋下)",
    "lat": 35.543747,
    "lng": 140.142166,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-10",
    "no": 10,
    "city": "市川市",
    "roadType": "県道",
    "route": "市川松戸線",
    "name": "市川3丁目",
    "lat": 35.735973,
    "lng": 139.903503,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-11",
    "no": 11,
    "city": "市川市",
    "roadType": "市道",
    "route": "市川市 7002号線",
    "name": "原木1丁目(原木地下道)",
    "lat": 35.704967,
    "lng": 139.945709,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-12",
    "no": 12,
    "city": "船橋市",
    "roadType": "県道",
    "route": "長沼船橋線",
    "name": "前原西2丁目",
    "lat": 35.693729,
    "lng": 140.021027,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-13",
    "no": 13,
    "city": "船橋市",
    "roadType": "県道",
    "route": "船橋行徳線",
    "name": "山野町",
    "lat": 35.704445,
    "lng": 139.96257,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-14",
    "no": 14,
    "city": "船橋市",
    "roadType": "県道",
    "route": "松戸原木線",
    "name": "本郷町",
    "lat": 35.707909,
    "lng": 139.952087,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-15",
    "no": 15,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 14-003号線(都市計画道路3・3・7号)",
    "name": "海神1丁目1番地先(JR総武線下・東武野田線下)",
    "lat": 35.701542,
    "lng": 139.981735,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-16",
    "no": 16,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 06-029号線",
    "name": "海神6丁目24番地先(JR総武線下)",
    "lat": 35.703087,
    "lng": 139.969666,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-17",
    "no": 17,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 14-010号線",
    "name": "本町7丁目4番地先(JR総武線下・東武野田線下)",
    "lat": 35.702415,
    "lng": 139.983215,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-18",
    "no": 18,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 00-033号線",
    "name": "市場1丁目2番地先(JR総武線下)",
    "lat": 35.701248,
    "lng": 139.99353,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-19",
    "no": 19,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 00-178号線",
    "name": "丸山1丁目1番地先(東武野田線下)",
    "lat": 35.743256,
    "lng": 139.992203,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-20",
    "no": 20,
    "city": "船橋市",
    "roadType": "市道",
    "route": "船橋市 25-013号線",
    "name": "印内2丁目2番地先(JR武蔵野線下)",
    "lat": 35.714359,
    "lng": 139.963196,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-21",
    "no": 21,
    "city": "松戸市",
    "roadType": "県道",
    "route": "松戸鎌ケ谷線",
    "name": "五香(五香立体)",
    "lat": 35.794498,
    "lng": 139.968704,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-28",
    "no": 28,
    "city": "流山市",
    "roadType": "市道",
    "route": "流山市 106号線",
    "name": "南流山1丁目(南流山駅ガード下)",
    "lat": 35.837894,
    "lng": 139.906448,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-29",
    "no": 29,
    "city": "流山市",
    "roadType": "市道",
    "route": "流山市 109号線",
    "name": "南流山4丁目(馬場下ガード)",
    "lat": 35.84087,
    "lng": 139.903397,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-30",
    "no": 30,
    "city": "流山市",
    "roadType": "市道",
    "route": "流山市 114号線",
    "name": "おおたかの森東一丁目(中・駒木線ガード下)",
    "lat": 35.871841,
    "lng": 139.926956,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-31",
    "no": 31,
    "city": "流山市",
    "roadType": "県道",
    "route": "松戸野田線",
    "name": "流山市南",
    "lat": 35.884785,
    "lng": 139.897812,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-32",
    "no": 32,
    "city": "鎌ケ谷市",
    "roadType": "市道",
    "route": "鎌ケ谷市 37号線",
    "name": "丸山1丁目(丸山アンダー)",
    "lat": 35.761906,
    "lng": 140.009598,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-33",
    "no": 33,
    "city": "我孫子市",
    "roadType": "国道(県管理)",
    "route": "356号",
    "name": "本町1丁目(JR常磐線第4浜街道ガード)",
    "lat": 35.87199,
    "lng": 140.007996,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-34",
    "no": 34,
    "city": "我孫子市",
    "roadType": "県道",
    "route": "船橋我孫子線",
    "name": "泉(JR常磐線船取ガード)",
    "lat": 35.870586,
    "lng": 140.031387,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-35",
    "no": 35,
    "city": "我孫子市",
    "roadType": "市道",
    "route": "我孫子市 00-011号線",
    "name": "柴崎台1丁目地先(利根山隧道)",
    "lat": 35.87352,
    "lng": 140.040268,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-36",
    "no": 36,
    "city": "柏市",
    "roadType": "県道",
    "route": "市川柏線",
    "name": "富里(JR常磐線中原ガード)",
    "lat": 35.852676,
    "lng": 139.967514,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-37",
    "no": 37,
    "city": "柏市",
    "roadType": "県道",
    "route": "北柏停車場線",
    "name": "北柏",
    "lat": 35.874477,
    "lng": 139.985413,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-38",
    "no": 38,
    "city": "柏市",
    "roadType": "県道",
    "route": "白井流山線",
    "name": "逆井",
    "lat": 35.815441,
    "lng": 139.982468,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-39",
    "no": 39,
    "city": "印西市",
    "roadType": "市道",
    "route": "印西市 08-014号線",
    "name": "大森4233-10(六軒ガード下)",
    "lat": 35.841385,
    "lng": 140.141281,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-40",
    "no": 40,
    "city": "栄町",
    "roadType": "町道",
    "route": "栄町 21037号線",
    "name": "北781-47地先(国道356号バイパス道路ガード下)",
    "lat": 35.855194,
    "lng": 140.214828,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-41",
    "no": 41,
    "city": "栄町",
    "roadType": "町道",
    "route": "栄町 24063号線",
    "name": "北80-3地先(国道356号バイパス道路ガード下)",
    "lat": 35.856922,
    "lng": 140.20813,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-42",
    "no": 42,
    "city": "栄町",
    "roadType": "町道",
    "route": "栄町 24057号線",
    "name": "北444-4地先(国道356号バイパス道路ガード下)",
    "lat": 35.856319,
    "lng": 140.204941,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-43",
    "no": 43,
    "city": "銚子市",
    "roadType": "国道(県管理)",
    "route": "126号",
    "name": "三軒町(三軒町立体交差)",
    "lat": 35.732517,
    "lng": 140.824585,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-44",
    "no": 44,
    "city": "東金市",
    "roadType": "市道",
    "route": "東金市 5028号線",
    "name": "東金市山田213-2地先",
    "lat": 35.573814,
    "lng": 140.31163,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-45",
    "no": 45,
    "city": "大網白里市",
    "roadType": "県道",
    "route": "山田台大網白里線",
    "name": "大網(アンダーパス)",
    "lat": 35.529552,
    "lng": 140.328415,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-46",
    "no": 46,
    "city": "一宮町",
    "roadType": "町道",
    "route": "一宮町 3154号線",
    "name": "一宮町綱田字麦田37-1(綱田アンダー)",
    "lat": 35.335579,
    "lng": 140.37883,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-47",
    "no": 47,
    "city": "一宮町",
    "roadType": "町道",
    "route": "一宮町 2156号線",
    "name": "一宮町一宮字下村9278(下村アンダー)",
    "lat": 35.3694,
    "lng": 140.380539,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-48",
    "no": 48,
    "city": "白子町",
    "roadType": "町道",
    "route": "白子町 3051号線",
    "name": "白子町古所3290-23地先",
    "lat": 35.449169,
    "lng": 140.40123,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-49",
    "no": 49,
    "city": "いすみ市",
    "roadType": "市道",
    "route": "いすみ市 6129号線",
    "name": "いすみ市岬町椎木地先(椎木JR外房線ガード下)",
    "lat": 35.324001,
    "lng": 140.375092,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-50",
    "no": 50,
    "city": "いすみ市",
    "roadType": "市道",
    "route": "いすみ市 1415号線",
    "name": "いすみ市行川地先(行川いすみ鉄道鉄橋下)",
    "lat": 35.28392,
    "lng": 140.281464,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-52",
    "no": 52,
    "city": "木更津市",
    "roadType": "市道",
    "route": "木更津市 5010号線",
    "name": "牛袋1242番地(アクアライン連絡道下)",
    "lat": 35.410793,
    "lng": 139.958038,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-53",
    "no": 53,
    "city": "木更津市",
    "roadType": "市道",
    "route": "木更津市 112-2号線",
    "name": "牛袋605番地(アクアライン連絡道下)",
    "lat": 35.405525,
    "lng": 139.962219,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-54",
    "no": 54,
    "city": "木更津市",
    "roadType": "市道",
    "route": "木更津市 5109号線",
    "name": "牛袋679番地(アクアライン連絡道下)",
    "lat": 35.401787,
    "lng": 139.960968,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-55",
    "no": 55,
    "city": "木更津市",
    "roadType": "市道",
    "route": "木更津市 5041号線",
    "name": "十日市場45-2番地(アクアライン連絡道下)",
    "lat": 35.400097,
    "lng": 139.966293,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-56",
    "no": 56,
    "city": "君津市",
    "roadType": "県道",
    "route": "加茂木更津線",
    "name": "末吉(小櫃立体地下道)",
    "lat": 35.327866,
    "lng": 140.062119,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-57",
    "no": 57,
    "city": "富津市",
    "roadType": "県道",
    "route": "竹岡インター線",
    "name": "竹岡(竹岡立体地下道)",
    "lat": 35.187023,
    "lng": 139.866516,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-58",
    "no": 58,
    "city": "富津市",
    "roadType": "県道",
    "route": "大貫青堀線",
    "name": "大堀(大堀立体地下道)",
    "lat": 35.337543,
    "lng": 139.854172,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-59",
    "no": 59,
    "city": "袖ケ浦市",
    "roadType": "市道",
    "route": "袖ケ浦市 坂戸川間尻線",
    "name": "坂戸市場2433-4(東京湾アクアライン連絡道ガード下)",
    "lat": 35.413811,
    "lng": 139.952133,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-60",
    "no": 60,
    "city": "袖ケ浦市",
    "roadType": "市道",
    "route": "袖ケ浦市 坂戸市場21号線",
    "name": "神納4189-2(東京湾アクアライン連絡道ガード下)",
    "lat": 35.412895,
    "lng": 139.954254,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-61",
    "no": 61,
    "city": "袖ケ浦市",
    "roadType": "市道",
    "route": "袖ケ浦市 坂戸市場18号線",
    "name": "神納4191-1(東京湾アクアライン連絡道ガード下)",
    "lat": 35.413139,
    "lng": 139.954956,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-62",
    "no": 62,
    "city": "袖ケ浦市",
    "roadType": "市道",
    "route": "袖ケ浦市 坂戸市場23号線",
    "name": "神納4207-4(東京湾アクアライン連絡道ガード下)",
    "lat": 35.41238,
    "lng": 139.956619,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-63",
    "no": 63,
    "city": "成田市",
    "roadType": "国道(国管理)",
    "route": "51号",
    "name": "成田市十余三(十余三トンネル)",
    "lat": 35.804314,
    "lng": 140.380966,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-65",
    "no": 65,
    "city": "四街道市",
    "roadType": "市道",
    "route": "四街道市 四街道鹿渡線",
    "name": "四街道市鹿渡1046-1地先(みのり町アンダーパス)",
    "lat": 35.666164,
    "lng": 140.170547,
    "accuracy": "住所（番地）の代表点",
    "precise": true
  },
  {
    "id": "road-66",
    "no": 66,
    "city": "我孫子市",
    "roadType": "県道",
    "route": "船橋我孫子線",
    "name": "柴崎(天王谷ランプ)",
    "lat": 35.877205,
    "lng": 140.034195,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-67",
    "no": 67,
    "city": "習志野市",
    "roadType": "県道",
    "route": "幕張八千代線",
    "name": "実籾(実籾アンダーパス)",
    "lat": 35.688072,
    "lng": 140.065826,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-68",
    "no": 68,
    "city": "市川市",
    "roadType": "市道",
    "route": "市川市 0131号線",
    "name": "八幡1丁目",
    "lat": 35.720284,
    "lng": 139.932526,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-72",
    "no": 72,
    "city": "市川市",
    "roadType": "国道(国管理)",
    "route": "298号",
    "name": "北国分(小塚山トンネル)",
    "lat": 35.758881,
    "lng": 139.905197,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-73",
    "no": 73,
    "city": "市川市",
    "roadType": "国道(国管理)",
    "route": "298号",
    "name": "菅野(菅野トンネル)",
    "lat": 35.72784,
    "lng": 139.925934,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-74",
    "no": 74,
    "city": "松戸市",
    "roadType": "国道(国管理)",
    "route": "298号(側道)",
    "name": "千葉県松戸市小山",
    "lat": 35.77317,
    "lng": 139.894501,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-77",
    "no": 77,
    "city": "流山市",
    "roadType": "県道",
    "route": "守谷流山線",
    "name": "流山市おおたかの森西4丁目",
    "lat": 35.874409,
    "lng": 139.919556,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-79",
    "no": 79,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 松波新港線",
    "name": "中央区春日1、2丁目(春日地下道)",
    "lat": 35.619396,
    "lng": 140.103928,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-80",
    "no": 80,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 登戸44号線",
    "name": "中央区汐見丘町(商高前地下道)",
    "lat": 35.617069,
    "lng": 140.10582,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-81",
    "no": 81,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 弁天27号線",
    "name": "中央区富士見1丁目(弁天地下道)",
    "lat": 35.612537,
    "lng": 140.117218,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-82",
    "no": 82,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 新町若松町線",
    "name": "中央区新町・富士見1丁目(駅前地下道)",
    "lat": 35.610493,
    "lng": 140.113434,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-83",
    "no": 83,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 寒川町20・千葉寺町70号線",
    "name": "中央区寒川町3丁目(寒川・稲荷地下道)",
    "lat": 35.592529,
    "lng": 140.122787,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-84",
    "no": 84,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 西千葉駅稲荷町線",
    "name": "中央区稲荷町3丁目(末広地下道)",
    "lat": 35.586319,
    "lng": 140.126495,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-85",
    "no": 85,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 蘇我町線",
    "name": "中央区蘇我2、3、4、5丁目(蘇我町線地下道)",
    "lat": 35.571819,
    "lng": 140.131607,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-86",
    "no": 86,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 村田町10号線",
    "name": "中央区村田町(村田町JR内房線地下道)",
    "lat": 35.549427,
    "lng": 140.129715,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-87",
    "no": 87,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 千葉港黒砂台線",
    "name": "中央区新千葉1、2丁目、新町、登戸2丁目",
    "lat": 35.612926,
    "lng": 140.113693,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-88",
    "no": 88,
    "city": "千葉市",
    "roadType": "国道(国管理)",
    "route": "16号",
    "name": "中央区村田町(村田町アンダーパス)",
    "lat": 35.549427,
    "lng": 140.129715,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-89",
    "no": 89,
    "city": "千葉市",
    "roadType": "県道(市管理)",
    "route": "千葉市 千葉鎌ヶ谷松戸線",
    "name": "花見川区幕張町4丁目(幕張昆陽地下道)",
    "lat": 35.667072,
    "lng": 140.057922,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-90",
    "no": 90,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 幕張366号線",
    "name": "花見川区幕張町5丁目(武石地下道)",
    "lat": 35.655067,
    "lng": 140.056351,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-91",
    "no": 91,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 新港穴川線",
    "name": "美浜区幸町2丁目~稲毛区穴川3丁目(新港穴川線地下道)",
    "lat": 35.621826,
    "lng": 140.091583,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-92",
    "no": 92,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 桜木町13号線",
    "name": "若葉区若松町・桜木北1、2丁目(滑橋地下道)",
    "lat": 35.644627,
    "lng": 140.164902,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-93",
    "no": 93,
    "city": "千葉市",
    "roadType": "市道",
    "route": "千葉市 おゆみ野東南部5号線",
    "name": "緑区おゆみ野3丁目・鎌取町(鎌取地下道)",
    "lat": 35.560665,
    "lng": 140.176941,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  },
  {
    "id": "road-94",
    "no": 94,
    "city": "千葉市",
    "roadType": "国道(国管理)",
    "route": "357号(東京湾岸道路)",
    "name": "中央区千葉港~中央区問屋町",
    "lat": 35.606827,
    "lng": 140.106308,
    "accuracy": "町丁目の代表点（数百m〜1km以上ずれることがある）",
    "precise": false
  }
];

const locationAliases = [
  {
    patterns: ["やわたパレット", "八幡パレット"],
    title: "やわたパレット（市原市八幡総合市民センター）",
    query: "千葉県市原市八幡1050-3",
    confidence: 0.94,
    reason: "市原市広報に掲載された正式名称・所在地と『白金通り』の記述が一致",
    sourceUrl: "https://prdurbanosichapp1.blob.core.windows.net/common-article/6973379d8dbe435020068490/2026_2_seikatujouhou_16-17_kouhouichihara_web.pdf"
  }
];

const demoRecords = [
  {
    id: "demo-1",
    title: "道路冠水のSNS候補",
    category: "road_flood",
    locationName: "木下駅北側周辺 サンプル",
    lat: 35.8372,
    lng: 140.1482,
    observedAt: "2026-08-13T08:40",
    sourceType: "sns",
    sourceUrl: "",
    status: "unconfirmed",
    severity: "medium",
    passability: "impassable",
    passabilityMode: "all",
    passabilityCheckedAt: "2026-08-13T08:40",
    roadDirection: "both",
    roadGeometry: [[35.83705, 140.1477], [35.8374, 140.1488]],
    photoStatus: "has-photo",
    photoUrl: "SNS画像URLを庁内台帳へ転記",
    photoPrivacy: "internal",
    assignedTo: "道路管理",
    notes: "デモデータです。実被害ではありません。投稿位置と道路冠水注意箇所の近接を確認する想定。",
    hazardFlags: { flood: false, inland: true, road: true, landslide: false }
  },
  {
    id: "demo-2",
    title: "低地で浸水通報",
    category: "inundation",
    locationName: "発作地区周辺 サンプル",
    lat: 35.8264,
    lng: 140.1584,
    observedAt: "2026-08-13T09:15",
    sourceType: "citizen",
    sourceUrl: "",
    status: "corroborated",
    severity: "high",
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: "防災課",
    notes: "デモデータです。複数通報があるが写真未確認、現地確認依頼に回す想定。",
    hazardFlags: { flood: true, inland: true, road: false, landslide: false }
  },
  {
    id: "demo-3",
    title: "ハザード外の冠水候補",
    category: "road_flood",
    locationName: "千葉ニュータウン中央駅南側 サンプル",
    lat: 35.8005,
    lng: 140.1166,
    observedAt: "2026-08-13T10:05",
    sourceType: "web",
    sourceUrl: "",
    status: "unconfirmed",
    severity: "low",
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: "確認待ち",
    notes: "デモデータです。ハザード一致が弱い地点を想定外候補として扱う例。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false }
  }
];

let records = loadRecords();
let searchLog = loadSearchLog();
let selectedId = null;
let clickAddMode = false;
let roadDrawingMode = false;
let roadDrawingPoints = [];
let roadDrawingOriginal = [];
let locationPickRecordId = null;
let locationContactRecordId = null;
let apiResultItems = [];
let collectorLocationCandidate = null;
let recordFormLocationCandidate = null;
let locationSearchContext = { source: "collector", recordId: null, candidates: [] };
let sharedRecordsSyncTimer = null;
let snsMonitorItems = [];
let snsMonitorPayload = null;
let snsMonitorTimer = null;
let officialShelters = [];
let shelterPayload = null;
let shelterTimer = null;
let selectedShelterId = null;

// ============================================================
// 避難所開設の手動入力（市長SNS・公式LINE等の本文貼り付け）
// 公式APIの反映が遅い場合の補完。この端末のLocalStorageにのみ保存し、
// 公式判定（防災速報照合）とはバッジ・出典表示で明確に区別する。
// ============================================================
const SHELTER_MANUAL_KEY = "cbi-disaster-shelter-manual-v1";
let shelterManualOverrides = loadShelterManualOverrides();
let shelterPasteCandidates = [];
let editingManualShelterId = null;  // 手動入力一覧でインライン編集中の施設ID

function loadShelterManualOverrides() {
  try {
    const raw = localStorage.getItem(SHELTER_MANUAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveShelterManualOverrides() {
  localStorage.setItem(SHELTER_MANUAL_KEY, JSON.stringify(shelterManualOverrides));
}

// 手動入力を優先した実効開設状態。manual が null なら公式判定のまま
function effectiveShelterOpening(shelter) {
  const manual = normalizeManualEntry(shelterManualOverrides[shelter.id]);
  const official = shelter.openingStatus || "not-announced";
  // 手動入力は「公式の反映が遅いときの補完」なので、市が開設・閉鎖を明示したら公式を優先する。
  // これをしないと、公式発表後も古い手動入力（入力時刻のまま）が表示され続けて情報が古く見える
  if (official !== "not-announced") {
    return { status: official, manual: null, supersededManual: manual };
  }
  // 「１６時、すべての避難所を閉鎖します」のように施設名を挙げない放送は、
  // 公式には施設ごとの判定にならない。放送より前に入力された手動の「開設中」は
  // その時点で無効になったものとして扱う（古い開設中が残り続けるのを防ぐ）。
  const blanket = shelterPayload && shelterPayload.blanketClosure;
  if (blanket && manual && manual.status === "open") {
    const closedAt = Date.parse(String(blanket.publishedAt || "").replace(/-/g, "/"));
    const confirmedAt = Date.parse(manual.confirmedAt || "");
    if (Number.isFinite(closedAt) && (!Number.isFinite(confirmedAt) || confirmedAt < closedAt)) {
      return { status: "closed", manual: null, supersededManual: manual, blanketClosure: blanket };
    }
  }
  return { status: manual ? manual.status : official, manual };
}

// 旧形式（time 1つ）の保存データを openedTime / closedTime 形式へ読み替える
function normalizeManualEntry(manual) {
  if (!manual) return null;
  const legacyTime = manual.time || "";
  return {
    status: manual.status === "closed" ? "closed" : "open",
    openedTime: manual.openedTime !== undefined ? manual.openedTime : (manual.status === "closed" ? "" : legacyTime),
    closedTime: manual.closedTime !== undefined ? manual.closedTime : (manual.status === "closed" ? legacyTime : ""),
    source: manual.source || "",
    confirmedAt: manual.confirmedAt || ""
  };
}

function manualTimeLabel(entry) {
  const parts = [];
  if (entry.openedTime) parts.push(`開設 ${entry.openedTime}`);
  if (entry.closedTime) parts.push(`閉鎖 ${entry.closedTime}`);
  return parts.join(" → ");
}

// 貼り付け本文と避難所名を照合する。
// 「木下小」→「木下小学校」等の略記も拾えるよう、正式名と省略形の両方で探す。
function shelterNameVariants(name) {
  const variants = new Set([name]);
  variants.add(name.replace(/小学校$/, "小"));
  variants.add(name.replace(/中学校$/, "中"));
  variants.add(name.replace(/公民館$/, "公民館"));
  variants.add(name.replace(/^印西市立/, ""));
  return [...variants].filter(v => v.length >= 3);
}

function parseShelterPasteText(text) {
  const normalized = String(text || "").replace(/[　\t]/g, " ");
  if (!normalized.trim()) return [];
  // 文単位に割り、施設名ごとに最寄りの文から開設/閉鎖と時刻を推定する
  const segments = normalized.split(/[。\n！!]/).map(s => s.trim()).filter(Boolean);
  const results = [];
  officialShelters.forEach(shelter => {
    const variants = shelterNameVariants(shelter.name);
    let hit = null;
    for (const segment of segments) {
      const matched = variants.find(v => segment.includes(v));
      if (matched) { hit = { segment, matched }; break; }
    }
    if (!hit) return;
    const closed = /閉鎖|閉所|開設.{0,8}(終了|取りやめ)|受入.{0,6}終了/.test(hit.segment);
    const opened = /開設|開放|受け入れ|受入れ|受入開始/.test(hit.segment);
    const times = [...hit.segment.matchAll(/(\d{1,2})[:時](\d{1,2})?分?/g)]
      .map(m => `${m[1]}:${String(m[2] || "0").padStart(2, "0")}`);
    // 開設と閉鎖が同じ文にある場合は 1つ目=開設時刻、2つ目=閉鎖時刻 とみなす（プレビューで修正可能）
    const openedTime = closed && !opened ? "" : (times[0] || "");
    const closedTime = closed ? (opened ? (times[1] || "") : (times[0] || "")) : "";
    results.push({
      id: shelter.id,
      name: shelter.name,
      status: closed ? "closed" : opened ? "open" : "open",
      ambiguous: !closed && !opened,
      openedTime,
      closedTime,
      segment: hit.segment
    });
  });
  return results;
}

function renderShelterPastePreview() {
  const preview = document.getElementById("shelter-paste-preview");
  const applyButton = document.getElementById("shelter-paste-apply-button");
  if (!shelterPasteCandidates.length) {
    preview.hidden = false;
    preview.innerHTML = '<div class="detail-empty">本文から避難所名を見つけられませんでした。施設名（例: 木下小学校）が含まれているか確認してください。</div>';
    applyButton.disabled = true;
    return;
  }
  preview.hidden = false;
  preview.innerHTML = shelterPasteCandidates.map((item, index) => `
    <div class="shelter-paste-row">
      <label class="toggleRow">
        <input type="checkbox" data-paste-check="${index}" checked>
        <strong>${escapeHtml(item.name)}</strong>
      </label>
      <select data-paste-status="${index}">
        <option value="open" ${item.status === "open" ? "selected" : ""}>開設</option>
        <option value="closed" ${item.status === "closed" ? "selected" : ""}>閉鎖・終了</option>
      </select>
      <input type="text" data-paste-opened="${index}" value="${escapeAttribute(item.openedTime)}" placeholder="開設時刻 例 9:00" size="10">
      <input type="text" data-paste-closed="${index}" value="${escapeAttribute(item.closedTime)}" placeholder="閉鎖時刻 例 17:00" size="10">
      ${item.ambiguous ? '<span class="badge yellow">開設/閉鎖の語が本文になく「開設」と仮定</span>' : ""}
      <div class="shelter-paste-segment">${escapeHtml(truncateText(item.segment, 90))}</div>
    </div>
  `).join("");
  applyButton.disabled = false;
}

function applyShelterPaste() {
  const source = getFormValue("shelter-paste-source") || "その他";
  let applied = 0;
  shelterPasteCandidates.forEach((item, index) => {
    const check = document.querySelector(`[data-paste-check="${index}"]`);
    if (!check || !check.checked) return;
    const status = document.querySelector(`[data-paste-status="${index}"]`)?.value === "closed" ? "closed" : "open";
    const openedTime = String(document.querySelector(`[data-paste-opened="${index}"]`)?.value || "").trim();
    const closedTime = String(document.querySelector(`[data-paste-closed="${index}"]`)?.value || "").trim();
    const previous = normalizeManualEntry(shelterManualOverrides[item.id]);
    shelterManualOverrides[item.id] = {
      status,
      // 閉鎖の更新で開設時刻を空欄のまま反映しても、記録済みの開設時刻は消さない
      openedTime: openedTime || (previous ? previous.openedTime : ""),
      closedTime,
      source,
      confirmedAt: new Date().toISOString()
    };
    applied += 1;
  });
  if (!applied) return;
  saveShelterManualOverrides();
  renderShelters();
  renderShelterManualList();
  shelterPasteCandidates = [];
  document.getElementById("shelter-paste-preview").hidden = true;
  document.getElementById("shelter-paste-apply-button").disabled = true;
  document.getElementById("shelter-paste-text").value = "";
  // 反映結果は一覧の「手動」バッジと右上の件数表示（renderShelterManualList）で確認できる
  document.getElementById("shelter-paste-dialog").close();
}

function renderShelterManualList() {
  const container = document.getElementById("shelter-manual-list");
  const badge = document.getElementById("shelter-manual-count");
  const entries = Object.entries(shelterManualOverrides);
  if (badge) {
    badge.hidden = entries.length === 0;
    badge.textContent = entries.length ? `手動入力 ${entries.length}件` : "";
  }
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<div class="detail-empty">手動入力はありません。</div>';
    return;
  }
  container.innerHTML = entries.map(([id, rawManual]) => {
    const manual = normalizeManualEntry(rawManual);
    const shelter = officialShelters.find(item => item.id === id);
    if (editingManualShelterId === id) {
      return `
      <div class="shelter-paste-row">
        <strong>${escapeHtml(shelter?.name || id)}</strong>
        <select data-manual-edit-status="${escapeAttribute(id)}">
          <option value="open" ${manual.status === "open" ? "selected" : ""}>開設</option>
          <option value="closed" ${manual.status === "closed" ? "selected" : ""}>閉鎖・終了</option>
        </select>
        <input type="text" data-manual-edit-opened="${escapeAttribute(id)}" value="${escapeAttribute(manual.openedTime)}" placeholder="開設時刻 例 9:00" size="10">
        <input type="text" data-manual-edit-closed="${escapeAttribute(id)}" value="${escapeAttribute(manual.closedTime)}" placeholder="閉鎖時刻 例 17:00" size="10">
        <button type="button" class="text-button" data-manual-save="${escapeAttribute(id)}">保存</button>
        <button type="button" class="text-button" data-manual-cancel>キャンセル</button>
      </div>`;
    }
    const timeLabel = manualTimeLabel(manual);
    return `
      <div class="shelter-paste-row">
        <strong>${escapeHtml(shelter?.name || id)}</strong>
        <span class="badge ${manual.status === "open" ? "green" : "gray"}">${manual.status === "open" ? "開設" : "閉鎖"}（手動）</span>
        <span>${escapeHtml(timeLabel ? `${timeLabel} ・ ` : "")}${escapeHtml(manual.source || "")} / ${escapeHtml(formatDateTime(toDateTimeLocal(manual.confirmedAt)))}確認</span>
        <button type="button" class="text-button" data-manual-edit="${escapeAttribute(id)}">編集</button>
        <button type="button" class="text-button" data-manual-remove="${escapeAttribute(id)}">解除</button>
      </div>`;
  }).join("");
}

function findManualEditField(kind, id) {
  return [...document.querySelectorAll(`[data-manual-edit-${kind}]`)]
    .find(node => node.getAttribute(`data-manual-edit-${kind}`) === id) || null;
}

function handleShelterManualListClick(event) {
  const editButton = event.target.closest("[data-manual-edit]");
  if (editButton) {
    editingManualShelterId = editButton.dataset.manualEdit;
    renderShelterManualList();
    return;
  }
  if (event.target.closest("[data-manual-cancel]")) {
    editingManualShelterId = null;
    renderShelterManualList();
    return;
  }
  const saveButton = event.target.closest("[data-manual-save]");
  if (saveButton) {
    const id = saveButton.dataset.manualSave;
    const previous = normalizeManualEntry(shelterManualOverrides[id]);
    if (previous) {
      shelterManualOverrides[id] = {
        status: findManualEditField("status", id)?.value === "closed" ? "closed" : "open",
        openedTime: String(findManualEditField("opened", id)?.value || "").trim(),
        closedTime: String(findManualEditField("closed", id)?.value || "").trim(),
        source: previous.source,
        confirmedAt: new Date().toISOString()
      };
      saveShelterManualOverrides();
    }
    editingManualShelterId = null;
    renderShelters();
    renderShelterManualList();
    return;
  }
  const button = event.target.closest("[data-manual-remove]");
  if (!button) return;
  if (editingManualShelterId === button.dataset.manualRemove) editingManualShelterId = null;
  delete shelterManualOverrides[button.dataset.manualRemove];
  saveShelterManualOverrides();
  renderShelters();
  renderShelterManualList();
}
let screenshotState = {
  image: null,
  scale: 1,
  crop: null,
  dragging: false,
  start: null,
  locationCandidate: null,
  relativeTime: null,
  gpsInspectionState: "not-checked",
  autoGpsRecordId: null
};

const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true
}).fitBounds(INZAI_BOUNDS);

// 「範囲外を伏せる」表示モード用の面。ピン（markerPane 600）より上に置いて
// 範囲外のピンもまとめて伏せる。ポップアップ（700）より下なので操作は妨げない。
map.createPane("maskPane");
map.getPane("maskPane").style.zIndex = 640;
map.getPane("maskPane").style.pointerEvents = "none";
// 冠水した道路（みんつく・実績）は事実なので、通れた道（GPS記録）と重なる場所では赤を上に描く
map.createPane("passedRoadsPane");
map.getPane("passedRoadsPane").style.zIndex = 440;
// 堤防の決壊地点と浸水範囲（公式の推定）。面が広いので、市民記録の線（440・450）より下に置く
map.createPane("leveeBreachPane");
map.getPane("leveeBreachPane").style.zIndex = 435;
// CBI の浸水の試算。公式の推定（435）の上・市民記録の線（440）の下。
// 下に置くと 3.0〜3.5m では公式の灰色に隠れて見えなかったので、上に置いて塗りを薄くした（2026-09-23）
map.createPane("leveeSimPane");
map.getPane("leveeSimPane").style.zIndex = 437;
// 決壊地点の✕は試算の面より上（面の下だと押せない）
map.createPane("leveeBreachMarkPane");
map.getPane("leveeBreachMarkPane").style.zIndex = 438;
map.createPane("kansuiPane");
map.getPane("kansuiPane").style.zIndex = 450;

// ⚠ この2つの層は SVG で描く（2026-09-21）。地図全体は preferCanvas: true だが、canvas のままだと
// 各 pane の canvas が画面いっぱいに広がり、上にある冠水（450）の canvas が下の「通れた道」（440）の
// クリックを全部吸ってしまう（elementFromPoint で実測。一覧からしかポップアップを開けなかった）。
// SVG なら線のある場所だけがクリックを受け、外れた場所は下の層へ通る。
// 本数が多い「道路の冠水リスク」（22,902本）は canvas のまま＝最下層なので邪魔をしない。
const passedRoadsRenderer = L.svg({ pane: "passedRoadsPane" });
const kansuiRenderer = L.svg({ pane: "kansuiPane" });
// 鉄道の運休・遅れ区間。既定OFFで、ONにした人には冠水の線より上に見せる。
// 専用の面に置かないと、道路の冠水リスク層（同じ面の canvas）がクリックを拾ってしまい
// ポップアップが開かない。
map.createPane("railStatusPane");
map.getPane("railStatusPane").style.zIndex = 460;
map.createPane("roadClosuresPane");
map.getPane("roadClosuresPane").style.zIndex = 462;
// 停電の円（2026-09-22・東電の許可待ち）。冠水の線より上、運休の線と同じ高さ
map.createPane("teidenPane");
map.getPane("teidenPane").style.zIndex = 465;

const baseLayers = {
  pale: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地理院タイル",
    maxZoom: 18
  }),
  std: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
    attribution: "地理院タイル",
    maxZoom: 18
  }),
  photo: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", {
    attribution: "地理院タイル",
    maxZoom: 18
  })
};

const hazardLayers = {
  // 色別標高図。低い土地ほど青〜緑で描かれる。
  // 内水氾濫はハザード想定区域の外でも起きるため（2026年8月の千葉豪雨では
  // 浸水報告の55.7%が想定区域外・ウェザーニューズ社調査）、
  // 「周囲より低い場所」を平面で把握する手掛かりとして重ねられるようにする。
  relief: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png", {
    attribution: "地理院タイル（色別標高図）",
    opacity: 0.56,
    maxZoom: 15
  }),
  floodMax: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  floodPlan: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  inland: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  // 以下3つは 2026-09-09 追加。ハザードマップポータルの全国タイルのうち、
  // 印西市域にデータがあることを実測で確認したもの（z13・市域42区画あたりの存在数）。
  // 浸水継続時間 41/42、家屋倒壊（氾濫流）18/42、家屋倒壊（河岸侵食）11/42。
  // 高潮・津波は 0/42（内陸のため）なので追加していない。
  floodKeizoku: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_keizoku_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  kaokuHanran: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_hanran_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  kaokuKagan: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_kagan_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  // 国土地理院の治水地形分類図。土地の成り立ち（氾濫平野・後背湿地・旧河道・
  // 自然堤防など）を示した図で、標高だけでは分からない「昔から水が集まってきた土地か」
  // が読み取れる。2026-09-07にみんつくの冠水実績と突き合わせたところ、
  // 現河道・水面 4.35倍、後背湿地 1.62倍、微高地（自然堤防）0.12倍、山地 0.09倍と、
  // 物理的に納得できる並びになった。
  // ただし一級河川沿いが対象で、印西市の冠水報告地点の74.7%は整備範囲の外だった。
  // そのため CBI の推定モデルには組み込まず、参考レイヤーとして重ねるだけにしている。
  landformFc: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/lcmfc2/{z}/{x}/{y}.png", {
    attribution: '<a href="https://www.gsi.go.jp/bousaichiri/fc_index.html" target="_blank" rel="noreferrer">治水地形分類図（国土地理院）</a>',
    opacity: 0.56,
    maxZoom: 16,
    maxNativeZoom: 16
  })
};

const jshisLayers = {
  jshisPshm: L.tileLayer.wms(String(APP_CONFIG.jshisPshmWmsUrl || "https://www.j-shis.bosai.go.jp/map/wms/pshm/Y2024"), {
    layers: "P-Y2024-MAP-AVR-TTL_MTTL-T30_I55_PS",
    styles: "default",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    crs: L.CRS.EPSG3857,
    attribution: '<a href="https://www.j-shis.bosai.go.jp/" target="_blank" rel="noreferrer">J-SHIS（防災科研）</a>',
    opacity: 0.56,
    zIndex: 440,
    updateWhenIdle: true
  }),
  jshisGround: L.tileLayer.wms(String(APP_CONFIG.jshisGroundWmsUrl || "https://www.j-shis.bosai.go.jp/map/wms/sstrct/V4"), {
    layers: "Z-V4-JAPAN-AMP-VS400_M250-IDARV2",
    styles: "default",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    crs: L.CRS.EPSG3857,
    attribution: '<a href="https://www.j-shis.bosai.go.jp/" target="_blank" rel="noreferrer">J-SHIS（防災科研）</a>',
    opacity: 0.56,
    zIndex: 441,
    updateWhenIdle: true
  })
};

const jshisLayerMeta = {
  jshisPshm: { statusId: "jshis-pshm-status", idle: "2024年版・将来予測" },
  jshisGround: { statusId: "jshis-ground-status", idle: "V4・250mメッシュ" }
};

const rainNowcastLayer = L.tileLayer("", {
  attribution: "気象庁 高解像度降水ナウキャスト",
  opacity: 0.62,
  maxNativeZoom: 10,
  maxZoom: 18,
  zIndex: 450,
  updateWhenIdle: true
});
let rainNowcastTime = null;

// キキクル（気象庁 危険度分布）。雨雲レーダーと同じ jmatile 配信で、土砂・浸水・洪水の3要素。
// WOUDIOの観光防災マップ（2026-08-28 参照依頼）が表示していたのも同じデータ。
const KIKIKURU_ELEMENTS = {
  kikikuruLand: { element: "land", label: "土砂キキクル" },
  kikikuruInund: { element: "inund", label: "浸水キキクル" },
  kikikuruFlood: { element: "flood", label: "洪水キキクル" }
};
const kikikuruLayers = {};
Object.keys(KIKIKURU_ELEMENTS).forEach(key => {
  kikikuruLayers[key] = L.tileLayer("", {
    attribution: "気象庁 キキクル（危険度分布）",
    opacity: 0.62,
    maxNativeZoom: 10,
    maxZoom: 18,
    zIndex: 455,
    updateWhenIdle: true
  });
});

async function refreshKikikuru(showLayer) {
  const status = document.getElementById("kikikuru-layer-status");
  try {
    const response = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/risk/targetTimes.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = await response.json();
    const latest = Array.isArray(times)
      ? times.find(item => item?.basetime && item?.validtime && item?.member && item?.elements?.includes("land"))
      : null;
    if (!latest) throw new Error("最新時刻がありません");
    Object.entries(KIKIKURU_ELEMENTS).forEach(([key, def]) => {
      const template = `https://www.jma.go.jp/bosai/jmatile/data/risk/${latest.basetime}/${latest.member}/${latest.validtime}/surf/${def.element}/{z}/{x}/{y}.png`;
      kikikuruLayers[key].setUrl(template, false);
    });
    if (status) {
      status.textContent = `${formatJmaTime(latest.validtime)}時点・5分更新`;
      status.classList.remove("is-error");
    }
    Object.keys(KIKIKURU_ELEMENTS).forEach(key => {
      const enabled = document.querySelector(`[data-overlay="${key}"]`)?.checked;
      if (enabled && !map.hasLayer(kikikuruLayers[key])) kikikuruLayers[key].addTo(map);
    });
  } catch (error) {
    if (status) {
      status.textContent = "取得できません";
      status.classList.add("is-error");
    }
    if (showLayer) {
      appendSystemWorkLog("キキクルレイヤー", "blocked", `気象庁キキクルの最新配信を取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁配信URLを確認する");
    }
  }
}

// ⚠ 2026-09-09 修正：3本とも `_data` 付きのURLで、全タイルが404だった（印西市域42区画すべて）。
// つまりこのレイヤーをONにしても何も表示されていなかった。
// `_data` 付きは都道府県別（.../12/{z}/{x}/{y}.png）の階層で、全国版には `_data` が付かない。
// 修正後の実測（z13・市域42区画）：急傾斜地 42/42、土石流 0/42、地すべり 0/42。
// 土石流・地すべりは印西市に指定区域が存在しないため何も描かれないが、
// 他市へ展開したときにそのまま使えるようレイヤーは残してある（画面側に「印西市には該当なし」と明記）。
const landslideGroup = L.layerGroup([
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  })
]);

// 「範囲外を伏せる」表示モード（2026-09-09追加）。
// CBI独自シミュレーションは市境ではなく矩形で計算しているため、オレンジの四角が
// 白井市・船橋市まではみ出して「そこまでが対象」と誤読される。
// 世界全体を覆うポリゴンに、見せたい範囲だけ穴を空けて薄い幕をかける。
// 穴あきポリゴンは L.polygon([外周, 穴]) で作れる（SVG の evenodd 塗り）。
const WORLD_RING = [[-89.9, -359.9], [-89.9, 359.9], [89.9, 359.9], [89.9, -359.9]];
// simulation-data/status.json の area.bounding_box と同じ値。変えるときは両方直すこと。
const SIM_BOUNDS = { north: 35.93003327846164, south: 35.64, east: 140.4004115529679, west: 139.98 };
const MASK_STYLE = { stroke: false, fillColor: "#f2f6f8", fillOpacity: 0.86, interactive: false, pane: "maskPane" };
const maskRectLayer = L.polygon([
  WORLD_RING,
  [[SIM_BOUNDS.south, SIM_BOUNDS.west], [SIM_BOUNDS.south, SIM_BOUNDS.east], [SIM_BOUNDS.north, SIM_BOUNDS.east], [SIM_BOUNDS.north, SIM_BOUNDS.west]]
], MASK_STYLE);
// 見せる範囲の輪郭。幕だけだと境目が分かりにくいため細い線を添える
const maskRectOutline = L.rectangle(
  [[SIM_BOUNDS.south, SIM_BOUNDS.west], [SIM_BOUNDS.north, SIM_BOUNDS.east]],
  { color: "#c96321", weight: 1.5, dashArray: "6 4", fill: false, interactive: false, pane: "maskPane" }
);
const maskRectGroup = L.layerGroup([maskRectLayer, maskRectOutline]);
// 市域の幕は境界データの取得後に作る（initBoundary から呼ぶ）
const maskCityGroup = L.layerGroup();
let maskCityReady = false;

function buildCityMask(geojson) {
  const rings = [];
  const walk = value => {
    if (!Array.isArray(value)) return;
    if (value.length && Array.isArray(value[0]) && typeof value[0][0] === "number") {
      rings.push(value.map(p => [p[1], p[0]]));   // [lon,lat] → [lat,lng]
      return;
    }
    value.forEach(walk);
  };
  (geojson.features || [geojson]).forEach(f => walk(f.geometry?.coordinates));
  if (!rings.length) return;
  maskCityGroup.clearLayers();
  maskCityGroup.addLayer(L.polygon([WORLD_RING, ...rings], MASK_STYLE));
  rings.forEach(ring => {
    maskCityGroup.addLayer(L.polyline(ring, { color: "#2365a8", weight: 1.5, fill: false, interactive: false, pane: "maskPane" }));
  });
  maskCityReady = true;
}

const recordLayer = L.layerGroup();
const roadFloodLayer = L.layerGroup();
const roadDrawingLayer = L.layerGroup();
const shelterLayer = L.layerGroup();
// 公式発表タイムライン（initTimeline は起動時に呼ばれるため、宣言は必ずこの位置より前に置く）
let timelinePayload = null;
let timelineTimer = null;
const TIMELINE_TRUST_LABEL = { official: "公式", "semi-official": "準公式", unverified: "未確認" };
const TIMELINE_CHANGE_LABEL = { update: "更新", cancel: "取消・解除" };
const PRESENCE_SESSION_KEY = "cbi-disaster-presence-session-v1";
let presenceTimer = null;
const wellLayer = L.layerGroup();
let officialWells = [];
let wellPayload = null;
const bunkazaiLayer = L.layerGroup();   // 平時参考: 文化財（メタバースと同じ bunkazai.json）
const kominkanLayer = L.layerGroup();   // 平時参考: 公民館・交流館・文化ホール（kominkan.json）
const pastFloodLayer = L.layerGroup();  // 過去の冠水実績（past-flood-points.json・対象日フィルタの対象外）
const boundaryLayer = L.geoJSON(null, {
  style: {
    color: "#2365a8",
    weight: 2,
    fillColor: "#2365a8",
    fillOpacity: 0.05,
    dashArray: "7 5"
  }
});

baseLayers.pale.addTo(map);
// 内水浸水想定は 2026-09-09 の照合で、市の公式内水ハザードマップの代わりにならないと
// 分かったため既定OFFにした（市の想定区域6,537件のうち82.1%はこのタイルが存在しない
// 場所にあり、浸水深1m以上では87%が欠けている）。チェック欄の ⓘ に理由を書いてある。
roadDrawingLayer.addTo(map);
boundaryLayer.addTo(map);
// 最初に出す冠水レイヤーはファイル末尾の initInitialOverlays() で入れる
// （kansuiLayer などの const 宣言がこの行より後ろにあり、ここでは触れないため）

// 対象日はHTMLに固定値を書かず、開いた日（日本時間）を既定にする。
// 2026-09-06 まで value="2026-08-13" が埋め込まれており、市民が開くと8月の日付のまま
// 「本日の発表はありません」と見えていた。過去の記録は日付を選び直せば従来どおり見られる
(function initIncidentDate() {
  const input = document.getElementById("incident-date");
  if (input && !input.value) input.value = todayJst();
})();

initBoundary();
refreshRainNowcast(false);
refreshWeatherWarnings(false);
refreshEarthquakeSummary(false);
initTimeline();
initQuickNav();
refreshAmedas(false);
refreshRiverLevel(false);
refreshEvacAlert();
refreshRainForecast(false);
renderRoadFloodSites();
initIntegration();
applyTrialRecordFromQuery();
renderAll();
bindEvents();
initSnsMonitor();
initShelters();
initHelpGuide();
initMapLegend();
initRecordRange();
initMapStatusAutoHide();
initPlaceSearch();
initRecordEvents();
initColorGuide();
initRainPanel();
initHazardCheck();
initModeration();
scheduleMapResize();

function bindEvents() {
  document.getElementById("base-layer-select").addEventListener("change", event => {
    Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
    baseLayers[event.target.value].addTo(map);
  });

  document.querySelectorAll("[data-overlay]").forEach(input => {
    input.addEventListener("change", () => {
      toggleOverlay(input.dataset.overlay, input.checked);
      syncMapLegend();
    });
  });

  document.getElementById("hazard-opacity").addEventListener("input", event => {
    const opacity = Number(event.target.value) / 100;
    document.getElementById("hazard-opacity-value").textContent = `${event.target.value}%`;
    Object.values(hazardLayers).forEach(layer => layer.setOpacity(opacity));
    Object.values(jshisLayers).forEach(layer => layer.setOpacity(opacity));
    landslideGroup.eachLayer(layer => layer.setOpacity(opacity));
    rainNowcastLayer.setOpacity(opacity);
  });

  document.getElementById("reset-view-button").addEventListener("click", () => map.fitBounds(INZAI_BOUNDS));
  document.getElementById("incident-date").addEventListener("change", () => {
    selectedId = null;
    renderAll();
    refreshSnsMonitor(false);
    refreshTimeline(false);
    // 「本日（＝対象日）」の判定が変わるので、冠水の色分けも描き直す
    renderKansuiLayer();
    renderPassedRoadsLayer();
  });
  document.getElementById("timeline-days").addEventListener("change", () => refreshTimeline(false));
  document.getElementById("refresh-timeline-button").addEventListener("click", () => refreshTimeline(true));
  document.getElementById("timeline-list").addEventListener("click", handleTimelineListClick);
  document.getElementById("past-flood-dates")?.addEventListener("change", handlePastFloodDateChange);
  document.getElementById("past-flood-dates")?.addEventListener("click", (e) => { if (e.target.closest("[data-past-flood-all]")) handlePastFloodDateChange(e); });
  document.getElementById("show-all-dates").addEventListener("change", () => {
    selectedId = null;
    renderAll();
  });
  document.getElementById("print-button").addEventListener("click", () => window.print());
  document.getElementById("sns-collector-button").addEventListener("click", openCollectorDialog);
  document.getElementById("help-button").addEventListener("click", openHelpDialog);
  document.getElementById("official-links-button").addEventListener("click", openOfficialLinksDialog);
  document.getElementById("help-start-button").addEventListener("click", startFromHelp);
  document.getElementById("register-social-link-button").addEventListener("click", registerSocialLink);
  document.getElementById("collector-location-search-button").addEventListener("click", () => openLocationSearchDialog({ source: "collector" }));
  document.getElementById("record-location-search-button").addEventListener("click", () => openLocationSearchDialog({ source: "record-form" }));
  document.getElementById("free-location-search-button").addEventListener("click", runFreeLocationSearch);
  document.getElementById("ai-location-search-button").addEventListener("click", runAiLocationSearch);
  document.getElementById("location-candidate-results").addEventListener("click", handleLocationCandidateAction);
  ["location-search-post-text", "location-search-comments", "location-search-hint"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateLocationWebSearchLink);
  });
  document.getElementById("refresh-earthquake-button").addEventListener("click", () => refreshEarthquakeSummary(true));
  document.getElementById("refresh-amedas-button")?.addEventListener("click", () => refreshAmedas(true));
  document.getElementById("refresh-river-button")?.addEventListener("click", () => refreshRiverLevel(true));
  document.getElementById("river-alert")?.addEventListener("click", handleMapAlertClick);
  document.getElementById("refresh-weather-warning-button").addEventListener("click", () => refreshWeatherWarnings(true));
  document.getElementById("refresh-sns-monitor-button").addEventListener("click", () => refreshSnsMonitor(true));
  document.getElementById("sns-monitor-list").addEventListener("click", handleSnsMonitorAction);
  document.getElementById("sns-manual-register-button").addEventListener("click", registerManualMonitorUrl);
  document.getElementById("refresh-shelters-button").addEventListener("click", () => refreshShelters(true));
  document.getElementById("show-shelter-flood-button").addEventListener("click", showShelterFloodLayers);
  document.getElementById("shelter-hazard-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-kind-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-opening-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-keyword-filter").addEventListener("input", renderShelters);
  document.getElementById("shelter-list").addEventListener("click", handleShelterListClick);
  document.getElementById("shelter-paste-button").addEventListener("click", () => {
    renderShelterManualList();
    document.getElementById("shelter-paste-dialog").showModal();
  });
  document.getElementById("shelter-paste-parse-button").addEventListener("click", () => {
    shelterPasteCandidates = parseShelterPasteText(document.getElementById("shelter-paste-text").value);
    renderShelterPastePreview();
  });
  document.getElementById("shelter-paste-apply-button").addEventListener("click", applyShelterPaste);
  document.getElementById("shelter-manual-list").addEventListener("click", handleShelterManualListClick);
  document.getElementById("shelter-manual-clear-button").addEventListener("click", () => {
    shelterManualOverrides = {};
    saveShelterManualOverrides();
    renderShelters();
    renderShelterManualList();
  });
  document.getElementById("paste-social-link-button").addEventListener("click", pasteSocialLink);
  document.getElementById("collector-post-url").addEventListener("input", syncCollectorPlatformFromUrl);
  // X の投稿URLを直接貼った場合も、本文・時刻・写真を自動で入れる（同じURLは1回だけ）
  let lastFetchedXUrl = "";
  document.getElementById("collector-post-url").addEventListener("input", event => {
    const url = event.target.value.trim();
    if (url === lastFetchedXUrl || !parseXStatusUrl(url)) return;
    lastFetchedXUrl = url;
    fillCollectorFromXUrl(url);
  });
  document.getElementById("collector-platform").addEventListener("change", updateCollectorPlatformHelp);
  document.querySelectorAll('[name="collector-search-mode"]').forEach(input => {
    input.addEventListener("change", updateCollectorPlatformHelp);
  });
  document.getElementById("cancel-location-pick-button").addEventListener("click", cancelLocationPick);
  document.getElementById("ask-comment-button").addEventListener("click", () => beginLocationContact("comment"));
  document.getElementById("ask-dm-button").addEventListener("click", () => beginLocationContact("dm"));
  document.getElementById("add-point-button").addEventListener("click", () => openRecordDialog());
  document.getElementById("add-road-status-button").addEventListener("click", openRoadStatusDialog);
  document.getElementById("record-road-draw-button").addEventListener("click", startRoadSectionSelection);
  document.getElementById("record-road-clear-button").addEventListener("click", clearRoadSection);
  document.getElementById("record-passability").addEventListener("change", updateRoadColorPreview);
  document.getElementById("road-draw-undo-button").addEventListener("click", undoRoadSectionPoint);
  document.getElementById("road-draw-cancel-button").addEventListener("click", cancelRoadSectionSelection);
  document.getElementById("road-draw-finish-button").addEventListener("click", finishRoadSectionSelection);
  document.getElementById("map-click-button").addEventListener("click", toggleClickAddMode);
  document.getElementById("screenshot-button").addEventListener("click", openScreenshotDialog);
  document.getElementById("use-map-center-button").addEventListener("click", useMapCenter);
  document.getElementById("record-form").addEventListener("submit", saveRecordFromForm);
  document.getElementById("delete-record-button").addEventListener("click", deleteCurrentRecord);
  document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-dialog").showModal());
  document.getElementById("import-form").addEventListener("submit", importCsv);
  document.getElementById("copy-template-button").addEventListener("click", copyCsvTemplate);
  document.getElementById("screenshot-file").addEventListener("change", loadScreenshotFile);
  document.getElementById("capture-screen-button").addEventListener("click", captureScreen);
  document.getElementById("screenshot-form").addEventListener("submit", saveScreenshotEvidence);
  document.getElementById("reset-crop-button").addEventListener("click", resetCrop);
  document.getElementById("download-crop-button").addEventListener("click", downloadCrop);
  document.getElementById("clear-screenshot-button").addEventListener("click", clearScreenshot);
  document.getElementById("run-ocr-button").addEventListener("click", runEvidenceOcr);
  document.getElementById("screenshot-dialog").addEventListener("paste", handleScreenshotPaste);
  bindScreenshotDropZone();
  document.getElementById("open-social-search-button").addEventListener("click", openSocialSearch);
  document.getElementById("to-screenshot-button").addEventListener("click", collectorToScreenshot);
  document.getElementById("api-search-button").addEventListener("click", searchViaBridge);
  document.getElementById("parse-sns-json-button").addEventListener("click", parseSnsJsonInput);
  document.getElementById("api-results").addEventListener("click", handleApiResultAction);
  document.getElementById("clear-search-log-button").addEventListener("click", clearSearchLog);
  document.querySelectorAll("[data-query]").forEach(button => {
    button.addEventListener("click", () => setFormValue("collector-query", button.dataset.query));
  });
  ["record-title", "record-location", "record-lat", "record-lng", "record-observed-at", "record-source-url"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderRecordDuplicateWarning);
  });
  ["evidence-platform", "evidence-query", "evidence-url", "evidence-observed-at", "evidence-ocr-text"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderEvidenceDuplicateWarning);
  });
  bindCropCanvas();
  document.getElementById("export-csv-button").addEventListener("click", exportCsv);
  document.getElementById("export-geojson-button").addEventListener("click", exportGeoJson);
  document.getElementById("load-demo-button").addEventListener("click", loadDemoRecords);
  document.getElementById("clear-filters-button").addEventListener("click", clearFilters);
  document.getElementById("keyword-filter").addEventListener("input", renderAll);
  document.getElementById("photo-filter").addEventListener("change", renderAll);
  document.getElementById("passability-filter").addEventListener("change", renderAll);
  document.querySelectorAll("[data-status]").forEach(input => input.addEventListener("change", renderAll));
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  // 大量データのレイヤー（土砂災害区域）は表示範囲が変わるたびに描き直す
  map.on("moveend", refreshVisibleOpenDataLayers);
  map.on("zoomend", refreshVisibleOpenDataLayers);
  map.on("click", event => {
    if (citizenRoadDraft.active) {
      addCitizenRoadPoint(event.latlng);
      return;
    }
    if (roadDrawingMode) {
      addRoadSectionPoint(event.latlng);
      return;
    }
    if (locationPickRecordId) {
      completeLocationPick(event.latlng);
      return;
    }
    if (!clickAddMode) {
      // iPhone では線そのもののタップが届かないことがあるので、近くの記録の線を探して詳細を開く
      if (!event.originalEvent?.target?.closest?.("path.leaflet-interactive")) openNearestRecordPopup(event); // 下の canvas にも leaflet-interactive が付くので path に限る
      return;
    }
    openRecordDialog({ lat: event.latlng.lat, lng: event.latlng.lng });
  });

  window.addEventListener("resize", scheduleMapResize);
  window.addEventListener("orientationchange", scheduleMapResize);
}

// タップした位置から一定の画面距離（指の太さ程度）にある、通れた道・通れない道・冠水の線／印を探し、いちばん近いものの詳細を開く
const NEAREST_RECORD_TAP_PX = 22;
function openNearestRecordPopup(event) {
  const tap = event.layerPoint;
  if (!tap) return;
  let best = null;
  const consider = layer => {
    if (!layer?.getPopup?.()) return;
    let d = Infinity;
    if (layer.getLatLngs) {
      const pts = layer.getLatLngs().flat(Infinity).map(ll => map.latLngToLayerPoint(ll));
      if (pts.length === 1) d = tap.distanceTo(pts[0]);
      for (let i = 1; i < pts.length; i++) d = Math.min(d, L.LineUtil.pointToSegmentDistance(tap, pts[i - 1], pts[i]));
    } else if (layer.getLatLng) {
      d = tap.distanceTo(map.latLngToLayerPoint(layer.getLatLng()));
    }
    if (d <= NEAREST_RECORD_TAP_PX && (!best || d < best.d)) best = { layer, d };
  };
  [passedRoadsLayer, kansuiLayer].forEach(group => { if (map.hasLayer(group)) group.eachLayer(consider); });
  if (best) best.layer.openPopup(best.layer.getLatLngs ? event.latlng : undefined);
}

// 地図の上の細い帯（#map-status）は、知らせることが無いときも「公開レイヤー接続済み・確認日…」を出し続けていて
// 地図が見にくかった（2026-09-23 事業主指摘）。待機中の文のときは隠し、意味のある知らせが入ったら出す。
// 鉄道・バスの運休など、ほかの処理がこの帯に書き込むところは触っていない
function initMapStatusAutoHide() {
  const node = document.getElementById("map-status");
  if (!node || typeof MutationObserver !== "function") return;
  const apply = () => {
    const idle = /^(公開レイヤー接続済み|地図を読み込み中)/.test((node.textContent || "").trim());
    node.classList.toggle("is-idle", idle);
    if (typeof placeRiverAlert === "function") placeRiverAlert();
  };
  new MutationObserver(apply).observe(node, { childList: true, characterData: true, subtree: true });
  apply();
}

function scheduleMapResize() {
  requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }));
  setTimeout(() => map.invalidateSize({ animate: false, pan: false }), 240);
}

function initIntegration() {
  const homeLink = document.querySelector(".cbi-home-link");
  if (homeLink && APP_CONFIG.cbiHomeUrl) homeLink.href = APP_CONFIG.cbiHomeUrl;
  if (new URLSearchParams(window.location.search).get("embed") === "1") {
    document.body.classList.add("embed-mode");
  }
  if (PUBLIC_VIEW) {
    document.body.classList.add("public-view");
    document.getElementById("operation-banner-title").textContent = "一般公開用の参考表示";
    document.getElementById("operation-banner-text").textContent = "公開承認済みの参考情報だけを表示します。救助・事件・事故は119・110へ通報し、公式情報を優先してください。";
    applyPublicViewControls();
  }
  initLayerTips();
  initPresets();
  initPassedRoadRecorder();
  initOperatorTools();

  const endpoint = String(APP_CONFIG.snsSearchEndpoint || "").trim();
  const monitorEndpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  const apiStatus = document.getElementById("api-status");
  const apiButton = document.getElementById("api-search-button");
  const apiNote = document.getElementById("collector-api-note");
  if (endpoint) {
    apiStatus.textContent = "SNS API接続設定済み";
    apiStatus.classList.add("is-connected");
    apiButton.disabled = false;
    apiNote.textContent = "CBI連携APIを通じて検索します。Metaのアクセストークンはこの画面には保存しません。";
  } else {
    apiStatus.textContent = monitorEndpoint ? "SNS自動巡回接続" : "試作・端末内保存";
    if (monitorEndpoint) apiStatus.classList.add("is-connected");
    apiButton.disabled = true;
    apiButton.title = "config.js にCBI連携APIを設定すると利用できます";
    apiNote.textContent = "現在は検索画面・スクショ・JSON取込を利用できます。公式API接続時は config.js の snsSearchEndpoint にCBI側の連携先を設定します。";
  }

  const locationAiEndpoint = String(APP_CONFIG.locationAiEndpoint || "").trim();
  const aiButton = document.getElementById("ai-location-search-button");
  if (locationAiEndpoint) {
    aiButton.disabled = false;
    aiButton.title = "CBI側のAI連携先で候補を補完します";
  } else {
    aiButton.disabled = true;
    aiButton.title = "CBI側のAI連携先を設定すると利用できます";
  }

  const operatorEndpoint = String(APP_CONFIG.operatorSessionEndpoint || "").trim();
  const operatorStatus = document.getElementById("operator-status");
  if (operatorEndpoint) {
    operatorStatus.textContent = "利用資格を確認中";
    initOperatorSession(operatorEndpoint);
  } else {
    operatorStatus.textContent = "試作利用";
  }

  window.CBIDisasterMap = {
    version: APP_CONFIG.appVersion || "",
    getRecords: () => records.map(withoutLargeImage),
    getSearchLog: () => searchLog.map(item => ({ ...item })),
    importSnsPayload: (payload, platform = "web") => consumeSnsPayload(payload, platform, "host")
  };
}

function initSnsMonitor() {
  const endpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  const panel = document.getElementById("sns-monitor-panel");
  if (!endpoint) {
    panel.hidden = true;
    return;
  }
  refreshSnsMonitor(false);
  clearInterval(snsMonitorTimer);
  snsMonitorTimer = setInterval(() => refreshSnsMonitor(true, true), 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
}

async function refreshSnsMonitor(runScan = false, quiet = false) {
  const endpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  if (!endpoint) return;
  const button = document.getElementById("refresh-sns-monitor-button");
  const status = document.getElementById("sns-monitor-status");
  if (!quiet) {
    button.disabled = true;
    status.classList.remove("is-error");
    status.textContent = runScan ? "各SNSの新着を確認しています..." : "巡回結果を読み込んでいます...";
  }
  try {
    if (runScan) {
      const scanResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "operator" })
      });
      if (!scanResponse.ok) throw new Error(`巡回API HTTP ${scanResponse.status}`);
    }
    const date = getFormValue("incident-date");
    const response = await fetch(`${endpoint}?date=${encodeURIComponent(date)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`新着API HTTP ${response.status}`);
    const payload = await response.json();
    snsMonitorItems = (Array.isArray(payload.items) ? payload.items : [])
      .map(item => normalizeSnsItem(item, item.platform || "web"))
      .filter(Boolean);
    snsMonitorPayload = payload;
    renderSnsMonitor(payload);
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = `SNS巡回結果を取得できませんでした（${error?.message || "接続エラー"}）。`;
    appendSystemWorkLog("SNS自動巡回", "blocked", status.textContent, "CIDAO巡回API、DBマイグレーション、SNS認証状態を確認する");
  } finally {
    button.disabled = false;
  }
}

function renderSnsMonitor(payload) {
  const status = document.getElementById("sns-monitor-status");
  const list = document.getElementById("sns-monitor-list");
  const count = document.getElementById("sns-monitor-new-count");
  const lastRunAt = payload?.lastRun?.finished_at || payload?.lastRun?.started_at || "";
  const lastRunStatus = payload?.lastRun?.status || "waiting";
  status.classList.toggle("is-error", lastRunStatus === "failed");
  status.textContent = lastRunAt
    ? `${formatDateTime(toDateTimeLocal(lastRunAt))} 巡回 / ${snsMonitorItems.length}件（${getFormValue("incident-date")}）`
    : "初回巡回を待っています。";

  const unregisteredCount = snsMonitorItems.filter(item => !findExactDuplicate(item)).length;
  count.textContent = String(unregisteredCount);
  count.hidden = unregisteredCount === 0;
  renderSnsPlatformStatus(payload?.platforms || []);
  renderSnsMonitorRules(payload?.rules || []);

  if (!snsMonitorItems.length) {
    list.innerHTML = '<div class="detail-empty">対象日の新着候補はありません。</div>';
    return;
  }
  // 市長・市公式の発信は災害時に最優先で確認したいので先頭へ並べ替える
  const ordered = snsMonitorItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.priorityLabel ? 1 : 0) - (a.item.priorityLabel ? 1 : 0));
  list.innerHTML = ordered.map(({ item, index }) => {
    const duplicate = findExactDuplicate(item);
    const platform = platformLabels[item.platform] || item.platform;
    return `
      <article class="sns-monitor-item ${duplicate ? "is-registered" : ""} ${item.priorityLabel ? "is-priority" : ""}">
        <a class="sns-monitor-link" href="${escapeAttribute(item.permalink)}" target="_blank" rel="noreferrer">
          <div class="sns-monitor-meta">
            <span class="sns-monitor-platform">${escapeHtml(platform)}</span>
            ${item.priorityLabel ? `<span class="sns-monitor-priority">${escapeHtml(item.priorityLabel)}</span>` : ""}
            <span>${escapeHtml(item.username ? `@${item.username}` : "投稿者不明")}</span>
            <span>${escapeHtml(formatDateTime(toDateTimeLocal(item.timestamp)))}</span>
          </div>
          <p class="sns-monitor-text">${escapeHtml(truncateText(item.text || "本文を取得できない投稿", 120))}</p>
          ${item.mediaUrl ? `<img class="sns-monitor-thumb" src="${escapeAttribute(item.mediaUrl)}" alt="${escapeAttribute(`${platform}投稿の写真`)}" loading="lazy" referrerpolicy="no-referrer">` : ""}
        </a>
        <div class="sns-monitor-actions">
          <button class="tool-button ${duplicate ? "" : "primary"}" type="button" data-monitor-index="${index}" ${duplicate ? "disabled" : ""}>${duplicate ? "登録済" : "未確認候補へ"}</button>
        </div>
      </article>`;
  }).join("");
}

function renderSnsPlatformStatus(platforms) {
  const node = document.getElementById("sns-platform-status");
  const expected = ["threads", "instagram", "bluesky"];
  const byPlatform = new Map(platforms.map(item => [item.platform, item]));
  node.innerHTML = expected.map(platform => {
    const item = byPlatform.get(platform);
    const label = platformLabels[platform] || (platform === "bluesky" ? "Bluesky" : platform);
    const state = !item ? "waiting" : item.status;
    const className = state === "success" ? "is-active" : state === "failed" ? "is-error" : "";
    const stateLabel = state === "success" ? "巡回中" : state === "failed" ? "要確認" : "待機";
    const title = item?.message ? ` title="${escapeAttribute(item.message)}"` : "";
    return `<span class="platform-state ${className}"${title}>${escapeHtml(label)} ${stateLabel}</span>`;
  }).join("");
}

function handleSnsMonitorAction(event) {
  const button = event.target.closest("[data-monitor-index]");
  if (!button) return;
  const item = snsMonitorItems[Number(button.dataset.monitorIndex)];
  if (!item) return;
  addApiResultAsRecord(item, { keepOpen: true, query: item.query || "SNS自動巡回" });
  renderSnsMonitor(snsMonitorPayload || {});
}

function renderSnsMonitorRules(rules) {
  const node = document.getElementById("sns-monitor-rules");
  const links = document.getElementById("sns-manual-search-links");
  const activeRules = (Array.isArray(rules) ? rules : []).filter(rule => rule.enabled && rule.query);
  if (!activeRules.length) {
    node.innerHTML = '<span class="detail-empty">有効な検索語はありません。</span>';
  } else {
    const grouped = new Map();
    activeRules.forEach(rule => {
      if (!grouped.has(rule.platform)) grouped.set(rule.platform, []);
      grouped.get(rule.platform).push(rule.query);
    });
    node.innerHTML = Array.from(grouped.entries()).map(([platform, queries]) => `
      <div><strong>${escapeHtml(platformLabels[platform] || platform)}</strong><span>${queries.map(escapeHtml).join(" / ")}</span></div>
    `).join("");
  }

  const manualRules = activeRules.slice(0, 9).map(rule => ({ ...rule }));
  const fallbackQuery = activeRules[0]?.query || "印西市 災害";
  manualRules.push({ platform: "facebook", query: fallbackQuery });
  links.innerHTML = manualRules.map(rule => `
    <a class="manual-search-link" href="${escapeAttribute(buildSocialSearchUrl(rule.platform, rule.query))}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(platformLabels[rule.platform] || rule.platform)}: ${escapeHtml(rule.query)}
    </a>
  `).join("");
}

function registerManualMonitorUrl() {
  const input = document.getElementById("sns-manual-post-url");
  const url = input.value.trim();
  if (!isHttpUrl(url)) {
    alert("見つけたSNS投稿のURLを入力してください。");
    input.focus();
    return;
  }
  openCollectorDialog();
  setFormValue("collector-post-url", url);
  syncCollectorPlatformFromUrl();
  const platform = detectPlatformFromUrl(url);
  const firstQuery = (snsMonitorPayload?.rules || []).find(rule => rule.enabled && (!platform || rule.platform === platform))?.query;
  if (firstQuery) setFormValue("collector-query", firstQuery);
  document.getElementById("collector-link-status").textContent = "手動巡回で見つけたURLを設定しました。分かる範囲で本文・時刻・場所を補ってください。";
  fillCollectorFromXUrl(url);
}

// ============================================================
// X（旧Twitter）の投稿URLを貼ると、本文・投稿時刻・写真を自動で入れる（2026-09-21）
// X の検索APIは有料だが、投稿1件の中身は fxtwitter（api.fxtwitter.com）が無料・認証なしで返す。
// CORS が「*」なのでブラウザから直接呼べる（サーバー・課金なし）。公開投稿のみ。
// 取得できなくても手入力はそのまま続けられる（失敗は状態文に出すだけ）。
// ============================================================
function parseXStatusUrl(url) {
  const match = String(url || "").match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/i);
  return match ? { user: match[1], id: match[2] } : null;
}

async function fillCollectorFromXUrl(url) {
  const parsed = parseXStatusUrl(url);
  if (!parsed) return;
  const status = document.getElementById("collector-link-status");
  status.textContent = "X の投稿から本文・時刻・写真を読み込んでいます…";
  try {
    const response = await fetch(`https://api.fxtwitter.com/${parsed.user}/status/${parsed.id}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const tweet = payload.tweet;
    if (!tweet) throw new Error("投稿が見つかりません（非公開・削除の可能性）");
    const text = String(tweet.text || "").trim();
    const photos = ((tweet.media && tweet.media.photos) || []).map(photo => photo.url).filter(Boolean);
    // 投稿時刻は既存の読み取り（parseCollectorPostTime）が受け付ける「YYYY/MM/DD HH:MM」で入れる
    const created = new Date((tweet.created_timestamp ? tweet.created_timestamp * 1000 : Date.parse(tweet.created_at)));
    if (Number.isFinite(created.getTime()) && !getFormValue("collector-post-time")) {
      const local = toLocalInputValue(created.getTime()).replace("T", " ").replace(/-/g, "/");
      setFormValue("collector-post-time", local);
    }
    if (text && !getFormValue("collector-post-text")) setFormValue("collector-post-text", text);
    const platform = document.getElementById("collector-platform");
    if (platform && [...platform.options].some(option => option.value === "x")) platform.value = "x";
    // 写真は位置の手がかりとして状態文に並べる（地図に自動では載せない）
    const author = tweet.author ? `${tweet.author.name}（@${tweet.author.screen_name}）` : `@${parsed.user}`;
    status.innerHTML = `X の投稿を読み込みました：${escapeHtml(author)}。本文と投稿時刻を入れました。` +
      (photos.length ? ` 写真 ${photos.length}枚：` + photos.map((src, i) => `<a href="${escapeAttribute(src)}" target="_blank" rel="noreferrer">写真${i + 1}</a>`).join("・") : "") +
      `<br><strong>場所は自動では決めません。</strong>本文の地名から「場所を探す」で確認してから保存してください。`;
    // 本文に地名があれば候補を1つ示すところまで進める（地図への確定は人がする）
    if (text) {
      const candidateStatus = document.getElementById("collector-location-candidate-status");
      suggestLocationFromOcr(text).then(candidate => {
        const name = candidate && (candidate.label || candidate.name || candidate.title || candidate.query);
        if (!name) return;
        if (!getFormValue("collector-location-note")) setFormValue("collector-location-note", name);
        if (candidateStatus) candidateStatus.textContent = `本文から場所の候補：${name}${candidate.outsideInzai ? "（印西市外）" : ""}。「場所を探す」で地図上の位置を確かめてください。`;
      }).catch(() => {});
    }
  } catch (error) {
    status.textContent = `X の投稿を自動で読み込めませんでした（${error?.message || "接続エラー"}）。本文・時刻は手で入れてください。`;
  }
}

function initShelters() {
  const endpoint = String(APP_CONFIG.shelterEndpoint || "").trim();
  if (!endpoint) {
    document.getElementById("shelter-summary").textContent = "避難所APIが未設定です。";
    return;
  }
  refreshShelters(false);
  clearInterval(shelterTimer);
  shelterTimer = setInterval(() => refreshShelters(false, true), 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
  // 災害用井戸は静的データのため初回のみ取得する
  refreshWells();
  initPresence();
}

async function refreshShelters(showStatus = false, quiet = false) {
  const endpoint = String(APP_CONFIG.shelterEndpoint || "").trim();
  if (!endpoint) return;
  const button = document.getElementById("refresh-shelters-button");
  const summary = document.getElementById("shelter-summary");
  if (!quiet) {
    button.disabled = true;
    if (showStatus) summary.textContent = "印西市の公式避難所・防災速報を更新中です。";
  }
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`避難所API HTTP ${response.status}`);
    const payload = await response.json();
    officialShelters = Array.isArray(payload.shelters) ? payload.shelters.filter(shelter => (
      Number.isFinite(Number(shelter.latitude)) && Number.isFinite(Number(shelter.longitude))
    )) : [];
    shelterPayload = payload;
    renderShelters();
    renderShelterManualList();
  } catch (error) {
    summary.classList.add("is-error");
    summary.textContent = `避難所情報を取得できませんでした（${error?.message || "接続エラー"}）。`;
  } finally {
    button.disabled = false;
  }
}

// 印西市公式オープンデータの災害用井戸（断水時の生活用水）。
// 飲用可否は公表されていないため、ポップアップでも必ずその旨を表示する。
async function refreshWells(showStatus = false) {
  const endpoint = String(APP_CONFIG.wellEndpoint || "").trim();
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`災害用井戸API HTTP ${response.status}`);
    const payload = await response.json();
    officialWells = Array.isArray(payload.wells) ? payload.wells.filter(well => (
      Number.isFinite(Number(well.latitude)) && Number.isFinite(Number(well.longitude))
    )) : [];
    wellPayload = payload;
    renderWells();
  } catch (error) {
    if (showStatus) {
      document.getElementById("map-status").textContent = `災害用井戸を取得できませんでした（${error?.message || "接続エラー"}）。`;
    }
  }
}

function renderWells() {
  wellLayer.clearLayers();
  const note = wellPayload?.usageNote || "飲用の可否は公表されていません。";
  officialWells.forEach(well => {
    const marker = L.marker([Number(well.latitude), Number(well.longitude)], {
      icon: L.divIcon({
        className: "",
        html: `<div class="well-marker" aria-label="${escapeAttribute(well.name)}"><span>井</span></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(well.name)}</div>
      <div class="shelter-popup-badges"><span class="badge blue">災害用井戸</span></div>
      ${well.address ? `<div>${escapeHtml(well.address)}</div>` : ""}
      <div class="popup-contact-note">${escapeHtml(note)}</div>
      <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
    `);
    wellLayer.addLayer(marker);
  });
}

// いまMAPを開いている人数（在席確認）。メタバースと同じCiDAOのpresence APIを使い、
// mode="disaster-map" で3Dワールド側と区別して数える。
// 送るのは端末で生成した乱数のセッションIDのみ（個人情報は送らない）。
function presenceSessionId() {
  let id = localStorage.getItem(PRESENCE_SESSION_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = `dm-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
    localStorage.setItem(PRESENCE_SESSION_KEY, id);
  }
  return id;
}

function renderPresence(count, todayCount) {
  const chip = document.getElementById("presence-chip");
  if (!chip) return;
  if (typeof count !== "number") {
    chip.textContent = "👥 人数未取得";
    chip.classList.remove("is-active");
    return;
  }
  // 今この瞬間の人数に加えて、本日このMAPを見た延べ人数（重複なし）も出す。
  // 災害時にどれだけ届いているかを運営が画面上で確認できるようにするため
  const today = Number.isFinite(todayCount) ? `・本日 ${todayCount}人` : "";
  chip.textContent = `👥 いま ${count}人が閲覧中${today}`;
  chip.classList.toggle("is-active", count > 1);
}

async function sendPresence() {
  const endpoint = String(APP_CONFIG.presenceEndpoint || "").trim();
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: presenceSessionId(), mode: "disaster-map" })
    });
    if (!response.ok) throw new Error(`presence HTTP ${response.status}`);
    const payload = await response.json();
    renderPresence(Number(payload.disasterMap ?? payload.total ?? 0), Number(payload?.today?.disasterMap));
  } catch {
    renderPresence(null);
  }
}

function initPresence() {
  if (!String(APP_CONFIG.presenceEndpoint || "").trim()) return;
  sendPresence();
  clearInterval(presenceTimer);
  // 在席とみなされるのは直近300秒（CiDAO の ACTIVE_SEC）。その半分以下の間隔で合図を送る。
  // 2026-09-23: Vercel の関数呼び出しが無料枠に達したため 40秒 → 150秒。
  // 画面を見ていない間（別のタブ・最小化）は送らず、戻ってきたときに1回送る。
  presenceTimer = setInterval(() => {
    if (document.hidden) return;
    sendPresence();
  }, 150 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sendPresence();
  });
}

// 印西市公式オープンデータの追加レイヤー（消防・警察・市役所・緊急輸送路・鉄道・市版土砂災害）。
// 国土地理院版の土砂災害レイヤーとは別に「印西市公表」として並記する。
// 指定時期のずれで境界が異なる場合があるため、どちらかに寄せず両方を出典つきで示す方針。
const OPEN_DATA_LAYERS = {
  fire: { label: "消防署", marker: "消", color: "#d9534f", zoomLimit: 0 },
  police: { label: "警察機関", marker: "警", color: "#3b6fb6", zoomLimit: 0 },
  cityOffice: { label: "市役所・支所", marker: "市", color: "#2f855a", zoomLimit: 0 },
  // 道路・鉄道は線データ（KML由来）。点で置くと路線として読めないため線で描く
  emergencyRoute: { label: "緊急輸送路", marker: "路", color: "#b7791f", zoomLimit: 0, line: { weight: 5, opacity: 0.85 } },
  railway: { label: "鉄道", marker: "鉄", color: "#4b5563", zoomLimit: 0, line: { weight: 3, opacity: 0.8, dashArray: "8 5" } },
  // 土砂災害は点数が多いため、広域表示では描画せず拡大時のみ出す（描画負荷対策）
  landslideWarning: { label: "土砂災害警戒区域（市公表）", marker: "土", color: "#c05621", zoomLimit: 13 },
  landslideSpecial: { label: "土砂災害特別警戒区域（市公表）", marker: "特", color: "#9b2c2c", zoomLimit: 13 }
};
const openDataLayers = {};
const openDataCache = {};

Object.keys(OPEN_DATA_LAYERS).forEach(key => { openDataLayers[key] = L.layerGroup(); });

async function ensureOpenDataLayer(key) {
  const base = String(APP_CONFIG.openDataEndpoint || "").trim();
  if (!base || openDataCache[key]) return;
  try {
    const response = await fetch(`${base}?set=${encodeURIComponent(key)}`, {
      headers: { Accept: "application/json" }, cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    openDataCache[key] = payload;
    renderOpenDataLayer(key);
  } catch (error) {
    document.getElementById("map-status").textContent =
      `${OPEN_DATA_LAYERS[key].label}を取得できませんでした（${error?.message || "接続エラー"}）。`;
  }
}

function renderOpenDataLayer(key) {
  const payload = openDataCache[key];
  const spec = OPEN_DATA_LAYERS[key];
  const layer = openDataLayers[key];
  if (!payload || !layer) return;
  layer.clearLayers();
  // 拡大時のみ表示する設定のレイヤーは、ズームが浅いうちは描画しない
  if (spec.zoomLimit && map.getZoom() < spec.zoomLimit) return;

  // 線データ（緊急輸送路・鉄道）はポリラインで描く
  if (spec.line && Array.isArray(payload.lines) && payload.lines.length) {
    payload.lines.forEach(line => {
      if (!Array.isArray(line.path) || line.path.length < 2) return;
      const polyline = L.polyline(line.path, {
        color: spec.color,
        weight: spec.line.weight,
        opacity: spec.line.opacity,
        dashArray: spec.line.dashArray
      });
      polyline.bindPopup(`
        <div class="popup-title">${escapeHtml(line.name || spec.label)}</div>
        <div class="shelter-popup-badges"><span class="badge blue">${escapeHtml(spec.label)}</span></div>
        ${payload.note ? `<div class="popup-contact-note">${escapeHtml(payload.note)}</div>` : ""}
        <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
      `);
      layer.addLayer(polyline);
    });
    return;
  }

  const bounds = map.getBounds();
  const wide = !spec.zoomLimit;
  (payload.features || []).forEach(feature => {
    const lat = Number(feature.latitude);
    const lng = Number(feature.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // 大量データは画面内だけ描画する
    if (!wide && !bounds.contains([lat, lng])) return;
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="opendata-marker" style="background:${spec.color}" aria-label="${escapeAttribute(feature.name)}"><span>${escapeHtml(spec.marker)}</span></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(feature.name)}</div>
      <div class="shelter-popup-badges"><span class="badge blue">${escapeHtml(feature.category || spec.label)}</span></div>
      ${feature.address ? `<div>${escapeHtml(feature.address)}</div>` : ""}
      ${feature.phone ? `<div class="detail-meta">電話 ${escapeHtml(feature.phone)}</div>` : ""}
      ${feature.detail ? `<div class="detail-meta">${escapeHtml(feature.detail)}</div>` : ""}
      ${payload.note ? `<div class="popup-contact-note">${escapeHtml(payload.note)}</div>` : ""}
      <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
    `);
    layer.addLayer(marker);
  });
}

// 表示中の大量データレイヤーを、地図移動のたびに描き直す
function refreshVisibleOpenDataLayers() {
  Object.keys(OPEN_DATA_LAYERS).forEach(key => {
    if (OPEN_DATA_LAYERS[key].zoomLimit && map.hasLayer(openDataLayers[key])) {
      renderOpenDataLayer(key);
    }
  });
}

// 気象庁の震源・震度情報を地図に表示する。
// list.json の cod（例 "+32.5+130.6+0/"）に震源座標と深さが含まれるため、
// 詳細JSONを追加取得せずに描画できる。印西市に震度記録がある地震を優先表示する。
const quakeLayer = L.layerGroup();
let quakeEvents = [];

// "+35.8+140.1-10000/" 形式を {lat, lng, depthKm} へ。深さはm単位で入ることがある
function parseJmaCoordinate(cod) {
  const m = String(cod || "").match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let depthKm = null;
  if (m[3] !== undefined) {
    const raw = Math.abs(Number(m[3]));
    // 1000以上はメートル表記とみなす（気象庁は深さをmで出す場合がある）
    depthKm = Number.isFinite(raw) ? (raw >= 1000 ? Math.round(raw / 1000) : raw) : null;
  }
  return { lat, lng, depthKm };
}

// 震度は "5-"（5弱）"6+"（6強）等の表記。地図の丸の大きさ・色に使う
function intensityRank(value) {
  const table = { "1": 1, "2": 2, "3": 3, "4": 4, "5-": 5, "5+": 6, "6-": 7, "6+": 8, "7": 9 };
  return table[String(value || "").trim()] ?? 0;
}

function intensityLabel(value) {
  const v = String(value || "").trim();
  if (v === "5-") return "5弱";
  if (v === "5+") return "5強";
  if (v === "6-") return "6弱";
  if (v === "6+") return "6強";
  return v || "-";
}

function quakeColor(rank) {
  if (rank >= 7) return "#7f1d1d";
  if (rank >= 5) return "#dc2626";
  if (rank >= 4) return "#ea580c";
  if (rank >= 3) return "#d97706";
  return "#0f766e";
}

function renderQuakeLayer() {
  quakeLayer.clearLayers();
  quakeEvents.forEach((event, index) => {
    const pos = event.position;
    const rank = intensityRank(event.maxi);
    const color = quakeColor(rank);
    // 最新の1件だけ大きく描き、それ以前は小さく薄く（履歴として残す）
    const isLatest = index === 0;
    const radius = isLatest ? 10 + rank * 1.6 : 6 + rank;
    const marker = L.circleMarker([pos.lat, pos.lng], {
      radius,
      color: "#ffffff",
      weight: isLatest ? 2 : 1,
      fillColor: color,
      fillOpacity: isLatest ? 0.85 : 0.45
    });
    marker.bindPopup(`
      <div class="popup-title">震源: ${escapeHtml(event.name || "不明")}</div>
      <div class="shelter-popup-badges">
        <span class="badge ${rank >= 4 ? "red" : "blue"}">最大震度 ${escapeHtml(intensityLabel(event.maxi))}</span>
        <span class="badge blue">M${escapeHtml(event.mag || "-")}</span>
      </div>
      <div>${escapeHtml(formatJmaDateTime(event.at))}</div>
      ${pos.depthKm !== null ? `<div class="detail-meta">深さ 約${escapeHtml(String(pos.depthKm))}km</div>` : ""}
      ${event.inzaiIntensity ? `<div class="shelter-evidence"><strong>印西市の震度 ${escapeHtml(intensityLabel(event.inzaiIntensity))}</strong><span>市内の観測点で記録された震度です。</span></div>` : '<div class="popup-contact-note">印西市の震度記録はありません。</div>'}
      <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer">出典: 気象庁 震源・震度情報</a>
    `);
    quakeLayer.addLayer(marker);
  });
}

// ============================================================
// 📰 公式発表・市長発信タイムライン
// CiDAO の /api/disaster/timeline（市公式ページ・防災速報・気象庁・市長SNSを
// 10分ごとに巡回し保存したもの）を、対象日を起点に時系列で読める形にする。
// 情報源の追加は CiDAO 管理画面（/admin/disaster-sources）で行い、ここでは表示だけを担う。
// ============================================================

async function refreshTimeline(manual = false) {
  const endpoint = String(APP_CONFIG.timelineEndpoint || "").trim();
  const status = document.getElementById("timeline-status");
  const list = document.getElementById("timeline-list");
  if (!endpoint || !status || !list) return;
  const date = getFormValue("incident-date") || dateStamp().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const days = Number(getFormValue("timeline-days") || 1);
  if (manual) status.textContent = "公式発表を更新中です。";
  try {
    const params = new URLSearchParams({ date, days: String(days), _: String(Date.now()) });
    const response = await fetch(`${endpoint}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 503 はテーブル未作成・未設定の案内。故障ではないので文言をそのまま出す
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    timelinePayload = payload;
    renderTimeline(payload);
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = `公式発表を取得できませんでした（${error?.message || "接続エラー"}）。印西市の公式ページで確認してください。`;
    if (manual) appendSystemWorkLog("公式発表タイムライン", "blocked", `取得失敗: ${error?.message || "不明"}`, "CiDAOのタイムラインAPIと情報源の状態を確認する");
  }
}

function timelineDayKey(iso) {
  const d = toDateTimeLocal(iso);
  return d ? d.slice(0, 10) : "";
}

function timelineTime(iso) {
  const d = toDateTimeLocal(iso);
  return d ? d.slice(11, 16) : "--:--";
}

function renderTimeline(payload) {
  const status = document.getElementById("timeline-status");
  const list = document.getElementById("timeline-list");
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  const enabledSources = sources.filter(s => s.enabled);
  const failed = enabledSources.filter(s => s.lastStatus && s.lastStatus !== "success");
  const lastFetched = enabledSources.map(s => s.lastFetchedAt).filter(Boolean).sort().pop();

  status.classList.remove("is-error");
  status.textContent = [
    `${items.length}件`,
    lastFetched ? `最終巡回 ${formatDateTime(toDateTimeLocal(lastFetched))}` : "",
    `情報源 ${enabledSources.length}`,
    failed.length ? `（取得失敗 ${failed.length}: ${failed.map(s => s.label).join("・")}）` : ""
  ].filter(Boolean).join(" ・ ");

  if (!items.length) {
    // 対象日が過去のまま「発表はありません」と出ると、災害の最中に
    // 「今日は何も出ていない」と誤読される。今日の件数を調べて誘導する
    const today = dateStamp().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    const viewing = getFormValue("incident-date") || today;
    list.innerHTML = `<div class="detail-empty">${escapeHtml(viewing)}の公式発表・発信はありません。</div>`;
    if (viewing !== today) checkTimelineToday(today);
    return;
  }

  // 日付ごとに見出しを挟み、同じ日の中は新しい順（上から最新を追う）
  const sorted = [...items].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
  let currentDay = "";
  const html = [];
  sorted.forEach((item, index) => {
    const day = timelineDayKey(item.occurredAt);
    if (day !== currentDay) {
      currentDay = day;
      html.push(`<div class="timeline-day">${escapeHtml(day || "日時不明")}</div>`);
    }
    const trust = item.trust || "unverified";
    const trustCls = trust === "official" ? "is-official" : trust === "semi-official" ? "is-semi" : "";
    const change = item.changeType && item.changeType !== "new" ? item.changeType : "";
    const body = String(item.body || "").trim();
    const long = body.length > 160;
    html.push(`
      <article class="timeline-item ${trustCls} ${change === "cancel" ? "is-cancel" : ""}">
        <div class="timeline-time">${escapeHtml(timelineTime(item.occurredAt))}</div>
        <div class="timeline-body">
          <div class="timeline-source">
            <span class="timeline-trust ${trustCls}">${escapeHtml(TIMELINE_TRUST_LABEL[trust] || trust)}</span>
            <span>${escapeHtml(item.sourceLabel || item.sourceKind || "情報源不明")}</span>
            ${change ? `<span class="timeline-change ${change === "cancel" ? "is-cancel" : ""}">${escapeHtml(TIMELINE_CHANGE_LABEL[change] || change)}</span>` : ""}
          </div>
          <p class="timeline-title">${escapeHtml(item.title || "（見出しなし）")}</p>
          ${body ? `<p class="timeline-text ${long ? "is-clamped" : ""}" data-timeline-text="${index}">${escapeHtml(body)}</p>` : ""}
          ${long ? `<button class="timeline-more" type="button" data-timeline-more="${index}">続きを読む</button>` : ""}
          ${isHttpUrl(item.url) ? `<a class="timeline-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">出典を開く</a>` : ""}
        </div>
      </article>`);
  });
  list.innerHTML = html.join("");
}

// 対象日に発表が無いとき、今日は何件あるかを調べて切替リンクを出す
async function checkTimelineToday(today) {
  const endpoint = String(APP_CONFIG.timelineEndpoint || "").trim();
  const list = document.getElementById("timeline-list");
  if (!endpoint || !list) return;
  try {
    const params = new URLSearchParams({ date: today, days: "1", _: String(Date.now()) });
    const response = await fetch(`${endpoint}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const count = Array.isArray(payload?.items) ? payload.items.length : 0;
    if (!count) return;
    list.insertAdjacentHTML("beforeend",
      `<div class="timeline-today-hint">本日（${escapeHtml(today)}）は${count}件の発表があります。<button type="button" id="timeline-jump-today">今日の発表を見る</button></div>`);
    document.getElementById("timeline-jump-today")?.addEventListener("click", () => {
      const input = document.getElementById("incident-date");
      if (!input) return;
      input.value = today;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } catch (error) {
    // 補助表示なので失敗しても何もしない
  }
}

// スマホでは縦に長く積むため、上部の「見たい情報へ」バーで各エリアへ飛べるようにする。
// 災害時に必要なのは 避難所・警報・公式発表 なので、その並びを優先している。
function initQuickNav() {
  const nav = document.getElementById("quick-nav");
  if (!nav) return;
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jump]");
    if (!button) return;
    const target = document.getElementById(button.dataset.jump);
    if (!target) return;
    // バー自体が上部に固定されるので、その高さ分だけ余白をとって隠れないようにする
    const offset = nav.getBoundingClientRect().height + 8;
    const top = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - offset);
    window.scrollTo({ top, behavior: "smooth" });
    // 端末やブラウザ設定によっては smooth が無視されて動かないことがある（実測）。
    // 少し待って動いていなければ即時スクロールで確実に移動させる
    window.setTimeout(() => {
      if (Math.abs(window.pageYOffset - top) > 40) window.scrollTo(0, top);
    }, 350);
    nav.querySelectorAll(".quick-nav-btn").forEach(b => b.classList.toggle("is-current", b === button));
  });
}

function handleTimelineListClick(event) {
  const button = event.target.closest("[data-timeline-more]");
  if (!button) return;
  const text = document.querySelector(`[data-timeline-text="${button.dataset.timelineMore}"]`);
  if (!text) return;
  const clamped = text.classList.toggle("is-clamped");
  button.textContent = clamped ? "続きを読む" : "閉じる";
}

function initTimeline() {
  if (!String(APP_CONFIG.timelineEndpoint || "").trim()) return;
  refreshTimeline(false);
  clearInterval(timelineTimer);
  // 巡回は10分ごとなので、表示側は5分ごとに追従すれば十分
  timelineTimer = setInterval(() => refreshTimeline(false), 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
}

function getShelterFilters() {
  return {
    hazard: getFormValue("shelter-hazard-filter") || "windFlood",
    kind: getFormValue("shelter-kind-filter") || "all",
    opening: getFormValue("shelter-opening-filter") || "all",
    keyword: getFormValue("shelter-keyword-filter").toLowerCase()
  };
}

function getFilteredShelters() {
  const filters = getShelterFilters();
  return officialShelters.filter(shelter => {
    if (filters.kind !== "all" && shelter.kind !== filters.kind) return false;
    if (filters.opening !== "all" && effectiveShelterOpening(shelter).status !== filters.opening) return false;
    if (filters.keyword && !`${shelter.name} ${shelter.address} ${shelter.district}`.toLowerCase().includes(filters.keyword)) return false;
    return true;
  });
}

function renderShelters() {
  const summary = document.getElementById("shelter-summary");
  const list = document.getElementById("shelter-list");
  const filters = getShelterFilters();
  const filtered = getFilteredShelters();
  const hazardLabels = { windFlood: "風水害", earthquake: "震災", landslide: "土砂災害" };
  const suitableCount = filtered.filter(shelter => shelter.suitableFor?.[filters.hazard]).length;
  const openCount = officialShelters.filter(shelter => effectiveShelterOpening(shelter).status === "open").length;
  const manualCount = Object.keys(shelterManualOverrides).length;
  const supersededCount = officialShelters.filter(shelter => effectiveShelterOpening(shelter).supersededManual).length;
  const updateTime = shelterPayload?.fetchedAt ? formatDateTime(toDateTimeLocal(shelterPayload.fetchedAt)) : "";
  summary.classList.remove("is-error");
  summary.innerHTML = `
    <strong>${escapeHtml(hazardLabels[filters.hazard] || filters.hazard)}対応 ${suitableCount} / 表示${filtered.length}施設</strong>
    <span>開設中 ${openCount}施設${manualCount ? `（手動入力 ${manualCount}件${supersededCount ? `・うち${supersededCount}件は公式で確認済み` : ""}）` : ""}${updateTime ? ` ・ ${escapeHtml(updateTime)}取得` : ""}</span>
    <span>${escapeHtml(shelterPayload?.openingInformation || "公式の開設発表を確認中です。")}</span>
    ${shelterPayload?.stale ? `<span class="shelter-stale">⚠ ${escapeHtml(lastBroadcastNote(shelterPayload))}市の発表でご確認ください。</span>` : ""}
  `;

  shelterLayer.clearLayers();
  filtered.forEach(shelter => {
    const suitable = Boolean(shelter.suitableFor?.[filters.hazard]);
    const effective = effectiveShelterOpening(shelter);
    const opening = effective.status;
    const marker = L.marker([Number(shelter.latitude), Number(shelter.longitude)], {
      icon: L.divIcon({
        className: "",
        html: `<div class="shelter-marker is-${escapeAttribute(opening)} ${effective.manual ? "is-manual" : ""} ${suitable ? "" : "is-unsuitable"}" aria-label="${escapeAttribute(shelter.name)}"><span>${opening === "open" ? "開" : suitable ? "避" : "!"}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    });
    marker._shelterId = shelter.id;
    marker.bindPopup(buildShelterPopup(shelter, filters.hazard));
    marker.on("click", () => {
      selectedShelterId = shelter.id;
      renderShelterList(filtered, filters.hazard);
    });
    shelterLayer.addLayer(marker);
  });
  renderShelterList(filtered, filters.hazard);
}

function buildShelterPopup(shelter, hazard) {
  const hazardLabels = { windFlood: "風水害", earthquake: "震災", landslide: "土砂災害" };
  const openingLabels = { open: "開設中", closed: "閉鎖・開設終了", "not-announced": "開設発表なし" };
  const suitable = Boolean(shelter.suitableFor?.[hazard]);
  const evidence = shelter.openingEvidence;
  const effective = effectiveShelterOpening(shelter);
  const manual = effective.manual;
  return `
    <div class="popup-title">${escapeHtml(shelter.name)}</div>
    <div class="shelter-popup-badges">
      <span class="badge ${suitable ? "green" : "red"}">${escapeHtml(hazardLabels[hazard])}: ${suitable ? "対応可" : "対象外"}</span>
      <span class="badge ${effective.status === "open" ? "green" : effective.status === "closed" ? "gray" : "yellow"}">${escapeHtml(openingLabels[effective.status] || "開設発表なし")}${manual ? "（手動）" : ""}</span>
    </div>
    <div>${escapeHtml(shelter.kindLabel)} / ${escapeHtml(shelter.address)}</div>
    ${shelter.phone ? `<div class="detail-meta">電話 ${escapeHtml(shelter.phone)}</div>` : ""}
    ${effective.supersededManual ? `<div class="shelter-evidence"><strong>手動入力は公式発表で確認済み</strong><span>${escapeHtml(formatDateTime(toDateTimeLocal(effective.supersededManual.confirmedAt)))}に運用者が入力した内容は、市の公式発表と一致したため公式の表示に切り替えました。</span></div>` : ""}
    ${manual ? `<div class="shelter-evidence is-manual"><strong>手動入力（${escapeHtml(manual.source || "出典未記入")}）</strong><span>${escapeHtml(manualTimeLabel(manual) ? `${manualTimeLabel(manual)} ・ ` : "")}${escapeHtml(formatDateTime(toDateTimeLocal(manual.confirmedAt)))}に運用者が確認・入力。公式発表ではありません。</span></div>` : ""}
    ${evidence ? `<div class="shelter-evidence"><strong>${escapeHtml(evidence.title || "印西市防災速報")}</strong><span>${escapeHtml(truncateText(evidence.message || "", 140))}</span><a href="${escapeAttribute(evidence.sourceUrl)}" target="_blank" rel="noreferrer">公式発表を確認</a></div>` : manual ? "" : '<div class="popup-contact-note">現在の開設を示す公式発表は確認されていません。</div>'}
    <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ</a>
  `;
}

function renderShelterList(filtered, hazard) {
  const list = document.getElementById("shelter-list");
  if (!filtered.length) {
    list.innerHTML = '<div class="detail-empty">条件に一致する避難所はありません。</div>';
    return;
  }
  const openingLabels = { open: "開設中", closed: "閉鎖発表", "not-announced": "開設発表なし" };
  list.innerHTML = filtered.map(shelter => {
    const suitable = Boolean(shelter.suitableFor?.[hazard]);
    const effective = effectiveShelterOpening(shelter);
    return `
      <button class="shelter-list-item ${shelter.id === selectedShelterId ? "is-selected" : ""}" type="button" data-shelter-id="${escapeAttribute(shelter.id)}">
        <strong>${escapeHtml(shelter.name)}</strong>
        <span>${escapeHtml(shelter.kindLabel)} ・ ${suitable ? "災害対応可" : "この災害は対象外"}</span>
        <span class="shelter-opening is-${escapeAttribute(effective.status)}">${escapeHtml(openingLabels[effective.status] || "開設発表なし")}${effective.manual ? "（手動）" : ""}</span>
      </button>`;
  }).join("");
}

function handleShelterListClick(event) {
  const button = event.target.closest("[data-shelter-id]");
  if (!button) return;
  const shelter = officialShelters.find(item => item.id === button.dataset.shelterId);
  if (!shelter) return;
  selectedShelterId = shelter.id;
  map.setView([Number(shelter.latitude), Number(shelter.longitude)], Math.max(map.getZoom(), 15));
  shelterLayer.eachLayer(marker => {
    if (marker._shelterId === shelter.id) marker.openPopup();
  });
  renderShelterList(getFilteredShelters(), getShelterFilters().hazard);
}

function showShelterFloodLayers() {
  setFormValue("shelter-hazard-filter", "windFlood");
  ["floodMax", "inland", "shelters"].forEach(name => {
    const input = document.querySelector(`[data-overlay="${name}"]`);
    if (input) input.checked = true;
    toggleOverlay(name, true);
  });
  renderShelters();
  map.fitBounds(INZAI_BOUNDS);
  document.getElementById("map-status").textContent = "公式の洪水・内水浸水想定と風水害対応避難所を重ねています。";
}

// 用途別ワンタップ切替（2026-09-10追加）。
// レイヤーが34種あり、目的の組み合わせを自分で作るのが大変なため、
// 「冠水した道路が見たい」「公式リンクが見たい」といった用途から入れるようにする。
// 押すとその用途の構成へ入れ替える（他はいったんOFF）。
// on に挙げたものだけを ON にし、keep は現在の状態を保つ。
const PRESETS = {
  // 需要が多い2つを先頭に置いている
  // 開いたときの既定でもある（index.html の checked ／ initInitialOverlays と同じ内容にする）。
  // 2026-09-21 に records（被害・確認候補のピン）を外した。冠水の道を見るボタンなので、
  // SNS 由来の被害候補ピンまで出すと地図が読めないため（中司さんの実機指摘）
  kansui: {
    label: "冠水した道・通れた道",
    on: ["boundary", "kansui", "passedRoads", "roadRisk", "leveeBreach"],
    openGroups: ["🚗"],
    focus: "layer-panel"
  },
  links: {
    label: "公式リンク集",
    on: ["boundary", "records"],
    // レイヤーではなく左パネルの2つのアコーディオンを開いて見せる
    openAcc: ["🚫", "📄"],
    focus: "acc"
  },
  flood: {
    label: "浸水の想定",
    on: ["boundary", "records", "floodMax", "floodKeizoku", "kaokuHanran"],
    openGroups: ["🌊"],
    focus: "layer-panel"
  },
  shelter: {
    label: "避難所",
    on: ["boundary", "records", "shelters", "wells", "floodMax"],
    openGroups: ["🏫"],
    focus: "layer-panel"
  },
  rain: {
    label: "いまの雨",
    on: ["boundary", "records", "rainNowcast", "kikikuruInund", "kikikuruFlood"],
    openGroups: ["🌧"],
    focus: "layer-panel"
  },
  // 市が発表した鉄道の運休・遅れ。路線の線（鉄道）も一緒に出して、
  // どの区間が止まっているかを位置関係で読めるようにする
  rail: {
    label: "鉄道の運休・遅れ",
    on: ["boundary", "railStatus", "railway"],
    openGroups: ["🏫"],
    focus: "layer-panel"
  },
  // 役所が発表した通行止め。場所の文章しかないので、左の一覧まで移動して見せる（2026-09-22 事業主指示）
  closures: {
    label: "通行止め",
    on: ["boundary", "roadClosures"],
    openGroups: ["🏫"],
    focus: "#road-closures-list"
  },
  landslide: {
    label: "土砂災害",
    on: ["boundary", "records", "landslide", "landslideWarning", "landslideSpecial"],
    openGroups: ["🌊"],
    focus: "layer-panel"
  },
  // 読み込み直後と同じ状態へ戻す（index.html の checked と、初期化の toggleOverlay と揃える）
  reset: {
    label: "最初の表示",
    on: ["boundary", "kansui", "passedRoads", "roadRisk", "leveeBreach"],
    openGroups: ["🚗"],
    focus: null
  }
};

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  const wanted = new Set(preset.on || []);
  // チェックを入れ替える。change イベントを起こすため click() を使う
  document.querySelectorAll("[data-overlay]").forEach(box => {
    const want = wanted.has(box.dataset.overlay);
    if (box.checked !== want) box.click();
  });
  // 関係するグループを開き、それ以外は畳んでおく
  document.querySelectorAll("details.layer-group").forEach(group => {
    const head = group.querySelector("summary")?.textContent || "";
    group.open = (preset.openGroups || []).some(mark => head.includes(mark));
  });
  document.querySelectorAll(".left-panel > details.acc").forEach(acc => {
    const head = acc.querySelector("summary")?.textContent || "";
    acc.open = (preset.openAcc || []).some(mark => head.includes(mark));
  });
  // 押したボタンを目立たせる
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.toggle("is-current", b.dataset.preset === name));
  document.querySelector(`.preset-btn[data-preset="${name}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  syncMapLegend();

  const panel = document.querySelector(".left-panel");
  if (!panel) return;
  if (preset.focus === "acc") {
    const target = document.querySelector(".left-panel > details.acc[open]");
    if (target) panel.scrollTop = target.offsetTop - panel.offsetTop - 8;
  } else if (preset.focus === "layer-panel") {
    panel.scrollTop = 0;
  } else if (preset.focus?.startsWith("#")) {
    // 一覧は読み込み後に高さが変わるので、少し待ってから寄せる（PCは左パネルの中、スマホはページごと）
    // 初回は読み込みが終わるまで一覧が隠れているので、そのときは真上のチェックの行へ寄せる（一覧はその下に開く）
    setTimeout(() => {
      const el = document.querySelector(preset.focus);
      (el?.hidden ? el.previousElementSibling : el)?.scrollIntoView({ block: "start" });
    }, 600);
  }
}

// ============================================================
// 🗑 市民記録の管理（運営用・2026-09-21）
// いたずらや誤った記録を地図から伏せる。API の DELETE に ?moderate=1 と合言葉ヘッダを付ける。
// 行は消さない（hidden=true）ので、間違えても戻せるし、繰り返すいたずらの端末も追える。
// 合言葉は CiDAO の環境変数（DISASTER_MODERATION_KEY、無ければ CRON_SECRET）と同じもの。
// この端末の localStorage にだけ保存し、コードにもサイトにも書かない。
// ============================================================
const MODERATION_KEY_STORAGE = "cbi-disaster-moderation-key-v1";

function moderationKey() {
  try { return localStorage.getItem(MODERATION_KEY_STORAGE) || ""; } catch { return ""; }
}

function askModerationKey() {
  const input = prompt("運営用の合言葉を入れてください（この端末にだけ保存します）", "");
  const value = String(input ?? "").trim();
  if (!value) return "";
  try { localStorage.setItem(MODERATION_KEY_STORAGE, value); } catch {}
  return value;
}

function moderationEndpoint() {
  return String(APP_CONFIG.passedRoadsEndpoint || "").trim();
}

function setModerateStatus(html) {
  const list = document.getElementById("moderate-list");
  if (list) list.innerHTML = html;
}

async function loadModerationList() {
  const endpoint = moderationEndpoint();
  if (!endpoint) { setModerateStatus("<p>配信先が設定されていません。</p>"); return; }
  const key = moderationKey() || askModerationKey();
  if (!key) { setModerateStatus("<p>合言葉が入力されていないため表示できません。</p>"); return; }
  setModerateStatus("<p>読み込み中…</p>");
  try {
    const response = await fetch(`${endpoint}?all=1`, { headers: { "x-moderation-key": key }, cache: "no-store" });
    if (response.status === 403) {
      try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
      setModerateStatus("<p class=\"is-error\">合言葉が違います。「一覧を読み直す」でもう一度入れてください。</p>");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const roads = payload.roads || [];
    if (!roads.length) { setModerateStatus("<p>記録はありません。</p>"); return; }
    setModerateStatus(roads.map(road => {
      const what = road.kind === "blocked" ? "🚫 通れない" : "🔵 通れた";
      const how = road.source === "map" ? "地図で記録" : "GPS";
      const shape = road.pointCount > 1 ? `線 ${road.pointCount}点・約${Math.round(road.lengthM || 0)}m` : "地点";
      return `<div class="moderate-row ${road.hidden ? "is-hidden-row" : ""}">` +
        `<div><strong>${what}</strong> ${escapeHtml(formatDateTime(toDateTimeLocal(road.endedAt)) || "時刻不明")}` +
        `<span class="moderate-meta">${escapeHtml(how)}・${escapeHtml(shape)}${road.note ? "・" + escapeHtml(road.note) : ""}` +
        `${road.hidden ? "・<em>伏せ済み</em>" : ""}</span></div>` +
        `<div class="moderate-row-buttons">` +
        `<button type="button" data-moderate-focus="${escapeAttribute(String(road.id))}">地図で見る</button>` +
        `<button type="button" class="${road.hidden ? "" : "is-danger"}" data-moderate-id="${escapeAttribute(String(road.id))}" data-moderate-hide="${road.hidden ? "0" : "1"}">${road.hidden ? "戻す" : "伏せる"}</button>` +
        `</div></div>`;
    }).join(""));
  } catch (error) {
    setModerateStatus(`<p class="is-error">取得できません（${escapeHtml(error?.message || "接続エラー")}）</p>`);
  }
}

// みんつくの投稿を CBI の地図から伏せる／戻す（本家のデータには触らない）
async function moderateKansui(id, hide) {
  const endpoint = String(APP_CONFIG.kansuiEndpoint || "").trim();
  const key = moderationKey();
  if (!endpoint || !key) return false;
  const url = `${endpoint}?id=${encodeURIComponent(id)}&moderate=1${hide ? "" : "&restore=1"}`;
  const response = await fetch(url, { method: "DELETE", headers: { "x-moderation-key": key } });
  if (response.status === 403) throw new Error("合言葉が違います");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // 取り直して地図に反映する（一般向けは10分キャッシュだが、運営の取得は no-store）
  kansuiLoaded = false;
  await ensureKansuiLayer();
  return true;
}

// 地図のポップアップの「🗑 この投稿を地図から伏せる」
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-kansui-hide]");
  if (!button) return;
  if (!confirm("このみんつくの投稿を、CBIの地図から伏せます。よろしいですか？（みんつく本家からは消えません。あとで戻せます）")) return;
  button.disabled = true;
  button.textContent = "伏せています…";
  try {
    await moderateKansui(button.dataset.kansuiHide, true);
    map.closePopup();
  } catch (error) {
    button.disabled = false;
    button.textContent = `伏せられませんでした（${error?.message || "接続エラー"}）`;
  }
});

// 運営：「今回の大雨」の開始日時を入れ替える（「🗑 市民記録の管理」の中）。次の大雨のときに使う
document.addEventListener("click", async event => {
  if (!event.target.closest?.("#event-start-save")) return;
  const input = document.getElementById("event-start-input");
  const status = document.getElementById("event-start-status");
  const value = input?.value || "";
  if (!value) { if (status) status.textContent = "日時を入れてください"; return; }
  const endpoint = moderationEndpoint();
  let key = moderationKey() || askModerationKey();
  if (!endpoint || !key) return;
  const send = k => fetch(`${endpoint}?setting=eventStart`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-moderation-key": k },
    body: JSON.stringify({ eventStart: new Date(value).toISOString() })
  });
  try {
    let response = await send(key);
    if (response.status === 403) {
      try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
      key = askModerationKey();
      if (!key) throw new Error("合言葉が違います");
      response = await send(key);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    await ensurePassedRoadsLayer(true);
    if (status) status.textContent = `保存しました（${eventStartLabel()} から後の通れた道を濃く表示）`;
  } catch (error) {
    if (status) status.textContent = `保存できませんでした（${error?.message || "接続エラー"}）`;
  }
});
document.addEventListener("click", event => {
  // 管理画面を開いたとき、いまの設定を入力欄に入れる
  if (!event.target.closest?.("#moderate-button, #moderate-reload")) return;
  const input = document.getElementById("event-start-input");
  if (input && passedEventStart && !input.value) input.value = toDateTimeLocal(passedEventStart);
});

// 地図のポップアップの「✏ 時刻・メモを直す」（運営）。道からずれた線を引き直すと記録時刻が引き直した時刻になるため、
// 実際の時刻とメモを上書きする。時刻を変えるとサーバーがその時刻の雨量を取り直す（2026-09-22）
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-passed-edit]");
  if (!button) return;
  const id = button.dataset.passedEdit;
  const road = passedRoadsData.find(r => String(r.id) === id);
  if (!road) return;
  const endpoint = moderationEndpoint();
  const key = moderationKey();
  if (!endpoint || !key) return;
  window.RoadRecordEditor.open({
    road, endpoint, key,
    getKey: () => { try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {} return askModerationKey(); },
    onSaved: async () => { map.closePopup(); await ensurePassedRoadsLayer(true); focusPassedRoad(road.id); }
  });
});

// 地図のポップアップの「🗑 この記録を地図から伏せる」（通れた道・通れない道）
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-passed-hide]");
  if (!button) return;
  if (!confirm("この記録を地図から伏せます。よろしいですか？（記録は消えず、「🗑 市民記録の管理」から戻せます）")) return;
  button.disabled = true;
  button.textContent = "伏せています…";
  map.closePopup();
  const result = await moderateRecord(button.dataset.passedHide, true);
  if (result !== true) alert(`伏せられませんでした（${result || "接続エラー"}）。もう一度線を押して試すか、「🗑 市民記録の管理」から操作してください。`);
});

async function loadKansuiModerationList() {
  const endpoint = String(APP_CONFIG.kansuiEndpoint || "").trim();
  const key = moderationKey();
  const box = document.getElementById("moderate-kansui-list");
  if (!box || !endpoint || !key) return;
  box.innerHTML = "<p>読み込み中…</p>";
  try {
    const response = await fetch(`${endpoint}?all=1`, { headers: { "x-moderation-key": key }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const hidden = (payload.roads || []).filter(road => road.hidden);
    if (!hidden.length) { box.innerHTML = "<p>伏せているみんつくの投稿はありません。地図の赤い線を押すと、ポップアップから伏せられます。</p>"; return; }
    box.innerHTML = hidden.map(road => {
      let meters = 0;
      for (let i = 1; i < road.path.length; i++) meters += L.latLng(road.path[i - 1]).distanceTo(L.latLng(road.path[i]));
      return `<div class="moderate-row is-hidden-row"><div><strong>🔴 みんつく</strong> 投稿 ${escapeHtml(formatDateTime(toDateTimeLocal(road.createdAt)) || "不明")}` +
        `<span class="moderate-meta">${road.path.length}点・約${(meters / 1000).toFixed(1)}km・伏せ済み</span></div>` +
        `<div class="moderate-row-buttons"><button type="button" data-kansui-restore="${escapeAttribute(String(road.id))}">戻す</button></div></div>`;
    }).join("");
  } catch (error) {
    box.innerHTML = `<p class="is-error">取得できません（${escapeHtml(error?.message || "接続エラー")}）</p>`;
  }
}

async function moderateRecord(id, hide) {
  const endpoint = moderationEndpoint();
  const key = moderationKey();
  if (!endpoint || !key) return;
  const url = `${endpoint}?id=${encodeURIComponent(id)}&moderate=1${hide ? "" : "&restore=1"}`;
  try {
    let response = await fetch(url, { method: "DELETE", headers: { "x-moderation-key": key } });
    if (response.status === 403) {
      // 端末に保存した合言葉が違う。消して入れ直してもらい、1回だけやり直す
      try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
      const retryKey = askModerationKey();
      if (!retryKey) throw new Error("合言葉が違います");
      response = await fetch(url, { method: "DELETE", headers: { "x-moderation-key": retryKey } });
      if (response.status === 403) {
        try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
        throw new Error("合言葉が違います");
      }
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await ensurePassedRoadsLayer(true); // 地図と一覧を取り直す
    await loadModerationList();
    return true;
  } catch (error) {
    setModerateStatus(`<p class="is-error">変更できません（${escapeHtml(error?.message || "接続エラー")}）</p>`);
    return error?.message || "接続エラー";
  }
}

// 市の避難情報の帯（2026-09-21）。運営が消すのは放送ごと。ほかの放送・新しい放送は出る
function setEvacModerateStatus(html) {
  const node = document.getElementById("moderate-evac");
  if (node) node.innerHTML = html;
}

async function loadEvacModeration() {
  const endpoint = APP_CONFIG.evacAlertEndpoint;
  if (!endpoint) { setEvacModerateStatus("<p>配信先が設定されていません。</p>"); return; }
  setEvacModerateStatus("<p>読み込み中…</p>");
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    evacAlertPayload = await response.json();
    renderMapAlert();
    const alerts = Array.isArray(evacAlertPayload.alerts) ? evacAlertPayload.alerts : [];
    if (!alerts.length) {
      const why = { cancelled: "解除の放送がありました。", expired: "発令から24時間たちました。" }[evacAlertPayload.reason] || "発令中の避難情報はありません。";
      setEvacModerateStatus(`<p>いまは帯を出していません。${escapeHtml(why)}</p>`);
      return;
    }
    setEvacModerateStatus(alerts.map(alert => {
      const head = `${escapeHtml(evacAlertHead(alert))}（${escapeHtml(alert.publishedAt)} 放送）`;
      return alert.suppressed
        ? `<div class="moderate-row is-hidden-row"><div><strong>全員の画面から消しています</strong><br>${head}</div>
            <div class="moderate-row-buttons"><button type="button" data-evac-off="0" data-evac-published="${escapeAttribute(alert.publishedAt)}">帯に戻す</button></div></div>`
        : `<div class="moderate-row"><div><strong>全員の画面に出しています</strong><br>${head}</div>
            <div class="moderate-row-buttons"><button type="button" class="is-danger" data-evac-off="1" data-evac-published="${escapeAttribute(alert.publishedAt)}">全員の画面から消す</button></div></div>`;
    }).join(""));
  } catch (error) {
    setEvacModerateStatus(`<p class="is-error">状態を取得できません（${escapeHtml(error?.message || "接続エラー")}）</p>`);
  }
}

async function setEvacAlertOff(off, publishedAt) {
  const endpoint = APP_CONFIG.evacAlertEndpoint;
  const key = moderationKey() || askModerationKey();
  if (!endpoint || !key) return;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-moderation-key": key },
      body: JSON.stringify({ off, publishedAt })
    });
    if (response.status === 403) {
      try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
      setEvacModerateStatus("<p class=\"is-error\">合言葉が違います。もう一度押して入れ直してください。</p>");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadEvacModeration();
  } catch (error) {
    setEvacModerateStatus(`<p class="is-error">変更できません（${escapeHtml(error?.message || "接続エラー")}）</p>`);
  }
}

function initModeration() {
  const modal = document.getElementById("moderate-modal");
  if (!modal) return;
  const open = () => { modal.hidden = false; loadEvacModeration(); loadModerationList().then(loadKansuiModerationList).then(loadSnsModerationList); };
  document.getElementById("moderate-button")?.addEventListener("click", open);
  document.getElementById("moderate-close")?.addEventListener("click", () => { modal.hidden = true; });
  document.getElementById("moderate-reload")?.addEventListener("click", loadModerationList);
  document.getElementById("moderate-forget")?.addEventListener("click", () => {
    try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
    setModerateStatus("<p>この端末から合言葉を消しました。</p>");
  });
  modal.addEventListener("click", async event => {
    if (event.target === modal) modal.hidden = true;
    const evacButton = event.target.closest?.("[data-evac-off]");
    if (evacButton) {
      const off = evacButton.dataset.evacOff === "1";
      if (off && !confirm("この放送の帯を、地図を見ている全員の画面から消します。よろしいですか？（ほかの放送や、新しい放送は出ます。あとで戻せます）")) return;
      await setEvacAlertOff(off, evacButton.dataset.evacPublished || "");
      return;
    }
    const restoreId = event.target.closest?.("[data-kansui-restore]")?.dataset.kansuiRestore;
    if (restoreId) {
      try { await moderateKansui(restoreId, false); } catch (error) { alert(`戻せませんでした（${error?.message || "接続エラー"}）`); }
      loadKansuiModerationList();
      return;
    }
    const focusId = event.target.closest?.("[data-moderate-focus]")?.dataset.moderateFocus;
    if (focusId) { modal.hidden = true; focusPassedRoad(focusId); return; }
    const snsFocusId = event.target.closest?.("[data-sns-focus]")?.dataset.snsFocus;
    if (snsFocusId) { modal.hidden = true; focusSnsRoad(snsFocusId); return; }
    const button = event.target.closest?.("[data-moderate-id]");
    if (!button) return;
    const hide = button.dataset.moderateHide === "1";
    if (hide && !confirm("この記録を地図から伏せます。よろしいですか？（あとで戻せます）")) return;
    moderateRecord(button.dataset.moderateId, hide);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) modal.hidden = true;
  });
}

// 地図の上端の凡例。色チップを押すとその表示を消せる。本日／過去の実績は記録の絞り込み。
// レイヤー一覧から操作されたときも syncMapLegend() で見た目をそろえる（2026-09-21）
function initMapLegend() {
  const legend = document.getElementById("map-legend");
  if (!legend) return;
  legend.addEventListener("click", event => {
    const chip = event.target.closest("[data-legend], [data-when], [data-kind]");
    if (!chip) return;
    const turnOn = chip.getAttribute("aria-pressed") !== "true";
    chip.setAttribute("aria-pressed", String(turnOn));
    if (chip.dataset.kind) {
      passedKindFilter[chip.dataset.kind] = turnOn;
      const box = document.querySelector('[data-overlay="passedRoads"]');
      if (turnOn && box && !box.checked) box.click(); // 層ごと OFF だったら ON にする（読み込みはそちらが持つ）
      // 赤（通れない道）は、みんつくへの投稿も同じ「通れない道」として一緒に出し入れする（2026-09-22）
      if (chip.dataset.kind === "blocked") {
        const kansuiBox = document.querySelector('[data-overlay="kansui"]');
        if (kansuiBox && kansuiBox.checked !== turnOn) kansuiBox.click();
      }
      renderPassedRoadsLayer();
      syncMapLegend();
      return;
    }
    if (chip.dataset.legend) {
      // レイヤーのチェック欄と同じ経路を通す（読み込みや描き直しはそちらが持っている）
      const box = document.querySelector(`[data-overlay="${chip.dataset.legend}"]`);
      if (box && box.checked !== turnOn) box.click();
      return;
    }
    recordWhenFilter[chip.dataset.when] = turnOn;
    renderKansuiLayer();
    renderPassedRoadsLayer();
    if (roadClosuresData) renderRoadClosures();
  });
  syncMapLegend();
  // 凡例は画面幅や期間のラベルで2〜3行に伸び縮みする。高さが変わるたびに、下に置く
  // ズームボタン・手賀沼の警告帯・状態表示を連動させる（2026-09-21：期間を指定すると
  // 凡例が3行目に回り込み、「⏱ 期間」が警告帯とズームボタンの裏に隠れて押せなくなっていた）
  const syncLegendHeight = () => {
    document.getElementById("map-pane")?.style.setProperty("--legend-h", `${legend.offsetHeight}px`);
    if (typeof placeRiverAlert === "function") placeRiverAlert();
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(syncLegendHeight).observe(legend);
  syncLegendHeight();

  // 凡例の続き（右に隠れているボタン）へ送る（2026-09-24「雨量ボタンの右が見えない」）
  const more = document.getElementById("legend-more");
  if (more) {
    const syncMore = () => {
      const rest = legend.scrollWidth - legend.clientWidth - legend.scrollLeft;
      more.hidden = rest < 8;
    };
    more.addEventListener("click", () => {
      // なめらか移動（behavior:"smooth"）が効かない環境があるので、値を直接入れる
      legend.scrollLeft = Math.min(legend.scrollWidth - legend.clientWidth, legend.scrollLeft + Math.round(legend.clientWidth * 0.8));
      syncMore();
    });
    legend.addEventListener("scroll", syncMore);
    window.addEventListener("resize", syncMore);
    if (typeof ResizeObserver === "function") new ResizeObserver(syncMore).observe(legend);
    syncMore();
  }

  // ポップアップが、地図の上に重ねている帯（凡例・手賀沼の警告・運休の表示）の裏に隠れないようにする。
  // Leaflet のポップアップは地図の面の中（z-index 400 の重なり）にあるため、外に重ねた帯より上には出せない。
  // 2026-09-21 夕：スマホで線を押すと、時刻の行がちょうど警告帯の裏に来て「押しても時間がわからない」状態だった。
  // 開いた時点で重なっていたら、その分だけ地図を下へずらす
  // Leaflet 自身の「はみ出したら地図をずらす」（autoPan）に、上の帯の分の余白を教える。
  // 自前で panBy すると Leaflet の autoPan と打ち消し合うので、余白を渡して Leaflet に任せる
  const coverBottomInMap = () => {
    const mapTop = document.getElementById("map")?.getBoundingClientRect().top ?? 0;
    const covers = ["map-legend", "river-alert", "map-status"]
      .map(id => document.getElementById(id))
      .filter(node => node && !node.hidden && node.offsetParent !== null && getComputedStyle(node).display !== "none");
    return Math.max(0, ...covers.map(node => node.getBoundingClientRect().bottom - mapTop));
  };
  map.on("popupopen", event => {
    const popup = event.popup;
    setTimeout(() => {
      popup.options.autoPanPaddingTopLeft = L.point(10, Math.round(coverBottomInMap()) + 10);
      popup.options.autoPan = true;
      if (typeof popup._adjustPan === "function") popup._adjustPan();
    }, 30);
  });
}

function syncMapLegend() {
  document.querySelectorAll("#map-legend [data-legend]").forEach(chip => {
    const box = document.querySelector(`[data-overlay="${chip.dataset.legend}"]`);
    chip.setAttribute("aria-pressed", String(Boolean(box?.checked)));
  });
  const passedOn = Boolean(document.querySelector('[data-overlay="passedRoads"]')?.checked);
  const kansuiOn = Boolean(document.querySelector('[data-overlay="kansui"]')?.checked);
  document.querySelectorAll("#map-legend [data-kind]").forEach(chip => {
    // 初期化の早い段階では passedKindFilter にまだ値が無い（後方で代入）ので、そのときは両方表示とみなす
    const own = passedOn && (passedKindFilter?.[chip.dataset.kind] ?? true);
    // 赤（通れない道）は、みんつくの層が出ていれば押された状態にする
    chip.setAttribute("aria-pressed", String(chip.dataset.kind === "blocked" ? own || kansuiOn : own));
  });
}

function initPresets() {
  const bar = document.getElementById("preset-bar");
  if (!bar) return;
  bar.addEventListener("click", event => {
    const button = event.target.closest("[data-preset]");
    if (button) applyPreset(button.dataset.preset);
  });
}

// レイヤー説明の ⓘ 吹き出し。
// 左パネルは overflow:auto なので絶対配置だと切れる。吹き出しは position:fixed とし、
// ここでボタンの位置から座標を決める。吹き出しの上にカーソルがある間は閉じない
// （中のリンクを押せるようにするため）。
function initLayerTips() {
  const tips = Array.from(document.querySelectorAll(".tip"));
  if (!tips.length) return;
  let openTip = null;
  let closeTimer = null;
  let openedAt = 0;

  function place(tip) {
    const body = tip.querySelector(".tip-body");
    const btn = tip.querySelector(".tip-btn");
    if (!body || !btn) return;
    // 先に表示してから実寸を測る（display:none だと幅・高さが取れない）
    tip.classList.add("is-open");
    const r = btn.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const margin = 8;
    let left = r.right + margin;
    if (left + b.width > window.innerWidth - margin) left = Math.max(margin, r.left - b.width - margin);
    let top = r.top - 4;
    if (top + b.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - margin - b.height);
    body.style.left = `${Math.round(left)}px`;
    body.style.top = `${Math.round(top)}px`;
  }

  function open(tip) {
    window.clearTimeout(closeTimer);
    if (openTip && openTip !== tip) openTip.classList.remove("is-open");
    openTip = tip;
    openedAt = Date.now();
    place(tip);
  }

  function scheduleClose() {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (openTip) openTip.classList.remove("is-open");
      openTip = null;
    }, 180);
  }

  tips.forEach(tip => {
    const btn = tip.querySelector(".tip-btn");
    if (!btn) return;
    tip.addEventListener("mouseenter", () => open(tip));
    tip.addEventListener("mouseleave", scheduleClose);
    btn.addEventListener("focus", () => open(tip));
    btn.addEventListener("blur", scheduleClose);
    // タッチ端末はホバーが無いので、タップで開閉する
    btn.addEventListener("click", event => {
      event.preventDefault();
      if (tip.classList.contains("is-open")) {
        tip.classList.remove("is-open");
        openTip = null;
      } else {
        open(tip);
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && openTip) {
      openTip.classList.remove("is-open");
      openTip = null;
    }
  });
  // スクロールすると位置がずれるので閉じる。
  // ただしスマホで ⓘ をタップした直後は、その操作自体がわずかなスクロールを起こして
  // 開いた瞬間に閉じてしまうため、開いてから400msは無視する。
  document.querySelectorAll(".side-panel").forEach(panel => {
    panel.addEventListener("scroll", () => {
      if (openTip && Date.now() - openedAt > 400) {
        openTip.classList.remove("is-open");
        openTip = null;
      }
    }, { passive: true });
  });
}

function applyPublicViewControls() {
  [
    "sns-collector-button", "add-point-button", "add-road-status-button", "map-click-button",
    "screenshot-button", "import-button", "export-csv-button", "export-geojson-button"
  ].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.hidden = true;
  });
  document.querySelector(".admin-button")?.setAttribute("hidden", "");
  ["photo-queue", "location-queue", "search-log"].forEach(id => {
    const section = document.getElementById(id)?.closest(".panel-section");
    if (section) section.hidden = true;
  });
}

async function initOperatorSession(endpoint) {
  const status = document.getElementById("operator-status");
  try {
    const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(response.status === 401 ? "LOGIN_REQUIRED" : `HTTP ${response.status}`);
    const session = await response.json();
    window.CBIDisasterOperator = session;
    const roleLabel = session.roleLabel || session.role || "登録利用者";
    status.textContent = `${session.displayName || "利用者"} / ${roleLabel}`;
    status.classList.add("is-connected");
    applyOperatorPermissions(session.permissions || {});
    await loadSharedRecords();
  } catch (error) {
    window.CBIDisasterOperator = null;
    status.textContent = error?.message === "LOGIN_REQUIRED" ? "CiDAOログインが必要" : "利用資格を確認できません";
    applyOperatorPermissions({ canEdit: false });
  }
}

function applyOperatorPermissions(permissions) {
  if (!APP_CONFIG.operatorSessionEndpoint) return;
  const canEdit = Boolean(permissions.canEdit || permissions.canCreate);
  [
    "sns-collector-button", "add-point-button", "add-road-status-button", "map-click-button",
    "screenshot-button", "import-button"
  ].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    control.disabled = !canEdit;
    if (!canEdit) control.title = "承認済みの自主防災組織利用者のみ操作できます";
  });
}

async function loadSharedRecords() {
  const endpoint = String(APP_CONFIG.sharedRecordsEndpoint || "").trim();
  if (!endpoint || !window.CBIDisasterOperator) return;
  const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`共有記録の取得に失敗しました (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload.records)) return;
  records = payload.records;
  selectedId = null;
  renderAll();
}

function initHelpGuide() {
  try {
    if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
      localStorage.setItem(GUIDE_SEEN_KEY, "true");
      document.getElementById("help-dialog").showModal();
    }
  } catch {}
}

function applyTrialRecordFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("trial") !== "yawata") return;
  const id = "trial-yawata-palette";
  const incidentDate = getFormValue("incident-date") || todayJst();
  if (!records.some(record => record.id === id)) {
    records = [...records, {
      id,
      title: "やわたパレット・白金通り（市外試験ピン）",
      category: "other",
      locationName: "やわたパレット（市原市八幡1050-3）",
      lat: 35.536659,
      lng: 140.116455,
      locationStatus: "pinned",
      observedAt: `${incidentDate}T00:00`,
      incidentDate,
      sourceType: "web",
      sourceUrl: "https://prdurbanosichapp1.blob.core.windows.net/common-article/6973379d8dbe435020068490/2026_2_seikatujouhou_16-17_kouhouichihara_web.pdf",
      status: "unconfirmed",
      severity: "low",
      passability: "none",
      passabilityMode: "unknown",
      passabilityCheckedAt: "",
      photoStatus: "needs-photo",
      photoUrl: "",
      photoPrivacy: "internal",
      assignedTo: "市外試験",
      notes: "投稿語『八幡パレット』『白金通り』から検索した試験ピン。正式名称は『やわたパレット』。印西市外のため実運用データとは分離して扱う。",
      hazardFlags: { flood: false, inland: false, road: false, landslide: false },
      sourceText: "八幡パレットの白金通り",
      sourceComments: "",
      publicationStatus: "internal",
      publicLocationPrecision: "hidden",
      locationCandidateSource: "public-source-gsi",
      locationCandidateConfidence: 0.94,
      locationCandidateQuery: "千葉県市原市八幡1050-3",
      locationCandidateReason: "市原市広報の所在地と国土地理院地名検索の座標が一致",
      locationCandidateOutsideArea: true,
      locationSearchCheckedAt: nowLocalInput()
    }];
    persistRecords();
  }
  selectedId = PUBLIC_VIEW ? null : id;
  document.getElementById("show-all-dates").checked = true;
  setTimeout(() => {
    if (!PUBLIC_VIEW) map.setView([35.536659, 140.116455], 15);
    renderAll();
    document.getElementById("map-status").textContent = PUBLIC_VIEW
      ? "一般公開用の参考表示です。公開承認済みの情報だけを表示しています。"
      : "市外試験ピン『やわたパレット』を表示しています。";
  }, 250);
}

function openHelpDialog() {
  document.getElementById("help-dialog").showModal();
}

function openOfficialLinksDialog() {
  document.getElementById("official-links-dialog").showModal();
}

function startFromHelp() {
  document.getElementById("help-dialog").close();
  openCollectorDialog();
}

function openCollectorDialog() {
  const incidentDate = getFormValue("incident-date") || dateStamp().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  setFormValue("collector-since", `${incidentDate}T00:00`);
  setFormValue("collector-until", `${incidentDate}T23:59`);
  setFormValue("collector-operator", loadOperator());
  setFormValue("collector-post-url", "");
  setFormValue("collector-post-text", "");
  setFormValue("collector-comments", "");
  setFormValue("collector-post-time", "");
  setFormValue("collector-location-note", "");
  collectorLocationCandidate = null;
  document.getElementById("collector-location-candidate-status").textContent = "候補未選択";
  document.getElementById("collector-link-status").textContent = "";
  apiResultItems = [];
  renderApiResults();
  updateCollectorPlatformHelp();
  document.getElementById("sns-collector-dialog").showModal();
}

function updateCollectorPlatformHelp() {
  const platform = getFormValue("collector-platform");
  const label = platformLabels[platform] || "SNS";
  const mode = getCollectorSearchMode();
  document.getElementById("open-social-search-button").textContent = `${label}で検索を開く`;
  document.getElementById("platform-help").textContent = `${label}の検索画面を新しいタブで開きます。検索語もコピーします。`;
  const messages = {
    instagram: "ハッシュタグなしのキーワードでも検索できます。本文等が候補になりますが、複数語の厳密なAND・完全一致は保証されません。",
    threads: "投稿本文をキーワード検索できます。複数語は絞り込みに使えますが、厳密なAND・完全一致は保証されません。",
    x: mode === "phrase"
      ? "Xは引用符付きの完全一致検索を開きます。ログイン後は高度な検索で期間も絞れます。"
      : "Xは半角スペースで区切った語を、すべて含む投稿として検索できます。",
    "yahoo-realtime": "本文中のキーワードを検索できます。複数語は絞り込みに使えますが、検索サービス側の順位付けがあります。",
    web: "Web検索を利用します。完全一致では引用符を付けて検索します。"
  };
  document.getElementById("search-capability-note").textContent = messages[platform] || messages.web;
}

async function pasteSocialLink() {
  const status = document.getElementById("collector-link-status");
  try {
    const text = await navigator.clipboard.readText();
    const url = extractFirstHttpUrl(text);
    if (!url) throw new Error("URL_NOT_FOUND");
    setFormValue("collector-post-url", url);
    syncCollectorPlatformFromUrl();
    status.textContent = "共有リンクを貼り付けました。";
  } catch (error) {
    status.textContent = error?.message === "URL_NOT_FOUND"
      ? "クリップボードに投稿URLが見つかりません。URL欄へ直接貼り付けてください。"
      : "自動貼り付けが許可されませんでした。URL欄を選び、Ctrl + Vで貼り付けてください。";
    document.getElementById("collector-post-url").focus();
  }
}

function extractFirstHttpUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[)\]}>。、，．]+$/, "") : "";
}

function syncCollectorPlatformFromUrl() {
  const platform = detectPlatformFromUrl(getFormValue("collector-post-url"));
  if (platform && platform !== "web") setFormValue("collector-platform", platform);
  updateCollectorPlatformHelp();
}

function registerSocialLink() {
  const sourceUrl = getFormValue("collector-post-url");
  if (!isHttpUrl(sourceUrl)) {
    alert("Instagramなどの投稿URLを入力してください。");
    return;
  }
  const platform = detectPlatformFromUrl(sourceUrl) || getFormValue("collector-platform") || "other";
  const operator = getFormValue("collector-operator") || loadOperator();
  const checkedAt = nowLocalInput();
  const sourceText = getFormValue("collector-post-text").trim();
  const sourceComments = getFormValue("collector-comments").trim();
  const locationNote = getFormValue("collector-location-note").trim();
  const postTime = parseCollectorPostTime(getFormValue("collector-post-time"), checkedAt);
  const metadata = parseSocialUrlMetadata(sourceUrl);
  const existing = records.find(record => canonicalUrl(record.sourceUrl) === canonicalUrl(sourceUrl));
  if (existing) {
    document.getElementById("sns-collector-dialog").close();
    selectRecord(existing.id, false);
    document.getElementById("map-status").textContent = "この投稿リンクはすでに登録されています。";
    return;
  }
  const record = {
    id: `rec-${Date.now()}`,
    title: sourceText ? truncateText(sourceText, 72) : `${platformLabels[platform] || "SNS"}投稿（場所確認待ち）`,
    category: inferCategory(sourceText),
    locationName: collectorLocationCandidate?.title || locationNote || "場所未特定",
    lat: collectorLocationCandidate?.lat ?? null,
    lng: collectorLocationCandidate?.lng ?? null,
    locationStatus: collectorLocationCandidate ? "pinned" : "unknown",
    observedAt: postTime.observedAt,
    incidentDate: getFormValue("incident-date"),
    sourceType: "sns",
    sourceUrl,
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(sourceText),
    passabilityMode: "unknown",
    passabilityCheckedAt: postTime.observedAt || checkedAt,
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: collectorLocationCandidate ? "位置・内容確認待ち" : "場所確認待ち",
    notes: collectorLocationCandidate
      ? `本文・コメントから採用した場所候補: ${collectorLocationCandidate.title}。${collectorLocationCandidate.outsideInzai ? "印西市外候補。" : ""}候補の緯度経度でピン設定済み。公開前に位置と根拠を確認する。`
      : locationNote
        ? `場所の手掛かり: ${locationNote}。位置を投稿者または別資料で確認後、地図へピンを設定する。`
      : "SNS投稿リンクから登録。投稿者へ撮影場所を確認後、地図へピンを設定する。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: getFormValue("collector-query"),
    evidenceOperator: operator,
    evidenceCheckedAt: checkedAt,
    evidenceRelativeTime: postTime.label,
    observedAtDerived: postTime.derived,
    sourceText,
    sourceComments,
    evidenceOcrText: "",
    evidenceImage: "",
    externalId: metadata.externalId,
    sourceUsername: metadata.sourceUsername,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: collectorLocationCandidate?.source || "",
    locationCandidateConfidence: collectorLocationCandidate?.confidence ?? null,
    locationCandidateQuery: collectorLocationCandidate?.query || "",
    locationCandidateReason: collectorLocationCandidate?.reason || "",
    locationCandidateOutsideArea: Boolean(collectorLocationCandidate?.outsideInzai),
    locationSearchCheckedAt: collectorLocationCandidate ? checkedAt : ""
  };
  saveOperator(operator);
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  logSearch({ platform, query: sourceUrl, operator, checkedAt, method: "link", resultCount: 1 });
  document.getElementById("sns-collector-dialog").close();
  renderAll();
  document.getElementById("map-status").textContent = matchesIncidentDate(record)
    ? "投稿リンクを登録しました。場所が不明な場合は「場所を質問（コメント / DM）」を使います。"
    : "投稿リンクを台帳へ保存しましたが、対象日外のため地図には表示していません。「過去記録も表示」で確認できます。";
}

function detectPlatformFromUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("threads.net") || host.includes("threads.com")) return "threads";
    if (host === "x.com" || host.endsWith(".x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("facebook.com") || host === "fb.watch") return "facebook";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    return "web";
  } catch {
    return "";
  }
}

function getRecordPlatform(record) {
  if (!record) return "";
  const platform = record.evidencePlatform || detectPlatformFromUrl(record.sourceUrl);
  if (!platform || platform === "web" || platform === "other") return "";
  return platform;
}

function parseSocialUrlMetadata(value) {
  try {
    const url = new URL(value);
    const path = url.pathname;
    const instagram = path.match(/^\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
    if (instagram) return { externalId: instagram[1], sourceUsername: "" };
    const threads = path.match(/^\/@([^/]+)\/post\/([^/?#]+)/i);
    if (threads) return { externalId: threads[2], sourceUsername: threads[1] };
    const x = path.match(/^\/([^/]+)\/status\/([^/?#]+)/i);
    if (x) return { externalId: x[2], sourceUsername: x[1] };
  } catch {}
  return { externalId: "", sourceUsername: "" };
}

function parseCollectorPostTime(value, checkedAt) {
  const text = String(value || "").trim();
  if (!text) return { label: "", observedAt: "", derived: false };
  const relative = deriveObservedAtFromRelativeText(text, checkedAt);
  if (relative) return { ...relative, derived: true };
  const normalized = text
    .normalize("NFKC")
    .replace(/[年\/\.]/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!match) return { label: text, observedAt: "", derived: false };
  const [, year, month, day, hour = "00", minute = "00"] = match;
  const observedAt = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
  return Number.isNaN(new Date(observedAt).getTime())
    ? { label: text, observedAt: "", derived: false }
    : { label: "", observedAt, derived: false };
}

function getCollectorSearchMode() {
  return document.querySelector('[name="collector-search-mode"]:checked')?.value || "keywords";
}

function openSocialSearch() {
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  if (!query) {
    alert("検索語を入力してください。");
    return;
  }
  saveOperator(operator);
  const mode = getCollectorSearchMode();
  const effectiveQuery = buildSearchQuery(platform, query, mode);
  const url = buildSocialSearchUrl(platform, effectiveQuery);
  navigator.clipboard?.writeText(effectiveQuery).catch(() => {});
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  else {
    alert("検索画面を開けませんでした。ポップアップの許可を確認してください。");
    appendSystemWorkLog("SNS検索画面", "blocked", "検索画面のポップアップを開けませんでした。", "ブラウザのポップアップ許可を確認する");
  }
  logSearch({ platform, query, operator, checkedAt: nowLocalInput(), method: "manual-search", resultCount: "-" });
}

function collectorToScreenshot() {
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  saveOperator(operator);
  document.getElementById("sns-collector-dialog").close();
  openScreenshotDialog({ platform, query, operator, checkedAt: nowLocalInput() });
  captureScreen();
}

function buildSearchQuery(platform, query, mode) {
  const clean = String(query || "").trim().replace(/\s+/g, " ");
  if (mode === "phrase" && (platform === "x" || platform === "web" || platform === "yahoo-realtime")) {
    return `"${clean.replace(/^"|"$/g, "")}"`;
  }
  return clean;
}

function buildSocialSearchUrl(platform, query) {
  const encoded = encodeURIComponent(query);
  if (platform === "instagram") {
    const tag = query.trim().replace(/^#/, "");
    if (query.trim().startsWith("#") && /^[^\s#]+$/.test(tag)) return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
    return `https://www.instagram.com/explore/search/keyword/?q=${encoded}`;
  }
  if (platform === "threads") return `https://www.threads.net/search?q=${encoded}&serp_type=default`;
  if (platform === "bluesky") return `https://bsky.app/search?q=${encoded}`;
  if (platform === "facebook") return `https://www.facebook.com/search/posts/?q=${encoded}`;
  if (platform === "x") return `https://x.com/search?q=${encoded}&src=typed_query&f=live`;
  if (platform === "yahoo-realtime") return `https://search.yahoo.co.jp/realtime/search?p=${encoded}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} 印西市 災害`)}`;
}

async function searchViaBridge() {
  const endpoint = String(APP_CONFIG.snsSearchEndpoint || "").trim();
  if (!endpoint) return;
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  if (!query) {
    alert("検索語を入力してください。");
    return;
  }
  const button = document.getElementById("api-search-button");
  const results = document.getElementById("api-results");
  button.disabled = true;
  results.innerHTML = '<div class="detail-empty">連携APIを検索中です...</div>';
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        query,
        since: getFormValue("collector-since"),
        until: getFormValue("collector-until")
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    consumeSnsPayload(payload, platform, "api");
    saveOperator(operator);
    logSearch({ platform, query, operator, checkedAt: nowLocalInput(), method: "api", resultCount: apiResultItems.length });
  } catch (error) {
    results.innerHTML = '<div class="duplicate-warning"><strong>連携APIから取得できませんでした</strong>検索画面・スクショ、またはJSON取込を利用してください。</div>';
    appendSystemWorkLog("SNS連携API", "blocked", `連携APIから取得できませんでした: ${error?.message || "不明なエラー"}`, "API設定、権限、レスポンス形式を確認する");
  } finally {
    button.disabled = false;
  }
}

function parseSnsJsonInput() {
  const text = getFormValue("sns-json-input");
  if (!text) return;
  try {
    const payload = JSON.parse(text);
    const platform = getFormValue("collector-platform");
    consumeSnsPayload(payload, platform, "json");
    logSearch({
      platform,
      query: getFormValue("collector-query"),
      operator: getFormValue("collector-operator"),
      checkedAt: nowLocalInput(),
      method: "json",
      resultCount: apiResultItems.length
    });
  } catch {
    alert("JSONの形式を確認してください。");
  }
}

function consumeSnsPayload(payload, fallbackPlatform, method) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
  apiResultItems = source.map(item => normalizeSnsItem(item, fallbackPlatform)).filter(Boolean);
  renderApiResults();
  if (!apiResultItems.length && method === "host") return [];
  return apiResultItems.map(item => ({ ...item }));
}

function normalizeSnsItem(item, fallbackPlatform) {
  if (!item || typeof item !== "object") return null;
  const text = String(item.text || item.caption || item.description || item.title || "").trim();
  const permalink = String(item.permalink || item.url || item.link || "").trim();
  const mediaUrl = String(item.mediaUrl || item.media_url || item.thumbnailUrl || item.thumbnail_url || "").trim();
  const coordinates = item.coordinates || item.location || {};
  const lat = Number(item.lat ?? item.latitude ?? coordinates.lat ?? coordinates.latitude);
  const lng = Number(item.lng ?? item.longitude ?? coordinates.lng ?? coordinates.longitude);
  return {
    externalId: String(item.externalId || item.id || item.shortcode || ""),
    platform: String(item.platform || fallbackPlatform || "web"),
    text,
    permalink,
    mediaUrl,
    timestamp: String(item.timestamp || item.createdAt || item.created_at || ""),
    username: String(item.username || item.owner?.username || ""),
    commentsText: Array.isArray(item.comments)
      ? item.comments.map(comment => typeof comment === "string" ? comment : comment?.text || "").filter(Boolean).join("\n")
      : String(item.commentsText || item.comments_text || item.commentText || ""),
    locationName: String(item.locationName || item.location_name || coordinates.name || ""),
    query: String(item.query || item.matchedQuery || item.matched_query || ""),
    discoveredAt: String(item.discoveredAt || item.discovered_at || ""),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function renderApiResults() {
  const node = document.getElementById("api-results");
  if (!apiResultItems.length) {
    node.innerHTML = '<div class="detail-empty">APIまたはJSONの検索結果はまだありません。</div>';
    return;
  }
  node.innerHTML = apiResultItems.map((item, index) => {
    const duplicate = findExactDuplicate(item);
    return `
      <article class="api-result">
        <div>
          <h3>${escapeHtml(truncateText(item.text || "本文なし", 92))}</h3>
          <p class="result-meta">
            <span>${escapeHtml(platformLabels[item.platform] || item.platform)}</span>
            <span>${escapeHtml(item.username ? `@${item.username}` : "投稿者不明")}</span>
            <span>${escapeHtml(formatDateTime(toDateTimeLocal(item.timestamp)))}</span>
          </p>
          ${item.permalink ? `<p><a href="${escapeAttribute(item.permalink)}" target="_blank" rel="noreferrer">元投稿を開く</a></p>` : ""}
        </div>
        <button class="tool-button ${duplicate ? "" : "primary"}" type="button" data-api-index="${index}" ${duplicate ? "disabled" : ""}>
          ${duplicate ? "登録済" : "候補に追加"}
        </button>
      </article>`;
  }).join("");
}

function handleApiResultAction(event) {
  const button = event.target.closest("[data-api-index]");
  if (!button) return;
  addApiResultAsRecord(apiResultItems[Number(button.dataset.apiIndex)]);
}

function addApiResultAsRecord(item, options = {}) {
  if (!item) return;
  const duplicate = findExactDuplicate(item);
  if (duplicate) {
    selectRecord(duplicate.id, true);
    return;
  }
  const operator = getFormValue("collector-operator") || loadOperator();
  const apiHasLocation = Number.isFinite(item.lat) && Number.isFinite(item.lng);
  const record = {
    id: `rec-${Date.now()}`,
    title: truncateText(item.text || `${platformLabels[item.platform] || "SNS"}投稿候補`, 72),
    category: inferCategory(item.text),
    locationName: item.locationName || "場所未特定",
    lat: apiHasLocation ? item.lat : null,
    lng: apiHasLocation ? item.lng : null,
    locationStatus: apiHasLocation ? "pinned" : "unknown",
    observedAt: toDateTimeLocal(item.timestamp) || nowLocalInput(),
    incidentDate: getFormValue("incident-date"),
    sourceType: item.platform === "web" ? "web" : "sns",
    sourceUrl: item.permalink,
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(item.text),
    passabilityMode: "unknown",
    passabilityCheckedAt: toDateTimeLocal(item.timestamp) || nowLocalInput(),
    photoStatus: item.mediaUrl ? "has-photo" : "needs-photo",
    photoUrl: item.mediaUrl,
    photoPrivacy: "internal",
    assignedTo: apiHasLocation ? "投稿位置情報の確認待ち" : "場所確認待ち",
    notes: "公式APIまたは連携JSONから登録。位置・内容・写真の真正性は未確認。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: item.platform,
    evidenceQuery: options.query || item.query || getFormValue("collector-query"),
    evidenceOperator: operator,
    evidenceCheckedAt: nowLocalInput(),
    sourceText: item.text,
    sourceComments: item.commentsText || "",
    evidenceOcrText: item.text,
    evidenceImage: "",
    externalId: item.externalId,
    sourceUsername: item.username,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: apiHasLocation ? "platform-location" : "",
    locationCandidateConfidence: apiHasLocation ? 0.9 : null,
    locationCandidateQuery: apiHasLocation ? "投稿API位置情報" : "",
    locationCandidateReason: apiHasLocation ? "投稿APIまたは連携JSONに緯度経度が含まれていました" : "",
    locationCandidateOutsideArea: apiHasLocation ? !INZAI_BOUNDS.contains([item.lat, item.lng]) : false,
    locationSearchCheckedAt: apiHasLocation ? nowLocalInput() : ""
  };
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  renderAll();
  renderApiResults();
  if (!options.keepOpen) document.getElementById("sns-collector-dialog").close();
  document.getElementById("map-status").textContent = apiHasLocation
    ? "投稿の場所候補を取得しました。地図上でピン位置を確認してください。"
    : "投稿を登録しました。場所が不明な場合は投稿者へ確認できます。";
}

function findExactDuplicate(item) {
  const url = canonicalUrl(item.permalink);
  return records.find(record =>
    (item.externalId && record.externalId && item.externalId === record.externalId) ||
    (url && canonicalUrl(record.sourceUrl) === url)
  );
}

function inferCategory(text) {
  const value = String(text || "");
  if (/助けて|救助|閉じ込め|生き埋め|安否確認|動けない|取り残され/.test(value)) return "rescue_request";
  if (/地震|揺れ|震度|倒壊|落下物/.test(value)) return "earthquake_damage";
  if (/冠水|アンダーパス|道路.*水/.test(value)) return "road_flood";
  if (/浸水|床上|床下/.test(value)) return "inundation";
  if (/河川|川.*増水|氾濫/.test(value)) return "river";
  if (/崖|土砂|土石流|地すべり/.test(value)) return "landslide";
  if (/通行止|通れない|通行不能|通行規制|通行再開|通れた|走行不能|走行可能|渋滞/.test(value)) return "traffic";
  if (/停電|断水|通信障害/.test(value)) return "lifeline";
  if (/避難所|避難場所/.test(value)) return "shelter";
  return "other";
}

function inferPassability(text) {
  const value = String(text || "");
  if (/通行止|通行禁止|進入禁止|閉鎖/.test(value)) return "closed";
  if (/通れない|通行不能|走行不能|進入不可|立ち往生/.test(value)) return "impassable";
  if (/片側交互|車線規制|通行規制|徐行/.test(value)) return "restricted";
  if (/通行再開|規制解除|開通/.test(value)) return "reopened";
  if (/通れた|通行できた|走行できた|走行可能/.test(value)) return "passed";
  return "none";
}

function deriveObservedAtFromRelativeText(text, referenceValue) {
  const source = String(text || "").normalize("NFKC");
  const reference = new Date(referenceValue || Date.now());
  if (Number.isNaN(reference.getTime())) return null;

  const japaneseMatch = source.match(/(?:約\s*)?(\d+)\s*(秒|分|時間|日|週間)前/);
  if (japaneseMatch) {
    const amount = Number(japaneseMatch[1]);
    const unitMs = {
      秒: 1000,
      分: 60 * 1000,
      時間: 60 * 60 * 1000,
      日: 24 * 60 * 60 * 1000,
      週間: 7 * 24 * 60 * 60 * 1000
    }[japaneseMatch[2]];
    return {
      label: japaneseMatch[0].replace(/\s+/g, ""),
      observedAt: toDateTimeLocal(new Date(reference.getTime() - amount * unitMs).toISOString())
    };
  }

  const englishMatch = source.match(/\b(\d+)\s*(s|m|h|d|w)\b/i);
  if (englishMatch) {
    const amount = Number(englishMatch[1]);
    const unitMs = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    }[englishMatch[2].toLowerCase()];
    return {
      label: englishMatch[0],
      observedAt: toDateTimeLocal(new Date(reference.getTime() - amount * unitMs).toISOString())
    };
  }

  if (/たった今/.test(source)) {
    return { label: "たった今", observedAt: toDateTimeLocal(reference.toISOString()) };
  }
  if (/昨日/.test(source)) {
    return {
      label: "昨日",
      observedAt: toDateTimeLocal(new Date(reference.getTime() - 24 * 60 * 60 * 1000).toISOString())
    };
  }
  return null;
}

async function suggestLocationFromOcr(text) {
  const candidates = await findFreeLocationCandidates({ postText: text, commentsText: "", hint: "" });
  return candidates.find(candidate => !candidate.outsideInzai) || candidates[0] || null;
}

function openLocationSearchDialog(options = {}) {
  const source = options.source || "collector";
  const recordId = options.recordId || (source === "record-form" ? getFormValue("record-id") : null);
  const record = recordId ? records.find(item => item.id === recordId) : null;
  const values = source === "collector"
    ? {
        postText: getFormValue("collector-post-text"),
        commentsText: getFormValue("collector-comments"),
        hint: getFormValue("collector-location-note")
      }
    : source === "record-form"
      ? {
          postText: getFormValue("record-source-text"),
          commentsText: getFormValue("record-source-comments"),
          hint: getFormValue("record-location")
        }
      : {
          postText: record?.sourceText || record?.evidenceOcrText || "",
          commentsText: record?.sourceComments || record?.locationAnswerNote || "",
          hint: record?.locationName && !["場所未特定", "位置未確定"].includes(record.locationName) ? record.locationName : ""
        };
  locationSearchContext = { source, recordId, candidates: [] };
  setFormValue("location-search-post-text", values.postText);
  setFormValue("location-search-comments", values.commentsText);
  setFormValue("location-search-hint", values.hint);
  document.getElementById("location-search-status").textContent = "無料候補検索から始めてください。「この候補を使う」を押すと、その緯度経度でピンを設定します。";
  renderLocationCandidates();
  updateLocationWebSearchLink();
  document.getElementById("location-search-dialog").showModal();
}

function getLocationSearchInput() {
  return {
    postText: getFormValue("location-search-post-text"),
    commentsText: getFormValue("location-search-comments"),
    hint: getFormValue("location-search-hint")
  };
}

function updateLocationWebSearchLink() {
  const input = getLocationSearchInput();
  const query = [input.hint, input.postText, input.commentsText]
    .filter(Boolean)
    .join(" ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  document.getElementById("location-web-search-link").href = `https://www.google.com/search?q=${encodeURIComponent(query || "印西市 災害 場所")}`;
}

async function runFreeLocationSearch() {
  const button = document.getElementById("free-location-search-button");
  const status = document.getElementById("location-search-status");
  const input = getLocationSearchInput();
  if (![input.postText, input.commentsText, input.hint].some(Boolean)) {
    status.textContent = "投稿本文、コメント、場所の手掛かりのいずれかを入力してください。";
    return;
  }
  button.disabled = true;
  status.textContent = "地名・施設名・道路名を抽出して、公開地名検索に照会しています...";
  try {
    const candidates = await findFreeLocationCandidates(input);
    locationSearchContext.candidates = candidates;
    renderLocationCandidates();
    status.textContent = candidates.length
      ? `${candidates.length}件の候補が見つかりました。市外候補も含め、根拠と地図を確認してください。`
      : "候補を特定できませんでした。コメントで町名・目印を確認するか、AI補完・Web検索を利用してください。";
  } catch (error) {
    status.textContent = `候補検索に失敗しました（${error?.message || "接続エラー"}）。`;
  } finally {
    button.disabled = false;
  }
}

async function findFreeLocationCandidates(input) {
  const queryItems = buildLocationQueries(input);
  const candidates = [];
  for (const item of queryItems.slice(0, 6)) {
    try {
      const response = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(item.query)}`);
      if (!response.ok) continue;
      const results = await response.json();
      if (!Array.isArray(results)) continue;
      results.slice(0, item.alias ? 1 : 3).forEach(result => {
        const coordinates = result?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return;
        const lng = Number(coordinates[0]);
        const lat = Number(coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const address = String(result.properties?.title || item.query);
        const tooBroad = /(?:都|道|府|県|市|区|町|村)$/.test(address) && item.query.length > address.length + 3 && !item.alias;
        if (tooBroad) return;
        candidates.push({
          title: item.alias?.title || address,
          address,
          lat,
          lng,
          query: item.query,
          source: item.alias ? "local-alias-gsi" : "gsi",
          confidence: Math.max(0.35, Math.min(1, item.confidence - (tooBroad ? 0.25 : 0))),
          reason: item.alias?.reason || item.reason,
          sourceUrl: item.alias?.sourceUrl || "https://maps.gsi.go.jp/",
          outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
          autoPin: false
        });
      });
    } catch {}
  }
  return dedupeLocationCandidates(candidates).sort((left, right) => {
    if (left.outsideInzai !== right.outsideInzai) return left.outsideInzai ? 1 : -1;
    return right.confidence - left.confidence;
  }).slice(0, 8);
}

function buildLocationQueries(input) {
  const source = [input.hint, input.postText, input.commentsText].filter(Boolean).join("\n").normalize("NFKC");
  const items = [];
  locationAliases.forEach(alias => {
    if (alias.patterns.some(pattern => source.includes(pattern))) {
      items.push({ query: alias.query, confidence: alias.confidence, reason: alias.reason, alias });
    }
  });

  const addressPattern = /(?:(?:北海道|東京都|(?:京都|大阪)府|.{2,3}県))?(?:[一-龯々ヶケ]{1,12}(?:市|区|町|村))[一-龯々ヶケぁ-んァ-ヶー0-9\-丁目番地号]{2,36}/g;
  (source.match(addressPattern) || []).slice(0, 3).forEach(value => {
    items.push({ query: value, confidence: /\d/.test(value) ? 0.92 : 0.76, reason: "本文またはコメントに住所・自治体名を含む記述があります" });
  });

  const knownPlaces = [
    "千葉ニュータウン中央駅", "印西牧の原駅", "印旛日本医大駅", "木下駅", "小林駅",
    "六軒", "大森", "草深", "船尾", "師戸", "岩戸", "瀬戸", "平賀"
  ];
  knownPlaces.filter(place => source.includes(place)).slice(0, 3).forEach(place => {
    items.push({ query: `千葉県印西市${place}`, confidence: 0.84, reason: "印西市内の既知の地名を検出しました" });
  });

  const municipality = (source.match(/[一-龯々ヶケ]{1,12}(?:市|区|町|村)/) || [])[0] || "印西市";
  const placeTerms = source.match(/[一-龯々ヶケぁ-んァ-ヶーA-Za-z0-9]{2,28}(?:駅|通り|街道|道路|橋|交差点|公園|学校|病院|センター|パレット|ガード|店)/g) || [];
  placeTerms.slice(0, 4).forEach(term => {
    items.push({ query: `千葉県${municipality}${term}`, confidence: 0.66, reason: "施設名・道路名・目印らしい語を検出しました" });
  });

  const hint = String(input.hint || "").replace(/\s+/g, " ").trim();
  if (hint && !items.some(item => item.query.includes(hint))) {
    const prefix = /(?:都|道|府|県|市|区|町|村)/.test(hint) ? "" : `千葉県${municipality}`;
    items.push({ query: `${prefix}${hint}`, confidence: 0.62, reason: "入力された場所の手掛かりを検索しました" });
  }

  const seen = new Set();
  return items.filter(item => {
    const key = item.query.replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeLocationCandidates(candidates) {
  const result = [];
  candidates.forEach(candidate => {
    const duplicate = result.find(item => distanceMeters(item.lat, item.lng, candidate.lat, candidate.lng) < 80);
    if (!duplicate) result.push(candidate);
    else if (candidate.confidence > duplicate.confidence) Object.assign(duplicate, candidate);
  });
  return result;
}

async function runAiLocationSearch() {
  const endpoint = String(APP_CONFIG.locationAiEndpoint || "").trim();
  const status = document.getElementById("location-search-status");
  if (!endpoint) {
    status.textContent = "AI連携先は未設定です。無料候補検索またはWeb検索を利用してください。";
    return;
  }
  const button = document.getElementById("ai-location-search-button");
  const input = getLocationSearchInput();
  button.disabled = true;
  status.textContent = "個人情報をマスクし、CBI側のAI連携先で候補を補完しています...";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        version: "1",
        targetArea: { name: "千葉県印西市", bounds: [[35.735, 140.055], [35.875, 140.245]] },
        postText: redactSensitiveText(input.postText),
        commentsText: redactSensitiveText(input.commentsText),
        locationHint: redactSensitiveText(input.hint),
        existingCandidates: locationSearchContext.candidates.map(candidate => withoutCandidatePrivateFields(candidate))
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const aiCandidates = normalizeAiLocationCandidates(payload.candidates || payload.data || []);
    locationSearchContext.candidates = dedupeLocationCandidates([...locationSearchContext.candidates, ...aiCandidates]);
    renderLocationCandidates();
    status.textContent = aiCandidates.length
      ? `AI補完で${aiCandidates.length}件を追加しました。候補の根拠を確認して採用してください。`
      : "AI補完でも新しい候補を特定できませんでした。投稿者への確認を続けてください。";
  } catch (error) {
    status.textContent = `AI補完に失敗しました（${error?.message || "接続エラー"}）。無料候補はそのまま利用できます。`;
    appendSystemWorkLog("AI場所候補検索", "blocked", status.textContent, "CBI側AIエンドポイントと利用者認証を確認する");
  } finally {
    button.disabled = false;
  }
}

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[メール非送信]")
    .replace(/(?:\+?81[- ]?)?0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}/g, "[電話番号非送信]")
    .replace(/@[A-Za-z0-9_.]{2,30}/g, "@[アカウント非送信]")
    .slice(0, 4000);
}

function withoutCandidatePrivateFields(candidate) {
  return {
    title: candidate.title,
    address: candidate.address,
    lat: candidate.lat,
    lng: candidate.lng,
    confidence: candidate.confidence,
    source: candidate.source
  };
}

function normalizeAiLocationCandidates(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    const lat = Number(item.lat ?? item.latitude);
    const lng = Number(item.lng ?? item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      title: String(item.title || item.name || item.address || "AI場所候補"),
      address: String(item.address || item.title || ""),
      lat,
      lng,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      reason: String(item.reason || "投稿本文とコメントからAIが推定"),
      query: String(item.query || "AI補完"),
      source: "ai",
      sourceUrl: isHttpUrl(item.sourceUrl) ? item.sourceUrl : "",
      outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
      autoPin: false
    };
  }).filter(Boolean);
}

function renderLocationCandidates() {
  const node = document.getElementById("location-candidate-results");
  const candidates = locationSearchContext.candidates || [];
  if (!candidates.length) {
    node.innerHTML = '<div class="detail-empty">場所候補はまだありません。</div>';
    return;
  }
  node.innerHTML = candidates.map((candidate, index) => `
    <article class="location-candidate-card ${candidate.outsideInzai ? "is-outside" : ""}">
      <div>
        <strong>${escapeHtml(candidate.title)}</strong>
        <p>${escapeHtml(candidate.address || candidate.reason || "候補住所なし")}</p>
        <div class="location-candidate-meta">
          <span class="badge ${candidate.outsideInzai ? "orange" : "green"}">${candidate.outsideInzai ? "印西市外" : "印西市内"}</span>
          <span class="badge blue">確度 ${Math.round(candidate.confidence * 100)}%</span>
          <span class="badge yellow">${escapeHtml(locationCandidateSourceLabel(candidate.source))}</span>
        </div>
        <p>${escapeHtml(candidate.reason || "候補の根拠は未記載です")}</p>
      </div>
      <button class="tool-button primary" type="button" data-location-candidate-index="${index}">この候補を使う</button>
    </article>
  `).join("");
}

function locationCandidateSourceLabel(source) {
  if (source === "image-exif") return "元画像GPS";
  if (source === "ai") return "AI補完";
  if (source === "local-alias-gsi" || source === "public-source-gsi") return "公開資料+地理院";
  return "国土地理院検索";
}

function publicationStatusLabel(value) {
  return ({ internal: "内部確認中", review: "公開承認待ち", published: "公開承認済み" })[value] || "内部確認中";
}

function publicLocationPrecisionLabel(value) {
  return ({ hidden: "位置非公開", approximate: "概略位置", exact: "正確な位置" })[value] || "位置非公開";
}

function handleLocationCandidateAction(event) {
  const button = event.target.closest("[data-location-candidate-index]");
  if (!button) return;
  const candidate = locationSearchContext.candidates[Number(button.dataset.locationCandidateIndex)];
  if (!candidate) return;
  applyLocationCandidate(candidate);
}

function applyLocationCandidate(candidate) {
  const checkedAt = nowLocalInput();
  if (locationSearchContext.source === "collector") {
    collectorLocationCandidate = candidate;
    setFormValue("collector-location-note", candidate.title);
    document.getElementById("collector-location-candidate-status").textContent = `${candidate.title} / ${candidate.outsideInzai ? "印西市外" : "印西市内"} / 確度${Math.round(candidate.confidence * 100)}%`;
  } else if (locationSearchContext.source === "record-form") {
    recordFormLocationCandidate = candidate;
    setFormValue("record-location", candidate.title);
    setFormValue("record-lat", candidate.lat.toFixed(6));
    setFormValue("record-lng", candidate.lng.toFixed(6));
    setFormValue("record-location-status", "pinned");
    setFormValue("record-source-text", getFormValue("location-search-post-text"));
    setFormValue("record-source-comments", getFormValue("location-search-comments"));
  } else {
    const record = records.find(item => item.id === locationSearchContext.recordId);
    if (!record) return;
    record.locationName = candidate.title;
    record.lat = candidate.lat;
    record.lng = candidate.lng;
    record.locationStatus = "pinned";
    record.sourceComments = getFormValue("location-search-comments");
    Object.assign(record, locationCandidateAuditFields(candidate, checkedAt));
    record.assignedTo = "位置・内容確認待ち";
    persistRecords();
    selectedId = record.id;
    map.setView([candidate.lat, candidate.lng], 15);
    renderAll();
  }
  document.getElementById("location-search-dialog").close();
  document.getElementById("map-status").textContent = `${candidate.title}の緯度経度でピンを設定しました。公開前に位置と根拠を確認してください。`;
}

function locationCandidateAuditFields(candidate, checkedAt = nowLocalInput()) {
  return {
    locationCandidateSource: candidate.source || "",
    locationCandidateConfidence: candidate.confidence ?? null,
    locationCandidateQuery: candidate.query || "",
    locationCandidateReason: candidate.reason || "",
    locationCandidateOutsideArea: Boolean(candidate.outsideInzai),
    locationSearchCheckedAt: checkedAt
  };
}

function logSearch(entry) {
  searchLog = [{
    id: `search-${Date.now()}`,
    platform: entry.platform || "web",
    query: entry.query || "",
    operator: entry.operator || "",
    checkedAt: entry.checkedAt || nowLocalInput(),
    method: entry.method || "manual-search",
    resultCount: entry.resultCount ?? "-"
  }, ...searchLog].slice(0, 50);
  try {
    localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(searchLog));
  } catch {}
  renderSearchLog();
}

function loadSearchLog() {
  try {
    const raw = localStorage.getItem(SEARCH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderSearchLog() {
  const node = document.getElementById("search-log");
  if (!node) return;
  if (!searchLog.length) {
    node.innerHTML = '<div class="detail-empty">検索履歴はまだありません。</div>';
    return;
  }
  node.innerHTML = searchLog.slice(0, 8).map(item => `
    <div class="search-log-item">
      <strong>${escapeHtml(platformLabels[item.platform] || item.platform)} / ${escapeHtml(item.query || "検索語なし")}</strong>
      <span>${escapeHtml(formatDateTime(item.checkedAt))} ・ ${escapeHtml(item.operator || "確認者未設定")} ・ ${escapeHtml(searchMethodLabels[item.method] || item.method)}</span>
    </div>
  `).join("");
}

function clearSearchLog() {
  searchLog = [];
  try {
    localStorage.removeItem(SEARCH_LOG_KEY);
  } catch {}
  renderSearchLog();
}

function loadOperator() {
  try {
    return localStorage.getItem(OPERATOR_KEY) || "";
  } catch {
    return "";
  }
}

function saveOperator(operator) {
  if (!operator) return;
  try {
    localStorage.setItem(OPERATOR_KEY, operator);
  } catch {}
}

let bunkazaiLoaded = false;
async function ensureBunkazaiLayer() {
  if (bunkazaiLoaded) return;
  bunkazaiLoaded = true;
  try {
    const res = await fetch("../metaverse/bunkazai.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`bunkazai.json HTTP ${res.status}`);
    const data = await res.json();
    const colors = { "国指定": "#e74c3c", "国登録": "#e67e22", "県指定": "#9b59b6", "市指定": "#3498db" };
    (data.spots || []).forEach(b => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return;
      const marker = L.circleMarker([b.lat, b.lon], {
        radius: 7, color: "#ffffff", weight: 1.5,
        fillColor: colors[b.designation] || "#3498db", fillOpacity: 0.9
      });
      marker.bindPopup(
        `<strong>🏛 ${escapeHtml(b.name)}</strong><br>` +
        `［${escapeHtml(b.designation)}・${escapeHtml(b.type)}${b.era ? "・" + escapeHtml(b.era) : ""}］ 印西市${escapeHtml(b.address)}<br>` +
        (b.description ? `<span style="font-size:11px;">${escapeHtml(b.description.slice(0, 80))}…</span><br>` : "") +
        (b.detailUrl ? `<a href="${b.detailUrl}" target="_blank" rel="noreferrer">市公式ページ（出典）</a> ・ ` : "") +
        `<a href="../metaverse/" target="_blank" rel="noreferrer">3Dで見る</a>`
      );
      marker.addTo(bunkazaiLayer);
    });
  } catch (error) {
    bunkazaiLoaded = false;
    console.error("文化財データの読み込みに失敗:", error);
  }
}

let kominkanLoaded = false;
async function ensureKominkanLayer() {
  if (kominkanLoaded) return;
  kominkanLoaded = true;
  try {
    const res = await fetch("../metaverse/kominkan.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`kominkan.json HTTP ${res.status}`);
    const data = await res.json();
    (data.facilities || []).forEach(k => {
      const marker = L.circleMarker([k.lat, k.lon], {
        radius: 7, color: "#ffffff", weight: 1.5, fillColor: "#00bcd4", fillOpacity: 0.9
      });
      marker.bindPopup(
        `<strong>🏢 ${escapeHtml(k.name)}</strong><br>` +
        `${escapeHtml(k.address)}<br>` +
        `<a href="${k.url}" target="_blank" rel="noreferrer">市公式ページ（出典）</a>`
      );
      marker.addTo(kominkanLayer);
    });
  } catch (error) {
    kominkanLoaded = false;
    console.error("公民館データの読み込みに失敗:", error);
  }
}

let pastFloodLoaded = false;
let pastFloodPoints = [];           // past-flood-points.json の全地点（日付フィルタ用に保持）
let pastFloodSelectedDates = null;  // null=全日付、Set=選択中の日付
async function ensurePastFloodLayer() {
  if (pastFloodLoaded) return;
  pastFloodLoaded = true;
  try {
    const res = await fetch("past-flood-points.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`past-flood-points.json HTTP ${res.status}`);
    const data = await res.json();
    pastFloodPoints = (data.points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    renderPastFloodDateFilter();
    renderPastFloodMarkers();
  } catch (error) {
    pastFloodLoaded = false;
    console.error("過去冠水実績データの読み込みに失敗:", error);
  }
}

// 記録にある日付を列挙し、複数選択で振り返りできるようにする（既定は全日付ON）
function renderPastFloodDateFilter() {
  const box = document.getElementById("past-flood-dates");
  if (!box) return;
  const dates = [...new Set(pastFloodPoints.flatMap(p => p.dates || []))].sort().reverse();
  if (!dates.length) { box.innerHTML = '<span class="past-flood-empty">記録なし</span>'; return; }
  box.innerHTML = dates.map(d => {
    const count = pastFloodPoints.filter(p => (p.dates || []).includes(d)).length;
    const checked = !pastFloodSelectedDates || pastFloodSelectedDates.has(d);
    return `<label class="past-flood-date"><input type="checkbox" data-past-flood-date="${escapeAttribute(d)}" ${checked ? "checked" : ""}> ${escapeHtml(d)}<span class="past-flood-count">${count}</span></label>`;
  }).join("") + '<button type="button" class="past-flood-all" data-past-flood-all>全日付</button>';
}

function handlePastFloodDateChange(event) {
  const box = document.getElementById("past-flood-dates");
  if (!box) return;
  if (event.target.closest("[data-past-flood-all]")) {
    pastFloodSelectedDates = null;
    box.querySelectorAll("[data-past-flood-date]").forEach(input => { input.checked = true; });
  } else if (event.target.matches("[data-past-flood-date]")) {
    pastFloodSelectedDates = new Set([...box.querySelectorAll("[data-past-flood-date]:checked")].map(i => i.dataset.pastFloodDate));
  } else {
    return;
  }
  renderPastFloodMarkers();
}

function renderPastFloodMarkers() {
  pastFloodLayer.clearLayers();
  pastFloodPoints.forEach(p => {
    const dates = p.dates || [];
    if (pastFloodSelectedDates && !dates.some(d => pastFloodSelectedDates.has(d))) return;
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 8, color: "#ffffff", weight: 1.5, fillColor: "#0d47a1", fillOpacity: 0.85
    });
    marker.bindPopup(
      `<strong>🌊 ${escapeHtml(p.name || "冠水ポイント")}</strong><br>` +
      `冠水確認日: ${escapeHtml(dates.join("、") || "不明")}<br>` +
      (p.note ? `${escapeHtml(p.note)}<br>` : "") +
      `出典: ${p.sourceUrl ? `<a href="${escapeAttribute(p.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(p.source || "記録")}</a>` : escapeHtml(p.source || "運用者記録")}` +
      (p.verifiedBy ? `（確認: ${escapeHtml(p.verifiedBy)}）` : "") +
      `<br><span style="font-size:11px;">過去に冠水が確認された地点の実績です。ハザード想定や現在の冠水状況ではありません。</span>`
    );
    marker.addTo(pastFloodLayer);
  });
}

// 💥 堤防の決壊地点と浸水範囲（公式の推定）（2026-09-23追加）
// 県・水資源機構が公表した浸水状況図（PDF）の線と×印を、運営が緯度経度へ読み取ったもの（levee-breaches.json）。
// CBI の試算は載せない（公式の推定だけを出す＝2026-09-23 事業主決定A）。対象日フィルタは掛けない。
const leveeBreachLayer = L.layerGroup();
const leveeBreachRenderer = L.svg({ pane: "leveeBreachPane" });
let leveeBreachLoaded = false;
async function ensureLeveeBreachLayer() {
  if (leveeBreachLoaded) return;
  leveeBreachLoaded = true;
  try {
    const res = await fetch("levee-breaches.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`levee-breaches.json HTTP ${res.status}`);
    renderLeveeBreaches(await res.json());
  } catch (error) {
    leveeBreachLoaded = false;
    console.error("決壊・浸水範囲データの読み込みに失敗:", error);
  }
}

function renderLeveeBreaches(data) {
  leveeBreachLayer.clearLayers();
  (data.events || []).forEach(ev => {
    const asOf = roadClosureTime(ev.asOf, true);
    const sourceHtml =
      (ev.source?.url ? `出典: <a href="${escapeAttribute(ev.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(ev.source.name)}</a><br>` : "") +
      (ev.mapSource?.url ? `図: <a href="${escapeAttribute(ev.mapSource.url)}" target="_blank" rel="noreferrer">${escapeHtml(ev.mapSource.name)}</a><br>` : "");
    const note = `<span style="font-size:11px;">公表された図の線を運営が地図に写したもので、数十mずれることがあります。最新の状況は出典で確認してください。</span>`;
    (ev.floodAreas || []).forEach(area => {
      if (!Array.isArray(area.path) || area.path.length < 3) return;
      L.polygon(area.path, {
        pane: "leveeBreachPane",
        renderer: leveeBreachRenderer,
        color: "#1f3346",
        weight: 2,
        fillColor: "#7fa3c4",
        fillOpacity: 0.35
      }).bindPopup(
        `<strong>🌊 ${escapeHtml(area.name || "浸水範囲（推定）")}</strong><br>` +
        `${escapeHtml(ev.title || "")}${asOf ? `（${escapeHtml(asOf)} 時点）` : ""}<br>` +
        (ev.mapSource?.estimatedBy ? `${escapeHtml(ev.mapSource.estimatedBy)}<br>` : "") +
        sourceHtml + note
      ).addTo(leveeBreachLayer);
    });
    (ev.breaches || []).forEach(b => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return;
      L.marker([b.lat, b.lon], {
        pane: "leveeBreachMarkPane",
        icon: L.divIcon({ className: "levee-breach-mark", html: "✕", iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: `決壊地点：${b.name || ""}`
      }).bindPopup(
        `<strong>💥 決壊地点：${escapeHtml(b.name || "")}</strong><br>` +
        (b.detail ? `${escapeHtml(b.detail)}<br>` : "") +
        `${escapeHtml(ev.title || "")}<br>` +
        sourceHtml + note
      ).addTo(leveeBreachLayer);
    });
  });
}

// 🧪 決壊地点からの浸水の試算（CBI・公式ではない）（2026-09-23追加・事業主決定＝一般公開・既定OFF）
// levee-sim.json は 5m標高で「決壊地点につながる、この高さ以下の陸地」を塗ったもの（scripts/levee-breach/）。
// 水位はボタンで切り替える。公式の推定（leveeBreach）の上に、薄い塗り＋太い点線で描く。
const leveeSimLayer = L.layerGroup();
const leveeSimRenderer = L.svg({ pane: "leveeSimPane" });
let leveeSimData = null;
let leveeSimH = null;
async function ensureLeveeSimLayer() {
  if (!leveeSimData) {
    try {
      const res = await fetch("levee-sim.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`levee-sim.json HTTP ${res.status}`);
      leveeSimData = await res.json();
      if (leveeSimH === null) leveeSimH = leveeSimData.defaultH;
    } catch (error) {
      console.error("浸水の試算データの読み込みに失敗:", error);
      return;
    }
  }
  renderLeveeSim();
}

function renderLeveeSim() {
  const box = document.getElementById("levee-sim-levels");
  const levels = leveeSimData?.levels || [];
  if (box) {
    box.innerHTML = levels.map(l =>
      `<button type="button" class="levee-sim-btn${l.h === leveeSimH ? " is-on" : ""}" data-levee-sim-h="${escapeAttribute(String(l.h))}">${escapeHtml(l.h.toFixed(1))}m</button>`
    ).join("") +
      `<p class="levee-sim-note">標高（T.P.）何mまで水が入ったかを選びます。${escapeHtml(leveeSimData?.officialMatch || "")}。` +
      (leveeSimData?.lakeNote ? `<br>${escapeHtml(leveeSimData.lakeNote)}` : "") + `</p>`;
    box.hidden = false;
  }
  leveeSimLayer.clearLayers();
  const level = levels.find(l => l.h === leveeSimH);
  if (!level) return;
  const popup =
    `<strong>🧪 浸水の試算（CBI・公式ではありません）</strong><br>` +
    `標高 T.P.${escapeHtml(level.h.toFixed(1))}m 以下の土地に、決壊地点から水が入った場合：約${escapeHtml(String(level.areaKm2))}km²<br>` +
    `<span style="font-size:11px;">国土地理院の5m標高から計算した目安です。堤防・排水機場・時間の経過・雨は入っていません。川と沼は水が越えないものとして扱っているため、印西市側への広がりは分かりません。実際の浸水範囲は県の発表（💥のレイヤー）で確認してください。</span>`;
  level.polygons.forEach(rings => {
    L.polygon(rings, {
      pane: "leveeSimPane",
      renderer: leveeSimRenderer,
      color: "#ea580c",
      weight: 3,
      dashArray: "6 5",
      fillColor: "#f97316",
      fillOpacity: 0.16
    }).bindPopup(popup).addTo(leveeSimLayer);
  });
}

document.addEventListener("click", event => {
  const btn = event.target.closest?.("[data-levee-sim-h]");
  if (!btn) return;
  leveeSimH = Number(btn.dataset.leveeSimH);
  renderLeveeSim();
});

// 🚇 アンダーパスの位置（国土交通省）（2026-09-23追加・既定OFF）
// 国交省「全国のアンダーパス箇所マップ」の関東分から、印西市とその周りを取り出した underpass-mlit.json。
// 公共データ利用規約1.0。出典は「加工して作成」と書く（国が作ったように見せない）。
const underpassMlitLayer = L.layerGroup();
// 点は冠水の線（450）より上に置き、SVG で描く（canvas だと上の層にクリックを吸われる）
map.createPane("underpassMlitPane");
map.getPane("underpassMlitPane").style.zIndex = 455;
const underpassMlitRenderer = L.svg({ pane: "underpassMlitPane" });
let underpassMlitLoaded = false;
async function ensureUnderpassMlitLayer() {
  if (underpassMlitLoaded) return;
  underpassMlitLoaded = true;
  try {
    const res = await fetch("underpass-mlit.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`underpass-mlit.json HTTP ${res.status}`);
    const data = await res.json();
    const src = data.source || {};
    (data.points || []).forEach(p => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
      L.circleMarker([p.lat, p.lon], {
        pane: "underpassMlitPane", renderer: underpassMlitRenderer,
        radius: 7, color: "#ffffff", weight: 2, fillColor: "#6d28d9", fillOpacity: 0.9
      }).bindPopup(
        `<strong>🚇 ${escapeHtml(p.name || "アンダーパス")}</strong><br>` +
        (p.road ? `路線: ${escapeHtml(p.road)}<br>` : "") +
        (p.manager ? `管理者: ${escapeHtml(p.manager)}<br>` : "") +
        UNDERPASS_WARNING_HTML +
        `<span class="reference-warning">いま冠水しているかどうかは示していません</span><br>` +
        `<span style="font-size:11px;">${escapeHtml(src.credit || "出典：国土交通省")}（<a href="${escapeAttribute(src.url || "")}" target="_blank" rel="noreferrer">元の地図</a>・${escapeHtml(data.fetchedAt || "")}取得）</span>`
      ).addTo(underpassMlitLayer);
    });
  } catch (error) {
    underpassMlitLoaded = false;
    console.error("アンダーパス（国土交通省）の読み込みに失敗:", error);
  }
}

// 🚃 鉄道の運休・遅れ区間（2026-09-21追加）
// 市「災害時の公共交通のご案内」は「成田駅～我孫子駅間」のように駅名で来るため、
// 区間の形（rail-segments.json・OpenStreetMap 由来／pipeline/build_rail_segments.py で生成）と
// どこが止まっているか（rail-status.json・市の発表を見て人が書き換える）を分けて持つ。
// 冠水の赤・青と色が混ざるので既定OFF。ONにした人にだけ描く。
const RAIL_STATE_STYLE = {
  suspended: { label: "運休", color: "#b91c1c", weight: 8 },
  disrupted: { label: "遅れ・運休", color: "#dc2626", weight: 8 },
  delayed: { label: "遅れ", color: "#d97706", weight: 7 },
  restored: { label: "運転再開", color: "#2f855a", weight: 6 }
};
// 発表からこれだけ経ったら「古い情報かもしれない」と添える
const RAIL_STALE_HOURS = 6;
const railStatusLayer = L.layerGroup();
// 地図全体は canvas 描画（preferCanvas）だが、この層だけは SVG で描く。
// 区間は多くて23本と少なく、canvas だと他の層とクリックを取り合ってポップアップが開かない。
const railStatusRenderer = L.svg({ pane: "railStatusPane" });
let railStatusLoaded = false;
let railSegmentsData = null;
let railStatusData = null;

// 運休の状態は CiDAO から取る（市が再開を発表するとサーバー側で自動的に解除される）。
// 通信できないときだけ、同じフォルダの静的ファイルを使う（古い情報が残りうるので最後の手段）。
async function fetchRailStatusData() {
  const endpoint = String(APP_CONFIG.railStatusEndpoint || "").trim();
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      payload.fromServer = true;
      return payload;
    } catch (error) {
      console.warn("運行情報APIを取得できないため静的ファイルを使います:", error);
    }
  }
  const res = await fetch("rail-status.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`rail-status.json HTTP ${res.status}`);
  const payload = await res.json();
  payload.fromServer = false;
  return payload;
}

async function ensureRailStatusLayer() {
  if (railStatusLoaded) return;
  railStatusLoaded = true;
  try {
    const [segments, status] = await Promise.all([
      fetch("rail-segments.json", { cache: "no-store" }),
      fetchRailStatusData()
    ]);
    if (!segments.ok) throw new Error(`rail-segments.json HTTP ${segments.status}`);
    railSegmentsData = await segments.json();
    railStatusData = status;
    if (Array.isArray(status.cleared) && status.cleared.length) {
      console.info("運行情報：解除済みのため表示していない項目", status.cleared);
    }
    renderRailStatus();
  } catch (error) {
    railStatusLoaded = false;
    console.error("鉄道の運行情報の読み込みに失敗:", error);
    document.getElementById("map-status").textContent =
      `鉄道の運行情報を取得できませんでした（${error?.message || "接続エラー"}）。`;
  }
}

function railStatusTime(iso) {
  const time = Date.parse(iso || "");
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function railStatusIsStale(iso) {
  const time = Date.parse(iso || "");
  if (!Number.isFinite(time)) return false;
  return Date.now() - time > RAIL_STALE_HOURS * 3600 * 1000;
}

function renderRailStatus() {
  railStatusLayer.clearLayers();
  if (!railSegmentsData || !railStatusData) return;
  const lines = railSegmentsData.lines || [];
  const source = railStatusData.source || {};
  let drawn = 0;

  (railStatusData.railways || []).forEach(entry => {
    const line = lines.find(item => item.id === entry.line);
    if (!line) return;
    const names = (line.stations || []).map(station => station.name);
    const fromIndex = names.indexOf(entry.from);
    const toIndex = names.indexOf(entry.to);
    // 駅名が路線のどこにも無ければ描かない（誤った区間を赤くしないため）
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const style = RAIL_STATE_STYLE[entry.state] || RAIL_STATE_STYLE.delayed;
    const announced = railStatusTime(entry.announcedAt || railStatusData.updatedAt);
    const stale = railStatusIsStale(entry.announcedAt || railStatusData.updatedAt);
    // 出典は項目ごと。市の案内に載らない事業者発表を運営が確認して登録した項目（sourceType: operator）は
    // その事業者を出典として出し、線の名前も実際の路線名（例：北総線の線路を走るスカイアクセス線）で見せる
    const operatorSourced = entry.sourceType === "operator";
    const entrySource = entry.sourceUrl ? { url: entry.sourceUrl, label: entry.sourceLabel } : source;
    const infoUrl = operatorSourced ? entry.sourceUrl : line.infoUrl;
    const popup =
      `<strong>🚃 ${escapeHtml(entry.lineLabel || line.name)}</strong><br>` +
      `<span style="color:${style.color};font-weight:700;">${escapeHtml(entry.from)}〜${escapeHtml(entry.to)}：${escapeHtml(style.label)}</span><br>` +
      (entry.detail ? `${escapeHtml(entry.detail)}<br>` : "") +
      (announced ? `発表: ${escapeHtml(announced)} 時点<br>` : "") +
      (entrySource.url
        ? `出典: <a href="${escapeAttribute(entrySource.url)}" target="_blank" rel="noreferrer">${escapeHtml(entrySource.label || "印西市")}</a>${operatorSourced ? "（運営が確認して登録）" : ""}<br>`
        : "") +
      (infoUrl && !operatorSourced
        ? `<a href="${escapeAttribute(infoUrl)}" target="_blank" rel="noreferrer">${escapeHtml(line.operator || "事業者")}の運行情報を見る ↗</a><br>`
        : "") +
      `<span style="font-size:11px;">${stale ? "⚠ 発表から時間が経っています。" : ""}区間は駅と駅のあいだを目安に塗っています（形の出典: OpenStreetMap）。最新は事業者の発表で確認してください。</span>`;

    (line.segments || []).slice(start, end).forEach(segment => {
      L.polyline(segment.path, {
        pane: "railStatusPane",
        renderer: railStatusRenderer,
        color: style.color,
        weight: style.weight,
        opacity: 0.9,
        lineCap: "round"
      }).bindPopup(popup).addTo(railStatusLayer);
      drawn += 1;
    });
  });

  const buses = (railStatusData.buses || []).map(bus =>
    `${String(bus.name || "").replace(/^路線バス\s*/, "")}（${RAIL_STATE_STYLE[bus.state]?.label || "運行情報"}）`
  );
  // 時刻は、出している項目のうちいちばん新しい発表の時刻にする。市の発表（updatedAt）だけを見ると、
  // 運営が今朝登録し直した項目があっても昨日の時刻と⚠が出ていた（2026-09-22 事業主指摘）
  const announcedTimes = [...(railStatusData.railways || []), ...(railStatusData.buses || [])]
    .map(item => item.announcedAt)
    .concat(railStatusData.updatedAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const newest = announcedTimes[0] || railStatusData.updatedAt;
  const updated = railStatusTime(newest);
  // 市が再開を発表した区間はサーバー側で外れる（cleared）。黙って消えると不安なので一言添える
  const cleared = Array.isArray(railStatusData.cleared) ? railStatusData.cleared : [];
  const stale = railStatusIsStale(newest);

  // 地図を覆わないよう、ふだんは1行の要約だけ出し、バス路線名などは「詳しく」で開く（2026-09-21 指摘）
  const summary = [];
  if (drawn) summary.push(`🚃 鉄道 ${drawn}区間`);
  if (buses.length) summary.push(`🚌 バス ${buses.length}路線`);
  const operatorRails = (railStatusData.railways || []).filter(r => r.sourceType === "operator");
  const head = summary.length
    ? `${summary.join("・")}が運休・遅れ${updated ? `（${updated} ${operatorRails.length ? "市・事業者の発表" : "市発表"}）` : ""}`
    : "🚃 登録中の運休・遅れはありません（平常という意味ではありません）";

  const details = [];
  // 市の案内に載らず、運営が事業者の発表を確認して登録した区間（出典を分けて見せる）
  operatorRails.forEach(r => details.push(`<li>${escapeHtml(r.lineLabel || "鉄道")} ${escapeHtml(r.from)}〜${escapeHtml(r.to)}：${escapeHtml(r.sourceLabel || "事業者")}の発表を運営が確認${r.announcedAt ? `（${escapeHtml(railStatusTime(r.announcedAt))} 時点）` : ""}</li>`));
  if (buses.length) details.push(`<li>路線バス：${buses.map(escapeHtml).join(" ／ ")}</li>`);
  if (cleared.length) details.push(`<li>${cleared.length}件は解除済みのため表示していません（${escapeHtml(cleared[0].why || "解除")}）</li>`);
  if (!railStatusData.fromServer) details.push("<li>最新の状態を取得できなかったため、保存済みの内容を表示しています</li>");
  if (stale) details.push("<li>⚠ 発表から時間が経っています。事業者の最新情報を確認してください</li>");

  const status = document.getElementById("map-status");
  // ✕ で文字だけ隠せる（赤い線は残る）。チェックを入れ直すとまた出る（2026-09-21 指摘：地図が見えない）
  const hide = `<button type="button" class="rail-status-hide" data-rail-status-hide aria-label="運休の表示を隠す" title="文字だけ隠す（線は残ります）">隠す</button>`;
  // 「鉄道」レイヤーの灰色の点線（線路の位置）を、色の薄い運休と読み違えないよう見分け方を添える（2026-09-22 事業主指摘）
  const railwayShown = Boolean(document.querySelector('[data-overlay="railway"]')?.checked);
  const legend = drawn
    ? `<div class="rail-status-legend"><span class="rail-legend-item"><span class="rail-legend-red"></span>運休・遅れ</span>${railwayShown ? `<span class="rail-legend-item"><span class="rail-legend-gray"></span>線路の位置（平常も表示）</span>` : ""}</div>`
    : "";
  status.innerHTML = details.length
    ? `<div class="rail-status-box"><div class="rail-status-main"><details class="rail-status-summary"><summary>${escapeHtml(head)}${stale ? " ⚠" : ""}　<span class="rail-status-more">詳しく ▾</span><span class="rail-status-less">閉じる ▴</span></summary><ul>${details.join("")}</ul></details>${legend}</div>${hide}</div>`
    : `<div class="rail-status-box"><div class="rail-status-main"><span>${escapeHtml(head)}</span>${legend}</div>${hide}</div>`;
  status.querySelector("[data-rail-status-hide]")?.addEventListener("click", clearRailStatusNote);
}

// 表示欄が運休の文だけなら空にする（ほかの層の案内が入っていたら触らない）
function clearRailStatusNote() {
  const status = document.getElementById("map-status");
  if (status?.querySelector(".rail-status-box")) status.innerHTML = "";
}

// ---------------------------------------------------------------------------
// 🚧 通行止め（役所の発表）
// ---------------------------------------------------------------------------
// CiDAO の巡回が千葉国道事務所・千葉県・印西市のページを毎時読み、解除も自動で外す（src/lib/disaster-road-closures.ts）。
// 役所の発表には座標がないので、線を引くのは運営が位置を確かめた件（path あり）だけ。それ以外は一覧に文字で出す
// （2026-09-22 事業主決定：情報源は役所のみ・まず印西市周辺・線は運営が確かめたものだけ）。
const roadClosuresLayer = L.layerGroup();
// 他の層と同じ理由で SVG（canvas だとクリックを吸われてポップアップが開かない）
const roadClosuresRenderer = L.svg({ pane: "roadClosuresPane" });
const ROAD_CLOSURE_REFRESH_MS = 10 * 60 * 1000;
let roadClosuresData = null;
let roadClosuresTimer = null;

// 通行止めが「いつから続いているか」。役所が発表日時を出していればそれ、無ければ
// CBIの巡回が初めて確認した時刻（firstSeenAt）を起点にする。どちらも継続の長さを見るための
// 目安で、実際に通行止めになった時刻とは限らない（2026-09-23 事業主指示）。
function roadClosureStart(item) {
  return item?.publishedAt || item?.firstSeenAt || "";
}

function roadClosureDuration(fromIso, toIso) {
  const from = Date.parse(fromIso || "");
  const to = toIso ? Date.parse(toIso) : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "";
  const minutes = Math.floor((to - from) / 60000);
  if (minutes < 60) return `${minutes}分`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}日${hours}時間` : `${hours}時間`;
}

function roadClosureContinuedText(item) {
  const text = roadClosureDuration(roadClosureStart(item));
  if (!text) return "";
  return item.publishedAt ? `${text} 継続中` : `${text} 継続中（確認できた時刻から）`;
}

function roadClosureTime(iso, withTime = false) {
  const time = Date.parse(iso || "");
  if (!Number.isFinite(time)) return "";
  const opts = withTime
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "numeric", day: "numeric" };
  return new Date(time).toLocaleString("ja-JP", opts);
}

// 情報源の名前は「通行止め：印西市」なので、出典には「印西市」だけを出す
function roadClosureSourceName(label) {
  return String(label || "役所の発表").replace(/^通行止め[：:]\s*/, "");
}

function roadClosureName(item) {
  // 路線名の無い件（佐倉市のマイマップなど）は場所だけを出す
  if (!item.road) return item.place || "道路";
  const road = item.road;
  return item.place ? `${road}（${item.place}）` : road;
}

async function refreshRoadClosures() {
  const statusEl = document.getElementById("road-closures-status");
  const endpoint = String(APP_CONFIG.roadClosuresEndpoint || "").trim();
  if (!endpoint) return;
  if (statusEl && !roadClosuresData) statusEl.textContent = "読み込み中…";
  try {
    const res = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    roadClosuresData = await res.json();
    renderRoadClosures();
  } catch (error) {
    console.error("通行止め情報の読み込みに失敗:", error);
    // 前回の内容があれば残す（一時的な失敗で一覧を消さない）
    if (statusEl) statusEl.textContent = roadClosuresData
      ? `更新できませんでした（前回の内容を表示中）`
      : `取得できませんでした（${error?.message || "接続エラー"}）`;
  }
}

function renderRoadClosures() {
  const data = roadClosuresData;
  const listEl = document.getElementById("road-closures-list");
  const statusEl = document.getElementById("road-closures-status");
  if (!data || !listEl) return;
  roadClosuresLayer.clearLayers();

  // ⏱ 期間・本日／過去の実績のしぼり込みを、通行止めにも掛ける（2026-09-23 事業主指示A）。
  // 基準は役所の発表日時。分からない件は初めて確認した日時を使う
  const allActive = Array.isArray(data.active) ? data.active : [];
  const active = allActive.filter(item => passesWhenFilter(item.publishedAt || item.firstSeenAt));
  const hiddenByWhen = allActive.length - active.length;
  const cleared = Array.isArray(data.recentlyCleared) ? data.recentlyCleared : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  let drawn = 0;

  active.forEach(item => {
    if (!Array.isArray(item.path) || item.path.length < 2) return;
    const popup =
      `<strong>🚧 ${escapeHtml(roadClosureName(item))}</strong><br>` +
      `<span style="color:#b8322c;font-weight:700;">通行止め</span>${item.reason ? `（${escapeHtml(item.reason)}）` : ""}<br>` +
      (item.publishedAt ? `発表: ${escapeHtml(roadClosureTime(item.publishedAt))}〜解除の発表まで<br>` : "") +
      (roadClosureContinuedText(item) ? `<span class="closure-continued">⏳ ${escapeHtml(roadClosureContinuedText(item))}</span><br>` : "") +
      (item.url ? `出典: <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(roadClosureSourceName(item.sourceLabel))}</a><br>` : "") +
      `<span style="font-size:11px;">${item.pathSource === "city" ? "線は役所が公開した位置です。" : "線の位置は運営が発表をもとに確かめたものです。"}最新は出典で確認してください。</span>`;
    L.polyline(item.path, {
      pane: "roadClosuresPane",
      renderer: roadClosuresRenderer,
      color: "#b8322c",
      weight: 7,
      opacity: 0.9,
      dashArray: "10 8",
      lineCap: "butt"
    }).bindPopup(popup).addTo(roadClosuresLayer);
    drawn += 1;
  });

  if (statusEl) {
    statusEl.textContent = active.length
      ? `通行止め ${active.length}件${drawn ? `（うち地図に線 ${drawn}件）` : "（地図の線なし）"}`
      : hiddenByWhen ? `期間の指定で ${hiddenByWhen}件を隠しています` : "役所が発表中の通行止めはありません";
  }

  const rowOf = item => {
    // 役所が期間を示している件（印旛土木事務所の工事など）はその終わりまで、無ければ解除の発表まで
    const until = item.periodEnd ? `${roadClosureTime(item.periodEnd)}（予定）` : "解除の発表まで";
    const period = item.publishedAt ? `${roadClosureTime(item.publishedAt)}〜${until}` : `発表日不明〜${until}`;
    // 線は引かない運用（2026-09-22 事業主決定C）。場所は役所の位置図か出典で見てもらう
    const onMap = Array.isArray(item.path) && item.path.length >= 2
      ? (item.pathSource === "city" ? "地図に線あり（役所の位置）" : "地図に線あり（運営が確認）")
      : item.mapUrl ? "場所は位置図で確認" : "場所は出典で確認";
    return `<li><strong>${escapeHtml(roadClosureName(item))}</strong>` +
      `<span class="road-closure-meta">${item.reason ? `${escapeHtml(item.reason)}・` : ""}${escapeHtml(period)}・${onMap}</span>` +
      (roadClosureContinuedText(item) ? `<span class="road-closure-meta closure-continued">⏳ ${escapeHtml(roadClosureContinuedText(item))}</span>` : "") +
      (item.url ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">出典：${escapeHtml(roadClosureSourceName(item.sourceLabel))} ↗</a>` : "") +
      // 線の無い件は、役所の位置図（区間を赤線で描いた地図）で場所を見てもらう
      (item.mapUrl ? `<br><a href="${escapeAttribute(item.mapUrl)}" target="_blank" rel="noreferrer">📍 位置図（${escapeHtml(roadClosureSourceName(item.sourceLabel))}のPDF） ↗</a>` : "") +
      `</li>`;
  };
  // 情報源ごとにまとめる。件数の多い情報源（佐倉市のマイマップは50件以上）は畳んで件数だけ見せる
  const groups = new Map();
  active.forEach(item => {
    const name = roadClosureSourceName(item.sourceLabel);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  });
  const rows = [...groups.entries()].map(([name, items]) =>
    `<details class="road-closure-group"${items.length <= 5 ? " open" : ""}><summary>${escapeHtml(name)} ${items.length}件</summary>` +
    `<ul class="road-closure-items">${items.map(rowOf).join("")}</ul></details>`
  );
  const clearedRows = cleared.map(item =>
    `<li>${escapeHtml(roadClosureName(item))}：${escapeHtml(roadClosureTime(item.clearedAt, true))}に${item.clearReason === "announced" ? "解除の発表" : item.clearReason === "operator" ? "運営が解除" : "掲載終了で解除"}` +
    (roadClosureDuration(roadClosureStart(item), item.clearedAt) ? `（${escapeHtml(roadClosureDuration(roadClosureStart(item), item.clearedAt))}で解除）` : "") +
    (item.url ? ` <a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">出典 ↗</a>` : "") + `</li>`
  );
  const failed = sources.filter(s => s.lastStatus === "failed");
  const lastFetched = sources.map(s => s.lastFetchedAt).filter(Boolean).sort().pop();

  listEl.innerHTML =
    (rows.length
      ? rows.join("")
      : `<p class="road-closure-empty">役所の発表で、いま通行止めになっている道はありません。<br>（発表されていない通行止めがあることもあります）</p>`) +
    (clearedRows.length ? `<details class="road-closure-cleared"><summary>24時間以内に解除 ${clearedRows.length}件</summary><ul>${clearedRows.join("")}</ul></details>` : "") +
    (hiddenByWhen ? `<p class="road-closure-warn">⏱ 期間の指定で ${hiddenByWhen}件を隠しています（発表が古い通行止めも、解除されるまでは通れません）。凡例の「⏱ 期間」で「すべて」にすると出ます。</p>` : "") +
    (failed.length ? `<p class="road-closure-warn">⚠ 前回 ${failed.map(s => escapeHtml(s.label)).join("・")} を読めませんでした。出典のページで確認してください。</p>` : "") +
    `<p class="road-closure-note">確認先：${sources.map(s => s.url ? `<a href="${escapeAttribute(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(roadClosureSourceName(s.label))}</a>` : escapeHtml(s.label)).join("／") || "―"}` +
    `${lastFetched ? `<br>最終確認：${escapeHtml(roadClosureTime(lastFetched, true))}（1時間ごと）` : ""}</p>`;
  listEl.hidden = false;
}

function toggleOverlay(name, checked) {
  if (name === "roadClosures") {
    const listEl = document.getElementById("road-closures-list");
    if (checked) {
      roadClosuresLayer.addTo(map);
      if (roadClosuresData) renderRoadClosures();
      refreshRoadClosures();
      clearInterval(roadClosuresTimer);
      roadClosuresTimer = setInterval(refreshRoadClosures, ROAD_CLOSURE_REFRESH_MS * CIDAO_POLL_SLOWDOWN);
    } else {
      map.removeLayer(roadClosuresLayer);
      clearInterval(roadClosuresTimer);
      roadClosuresTimer = null;
      if (listEl) listEl.hidden = true;
      const statusEl = document.getElementById("road-closures-status");
      if (statusEl) statusEl.textContent = "ONにすると読み込みます";
    }
    return;
  }
  if (name === "railStatus") {
    // 読み込み済みなら表示欄の文も出し直す（✕で隠したあと、入れ直せば戻る）
    if (checked) { if (railStatusLoaded && railStatusData) renderRailStatus(); else ensureRailStatusLayer(); railStatusLayer.addTo(map); }
    else { map.removeLayer(railStatusLayer); clearRailStatusNote(); }
    return;
  }
  if (name === "terrainRisk") {
    if (checked) { ensureTerrainRiskLayer(); terrainRiskLayer.addTo(map); }
    else map.removeLayer(terrainRiskLayer);
    return;
  }
  if (name === "roadRisk") {
    if (checked) { ensureRoadRiskLayer(); roadRiskLayer.addTo(map); }
    else map.removeLayer(roadRiskLayer);
    return;
  }
  if (name === "kansui") {
    if (checked) { ensureKansuiLayer(); kansuiLayer.addTo(map); }
    else map.removeLayer(kansuiLayer);
    return;
  }
  if (name === "passedRoads") {
    if (checked) { ensurePassedRoadsLayer(); passedRoadsLayer.addTo(map); }
    else map.removeLayer(passedRoadsLayer);
    return;
  }
  if (name === "snsRoads") {
    if (checked) { ensureSnsRoadsLayer(); snsRoadsLayer.addTo(map); }
    else map.removeLayer(snsRoadsLayer);
    return;
  }
  if (name === "rainForecast") {
    if (checked) { refreshRainForecast(true); rainForecastLayer.addTo(map); }
    else map.removeLayer(rainForecastLayer);
    return;
  }
  if (name === "quakeIntensity") {
    if (checked) { ensureQuakeIntensityLayer(); quakeIntensityLayer.addTo(map); }
    else map.removeLayer(quakeIntensityLayer);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(kikikuruLayers, name)) {
    if (checked) { refreshKikikuru(true); kikikuruLayers[name].addTo(map); }
    else map.removeLayer(kikikuruLayers[name]);
    return;
  }
  if (name === "rainNowcast") {
    if (checked) refreshRainNowcast(true);
    else map.removeLayer(rainNowcastLayer);
    return;
  }
  if (name === "bunkazai") {
    if (checked) { ensureBunkazaiLayer(); bunkazaiLayer.addTo(map); }
    else map.removeLayer(bunkazaiLayer);
    return;
  }
  if (name === "kominkan") {
    if (checked) { ensureKominkanLayer(); kominkanLayer.addTo(map); }
    else map.removeLayer(kominkanLayer);
    return;
  }
  if (name === "underpassMlit") {
    if (checked) { ensureUnderpassMlitLayer(); underpassMlitLayer.addTo(map); }
    else map.removeLayer(underpassMlitLayer);
    return;
  }
  if (name === "leveeSim") {
    const box = document.getElementById("levee-sim-levels");
    if (checked) { ensureLeveeSimLayer(); leveeSimLayer.addTo(map); }
    else { map.removeLayer(leveeSimLayer); if (box) box.hidden = true; }
    return;
  }
  if (name === "leveeBreach") {
    if (checked) { ensureLeveeBreachLayer(); leveeBreachLayer.addTo(map); }
    else map.removeLayer(leveeBreachLayer);
    return;
  }
  if (name === "pastFlood") {
    if (checked) { ensurePastFloodLayer(); pastFloodLayer.addTo(map); }
    else map.removeLayer(pastFloodLayer);
    return;
  }
  const layerMap = {
    boundary: boundaryLayer,
    relief: hazardLayers.relief,
    floodMax: hazardLayers.floodMax,
    floodPlan: hazardLayers.floodPlan,
    inland: hazardLayers.inland,
    // ⚠ 2026-09-09 修正：landformFc は定義だけあってこの表に無く、チェックしても
    // map.hasLayer() が false のまま＝導入以来ずっと何も表示されていなかった。
    landformFc: hazardLayers.landformFc,
    maskRect: maskRectGroup,
    maskCity: maskCityGroup,
    floodKeizoku: hazardLayers.floodKeizoku,
    kaokuHanran: hazardLayers.kaokuHanran,
    kaokuKagan: hazardLayers.kaokuKagan,
    jshisPshm: jshisLayers.jshisPshm,
    jshisGround: jshisLayers.jshisGround,
    landslide: landslideGroup,
    roadFlood: roadFloodLayer,
    shelters: shelterLayer,
    wells: wellLayer,
    quakes: quakeLayer,
    fire: openDataLayers.fire,
    police: openDataLayers.police,
    cityOffice: openDataLayers.cityOffice,
    emergencyRoute: openDataLayers.emergencyRoute,
    railway: openDataLayers.railway,
    landslideWarning: openDataLayers.landslideWarning,
    landslideSpecial: openDataLayers.landslideSpecial,
    records: recordLayer
  };
  const layer = layerMap[name];
  if (!layer) return;
  if (checked) layer.addTo(map);
  else map.removeLayer(layer);
  // 市オープンデータのレイヤーは、最初にONにされた時だけ取得する
  if (checked && OPEN_DATA_LAYERS[name]) ensureOpenDataLayer(name);
  if (jshisLayers[name]) {
    setJshisLayerStatus(name, checked ? "読込中" : jshisLayerMeta[name].idle);
    updateJshisLegend(name, checked);
  }
}

Object.entries(jshisLayers).forEach(([name, layer]) => {
  layer.on("loading", () => setJshisLayerStatus(name, "読込中"));
  layer.on("load", () => setJshisLayerStatus(name, "表示中"));
  layer.on("tileerror", () => setJshisLayerStatus(name, "取得できません", true));
});

function setJshisLayerStatus(name, text, isError = false) {
  const node = document.getElementById(jshisLayerMeta[name]?.statusId || "");
  if (!node) return;
  node.textContent = text;
  node.classList.toggle("is-error", isError);
}

function updateJshisLegend(name, visible) {
  const legend = document.querySelector(`[data-jshis-legend="${name}"]`);
  if (legend) legend.hidden = !visible;
}

async function refreshRainNowcast(showLayer) {
  const status = document.getElementById("rain-layer-status");
  try {
    const response = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = await response.json();
    const latest = Array.isArray(times) ? times.find(item => item?.elements?.includes("hrpns")) : null;
    if (!latest?.basetime || !latest?.validtime) throw new Error("最新時刻がありません");
    const template = `https://www.jma.go.jp/bosai/jmatile/data/nowc/${latest.basetime}/none/${latest.validtime}/surf/hrpns/{z}/{x}/{y}.png`;
    rainNowcastLayer.setUrl(template, false);
    rainNowcastTime = latest.validtime;
    status.textContent = `${formatJmaTime(latest.validtime)}実況・5分更新`;
    status.classList.remove("is-error");
    const enabled = document.querySelector('[data-overlay="rainNowcast"]')?.checked;
    if ((showLayer || enabled) && !map.hasLayer(rainNowcastLayer)) rainNowcastLayer.addTo(map);
  } catch (error) {
    status.textContent = "取得できません";
    status.classList.add("is-error");
    if (showLayer) document.querySelector('[data-overlay="rainNowcast"]').checked = false;
    appendSystemWorkLog("リアルタイム降水レイヤー", "blocked", `気象庁の最新降水データを取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁配信URLを確認する");
  }
}

// ============================================================
// 🎯 震度分布（直近の地震・市町村ごと）
// 気象庁の震源・震度情報の詳細JSONには市町村ごとの震度が入っている。
// 面的な震度分布のタイル配信は公開されていない（2026-09-06調査）ため、
// 市町村の代表点に色分けした丸を置いて「印西とその周りがどれだけ揺れたか」を示す。
// 座標は国土地理院の住所検索で1度だけ引き、端末内に保存して使い回す。
// ============================================================
const quakeIntensityLayer = L.layerGroup();
const QUAKE_CITY_CACHE_KEY = "cbi-disaster-quake-city-points-v1";
const QUAKE_INTENSITY_COLORS = {
  "1": "#b6c7dd", "2": "#79a6d2", "3": "#7fb069", "4": "#ffd166",
  "5-": "#f4a261", "5+": "#e76f51", "6-": "#d1495b", "6+": "#9d0208", "7": "#6a040f"
};
// 関東以外まで丸を置いても印西市の地図では意味がないので、対象を絞る
const QUAKE_TARGET_PREFS = ["千葉県", "茨城県", "埼玉県", "東京都", "神奈川県", "群馬県", "栃木県"];
const QUAKE_CITY_LIMIT = 120;
let quakeIntensityLoaded = false;

function loadQuakeCityCache() {
  try {
    return JSON.parse(localStorage.getItem(QUAKE_CITY_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveQuakeCityCache(cache) {
  try {
    localStorage.setItem(QUAKE_CITY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 保存できなくても表示は続ける
  }
}

// 「茨城鹿嶋市」のように県名の一部が頭に付く表記があるため、検索前に落とす
function quakeCityQuery(prefName, cityName) {
  const bare = String(prefName).replace(/[都道府県]$/, "");
  const name = String(cityName).startsWith(bare) ? String(cityName).slice(bare.length) : String(cityName);
  return `${prefName}${name}`;
}

async function geocodeCity(query) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  const point = Array.isArray(rows) ? rows[0]?.geometry?.coordinates : null;
  if (!Array.isArray(point) || point.length < 2) return null;
  return { lat: Number(point[1]), lon: Number(point[0]) };
}

async function ensureQuakeIntensityLayer() {
  if (quakeIntensityLoaded) return;
  quakeIntensityLoaded = true;
  const status = document.getElementById("quake-intensity-status");
  const setStatus = (text, isError) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  };
  setStatus("直近の地震を確認中");
  try {
    const listUrl = String(APP_CONFIG.earthquakeListEndpoint || "https://www.jma.go.jp/bosai/quake/data/list.json");
    const listResponse = await fetch(`${listUrl}${listUrl.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`);
    const list = await listResponse.json();
    const latest = (Array.isArray(list) ? list : []).find(item =>
      String(item.ttl || "").includes("震源・震度") && item.ift !== "取消" && item.json);
    if (!latest) throw new Error("震度情報がありません");

    const detailUrl = `https://www.jma.go.jp/bosai/quake/data/${latest.json}`;
    const detailResponse = await fetch(detailUrl, { cache: "no-store" });
    if (!detailResponse.ok) throw new Error(`詳細 HTTP ${detailResponse.status}`);
    const detail = await detailResponse.json();

    const observation = detail?.Body?.Intensity?.Observation;
    const cities = [];
    (observation?.Pref || []).forEach(pref => {
      if (!QUAKE_TARGET_PREFS.includes(String(pref.Name))) return;
      (pref.Area || []).forEach(area => {
        (area.City || []).forEach(city => {
          if (!city?.Code || !city?.MaxInt) return;
          cities.push({ code: String(city.Code), name: String(city.Name), pref: String(pref.Name), intensity: String(city.MaxInt) });
        });
      });
    });
    if (!cities.length) {
      quakeIntensityLayer.clearLayers();
      setStatus(`${formatDateTime(toDateTimeLocal(latest.at))}の地震：関東で震度の記録はありません`);
      return;
    }

    const cache = loadQuakeCityCache();
    const targets = cities.slice(0, QUAKE_CITY_LIMIT);
    for (const city of targets) {
      if (cache[city.code]) continue;
      try {
        const point = await geocodeCity(quakeCityQuery(city.pref, city.name));
        if (point) cache[city.code] = point;
      } catch {
        // 1件失敗しても他の市町村は描く
      }
    }
    saveQuakeCityCache(cache);

    quakeIntensityLayer.clearLayers();
    let drawn = 0;
    targets.forEach(city => {
      const point = cache[city.code];
      if (!point) return;
      const color = QUAKE_INTENSITY_COLORS[city.intensity] || "#9aa5b1";
      const rank = intensityRank(city.intensity);
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 8 + Math.min(rank, 7),
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9
      });
      marker.bindPopup(
        `<strong>${escapeHtml(city.name)}</strong><br>` +
        `震度 ${escapeHtml(intensityLabel(city.intensity))}<br>` +
        `<span style="font-size:11px;">${escapeHtml(formatDateTime(toDateTimeLocal(latest.at)))} ${escapeHtml(latest.anm || "")}${latest.mag ? ` M${escapeHtml(String(latest.mag))}` : ""}</span><br>` +
        `<span style="font-size:11px;">丸は市町村の代表点です。市内すべてが同じ震度という意味ではありません。</span>`
      );
      marker.addTo(quakeIntensityLayer);
      drawn += 1;
    });
    setStatus(`${formatDateTime(toDateTimeLocal(latest.at))} ${latest.anm || ""}${latest.mag ? ` M${latest.mag}` : ""}・最大震度${intensityLabel(latest.maxi)}／関東${drawn}市町村`);
  } catch (error) {
    quakeIntensityLoaded = false;
    setStatus(`取得できません（${error?.message || "接続エラー"}）`, true);
  }
}

// ============================================================
// 🌧 アメダス実況（印西市の周囲）と降水短時間予報
// キキクルは「危険度の判定結果」で、いま何ミリ降っているかは分からない。
// 行動を決めるには実況の雨量が要るので、市内に観測点がない印西市の代わりに
// 周囲4地点（我孫子・佐倉・成田・船橋）の値を並べる。
// ============================================================
const AMEDAS_STATIONS = [
  { code: "45061", name: "我孫子" },
  { code: "45116", name: "佐倉" },
  { code: "45121", name: "成田" },
  { code: "45106", name: "船橋" }
];
let amedasTimer = null;

function amedasValue(entry, key) {
  const value = entry?.[key];
  // [値, 品質フラグ] の形。品質フラグ0が正常値
  if (!Array.isArray(value) || value[1] !== 0 || typeof value[0] !== "number") return null;
  return value[0];
}

function amedasClass(mmPerHour) {
  if (mmPerHour === null) return "";
  if (mmPerHour >= 50) return "is-extreme";
  if (mmPerHour >= 30) return "is-heavy";
  if (mmPerHour >= 10) return "is-moderate";
  return "";
}

async function refreshAmedas(manual) {
  const node = document.getElementById("amedas-content");
  const status = document.getElementById("amedas-status");
  if (!node) return;
  if (manual) node.innerHTML = '<div class="detail-empty">最新の観測値を取得中です。</div>';
  try {
    const timeText = await (await fetch(`https://www.jma.go.jp/bosai/amedas/data/latest_time.txt?_=${Date.now()}`, { cache: "no-store" })).text();
    const at = new Date(timeText.trim());
    if (Number.isNaN(at.getTime())) throw new Error("観測時刻を取得できません");
    const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}${String(at.getHours()).padStart(2, "0")}${String(at.getMinutes()).padStart(2, "0")}00`;
    const response = await fetch(`https://www.jma.go.jp/bosai/amedas/data/map/${stamp}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const rows = AMEDAS_STATIONS.map(station => {
      const entry = data[station.code];
      return {
        name: station.name,
        h1: amedasValue(entry, "precipitation1h"),
        h24: amedasValue(entry, "precipitation24h"),
        m10: amedasValue(entry, "precipitation10m")
      };
    });
    const maxH1 = Math.max(...rows.map(r => (r.h1 === null ? -1 : r.h1)));

    node.innerHTML = `
      <div class="amedas-grid">
        ${rows.map(row => `
          <div class="amedas-item ${amedasClass(row.h1)}">
            <div class="amedas-name">${escapeHtml(row.name)}</div>
            <div class="amedas-main">${row.h1 === null ? "—" : escapeHtml(String(row.h1))}<span>mm/h</span></div>
            <div class="amedas-sub">24時間 ${row.h24 === null ? "—" : escapeHtml(String(row.h24))}mm ／ 10分 ${row.m10 === null ? "—" : escapeHtml(String(row.m10))}mm</div>
          </div>
        `).join("")}
      </div>
      <div class="amedas-note">印西市内に気象庁の雨量観測点がないため、周囲4地点の実況です。1時間30mm以上で橙、50mm以上で赤になります。</div>
    `;
    if (status) {
      status.textContent = `${formatDateTime(toDateTimeLocal(at.toISOString()))}時点 ・ 最大 ${maxH1 < 0 ? "—" : maxH1}mm/h`;
      status.classList.remove("is-error");
    }
  } catch (error) {
    node.innerHTML = '<div class="detail-empty">観測値を取得できませんでした。</div>';
    if (status) {
      status.textContent = `取得できません（${error?.message || "接続エラー"}）`;
      status.classList.add("is-error");
    }
  }
}

// 🌊 手賀沼の水位（2026-09-21）。CiDAO が千葉県のページを10分キャッシュで読み取って返す。
// 利根川は国の規約上取得しない（index.html にリンクと基準値だけ）。警告はこの地図の上だけに出す（SNSへは流さない）
const RIVER_STAGE = {
  danger: { label: "はんらん危険水位を超えています", short: "危険", cls: "is-danger" },
  caution: { label: "はんらん注意水位を超えています", short: "注意", cls: "is-caution" },
  standby: { label: "水防団待機水位を超えています", short: "待機", cls: "is-standby" },
  normal: { label: "平常", short: "平常", cls: "" },
  // 大和田機場の内水位・外水位には基準（待機・注意・危険）が決められていない。「平常」と言い切らない
  nostd: { label: "基準が決められていない観測所です", short: "基準なし", cls: "" },
  unknown: { label: "水位を取得できません", short: "不明", cls: "" }
};
// 観測から この時間を過ぎたら「古い」と添える（県のページの更新が止まったとき用）
const RIVER_STALE_MINUTES = 60;

// 凡例の帯はスマホで2段になり高さが変わるので、実際の高さの下に警告を置き、
// 地図の状態表示（.map-status）はさらにその下へずらす。警告を消したら CSS の位置に戻す
function placeRiverAlert() {
  const alertNode = document.getElementById("river-alert");
  const statusNode = document.getElementById("map-status");
  const legend = document.getElementById("map-legend");
  if (!alertNode) return;
  if (alertNode.hidden) {
    if (statusNode) statusNode.style.top = "";
    return;
  }
  alertNode.style.top = `${(legend?.offsetHeight || 36) + 6}px`;
  if (statusNode) statusNode.style.top = `${alertNode.offsetTop + alertNode.offsetHeight + 6}px`;
}
window.addEventListener("resize", placeRiverAlert);

const TEGANUMA_PAGE = "http://suibo.bousai.pref.chiba.lg.jp/bousaip/river/graph_90_0.html";

// 水位の目盛りバー。平常〜待機〜注意〜危険（印旛沼は計画高水位の0.2m手前〜計画高水位）を色帯で並べ、
// いまの水位の位置に印を付ける。範囲は「待機の1m下」から「最上位の基準の0.4m上」まで
function riverGaugeHtml(st, planMode) {
  const lv = st.levels || {};
  const top = planMode ? lv.planHigh : lv.danger;
  if (typeof top !== "number" || typeof lv.standby !== "number") return "";
  const dangerFrom = planMode ? Math.round((lv.planHigh - 0.2) * 100) / 100 : lv.danger;
  const min = lv.standby - 1;
  // 上限を超えて増水したときも印が端に張り付かないよう、いまの水位の0.3m上までは広げる
  const max = Math.max(top + 0.4, st.latest.level + 0.3);
  const pct = v => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)).toFixed(1)}%`;
  const cur = st.latest.level;
  const zones = [
    ["normal", min, lv.standby],
    ["standby", lv.standby, lv.caution ?? dangerFrom],
    ["caution", lv.caution ?? dangerFrom, dangerFrom],
    ["danger", dangerFrom, max]
  ].filter(([, from, to]) => typeof from === "number" && typeof to === "number" && to > from);
  const ticks = [
    ["待機", lv.standby],
    ["注意", lv.caution],
    [planMode ? "計画高" : "危険", top]
  ].filter(([, v]) => typeof v === "number");
  return `
    <div class="river-gauge" aria-hidden="true">
      <div class="river-gauge-bar">
        ${zones.map(([cls, from, to]) => `<span class="river-zone is-${cls}" style="left:${pct(from)};width:calc(${pct(to)} - ${pct(from)})"></span>`).join("")}
        ${ticks.map(([, v]) => `<span class="river-tick" style="left:${pct(v)}"></span>`).join("")}
        <span class="river-marker" style="left:${pct(cur)}"></span>
      </div>
      <div class="river-gauge-labels">
        ${ticks.map(([name, v]) => `<span style="left:${pct(v)}">${escapeHtml(name)}<br>${escapeHtml(v.toFixed(2))}</span>`).join("")}
      </div>
    </div>`;
}

// 1つの観測所のカードと、警告帯に使う情報（注意・危険のときだけ）を作る。
// 印旛沼ははんらん危険水位が無いので、計画高水位の0.2m手前からを「危険」とし（CBIの目安・API側で判定）、
// 「計画高水位まであと○m」を出す（2026-09-21 事業主決定＝A案）
function riverStationView(st) {
  const planMode = st.levels?.danger == null && typeof st.levels?.planHigh === "number";
  const stage = RIVER_STAGE[st.stage] || RIVER_STAGE.unknown;
  const label = planMode && st.stage === "danger"
    ? `計画高水位（${st.levels.planHigh}m）に近づいています`
    : stage.label;
  const at = new Date(st.latest.time);
  const ageMin = Math.round((Date.now() - at.getTime()) / 60000);
  const stale = ageMin > RIVER_STALE_MINUTES;
  const hhmm = `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
  const ch = st.change1h;
  const change = typeof ch === "number"
    ? `<span class="river-change ${ch > 0 ? "is-up" : ch < 0 ? "is-down" : ""}">${ch > 0 ? "▲" : ch < 0 ? "▼" : "±"}${escapeHtml(Math.abs(ch).toFixed(2))}m<small>/1時間</small></span>`
    : "";
  const remainShort = planMode && typeof st.toPlanHigh === "number"
    ? (st.toPlanHigh > 0 ? `計画高水位まで${st.toPlanHigh.toFixed(2)}m` : "計画高水位超え")
    : "";
  const html = `
    <div class="river-item ${stage.cls}">
      <div class="river-head">
        <span class="river-name">${escapeHtml(st.name)}</span>
        <b class="river-badge">${escapeHtml(stage.short)}</b>
      </div>
      <div class="river-main">${escapeHtml(st.latest.level.toFixed(2))}<span>m</span>${change}</div>
      <div class="river-sub">${escapeHtml(label)}${remainShort ? `<b class="river-remain">${escapeHtml(remainShort)}</b>` : ""}</div>
      ${riverGaugeHtml(st, planMode)}
      <div class="river-foot">${escapeHtml(hhmm)}観測${stale ? `<span class="river-stale">（${ageMin}分前の値）</span>` : ""}・${escapeHtml(st.manager || "")}・<a href="${escapeHtml(st.sourceUrl || TEGANUMA_PAGE)}" target="_blank" rel="noreferrer">県のグラフ ↗</a>${planMode ? "<br>危険水位の設定がないため、計画高水位の0.2m手前から赤（CBIの目安）" : ""}</div>
    </div>`;
  const warning = st.stage === "danger" || st.stage === "caution"
    ? {
        severe: st.stage === "danger",
        name: st.name,
        value: `${st.latest.level.toFixed(2)}m`,
        // 帯の札は短く（詳しい文は水位欄）
        note: remainShort ? remainShort.replace("計画高水位まで", "計画高まで") : (st.stage === "danger" ? "危険水位超え" : "注意水位超え"),
        text: `${st.name} ${st.latest.level.toFixed(2)}m ${remainShort || (st.stage === "danger" ? "危険水位超え" : "注意水位超え")}${stale ? "（古い値）" : ""}`
      }
    : null;
  return { html, warning, at, stale };
}

// 沼へ入ってくる川（高崎川・鹿島川）と、沼から水を出す先（長門川・大和田機場）の行。
// 沼のカードより小さく、1行で「川の名前・いまの水位・向き・基準との関係」が読めるようにする（2026-09-24）
function riverFlowRow(st) {
  const stage = RIVER_STAGE[st.stage] || RIVER_STAGE.unknown;
  const at = new Date(st.latest.time);
  const ageMin = Math.round((Date.now() - at.getTime()) / 60000);
  const stale = ageMin > RIVER_STALE_MINUTES;
  const hhmm = `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
  const arrow = st.trend === "up" ? "▲上がっている" : st.trend === "down" ? "▼下がっている" : "±横ばい";
  const arrowCls = st.trend === "up" ? "is-up" : st.trend === "down" ? "is-down" : "";
  const caution = typeof st.levels?.caution === "number" ? `注意水位 ${st.levels.caution.toFixed(2)}m` : "";
  const html = `
    <div class="river-flow-row ${stage.cls}">
      <div class="river-flow-name">${escapeHtml(st.river || st.name)}<small>${escapeHtml(st.name)}</small></div>
      <div class="river-flow-value">${escapeHtml(st.latest.level.toFixed(2))}<span>m</span><b class="river-flow-trend ${arrowCls}">${escapeHtml(arrow)}</b></div>
      <div class="river-flow-state"><b class="river-badge">${escapeHtml(stage.short)}</b>${caution ? `<small>${escapeHtml(caution)}</small>` : ""}</div>
      <div class="river-flow-note">${escapeHtml(st.note || "")}${st.note ? "・" : ""}${escapeHtml(hhmm)}観測${stale ? `<span class="river-stale">（${ageMin}分前の値）</span>` : ""}・${escapeHtml(st.manager || "")}・<a href="${escapeHtml(st.sourceUrl || TEGANUMA_PAGE)}" target="_blank" rel="noreferrer">県のグラフ ↗</a></div>
    </div>`;
  return { html, at, stale };
}

// 手賀沼・西印旛沼・北印旛沼の欄を描き、警告の配列（危険を先に）を返す
function renderLakes(node, status, data) {
  const all = (data.stations || []).filter(st => st?.latest);
  const list = all.filter(st => (st.role || "lake") === "lake");
  const inflow = all.filter(st => st.role === "inflow");
  const outflow = all.filter(st => st.role === "outflow");
  if (!list.length) {
    node.innerHTML = `<div class="detail-empty">沼の水位を取得できませんでした。千葉県のページで確認してください。<br><a href="http://suibo.bousai.pref.chiba.lg.jp/" target="_blank" rel="noreferrer">千葉県 雨量・水位情報 ↗</a></div>`;
    if (status) {
      status.textContent = "沼の水位を取得できません";
      status.classList.add("is-error");
    }
    return [];
  }
  // カードも警告帯と同じ並び（危険→注意→…、同じ段階なら西印旛沼→手賀沼→北印旛沼）
  const stageRank = { danger: 0, caution: 1, standby: 2, normal: 3, unknown: 4 };
  const nameOrder = ["西印旛沼", "手賀沼", "北印旛沼"];
  list.sort((a, b) => (stageRank[a.stage] ?? 4) - (stageRank[b.stage] ?? 4) || nameOrder.indexOf(a.name) - nameOrder.indexOf(b.name));
  const views = list.map(riverStationView);
  const inflowViews = inflow.map(riverFlowRow);
  const outflowViews = outflow.map(riverFlowRow);
  const failed = (data.errors || []).filter(e => !/^利根川/.test(e));
  node.innerHTML = `
    ${inflowViews.length ? `<div class="river-flow is-inflow">
      <div class="river-flow-title">⬇ 沼に入ってくる川（上流）</div>
      ${inflowViews.map(v => v.html).join("")}
    </div>` : ""}
    <div class="river-list">${views.map(v => v.html).join("")}</div>
    ${outflowViews.length ? `<div class="river-flow is-outflow">
      <div class="river-flow-title">⬆ 沼から水を出す先</div>
      ${outflowViews.map(v => v.html).join("")}
      <div class="river-note">長門川は利根川の水位が高いと流せなくなり、大和田機場は東京湾が満潮だと出しにくくなります。排水機場のポンプが何台動いているかは公表されていないため、ここには出せません。</div>
    </div>` : ""}
    ${failed.length ? `<div class="river-note is-error">取得できなかった観測所：${escapeHtml(failed.map(e => e.split(":")[0]).join("・"))}</div>` : ""}
    <div class="river-note">出典：<a href="${escapeHtml(data.source?.url || "http://suibo.bousai.pref.chiba.lg.jp/")}" target="_blank" rel="noreferrer">${escapeHtml(data.source?.name || "千葉県 水防情報")} ↗</a>（CBIが読み取って表示・0.00と欠測は除外）。印旛沼の「危険」はCBIの目安です。避難の判断は印西市の避難情報に従ってください。</div>
  `;
  const allViews = [...views, ...inflowViews, ...outflowViews];
  const latestAt = allViews.reduce((m, v) => (v.at > m ? v.at : m), views[0].at);
  const anyStale = allViews.some(v => v.stale);
  if (status) {
    status.textContent = `${formatDateTime(toDateTimeLocal(latestAt.toISOString()))}観測${anyStale ? "（一部の観測所の更新が止まっている可能性）" : ""}`;
    status.classList.toggle("is-error", anyStale);
  }
  // 危険を先、同じなら西印旛沼→手賀沼→北印旛沼（避難指示の出ている印旛沼を先頭に）
  const order = ["西印旛沼", "手賀沼", "北印旛沼"];
  return views.map(v => v.warning).filter(Boolean)
    .sort((a, b) => Number(b.severe) - Number(a.severe) || order.indexOf(a.name) - order.indexOf(b.name));
}

// 利根川の指定河川洪水予報（気象庁）。null＝取得失敗、[]＝発表なし
function renderToneFlood(data) {
  const node = document.getElementById("river-flood");
  if (!node) return null;
  const list = data.floodForecasts;
  if (!Array.isArray(list)) {
    node.innerHTML = '<div class="river-flood-none is-error">利根川の洪水予報を取得できませんでした。<a href="https://www.jma.go.jp/bosai/flood/" target="_blank" rel="noreferrer">気象庁 指定河川洪水予報 ↗</a>で確認してください。</div>';
    return null;
  }
  if (!list.length) {
    node.innerHTML = '<div class="river-flood-none">利根川に洪水予報（氾濫注意・警戒・危険・発生）は出ていません。</div>';
    return null;
  }
  node.innerHTML = list.map(f => `
    <div class="river-flood-item ${f.level >= 4 ? "is-danger" : "is-caution"}">
      <div class="river-flood-head"><b class="river-badge">レベル${escapeHtml(String(f.level))}</b>${escapeHtml(f.area)} ${escapeHtml(f.kindName.replace(/^レベル.?/, ""))}</div>
      <div class="river-flood-text">${escapeHtml(f.mainText || f.headline)}</div>
      <div class="river-flood-meta">${escapeHtml(formatDateTime(toDateTimeLocal(new Date(f.reportedAt).toISOString())))} 発表 ／ <a href="${escapeHtml(f.sourceUrl)}" target="_blank" rel="noreferrer">気象庁 ↗</a></div>
    </div>
  `).join("");
  const top = list[0];
  return {
    severe: top.level >= 4,
    name: top.area,
    value: `レベル${top.level}`,
    note: top.kindName.replace(/^レベル.?/, ""),
    text: `${top.area} レベル${top.level} ${top.kindName.replace(/^レベル.?/, "")}（${new Date(top.reportedAt).getHours()}:${String(new Date(top.reportedAt).getMinutes()).padStart(2, "0")}発表）`
  };
}

async function refreshRiverLevel(manual) {
  const node = document.getElementById("river-content");
  const status = document.getElementById("river-status");
  const alertNode = document.getElementById("river-alert");
  const endpoint = APP_CONFIG.riverLevelEndpoint;
  if (!node || !endpoint) return;
  if (manual) node.innerHTML = '<div class="detail-empty">最新の水位を取得中です。</div>';
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    riverWarnings = [...renderLakes(node, status, data), renderToneFlood(data)].filter(Boolean);
    renderMapAlert();
  } catch (error) {
    node.innerHTML = `<div class="detail-empty">水位を取得できませんでした。千葉県のページで確認してください。<br><a href="${TEGANUMA_PAGE}" target="_blank" rel="noreferrer">千葉県 水位グラフ:手賀沼 ↗</a></div>`;
    const flood = document.getElementById("river-flood");
    if (flood) flood.innerHTML = '<div class="river-flood-none is-error">利根川の洪水予報を取得できませんでした。<a href="https://www.jma.go.jp/bosai/flood/" target="_blank" rel="noreferrer">気象庁 指定河川洪水予報 ↗</a>で確認してください。</div>';
    if (status) {
      status.textContent = `取得できません（${error?.message || "接続エラー"}）`;
      status.classList.add("is-error");
    }
    // 取得できないときは警告を消さずに残すと誤解を生むので消す（カードに取得失敗を出している）
    riverWarnings = [];
    renderMapAlert();
  }
}

// ============================================================
// 📈 沼の水位 48時間の推移（2026-09-24・56c6ead0）
// 記録は CiDAO の disaster_river_levels（MAP が開かれたときだけ貯まる＝抜けがある）。
// 無料枠の呼び出し回数を増やさないよう、折りたたみを開いたときだけ読む。index.html は触らず、
// #river-content の直後に差し込む（#river-content は innerHTML で描き直されるので、その外に置く）
// ============================================================
const RIVER_HISTORY_LINES = [
  { id: "nishi-inbanuma", name: "西印旛沼", color: "#1d4ed8" },
  { id: "kita-inbanuma", name: "北印旛沼", color: "#c2410c" },
  { id: "teganuma", name: "手賀沼", color: "#2f855a" }
];
// 基準線（画面の水位欄と同じ値。印旛沼は計画高水位、手賀沼ははん濫危険水位）
const RIVER_HISTORY_REFS = [
  { level: 4.25, label: "印旛沼 計画高水位 4.25m", color: "#b91c1c" },
  { level: 2.80, label: "手賀沼 危険 2.80m", color: "#15803d" }
];
const RIVER_HISTORY_HOURS = 48;
let riverHistoryLoadedAt = 0;

function initRiverHistory() {
  const content = document.getElementById("river-content");
  if (!content || document.getElementById("river-history")) return;
  const box = document.createElement("details");
  box.id = "river-history";
  box.className = "river-tone river-history";
  box.innerHTML = `<summary class="river-tone-title">📈 沼の水位 ${RIVER_HISTORY_HOURS}時間の推移</summary><div id="river-history-body" class="river-history-body">開くと読み込みます。</div>`;
  content.insertAdjacentElement("afterend", box);
  box.addEventListener("toggle", () => {
    if (box.open && Date.now() - riverHistoryLoadedAt > 5 * 60 * 1000) loadRiverHistory();
  });
}

async function loadRiverHistory() {
  const body = document.getElementById("river-history-body");
  const endpoint = APP_CONFIG.riverLevelEndpoint;
  if (!body || !endpoint) return;
  body.textContent = "読み込み中…";
  try {
    const res = await fetch(`${endpoint}?history=1&hours=${RIVER_HISTORY_HOURS}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    riverHistoryLoadedAt = Date.now();
    body.innerHTML = renderRiverHistory(data.readings || []);
  } catch (error) {
    body.innerHTML = `<div class="detail-empty">推移を読み込めませんでした（${escapeHtml(error?.message || "接続エラー")}）。</div>`;
  }
}

function renderRiverHistory(readings) {
  const now = Date.now();
  const from = now - RIVER_HISTORY_HOURS * 3600 * 1000;
  const series = RIVER_HISTORY_LINES.map(line => ({
    ...line,
    points: readings
      .filter(r => r.station_id === line.id && Number.isFinite(r.level) && r.level > 0)
      .map(r => ({ t: Date.parse(r.observed_at), v: r.level }))
      .filter(p => p.t >= from)
      .sort((a, b) => a.t - b.t)
  })).filter(s => s.points.length);
  if (!series.length) return '<div class="detail-empty">まだ記録がありません（2026年9月24日から貯め始めました）。</div>';
  const all = series.flatMap(s => s.points);
  let lo = Math.min(...all.map(p => p.v));
  let hi = Math.max(...all.map(p => p.v));
  // 近い基準線は目盛りに入れる（0.6m以内）
  RIVER_HISTORY_REFS.forEach(r => { if (r.level > hi && r.level - hi < 0.6) hi = r.level; if (r.level < lo && lo - r.level < 0.6) lo = r.level; });
  const pad = Math.max(0.1, (hi - lo) * 0.08);
  lo -= pad; hi += pad;
  const W = 320, H = 190, L = 34, R = 8, T = 8, B = 22;
  const x = t => L + (t - from) / (now - from) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const GAP = 40 * 60 * 1000; // 40分以上あいたら線を切る（誰も見ていない時間は記録が無い）
  const path = pts => pts.map((p, i) => `${i && p.t - pts[i - 1].t <= GAP ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const step = hi - lo > 2 ? 0.5 : hi - lo > 1 ? 0.25 : 0.1;
  const yTicks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);
  const xTicks = [];
  const d0 = new Date(from); d0.setMinutes(0, 0, 0);
  for (let t = d0.getTime() + 3600 * 1000; t < now; t += 3600 * 1000) if (new Date(t).getHours() % 12 === 0) xTicks.push(t);
  const refs = RIVER_HISTORY_REFS.filter(r => r.level >= lo && r.level <= hi);
  const svg = `<svg class="river-history-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="沼の水位の推移">
    ${yTicks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e2e8f0"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748b">${v.toFixed(step < 0.25 ? 1 : 2)}</text>`).join("")}
    ${xTicks.map(t => { const d = new Date(t); return `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="#e2e8f0"/><text x="${x(t).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#64748b">${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}時</text>`; }).join("")}
    ${refs.map(r => `<line x1="${L}" x2="${W - R}" y1="${y(r.level).toFixed(1)}" y2="${y(r.level).toFixed(1)}" stroke="${r.color}" stroke-dasharray="4 3"/><text x="${W - R}" y="${(y(r.level) - 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${r.color}">${escapeHtml(r.label)}</text>`).join("")}
    ${series.map(s => `<path d="${path(s.points)}" fill="none" stroke="${s.color}" stroke-width="2"/>`).join("")}
  </svg>`;
  const legend = series.map(s => {
    const last = s.points[s.points.length - 1];
    const first = s.points[0];
    const diff = last.v - first.v;
    const d = new Date(last.t);
    return `<li><span class="river-history-swatch" style="background:${s.color}"></span>${escapeHtml(s.name)} <b>${last.v.toFixed(2)}m</b>（${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}）` +
      `<span class="river-history-diff">期間中 ${diff >= 0 ? "▲" : "▼"}${Math.abs(diff).toFixed(2)}m</span></li>`;
  }).join("");
  const firstAt = new Date(Math.min(...all.map(p => p.t)));
  return `${svg}<ul class="river-history-legend">${legend}</ul>
    <p class="river-note">記録は、この地図が開かれたときに10分ごとの値を貯めたものです。誰も開いていない時間は抜けるので、線が途切れます（最初の記録：${firstAt.getMonth() + 1}/${firstAt.getDate()} ${firstAt.getHours()}:${String(firstAt.getMinutes()).padStart(2, "0")}）。出典は千葉県 水防情報。0.00と欠測は除いています。</p>`;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRiverHistory);
else initRiverHistory();

// ============================================================
// 地図の上の警告帯（2026-09-21）
// 帯を増やすと地図が見えなくなるので、市の避難情報と水位を1本にまとめる。
// 1行＝1項目で、はみ出す分は「…」。市の避難情報は押すと全文と出典を開く。
// ✕ はこの端末だけ閉じる（内容が変われば再び出る）。全員から消すのは運営の「🗑 市民記録の管理」。
// ============================================================
let riverWarnings = [];
let evacAlertPayload = null;
let mapAlertExpanded = false;
// 警告帯を閉じた記録はこの画面を開いている間だけ持つ。再読み込み（F5）すれば出直す。
// 以前は sessionStorage に残していたため、F5 しても出てこなかった（2026-09-21 事業主指摘）
let mapAlertDismissed = "";

function mapAlertSignature() {
  return JSON.stringify([visibleEvacAlerts().map(a => a.publishedAt), riverWarnings.map(w => w.text)]);
}

// 発令中で、運営が消していないもの（新しい順）
function visibleEvacAlerts() {
  const list = evacAlertPayload && Array.isArray(evacAlertPayload.alerts) ? evacAlertPayload.alerts : [];
  return list.filter(a => !a.suppressed);
}

function evacAlertHead(alert) {
  const when = evacAlertTime(alert);
  const cause = evacAlertCause(alert);
  return `警戒レベル${alert.level}「${alert.label}」${cause ? `・${cause}` : ""}${alert.area ? `（${alert.area}）` : ""}${when ? ` ${when}` : ""}`;
}

// 何による避難情報かを放送の本文から読む（2026-09-22：気象庁の「警戒レベル相当」と混同されたため）
function evacAlertCause(alert) {
  const text = String(alert.message || "");
  if (/土砂/.test(text)) return "土砂災害のおそれによる";
  // 川・沼の名前は決め打ちにしない（2026-09-22 の放送は長門川・旧長門川・将監川だった）。
  // 本文から拾って先頭2つまで並べる。「印旛沼の水位上昇」「将監川の一部越水」など言い回しも変わる
  const waters = Array.from(new Set(text.match(/[^\s、。「」（）]{1,6}[川沼]/g) || []))
    .filter(name => !/^(この|その)/.test(name))
    .slice(0, 2);
  if (waters.length) {
    const how = /越水|氾濫|溢水/.test(text) ? "の越水による" : /水位|増水/.test(text) ? "の水位による" : "による";
    return `${waters.join("・")}${how}`;
  }
  if (/浸水|洪水/.test(text)) return "浸水のおそれによる";
  return "";
}

// 帯の見出し。市の避難情報（行動のレベル）であることと、何によるものかを先に書く
function evacAlertSummary(evacs) {
  const top = evacs.reduce((a, b) => (b.level > a.level ? b : a));
  const causes = Array.from(new Set(evacs.map(evacAlertCause).filter(Boolean)));
  // 「周辺の低い土地」と「印旛沼周辺の低い土地」のように、ほかに含まれる地域名は省く
  const areas = Array.from(new Set(evacs.map(a => a.area).filter(Boolean)))
    .filter((area, _, all) => !all.some(other => other !== area && other.includes(area)));
  // 川の名前が「長門川・旧長門川」と並ぶので、理由と地域の区切りは中黒を使わない
  const parts = [causes.join("／"), areas.join("／")].filter(Boolean).join(" ／ ");
  // 市の放送データが空になったあとは「参考」と断る（2026-09-24。解除を確認したわけではない）
  const stale = evacAlertPayload && evacAlertPayload.stale ? "【参考】" : "";
  return `${stale}印西市の${top.label}（警戒レベル${top.level}）${parts ? `：${parts}` : ""}${evacs.length > 1 ? ` 計${evacs.length}件` : ""}`;
}

// 「◯◯の放送以降、新しい放送はありません」。市の防災速報は災害が落ち着くと0件になる
function lastBroadcastNote(payload) {
  if (!payload || !payload.stale) return "";
  const at = String(payload.lastBroadcastAt || "").replace(/:\d\d$/, "");
  return `市の防災速報は現在0件です。${at ? `${at}の放送` : "最後の放送"}以降、新しい放送はありません（解除・閉鎖を確認したわけではありません）。`;
}

// 右の「印西市 警報・注意報」カードに、市の避難情報が出ている間だけ1行添える
let weatherAlertLevelNow = 0;
function updateEvacCardNote() {
  const node = document.getElementById("weather-warning-content");
  if (!node) return;
  let note = node.querySelector(".weather-warning-evac-note");
  const evacs = visibleEvacAlerts();
  if (!evacs.length) { note?.remove(); return; }
  if (!note) {
    note = document.createElement("button");
    note.type = "button";
    note.className = "weather-warning-evac-note";
    note.addEventListener("click", () => {
      mapAlertDismissed = "";
      mapAlertExpanded = true;
      renderMapAlert();
      document.getElementById("map-pane")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  if (node.firstChild !== note) node.prepend(note);
  const top = evacs.reduce((a, b) => (b.level > a.level ? b : a));
  const cause = Array.from(new Set(evacs.map(evacAlertCause).filter(Boolean))).join("／");
  const what = `市の${top.label}（警戒レベル${top.level}${cause ? `／${cause}` : ""}）`;
  note.textContent = weatherAlertLevelNow < top.level
    ? `📢 気象の危険度は下がっていますが、${what}は続いています。地図の上の赤い帯を見る →`
    : `📢 気象庁の警報とは別に、${what}が出ています。地図の上の赤い帯を見る →`;
}

function evacAlertTime(alert) {
  const m = String(alert.publishedAt || "").match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])} ${Number(m[3])}:${m[4]}` : "";
}

function renderMapAlert() {
  const alertNode = document.getElementById("river-alert");
  if (!alertNode) return;
  updateEvacCardNote();
  const evacs = visibleEvacAlerts();
  let dismissed = "";
  dismissed = mapAlertDismissed;
  const hasAny = Boolean(evacs.length || riverWarnings.length);
  const show = hasAny && dismissed !== mapAlertSignature();
  // ✕で閉じても、警告が出ている間は小さな「表示する」ボタンを残す（2026-09-21：閉じたら戻せなかった）
  if (hasAny && !show) {
    const count = evacs.length + riverWarnings.length;
    const severeClosed = evacs.some(a => a.level >= 4) || riverWarnings.some(w => w.severe);
    alertNode.hidden = false;
    alertNode.className = `river-alert is-collapsed ${severeClosed ? "is-danger" : "is-caution"}`;
    alertNode.innerHTML = `<button type="button" class="map-alert-reopen" data-map-alert="reopen">📢 警告 ${count}件（閉じています）　表示する</button>`;
    mapAlertExpanded = false;
    placeRiverAlert();
    return;
  }
  alertNode.hidden = !show;
  if (!show) {
    mapAlertExpanded = false;
    placeRiverAlert();
    if (inzaiFitDone) fitToInzai(true);
    return;
  }
  const severe = evacs.some(a => a.level >= 4) || riverWarnings.some(w => w.severe);
  alertNode.className = `river-alert ${severe ? "is-danger" : "is-caution"}`;
  const lines = [];
  if (evacs.length) {
    // 何件出ていても1行。2件以上は「避難指示 2件」とまとめ、押すと1件ずつ開く
    const summary = evacAlertSummary(evacs);
    lines.push(`<button type="button" class="map-alert-line is-evac" data-map-alert="evac" aria-expanded="${mapAlertExpanded}" title="市が出す避難の呼びかけです（気象庁の警報・注意報の「警戒レベル相当」とは別）">📢 ${escapeHtml(summary)}</button>`);
    if (mapAlertExpanded) {
      lines.push(`<div class="map-alert-detail">
        <div class="map-alert-kind">市が出す避難の呼びかけ（行動の警戒レベル）です。気象庁の警報・注意報が下がっても、市が解除するまで続きます。</div>
        ${evacAlertPayload?.stale ? `<div class="map-alert-kind">⚠ ${escapeHtml(lastBroadcastNote(evacAlertPayload))}</div>` : ""}
        ${evacs.map(a => `<div class="map-alert-item"><strong>${escapeHtml(evacAlertHead(a))}</strong><div>${escapeHtml(a.message).replace(/\n/g, "<br>")}</div></div>`).join("")}
        <div class="map-alert-source">出典：<a href="${escapeAttribute(evacs[0].sourceUrl)}" target="_blank" rel="noreferrer">印西市防災速報（防災行政無線）↗</a>。CBIが読み取って表示しています。解除の放送があるか、発表から24時間たつと消えます。</div>
      </div>`);
    }
  }
  if (riverWarnings.length) {
    // 観測所ごとの札。スマホで切れないよう横に流す（危険が先・押すと水位欄へ）
    lines.push(`<button type="button" class="map-alert-line is-chips" data-map-alert="river" aria-label="${escapeAttribute(riverWarnings.map(w => w.text).join("、"))}">${riverWarnings.map(w => `<span class="map-alert-chip ${w.severe ? "is-danger" : "is-caution"}"><b>${escapeHtml(w.name || "")}</b>${escapeHtml(w.value || "")}${w.note ? `<small>${escapeHtml(w.note)}</small>` : ""}</span>`).join("")}</button>`);
  }
  alertNode.innerHTML = `<div class="map-alert-lines">${lines.join("")}</div>
    <button type="button" class="map-alert-close" data-map-alert="close" title="閉じる（再読み込みするか、内容が変われば再び出ます）" aria-label="警告を閉じる">✕</button>`;
  placeRiverAlert();
  if (inzaiFitDone && !mapAlertExpanded) fitToInzai(true);
}

function handleMapAlertClick(event) {
  const kind = event.target.closest?.("[data-map-alert]")?.dataset.mapAlert;
  if (kind === "evac") {
    mapAlertExpanded = !mapAlertExpanded;
    renderMapAlert();
  } else if (kind === "river") {
    document.getElementById("river-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (kind === "close") {
    mapAlertDismissed = mapAlertSignature();
    renderMapAlert();
  } else if (kind === "reopen") {
    mapAlertDismissed = "";
    renderMapAlert();
  }
}

async function refreshEvacAlert() {
  const endpoint = APP_CONFIG.evacAlertEndpoint;
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    evacAlertPayload = await response.json();
  } catch {
    // 取れないときは前回の内容を残す（一時的な失敗で避難指示の帯が消えるのを避ける）
  }
  renderMapAlert();
}

// 降水短時間予報（この先1時間の雨の予想）。実況の雨雲レーダーとは別配信
const rainForecastLayer = L.tileLayer("", {
  attribution: "気象庁 降水短時間予報",
  opacity: 0.55,
  maxNativeZoom: 10,
  maxZoom: 18,
  zIndex: 448,
  updateWhenIdle: true
});

async function refreshRainForecast(showLayer) {
  const status = document.getElementById("rain-forecast-status");
  try {
    const response = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N2.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = await response.json();
    // 先頭が最も先の時刻。いまから約30分後の予想を出す（直近すぎると実況と変わらない）
    const candidates = (Array.isArray(times) ? times : []).filter(item => item?.elements?.includes("hrpns"));
    const target = candidates[Math.max(0, candidates.length - 7)] || candidates[0];
    if (!target) throw new Error("予報時刻がありません");
    rainForecastLayer.setUrl(`https://www.jma.go.jp/bosai/jmatile/data/nowc/${target.basetime}/none/${target.validtime}/surf/hrpns/{z}/{x}/{y}.png`, false);
    if (status) {
      status.textContent = `${formatJmaTime(target.validtime)}の予想`;
      status.classList.remove("is-error");
    }
    if (document.querySelector('[data-overlay="rainForecast"]')?.checked && !map.hasLayer(rainForecastLayer)) {
      rainForecastLayer.addTo(map);
    }
  } catch (error) {
    if (status) {
      status.textContent = "取得できません";
      status.classList.add("is-error");
    }
    if (showLayer) {
      const box = document.querySelector('[data-overlay="rainForecast"]');
      if (box) box.checked = false;
    }
  }
}

// ============================================================
// 🟠 地形の冠水リスク（面・仮設定）
// 窪地・相対的な低さ・集水・平坦さを合成した地形指標（0〜100）を面で塗る。
// 道路レイヤーと同じ元データ（map_grid.json の score）で、雨量は入っていない。
// 「CBI独自シミュレーション」は同じ score に雨量の係数を掛けたもので、
// こちらは係数を掛けない素の地形指標。順位はどちらも同じになる。
// 道路の下・ピンの下に来るよう専用ペイン（z-index 385）へ置く。
// ============================================================
const terrainRiskLayer = L.layerGroup();
let terrainRiskLoaded = false;

async function ensureTerrainRiskLayer() {
  if (terrainRiskLoaded) return;
  terrainRiskLoaded = true;
  const status = document.getElementById("terrain-risk-status");
  const setStatus = (text, isError) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  };
  setStatus("読み込み中（約1.9MB）");
  try {
    if (!map.getPane("terrainRiskPane")) {
      const pane = map.createPane("terrainRiskPane");
      pane.style.zIndex = "385";
      pane.style.pointerEvents = "none";
    }
    const response = await fetch("./simulation-data/map_grid.json", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const grid = await response.json();
    const scores = grid?.values?.score;
    if (!Array.isArray(scores)) throw new Error("地形データの形式を確認できません");

    // 低い→高い：青緑→黄→橙。研究用MAP（naisui.html）と同じ配色にそろえる
    const stops = [[0, [63, 142, 163]], [40, [242, 201, 76]], [100, [224, 123, 57]]];
    const ramp = value => {
      const x = Math.max(0, Math.min(100, value));
      for (let i = 1; i < stops.length; i += 1) {
        if (x <= stops[i][0]) {
          const [a, ca] = stops[i - 1];
          const [b, cb] = stops[i];
          const f = b === a ? 0 : (x - a) / (b - a);
          return [0, 1, 2].map(ch => Math.round(ca[ch] + (cb[ch] - ca[ch]) * f));
        }
      }
      return stops[stops.length - 1][1];
    };

    const canvas = document.createElement("canvas");
    canvas.width = grid.width;
    canvas.height = grid.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("このブラウザでは描画できません");
    const pixels = context.createImageData(grid.width, grid.height);
    let valid = 0;
    scores.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) return; // 欠測は透明のまま（0で埋めない）
      valid += 1;
      const rgb = ramp(value);
      pixels.data[index * 4] = rgb[0];
      pixels.data[index * 4 + 1] = rgb[1];
      pixels.data[index * 4 + 2] = rgb[2];
      pixels.data[index * 4 + 3] = 255;
    });
    if (!valid) throw new Error("有効な地形データがありません");
    context.putImageData(pixels, 0, 0);

    terrainRiskLayer.clearLayers();
    L.imageOverlay(canvas.toDataURL("image/png"), grid.bounds, {
      pane: "terrainRiskPane",
      opacity: 0.55,
      interactive: false,
      alt: "地形の冠水リスク（未校正の相対指標）"
    }).addTo(terrainRiskLayer);
    setStatus(`${valid.toLocaleString()}マス（100m格子）・未校正`);
  } catch (error) {
    terrainRiskLoaded = false;
    setStatus(`取得できません（${error?.message || "接続エラー"}）`, true);
  }
}

// ============================================================
// 🚗 道路の冠水リスク傾向（地形のみ・未校正）
// 国土地理院の標高から作った地形指標を、OSMの車道に割り当てて色分けしたもの。
// 排水能力・路面高・アンダーパスは未考慮で、通行できるかどうかではない。
// しきい値は未検証（status.json の road_impassable_threshold = UNVERIFIED）なので、
// 既定OFFにして、見たい人だけが出す扱いにしている（2026-09-07 B案）。
// 22,000本を超える線を描くので Canvas レンダラを使う（SVGでは重すぎる）。
// ============================================================
// 2026-09-21: 既定でONにしたため、実際の冠水記録（赤・青）より前に出ないよう薄く描く。
// 描画の上下は pane でも決めている（kansuiPane 450 ＞ passedRoadsPane 440 ＞ この線 400）が、
// 本数が22,902本あるので不透明のままだと赤い記録が視覚的に埋もれる
const ROAD_RISK_STYLE = [
  { color: "#2f8ba3", weight: 1.4, opacity: 0.4 },
  { color: "#e8b23a", weight: 1.4, opacity: 0.4 },
  { color: "#df7038", weight: 2.0, opacity: 0.45 },
  { color: "#8e44ad", weight: 3.0, opacity: 0.5 },
  { color: "#8a9099", weight: 1.2, opacity: 0.35, dashArray: "4 4" }
];
const roadRiskLayer = L.layerGroup();
let roadRiskLoaded = false;

async function ensureRoadRiskLayer() {
  if (roadRiskLoaded) return;
  roadRiskLoaded = true;
  const status = document.getElementById("road-risk-status");
  const setStatus = (text, isError) => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  };
  setStatus("読み込み中（約0.6MB）");
  try {
    const response = await fetch("./simulation-data/road_risk.json", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const renderer = L.canvas({ padding: 0.3 });
    const quantize = payload.quantize || 100000;
    roadRiskLayer.clearLayers();
    (payload.lines || []).forEach(entry => {
      const cls = entry[0];
      let lat = entry[1], lon = entry[2];
      const points = [[lat / quantize, lon / quantize]];
      for (let i = 3; i < entry.length; i += 2) {
        lat += entry[i]; lon += entry[i + 1];
        points.push([lat / quantize, lon / quantize]);
      }
      L.polyline(points, Object.assign(
        { renderer, interactive: false, lineCap: "butt" },
        ROAD_RISK_STYLE[cls] || ROAD_RISK_STYLE[4]
      )).addTo(roadRiskLayer);
    });
    setStatus(`${(payload.lines || []).length.toLocaleString()}区間 ・ 地形モデル ${payload.model || ""}・未校正`);
  } catch (error) {
    roadRiskLoaded = false;
    setStatus(`取得できません（${error?.message || "接続エラー"}）`, true);
  }
}

// ============================================================
// 🚗 冠水した道路（みんつく千葉冠水マップ・市民の投稿）
// 有志プロジェクト「みんなでつくる千葉豪雨冠水道路マップ」に市民が投稿した、
// 令和8年8月千葉豪雨などで実際に冠水した道路。8月に冠水した道は同じ雨で再び冠水
// しやすく、そこを避けられれば車の水没・放置を減らせる。
// 取得は CiDAO 経由（先方サーバーへの負担を避けるため10分キャッシュ・印西市域のみ）。
// 投稿の受け付けは本家が行っているので、追加はリンク先でしてもらう。
// ============================================================
const kansuiLayer = L.layerGroup();
let kansuiLoaded = false;

let kansuiData = [];
let kansuiGeneratedAt = "";

function setKansuiStatus(text, isError) {
  const status = document.getElementById("kansui-status");
  if (!status) return;
  status.textContent = text;
  status.classList.toggle("is-error", Boolean(isError));
}

// 取得済みのデータから描き直す（「本日」「過去の実績」の絞り込みを反映する）。
// 対象日と同じ日の投稿は濃く太く、それ以前の実績は薄く細く描く（2026-09-21）
// 道路をなぞって記録した線なら、隣り合う点どうしは近い。1区間でも3km以上離れている線は、
// 地図を拡大しないまま2か所をタップした誤操作（またはいたずら）とみなして表示しない。
// 2026-09-21 の大雨の最中に、2点だけで27km・35kmの直線がみんつくに投稿され、地図を横切っていた。
// みんつくのデータは CBI のデータベースではないので「🗑 市民記録の管理」では消せない。そのための安全装置。
// 正常な線の最長は 2026-09-21 時点で 3.0km（15点）なので、区間3kmで切っても本物は落ちない
const KANSUI_MAX_SEGMENT_M = 3000;
let kansuiHiddenImplausible = 0;

function isImplausibleKansuiLine(path) {
  if (!Array.isArray(path) || path.length < 2) return false;
  for (let i = 1; i < path.length; i++) {
    if (L.latLng(path[i - 1]).distanceTo(L.latLng(path[i])) > KANSUI_MAX_SEGMENT_M) return true;
  }
  return false;
}

// 千葉県全域（6,000件超）を一度に描くとスマホで重いので、画面に見えている範囲（少しの余白つき）だけ描く。
// 描いた範囲の外へ動かしたときと、2段階以上拡大したときだけ描き直す（ポップアップを開いたときの小さな移動では描き直さない）。
// 県全体が見えるほど縮めたとき（ズーム KANSUI_TODAY_ONLY_BELOW 未満）は、対象日の投稿だけ描く
const KANSUI_TODAY_ONLY_BELOW = 10;
let kansuiRenderedBounds = null;
let kansuiRenderedZoom = null;
function renderKansuiLayer() {
  kansuiLayer.clearLayers();
  const view = map.getBounds().pad(0.15);
  kansuiRenderedBounds = view;
  kansuiRenderedZoom = map.getZoom();
  const todayOnly = kansuiRenderedZoom < KANSUI_TODAY_ONLY_BELOW;
  let drawn = 0;
  let shown = 0;
  let todayCount = 0;
  kansuiHiddenImplausible = 0;
  kansuiData.forEach(road => {
    if (isImplausibleKansuiLine(road.path)) { kansuiHiddenImplausible += 1; return; }
    const isToday = isTargetDayRecord(road.createdAt);
    if (isToday) todayCount += 1;
    if (!passesWhenFilter(road.createdAt)) return;
    shown += 1;
    if (!road.bounds) road.bounds = L.latLngBounds(road.path);
    if (!view.intersects(road.bounds)) return;
    if (todayOnly && !isToday) return;
    drawn += 1;
    // 赤＝入らない道。「通れた道（青）」と並べて見るため、通行止め記録と同じ赤に揃えている
    const shape = road.path.length === 1
      ? L.circleMarker(road.path[0], {
          pane: "kansuiPane", renderer: kansuiRenderer, radius: isToday ? 7 : 5, color: "#ffffff", weight: 2,
          fillColor: KANSUI_COLOR, fillOpacity: isToday ? 0.95 : 0.55
        })
      : L.polyline(road.path, {
          pane: "kansuiPane", renderer: kansuiRenderer, color: KANSUI_COLOR,
          weight: isToday ? 6 : 4, opacity: isToday ? 0.95 : 0.5
        });
    shape.bindPopup(
      `<strong>🔴 冠水した道路（市民の投稿）</strong><br>` +
      `投稿日 ${escapeHtml(formatDateTime(toDateTimeLocal(road.createdAt)) || "不明")}` +
      `（${escapeHtml(formatAgo(road.createdAt) || "")}）<br>` +
      `<span class="when-badge ${isToday ? "is-today" : "is-past"}">${isToday ? "対象日の投稿" : "過去の実績"}</span><br>` +
      `<span style="font-size:11px;">令和8年8月の豪雨などで冠水したと投稿された区間です。公式に確認された通行止めではありません。同じ雨で再び冠水するおそれがあるため、通行を避ける判断の参考にしてください。</span><br>` +
      `<a href="https://mintsuku-chiba-kansuimap.com/" target="_blank" rel="noreferrer">出典・投稿はこちら: みんなでつくる千葉豪雨冠水道路マップ</a>` +
      profileButtonHtml("kansui", road) +
      // 運営の合言葉がある端末だけ、いたずら・誤った投稿を CBI の地図から伏せるボタンを出す
      (moderationKey() && road.id != null
        ? `<br><button type="button" class="kansui-hide-btn" data-kansui-hide="${escapeAttribute(String(road.id))}">🗑 この投稿を地図から伏せる（運営）</button>`
        : "")
    );
    shape.addTo(kansuiLayer);
  });
  const filtered = shown !== kansuiData.length ? `${shown}件表示 / 全${kansuiData.length}件` : `${kansuiData.length}件`;
  const skipped = kansuiHiddenImplausible ? `・道路をなぞっていない線 ${kansuiHiddenImplausible}件は非表示` : "";
  const partial = todayOnly ? `・縮小中は対象日の投稿だけ表示（拡大すると過去の投稿も出ます）` : `・画面の範囲の${drawn}件を表示中`;
  setKansuiStatus(`${filtered}（対象日 ${todayCount}件）${skipped}${partial}・ ${formatDateTime(toDateTimeLocal(kansuiGeneratedAt)) || ""}時点`);
}

map.on("moveend", () => {
  if (!map.hasLayer(kansuiLayer) || !kansuiData.length) return;
  const zoomedIn = kansuiRenderedZoom !== null && map.getZoom() - kansuiRenderedZoom >= 2;
  const crossedTodayOnly = kansuiRenderedZoom !== null && (kansuiRenderedZoom < KANSUI_TODAY_ONLY_BELOW) !== (map.getZoom() < KANSUI_TODAY_ONLY_BELOW);
  if (!zoomedIn && !crossedTodayOnly && kansuiRenderedBounds && kansuiRenderedBounds.contains(map.getBounds())) return;
  renderKansuiLayer();
});

async function ensureKansuiLayer() {
  if (kansuiLoaded) return;
  kansuiLoaded = true;
  const setStatus = setKansuiStatus;
  const endpoint = String(APP_CONFIG.kansuiEndpoint || "").trim();
  if (!endpoint) { setStatus("配信先が設定されていません", true); return; }
  setStatus("読み込み中");
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    kansuiData = (payload.roads || []).filter(road => Array.isArray(road.path) && road.path.length);
    kansuiGeneratedAt = payload.generatedAt || "";
    renderKansuiLayer();
  } catch (error) {
    kansuiLoaded = false;
    setStatus(`取得できません（${error?.message || "接続エラー"}）`, true);
  }
}

// ============================================================
// 🔵 通れた道（GPS記録）
// 閲覧者がスマホの位置情報で「いま通れた道」を記録し、赤（冠水した道路）と並べて見る。
// 色の濃さ＝記録の新しさ。6時間より前の記録は「冠水時に通れた実績」として薄い青で残す
// （消さない）。より強い雨では冠水しうるので「安全な道」とは書かない。
// 保存先は CiDAO（Supabase）。匿名で、端末の乱数IDと軌跡だけを送る。
// ============================================================
const KANSUI_COLOR = "#b8322c";
const PASSED_ROADS_KEY = "cbi-disaster-passed-roads-device-v1";
// 通れた道の濃さは「今回の大雨」の開始日時（サーバーの設定・運営が入れ替える）で分ける（2026-09-22 事業主判断）：
// 開始より後＝濃い青、前＝薄い青。その雨量を超えない限りほぼ通れる道なので、時間の経過では薄くしない。
// 段階は見出しの文言（いつ通れたか）にだけ使う
const PASSED_ROAD_COLOR = "#1565c0";
const PASSED_ROAD_TIERS = [
  { maxHours: 1, color: PASSED_ROAD_COLOR, weight: 5, label: "1時間以内に通れた道" },
  { maxHours: 3, color: PASSED_ROAD_COLOR, weight: 5, label: "3時間以内に通れた道" },
  { maxHours: 6, color: PASSED_ROAD_COLOR, weight: 5, label: "6時間以内に通れた道" },
  { maxHours: Infinity, color: PASSED_ROAD_COLOR, weight: 5, label: "冠水時に通れた実績" }
];
var passedEventStart = null; // サーバーの eventStart（ISO）。var：読み込み前に参照されても止まらないように
function isBeforeEvent(at) {
  const start = Date.parse(passedEventStart || "");
  const t = Date.parse(at || "");
  return Number.isFinite(start) && Number.isFinite(t) && t < start;
}
function eventStartLabel() {
  return passedEventStart ? formatDateTime(toDateTimeLocal(passedEventStart)) : "";
}
const passedRoadsLayer = L.layerGroup();
const passedRoadDraftLayer = L.layerGroup();
let passedRoadsLoaded = false;
let passedRoadsData = [];              // 読み込んだ記録（一覧の元）
const passedRoadShapes = new Map();    // id → 地図上の線・印（一覧から飛ぶため）

// 📡 SNSの通行情報（AI読み取り・未確認）（2026-09-25 事業主決定A）
// Threads・Instagram・Bluesky の巡回候補を CiDAO 側の AI が読み、「通れた／通れない／解除」と場所を取り出したもの。
// 一般向けの配信は確度 high・伏せていないものだけ。運営（合言葉あり）は ?all=1 で中・低・伏せた分も受け取り、確度を添えて表示する。
// 市民の記録（実線）と混ざらないよう、破線の輪＋絵文字の点で出す。
const snsRoadsLayer = L.layerGroup();
let snsRoadsLoaded = false;
let snsRoadsTimer = null;
let snsRoadsData = [];

function snsRoadKindLabel(kind) { return kind === "passed" ? "通れた" : kind === "blocked" ? "通れない" : "通行止め解除"; }
function snsRoadGlyph(kind) { return kind === "passed" ? "🔵" : kind === "blocked" ? "🚫" : "✅"; }
function snsRoadPlatformLabel(platform) {
  return platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : platform === "bluesky" ? "Bluesky" : "SNS";
}

async function ensureSnsRoadsLayer(force) {
  const endpoint = String(APP_CONFIG.snsRoadReportsEndpoint || "").trim();
  const status = document.getElementById("sns-roads-status");
  if (!endpoint) { if (status) status.textContent = "配信先が設定されていません"; return; }
  if (snsRoadsLoaded && !force) return;
  snsRoadsLoaded = true;
  if (status) status.textContent = "読み込み中…";
  try {
    const key = moderationKey();
    let response = await fetch(key ? `${endpoint}?all=1` : endpoint, { cache: "no-store", headers: key ? { "x-moderation-key": key } : {} });
    // 合言葉が古いときは一般向けに切り替えて表示は止めない
    if (response.status === 403 && key) response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    snsRoadsData = Array.isArray(payload.reports) ? payload.reports : [];
    await snapSnsRoadPoints();
    renderSnsRoads();
    if (status) status.textContent = `${snsRoadsData.filter(r => !r.hidden).length}件（AI読み取り・未確認）`;
    clearInterval(snsRoadsTimer);
    snsRoadsTimer = setInterval(() => { if (map.hasLayer(snsRoadsLayer)) ensureSnsRoadsLayer(true); }, 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
  } catch (error) {
    snsRoadsLoaded = false;
    if (status) status.textContent = "読み込めませんでした";
    console.error("SNS通行情報の読み込みに失敗:", error);
  }
}

// 地名の代表点（駅・町名の中心など）は道の上に乗らないので、150m以内に道路があれば最寄りの道路上へ寄せる（2026-09-25 事業主指摘）。
// 道から遠い点（沼の中心など）は寄せない。道路データは「なぞった線を道なりに直す」と同じ road_risk.json を使う
const SNS_ROAD_SNAP_MAX_M = 150;
const snsRoadShapes = new Map();   // id → marker（一覧から飛ぶため）
async function snapSnsRoadPoints() {
  const segments = await ensureRoadSnapData().catch(() => null);
  if (!segments) return;
  snsRoadsData.forEach(report => {
    if (report.snapped || !Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const pad = 0.003; // 約300m四方だけ切り出す（全域を繋ぐと重い）
    const graph = buildLocalGraph(segments, { s: report.lat - pad, n: report.lat + pad, w: report.lng - pad, e: report.lng + pad });
    if (!graph.pos.size) { report.snapped = "none"; return; }
    const near = nearestGraphNode(graph, [report.lat, report.lng]);
    if (!near.key || near.distance > SNS_ROAD_SNAP_MAX_M) { report.snapped = "none"; return; }
    const p = graph.pos.get(near.key);
    report.rawLat = report.lat; report.rawLng = report.lng;
    report.lat = p[0]; report.lng = p[1];
    report.snapped = Math.round(near.distance);
  });
}

function focusSnsRoad(id) {
  const marker = snsRoadShapes.get(String(id));
  if (!marker) return;
  if (!map.hasLayer(snsRoadsLayer)) { snsRoadsLayer.addTo(map); const box = document.querySelector('[data-overlay="snsRoads"]'); if (box) box.checked = true; }
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
  marker.openPopup();
}

function renderSnsRoads() {
  snsRoadsLayer.clearLayers();
  snsRoadShapes.clear();
  const isModerator = Boolean(moderationKey());
  snsRoadsData.forEach(report => {
    if (report.hidden && !isModerator) return;
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const kind = ["passed", "blocked", "cleared"].includes(report.kind) ? report.kind : "blocked";
    const when = report.observedAt || report.postedAt;
    const timeLabel = report.observedAt ? "見た時刻" : "投稿時刻";
    const sourceUrl = /^https:\/\//.test(String(report.sourceUrl || "")) ? report.sourceUrl : "";
    const snapNote = Number.isFinite(report.snapped) ? `・約${report.snapped}m先の道路へ寄せた` : "";
    const marker = L.marker([report.lat, report.lng], {
      icon: L.divIcon({ className: "", html: `<div class="sns-road-marker is-${kind}${report.hidden ? " is-old" : ""}">${snsRoadGlyph(kind)}</div>`, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] }),
      title: `SNS：${report.locationName || ""} ${snsRoadKindLabel(kind)}（未確認）`,
      zIndexOffset: 300
    });
    marker.bindPopup(
      `<strong>📡 SNSの投稿：${snsRoadKindLabel(kind)}</strong><br>` +
      `<span class="sns-road-unverified">AIが投稿を読み取ったもの・CBIや市の確認はありません</span><br>` +
      (report.summary ? `${escapeHtml(report.summary)}<br>` : "") +
      `場所：${escapeHtml(report.locationName || "不明")}` +
      (report.locationBasis || snapNote ? `<span style="font-size:11px;color:#53677b;">（${escapeHtml(report.locationBasis || "")}${escapeHtml(snapNote)}）</span>` : "") + `<br>` +
      `${timeLabel} ${escapeHtml(formatDateTime(toDateTimeLocal(when)) || "不明")}（${escapeHtml(formatAgo(when))}）` +
      (report.quote ? `<span class="sns-road-quote">「${escapeHtml(report.quote)}」</span>` : "<br>") +
      (sourceUrl ? `出典：<a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(snsRoadPlatformLabel(report.platform))}の投稿を開く ↗</a>` : "") +
      (isModerator && report.confidence !== "high" ? `<br><span class="sns-road-unverified">確度：${report.confidence === "medium" ? "中" : "低"}（運営だけに表示・一般には出ていません）</span>` : "") +
      (isModerator && report.hidden ? `<br><span class="sns-road-unverified">伏せています（一般には出ていません）</span>` : "") +
      (isModerator
        ? `<br><button type="button" class="kansui-hide-btn" data-sns-road-hide="${escapeAttribute(String(report.id))}" data-sns-road-hidden="${report.hidden ? "1" : "0"}">${report.hidden ? "↩ 地図に戻す（運営）" : "🗑 この投稿を地図から伏せる（運営）"}</button>`
        : "") +
      `<br><span style="font-size:11px;">点は投稿が指す場所の目安です。いま通れるかどうかを保証するものではありません。元の投稿で確かめてください。</span>`,
      { maxWidth: 320 }
    );
    marker.addTo(snsRoadsLayer);
    snsRoadShapes.set(String(report.id), marker);
  });
}

// 「🗑 市民記録の管理」の中の SNS の節（運営）。確度と伏せ状態が分かり、地図で見る／元の投稿／伏せる・戻す ができる
async function loadSnsModerationList() {
  const box = document.getElementById("moderate-sns-list");
  const endpoint = String(APP_CONFIG.snsRoadReportsEndpoint || "").trim();
  const key = moderationKey();
  if (!box) return;
  if (!endpoint || !key) { box.innerHTML = "<p>合言葉が入力されていないため表示できません。</p>"; return; }
  box.innerHTML = "<p>読み込み中…</p>";
  try {
    await ensureSnsRoadsLayer(true);
    if (!snsRoadsData.length) { box.innerHTML = "<p>SNS由来の通行情報はまだありません。</p>"; return; }
    const confLabel = c => c === "high" ? "確度 高（公開中）" : c === "medium" ? "確度 中（運営のみ）" : "確度 低（運営のみ）";
    box.innerHTML = snsRoadsData.map(report => {
      const kind = ["passed", "blocked", "cleared"].includes(report.kind) ? report.kind : "blocked";
      const when = report.observedAt || report.postedAt;
      const sourceUrl = /^https:\/\//.test(String(report.sourceUrl || "")) ? report.sourceUrl : "";
      return `<div class="moderate-row ${report.hidden ? "is-hidden-row" : ""}">` +
        `<div><strong>${snsRoadGlyph(kind)} ${escapeHtml(snsRoadKindLabel(kind))}（SNS）</strong> ${escapeHtml(formatDateTime(toDateTimeLocal(when)) || "時刻不明")}` +
        `<span class="moderate-meta">${escapeHtml(report.locationName || "場所不明")}・${escapeHtml(snsRoadPlatformLabel(report.platform))}・${escapeHtml(confLabel(report.confidence))}` +
        `${report.summary ? "・" + escapeHtml(report.summary) : ""}${report.hidden ? "・<em>伏せ済み</em>" : ""}</span></div>` +
        `<div class="moderate-row-buttons">` +
        `<button type="button" data-sns-focus="${escapeAttribute(String(report.id))}">地図で見る</button>` +
        (sourceUrl ? `<a class="moderate-link" href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noopener noreferrer">元の投稿 ↗</a>` : "") +
        `<button type="button" class="${report.hidden ? "" : "is-danger"}" data-sns-road-hide="${escapeAttribute(String(report.id))}" data-sns-road-hidden="${report.hidden ? "1" : "0"}" data-sns-from-list="1">${report.hidden ? "戻す" : "伏せる"}</button>` +
        `</div></div>`;
    }).join("");
  } catch (error) {
    box.innerHTML = `<p class="is-error">取得できません（${escapeHtml(error?.message || "接続エラー")}）</p>`;
  }
}

// 運営：SNSの通行情報を伏せる／戻す（行は消さない）
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-sns-road-hide]");
  if (!button) return;
  const hide = button.dataset.snsRoadHidden !== "1";
  if (hide && !confirm("このSNSの通行情報を地図から伏せます。よろしいですか？（元の投稿は消えません。運営はあとから戻せます）")) return;
  const endpoint = String(APP_CONFIG.snsRoadReportsEndpoint || "").trim();
  let key = moderationKey();
  if (!endpoint || !key) return;
  button.disabled = true;
  button.textContent = hide ? "伏せています…" : "戻しています…";
  const send = k => fetch(`${endpoint}?id=${encodeURIComponent(button.dataset.snsRoadHide)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-moderation-key": k }, body: JSON.stringify({ hidden: hide })
  });
  try {
    let response = await send(key);
    if (response.status === 403) {
      try { localStorage.removeItem(MODERATION_KEY_STORAGE); } catch {}
      key = askModerationKey();
      if (!key) throw new Error("合言葉が違います");
      response = await send(key);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    map.closePopup();
    await ensureSnsRoadsLayer(true);
    if (button.dataset.snsFromList) loadSnsModerationList();
  } catch (error) {
    alert(`${hide ? "伏せられ" : "戻せ"}ませんでした（${error?.message || "接続エラー"}）`);
    button.disabled = false;
    button.textContent = hide ? "🗑 この投稿を地図から伏せる（運営）" : "↩ 地図に戻す（運営）";
  }
});

// 📋 記録の一覧（時間順）。並び順と種類で絞り、押すとその場所へ移動してポップアップを開く
function renderPassedRoadsList() {
  const list = document.getElementById("passed-roads-list");
  if (!list) return;
  const order = document.getElementById("passed-roads-sort")?.value || "desc";
  const filter = document.getElementById("passed-roads-filter")?.value || "all";
  const rows = passedRoadsData
    .filter(road => filter === "all" || road.kind === filter)
    .filter(passesRainFilter)
    .sort((a, b) => {
      const ta = new Date(a.endedAt).getTime() || 0;
      const tb = new Date(b.endedAt).getTime() || 0;
      return order === "asc" ? ta - tb : tb - ta;
    });
  if (!rows.length) {
    list.innerHTML = `<li class="passed-roads-empty">${passedRoadsData.length ? "該当する記録はありません" : "まだ記録がありません"}</li>`;
    return;
  }
  list.innerHTML = rows.map(road => {
    const old = passedRoadTier(road.endedAt).maxHours === Infinity;
    const what = road.kind === "blocked" ? "🚫" : "🔵";
    const rainNote = road.kind === "blocked" && road.rain ? `${rainVerdictOf(road).icon} ${rainVerdictOf(road).label}` : "";
    const desc = (road.kind === "blocked"
      ? (road.path.length === 1 ? "通れない地点" : `通れない道 約${Math.round(road.lengthM || 0)}m`)
      : (road.path.length === 1 ? "通れた地点" : `通れた道 約${Math.round(road.lengthM || 0)}m`)) + (rainNote ? `・${rainNote}` : "");
    const own = isOwnRecentPassedRoad(road.id);
    return `<li class="${old ? "pr-old" : ""}"><button type="button" data-passed-road="${escapeAttribute(String(road.id))}">` +
      `<span class="pr-kind">${what}</span><span><span class="pr-time">${escapeHtml(formatDateTime(toDateTimeLocal(road.endedAt)) || "時刻不明")}</span>` +
      `（${escapeHtml(formatAgo(road.endedAt))}）<span class="pr-meta">${escapeHtml(desc)}・${escapeHtml(road.source === "map" ? "地図で記録" : "GPS")}` +
      `${road.note ? "・" + escapeHtml(road.note) : ""}</span></span></button>` +
      (own ? `<button type="button" class="undo-link pr-undo" data-undo-id="${escapeAttribute(String(road.id))}">↩ 取り消す</button>` : "") +
      `</li>`;
  }).join("");
}

function focusPassedRoad(id) {
  let shape = passedRoadShapes.get(id);
  if (!shape) {
    // 一覧には出ていても、凡例で種類をOFFにしている・期間でしぼり込んでいると地図には描かれていない。
    // 以前はここで黙って終わっていたため「一覧から押しても飛ばない」状態だった（2026-09-23）
    const road = passedRoadsData.find(item => String(item.id) === String(id));
    if (!road) return;
    const kind = passedRoadKindOf(road);
    if (!passedKindFilter[kind]) {
      passedKindFilter[kind] = true;
      document.querySelector(`#map-legend [data-kind="${kind}"]`)?.setAttribute("aria-pressed", "true");
    }
    ensurePassedRoadsOverlayOn();
    renderPassedRoadsLayer();
    shape = passedRoadShapes.get(id);
    if (!shape) {
      // 期間のしぼり込みの外。その1本だけ描いて飛ぶ（しぼり込みを変えると消える）
      shape = passedRoadShape(road).addTo(passedRoadsLayer);
      passedRoadShapes.set(road.id, shape);
      setPassedRoadsStatus("しぼり込みの外の記録を1件だけ表示しています。しぼり込みを変えると消えます。");
    }
  }
  ensurePassedRoadsOverlayOn();
  const center = typeof shape.getLatLng === "function" ? shape.getLatLng() : shape.getBounds().getCenter();
  map.setView(center, Math.max(map.getZoom(), 16));
  document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => shape.openPopup(), 300);
}

// 🖐 地図の長押し（PCは右クリック）で、後からその場所に記録する。
// 走行中は操作できないので、止まってから地図を拡大して付ける用途。時刻は記録者の申告。
const MAP_RECORD_MIN_ZOOM = 15;
let mapRecordPopup = null;

// 道路をタップしてなぞる。GPSの許可や長押しを必要としない市民向けの入口。

// ⛰ 標高の断面図（2026-09-22）。国土地理院の標高タイル（DEM1A → DEM5A → DEM5B → DEM10B の順に値のあるもの）を
// ブラウザで読み、線に沿って標高を取る。サーバー（CiDAO）は使わない。
// 標高タイルは地面の高さで、アンダーパスの路面が正しく入っていないこともある。冠水する高さを示すものではない
// 1m（航空レーザー）が最優先。地理院地図の断面図・標高APIと同じ並びで、アンダーパスのような細い窪みは1mでないと出ない
// （北柏付近で 5m=4.74m に対し 1m=1.36m／地理院の標高API 1.4m を確認）
const DEM_SOURCES = [
  { url: "https://cyberjapandata.gsi.go.jp/xyz/dem1a_png/{z}/{x}/{y}.png", z: 17, label: "1mメッシュ（航空レーザー）" },
  { url: "https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png", z: 15, label: "5mメッシュ（航空レーザー）" },
  { url: "https://cyberjapandata.gsi.go.jp/xyz/dem5b_png/{z}/{x}/{y}.png", z: 15, label: "5mメッシュ（写真測量）" },
  { url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png", z: 14, label: "10mメッシュ" }
];
const demTileCache = new Map();
const profileLayer = L.layerGroup();

function demTile(source, x, y) {
  const key = `${source.z}/${source.url}/${x}/${y}`;
  if (!demTileCache.has(key)) {
    demTileCache.set(key, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 256; canvas.height = 256;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, 256, 256).data);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null); // 海や測量のない場所はタイル自体が無い（404）
      img.src = source.url.replace("{z}", source.z).replace("{x}", x).replace("{y}", y);
    }));
  }
  return demTileCache.get(key);
}

// 標高PNGの値：R*65536 + G*256 + B。2^23 は「値なし」、2^23 を超えると負の値（0.01m単位）
async function elevationAt(lat, lon) {
  for (const source of DEM_SOURCES) {
    const n = 2 ** source.z;
    const fx = (lon + 180) / 360 * n * 256;
    const rad = lat * Math.PI / 180;
    const fy = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n * 256;
    const data = await demTile(source, Math.floor(fx / 256), Math.floor(fy / 256));
    if (!data) continue;
    const i = ((Math.floor(fy) % 256) * 256 + (Math.floor(fx) % 256)) * 4;
    const v = data[i] * 65536 + data[i + 1] * 256 + data[i + 2];
    if (v === 8388608) continue;
    return { h: (v < 8388608 ? v : v - 16777216) * 0.01, source: source.label };
  }
  return { h: null, source: "" };
}

// 線に沿って等間隔に点を取る（最短2m・最大1500点。1mのデータの細い窪みを見落とさないため）
function samplePath(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + passedRoadDistanceM(path[i - 1], path[i]));
  const total = cum[cum.length - 1];
  const step = Math.max(2, total / 1500);
  const count = Math.max(1, Math.ceil(total / step));
  const out = [];
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const d = Math.min(total, k * step);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j];
    const r = seg ? (d - cum[j]) / seg : 0;
    const a = path[j], b = path[j + 1];
    out.push({ lat: a[0] + (b[0] - a[0]) * r, lon: a[1] + (b[1] - a[1]) * r, d });
  }
  return out;
}

function closeElevationProfile() {
  document.getElementById("profile-panel")?.setAttribute("hidden", "");
  profileLayer.clearLayers();
  map.removeLayer(profileLayer);
}

async function showElevationProfile(path, title) {
  if (!Array.isArray(path) || path.length < 2) return;
  const panel = document.getElementById("profile-panel");
  const body = document.getElementById("profile-body");
  if (!panel || !body) return;
  map.closePopup();
  panel.hidden = false;
  document.getElementById("profile-title").textContent = `⛰ 標高の断面図：${title}`;
  body.innerHTML = `<p class="profile-note">標高を読み込み中…</p>`;
  profileLayer.clearLayers();
  profileLayer.addTo(map);
  L.polyline(path, { color: "#6d4c41", weight: 4, opacity: .8, dashArray: "6 5", interactive: false }).addTo(profileLayer);

  const samples = samplePath(path);
  const values = await Promise.all(samples.map(s => elevationAt(s.lat, s.lon)));
  samples.forEach((s, i) => { s.h = values[i].h; s.source = values[i].source; });
  const valid = samples.filter(s => s.h !== null);
  if (!valid.length) { body.innerHTML = `<p class="profile-note">この区間の標高データがありません（海の上など）。</p>`; return; }

  const total = samples[samples.length - 1].d;
  const min = valid.reduce((a, b) => (b.h < a.h ? b : a));
  const max = valid.reduce((a, b) => (b.h > a.h ? b : a));
  const lo = Math.floor(min.h - 1), hi = Math.ceil(max.h + 1);
  const W = 640, H = 220, L0 = 44, R0 = 12, T0 = 12, B0 = 28;
  const px = d => L0 + (total ? d / total : 0) * (W - L0 - R0);
  const py = h => T0 + (hi - h) / (hi - lo || 1) * (H - T0 - B0);
  let dLine = "", pen = false;
  samples.forEach(s => {
    if (s.h === null) { pen = false; return; }
    dLine += `${pen ? "L" : "M"}${px(s.d).toFixed(1)},${py(s.h).toFixed(1)} `;
    pen = true;
  });
  const area = `M${px(valid[0].d).toFixed(1)},${H - B0} ` + valid.map(s => `L${px(s.d).toFixed(1)},${py(s.h).toFixed(1)}`).join(" ") + ` L${px(valid[valid.length - 1].d).toFixed(1)},${H - B0} Z`;
  const km = d => (d >= 1000 ? `${(d / 1000).toFixed(2)}km` : `${Math.round(d)}m`);
  const sources = Array.from(new Set(valid.map(s => s.source))).join("・");
  body.innerHTML = `
    <svg class="profile-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="標高の断面図">
      <rect x="${L0}" y="${T0}" width="${W - L0 - R0}" height="${H - T0 - B0}" fill="#f7f9fc" stroke="#d5dde6"/>
      <path d="${area}" fill="rgba(109,76,65,.14)"/>
      <path d="${dLine}" fill="none" stroke="#6d4c41" stroke-width="2.2"/>
      <text x="${L0 - 6}" y="${py(hi) + 4}" text-anchor="end" font-size="11" fill="#5a6675">${hi}m</text>
      <text x="${L0 - 6}" y="${py(lo) + 4}" text-anchor="end" font-size="11" fill="#5a6675">${lo}m</text>
      <text x="${L0}" y="${H - 8}" font-size="11" fill="#5a6675">始</text>
      <text x="${W - R0}" y="${H - 8}" text-anchor="end" font-size="11" fill="#5a6675">終 ${km(total)}</text>
      <circle cx="${px(min.d)}" cy="${py(min.h)}" r="5" fill="#b8322c"/>
      <text x="${Math.min(W - R0 - 4, Math.max(L0 + 4, px(min.d)))}" y="${Math.min(H - B0 - 6, py(min.h) + 18)}" text-anchor="middle" font-size="12" font-weight="700" fill="#b8322c">最低 ${min.h.toFixed(2)}m</text>
      <line id="profile-cursor" x1="0" x2="0" y1="${T0}" y2="${H - B0}" stroke="#16324f" stroke-width="1" visibility="hidden"/>
    </svg>
    <p class="profile-readout" id="profile-readout">最低 <b>${min.h.toFixed(2)}m</b>（始点から${km(min.d)}）・最高 ${max.h.toFixed(2)}m・高低差 ${(max.h - min.h).toFixed(2)}m　<span>グラフをなぞると、その地点の標高が出ます</span></p>
    <p class="profile-note">周りより低い場所を見つける参考です。<strong>冠水する高さを示すものではありません。</strong>標高は地面の高さで、アンダーパスの路面などは正しく入っていないことがあります。出典：国土地理院 標高タイル（${escapeHtml(sources)}）。始＝なぞり始めた側。</p>`;

  const minMark = L.circleMarker([min.lat, min.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#b8322c", fillOpacity: 1, interactive: false }).addTo(profileLayer);
  minMark.bindTooltip(`最低 ${min.h.toFixed(2)}m`, { permanent: true, direction: "top", offset: [0, -6] });
  const cursorMark = L.circleMarker([samples[0].lat, samples[0].lon], { radius: 6, color: "#fff", weight: 2, fillColor: "#16324f", fillOpacity: 1, interactive: false });
  const svg = body.querySelector(".profile-svg");
  const readout = document.getElementById("profile-readout");
  const baseReadout = readout.innerHTML;
  const onMove = event => {
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * W;
    const d = Math.max(0, Math.min(total, (x - L0) / (W - L0 - R0) * total));
    const s = samples.reduce((a, b) => (Math.abs(b.d - d) < Math.abs(a.d - d) ? b : a));
    const cursor = svg.querySelector("#profile-cursor");
    cursor.setAttribute("x1", px(s.d)); cursor.setAttribute("x2", px(s.d)); cursor.setAttribute("visibility", "visible");
    cursorMark.setLatLng([s.lat, s.lon]).addTo(profileLayer);
    readout.innerHTML = `始点から${km(s.d)}：<b>${s.h === null ? "データなし" : `${s.h.toFixed(2)}m`}</b>（最低 ${min.h.toFixed(2)}m）`;
  };
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerdown", onMove);
  svg.addEventListener("pointerleave", () => { readout.innerHTML = baseReadout; svg.querySelector("#profile-cursor").setAttribute("visibility", "hidden"); profileLayer.removeLayer(cursorMark); });
}

document.addEventListener("click", event => {
  if (event.target.closest?.("#profile-close")) { closeElevationProfile(); return; }
  const button = event.target.closest?.("[data-profile]");
  if (!button) return;
  const [type, id] = button.dataset.profile.split(":");
  const road = type === "kansui"
    ? kansuiData.find(r => String(r.id) === id)
    : passedRoadsData.find(r => String(r.id) === id);
  if (!road) return;
  const label = type === "kansui" ? "冠水した道路（みんつくへの投稿）" : road.kind === "blocked" ? "通れない道" : "通れた道";
  showElevationProfile(road.path, label);
});

function profileButtonHtml(type, road) {
  return road?.path?.length > 1 && road.id != null
    ? `<br><button type="button" class="profile-btn" data-profile="${type}:${escapeAttribute(String(road.id))}">⛰ この道の断面図（標高）</button>`
    : "";
}

const citizenRoadDraft = { active: false, kind: "blocked", points: [], busy: false, retryAt: 0, timer: null, doubleClickZoom: true };
const citizenRoadDraftLayer = L.layerGroup();

function citizenRoadMessage(text, error = false, html = false) {
  const node = document.getElementById("citizen-road-status");
  // html=true を渡すのは、この中で組み立てた文だけ（利用者の入力は入れない）
  if (html) node.innerHTML = text; else node.textContent = text;
  node.classList.toggle("is-error", error);
}

function updateCitizenRoadControls() {
  const draft = citizenRoadDraft;
  const remaining = Math.max(0, Math.ceil((draft.retryAt - Date.now()) / 1000));
  document.getElementById("citizen-road-count").textContent = `${draft.points.length}点・約${Math.round(passedRoadPathLengthM(draft.points))}m`;
  document.getElementById("citizen-road-back").disabled = draft.busy || !draft.points.length;
  document.getElementById("citizen-road-cancel").disabled = draft.busy;
  const finish = document.getElementById("citizen-road-finish");
  finish.disabled = draft.busy || draft.points.length < 2 || remaining > 0;
  finish.textContent = draft.kind === "profile" ? "完了（断面図を見る）" : draft.busy ? "送信中…" : remaining ? `あと${remaining}秒` : `完了（${draft.kind === "blocked" ? "赤" : "青"}く塗る）`;
  document.querySelectorAll("#citizen-road-editor input, #citizen-road-editor select").forEach(node => { node.disabled = draft.busy; });
}

function drawCitizenRoadPreview() {
  citizenRoadDraftLayer.clearLayers();
  const { points, kind } = citizenRoadDraft;
  const color = kind === "blocked" ? KANSUI_COLOR : kind === "profile" ? "#6d4c41" : "#1565c0";
  if (points.length > 1) L.polyline(points, { color, weight: 7, opacity: .9, dashArray: "8 6", interactive: false }).addTo(citizenRoadDraftLayer);
  points.forEach((point, index) => {
    L.marker(point, { interactive: false, icon: L.divIcon({ className: "citizen-road-point", html: `<span style="background:${color}">${index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(citizenRoadDraftLayer);
  });
  updateCitizenRoadControls();
}

function startCitizenRoadDrawing(kind) {
  // 道路データを先に読み始める。読めていれば、送るときに道なりへ直せる（待たせない）
  if (kind !== "profile") { try { ensureRoadSnapData(); } catch (error) { /* 読めなくても記録はできる */ } }
  if (citizenRoadDraft.active || blockedPointBusy) return;
  if (passedRoadRecorder.watchId !== null) {
    setPassedRoadRecordStatus("GPSで記録中です。先にGPSの記録を終えてください。", "error");
    return;
  }
  if (roadDrawingMode || locationPickRecordId) {
    setPassedRoadRecordStatus("入力中の場所・区間を確定または取り消してから記録してください。", "error");
    return;
  }
  citizenRoadDraft.active = true;
  citizenRoadDraft.kind = kind;
  citizenRoadDraft.points = [];
  citizenRoadDraft.retryAt = 0;
  citizenRoadDraft.doubleClickZoom = map.doubleClickZoom.enabled();
  map.doubleClickZoom.disable();
  map.closePopup();
  showGeoDeniedGuide(false);
  showMintsukuHint(false);
  closeElevationProfile();
  document.getElementById("citizen-road-title").textContent = kind === "blocked" ? "🚫 通れない道を赤く塗る" : kind === "profile" ? "⛰ 断面図を作る道をなぞる（記録はしません）" : "🔵 通れた道を青く塗る";
  document.getElementById("citizen-road-editor").hidden = false;
  document.getElementById("citizen-road-editor").dataset.kind = kind;
  document.getElementById("citizen-road-when").value = "0";
  document.getElementById("citizen-road-note").value = "";
  document.getElementById("citizen-road-options").open = false;
  document.getElementById("map-pane").classList.add("is-citizen-drawing");
  document.body.classList.add("citizen-road-editing");
  map.invalidateSize({ pan: false });
  citizenRoadDraftLayer.addTo(map);
  citizenRoadMessage("道の始まりをタップ → 曲がり角 → 終わりの順にタップしてください。");
  drawCitizenRoadPreview();
  document.getElementById("citizen-road-cancel").focus({ preventScroll: true });
  scheduleMapResize();
  // ⚠ 拡大は画面の作り直し（全画面化・invalidateSize）より後に、アニメーション無しで行う。
  // 先に setZoom すると、直後のサイズ変更で元のズームへ戻り、タップしても点が入らない
  // （2026-09-24 中司さんの「浸水領域の道が追加できない」。広域のまま押すと無反応に見えていた）
  setTimeout(() => {
    if (citizenRoadDraft.active && map.getZoom() < MAP_RECORD_MIN_ZOOM) map.setZoom(16, { animate: false });
  }, 300);
}

function addCitizenRoadPoint(latlng) {
  const draft = citizenRoadDraft;
  if (!draft.active || draft.busy) return;
  if (map.getZoom() < MAP_RECORD_MIN_ZOOM) {
    // 断るだけでは行き止まりになるので、タップした場所を拡大して続けられるようにする（2026-09-24）
    map.setView(latlng, 16, { animate: false });
    citizenRoadMessage("道路が見分けられる大きさまで拡大しました。もう一度、道をタップしてください。", true);
    return;
  }
  if (draft.points.length >= 2000) { citizenRoadMessage("点が多すぎます。ここまでを完了してください。", true); return; }
  const point = [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
  const last = draft.points[draft.points.length - 1];
  if (last && passedRoadDistanceM(last, point) < 1) return;
  if (passedRoadPathLengthM([...draft.points, point]) > 30000) {
    citizenRoadMessage("1回に記録できるのは30kmまでです。ここまでを完了してください。", true);
    return;
  }
  draft.points.push(point);
  drawCitizenRoadPreview();
  citizenRoadMessage(draft.points.length < 2 ? "次に、道の終わりか曲がり角をタップしてください。" : "曲がり角を追加できます。線の位置を確認して「完了」を押してください。");
}

function closeCitizenRoadDrawing() {
  if (citizenRoadDraft.busy) return;
  citizenRoadDraft.active = false;
  citizenRoadDraft.points = [];
  clearInterval(citizenRoadDraft.timer);
  citizenRoadDraft.timer = null;
  citizenRoadDraftLayer.clearLayers();
  map.removeLayer(citizenRoadDraftLayer);
  if (citizenRoadDraft.doubleClickZoom) map.doubleClickZoom.enable();
  document.getElementById("citizen-road-editor").hidden = true;
  document.getElementById("map-pane").classList.remove("is-citizen-drawing");
  document.body.classList.remove("citizen-road-editing");
  scheduleMapResize();
  document.getElementById(citizenRoadDraft.kind === "blocked" ? "quick-blocked-btn" : citizenRoadDraft.kind === "profile" ? "quick-profile-btn" : "quick-passed-btn")?.focus({ preventScroll: true });
}

async function finishCitizenRoadDrawing() {
  const draft = citizenRoadDraft;
  if (!draft.active || draft.busy || draft.points.length < 2 || draft.retryAt > Date.now()) return;
  if (draft.kind === "profile") {
    // 断面図は記録を送らない。線を残して断面図を開く
    const path = draft.points.map(point => [...point]);
    closeCitizenRoadDrawing();
    showElevationProfile(path, "なぞった道");
    return;
  }
  // 過去の災害を選んだときは、その災害の代表の時刻で送る（2026-09-25）。
  // 台風25号の冠水を集め直すため、API 側も PAST_EVENTS の期間だけ後から受けるようにした。
  // ⚠ 期間と代表の時刻は cidao の passed-roads/route.ts の PAST_EVENTS と揃えること。
  // 代表の時刻は「その災害でいちばん冠水していた時間帯」で、本人の申告ではない。メモにその旨を残す。
  const PAST_EVENT_TIMES = {
    "event:typhoon25": { label: "台風25号", at: "2026-09-21T18:00:00+09:00" },
    "event:aug2026": { label: "8月の豪雨", at: "2026-08-13T12:00:00+09:00" }
  };
  const whenValue = document.getElementById("citizen-road-when").value;
  const pastEvent = PAST_EVENT_TIMES[whenValue] || null;
  const endedAt = pastEvent
    ? new Date(pastEvent.at).toISOString()
    : new Date(Date.now() - Number(whenValue) * 60000).toISOString();
  draft.busy = true;
  updateCitizenRoadControls();
  citizenRoadMessage("道路に合わせています…");
  // なぞった線を道なりに直してから送る（直せなければ元のまま送る。2026-09-24）
  const snapped = await snapPathToRoads(draft.points.map(point => [...point]));
  citizenRoadMessage("送信しています…");
  const result = await submitPassedRoadRecord({
    kind: draft.kind, source: "map", path: snapped,
    startedAt: endedAt, endedAt,
    // もとになったSNSの投稿URL（任意・1つ）。AIの自動読み取りが取りこぼした投稿を手で足せるように（2026-09-25）
    sourceUrls: (() => {
      const raw = String(document.getElementById("citizen-road-source")?.value || "").trim();
      return /^https?:\/\//i.test(raw) ? [raw] : [];
    })(),
    note: (pastEvent ? `［${pastEvent.label}のとき・時刻は運営が当てた代表値］ ` : "")
      + document.getElementById("citizen-road-note").value.trim().slice(0, 160)
  });
  draft.busy = false;
  if (result.ok) {
    const kind = draft.kind;
    closeCitizenRoadDrawing();
    // 過去の災害の記録は、県全体を集めているみんつくにも残してもらう（2026-09-25 C案）
    setPassedRoadRecordStatus(
      `記録しました。${kind === "blocked" ? "赤" : "青"}い線で表示しています。間違えた場合は下の「取り消す」で戻せます。`
      + (pastEvent ? `　この${pastEvent.label}の記録は「過去の実績」で見られます。` : ""), "");
    const src = document.getElementById("citizen-road-source"); if (src) src.value = "";
    const photoNote = await attachCitizenPhoto(result.payload && result.payload.id);
    if (photoNote) setPassedRoadRecordStatus(`記録しました。${photoNote}間違えた場合は下の「取り消す」で戻せます。`, "");
    // 写真は記録のあとに付くので、線を読み直してポップアップに写真が出るようにする
    if (photoNote === "写真も付けました。") await ensurePassedRoadsLayer(true);
    const mintsuku = document.getElementById("passed-road-mintsuku");
    if (mintsuku && pastEvent && kind === "blocked") mintsuku.hidden = false;
    document.getElementById("map-pane").scrollIntoView({ block: "center" });
    return;
  }
  citizenRoadMessage(`送れませんでした。${result.error} 線は残っています。`, true);
  if (result.retryAfterSeconds) {
    draft.retryAt = Date.now() + result.retryAfterSeconds * 1000;
    clearInterval(draft.timer);
    draft.timer = setInterval(() => {
      updateCitizenRoadControls();
      if (draft.retryAt <= Date.now()) {
        clearInterval(draft.timer);
        draft.timer = null;
        citizenRoadMessage("もう一度「完了」を押して送れます。線とメモはそのままです。");
      }
    }, 1000);
  }
  updateCitizenRoadControls();
}

function openMapRecordPopup(latlng) {
  if (passedRoadRecorder.watchId !== null) {
    setPassedRoadRecordStatus("「通れた道」を記録中です。先に停止（送信）してください。", "error");
    return;
  }
  if (map.getZoom() < MAP_RECORD_MIN_ZOOM) {
    setPassedRoadRecordStatus(`地図をもう少し拡大してから長押ししてください（道路が見分けられる大きさ・ズーム${MAP_RECORD_MIN_ZOOM}以上）。`, "error");
    return;
  }
  const html = `
    <div class="map-record-popup">
      <div class="mrp-title">この場所を後から記録する</div>
      <div class="mrp-row"><label>いつ：<select class="mrp-when">
        <option value="0">いま</option><option value="30">30分前</option><option value="60">1時間前</option><option value="120">2時間前</option><option value="180">3時間前</option><option value="custom">時刻を指定</option>
      </select></label><input type="datetime-local" class="mrp-custom" hidden></div>
      <input type="text" class="mrp-note-input" maxlength="200" placeholder="一言メモ（任意）">
      <div class="mrp-row"><button type="button" class="mrp-btn is-blocked">🚫 通れなかった</button><button type="button" class="mrp-btn is-passed">🔵 通れた</button></div>
      <p class="mrp-note">記録した本人の申告として地図に載ります（匿名）。</p>
      <p class="mrp-status"></p>
    </div>`;
  mapRecordPopup = L.popup({ maxWidth: 280, closeButton: true }).setLatLng(latlng).setContent(html).openOn(map);
  const root = mapRecordPopup.getElement();
  if (!root) return;
  const when = root.querySelector(".mrp-when");
  const custom = root.querySelector(".mrp-custom");
  const status = root.querySelector(".mrp-status");
  when.addEventListener("change", () => {
    custom.hidden = when.value !== "custom";
    if (!custom.hidden && !custom.value) custom.value = toDateTimeLocal(new Date().toISOString());
  });
  const endedAtFromForm = () => {
    if (when.value === "custom") {
      const at = new Date(custom.value);
      return Number.isNaN(at.getTime()) ? null : at;
    }
    return new Date(Date.now() - Number(when.value) * 60000);
  };
  root.querySelectorAll(".mrp-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const kind = button.classList.contains("is-blocked") ? "blocked" : "passed";
      const endedAt = endedAtFromForm();
      if (!endedAt) { status.textContent = "時刻を入れてください。"; status.classList.add("is-error"); return; }
      if (Math.abs(Date.now() - endedAt.getTime()) > 24 * 3600000) { status.textContent = "24時間より前・先の時刻は記録できません。"; status.classList.add("is-error"); return; }
      root.querySelectorAll(".mrp-btn").forEach(b => { b.disabled = true; });
      status.classList.remove("is-error");
      status.textContent = "送信中…";
      const result = await submitPassedRoadRecord({
        kind, source: "map", path: [[latlng.lat, latlng.lng]],
        startedAt: endedAt.toISOString(), endedAt: endedAt.toISOString(),
        note: root.querySelector(".mrp-note-input").value.trim().slice(0, 200)
      });
      if (result.ok) {
        map.closePopup(mapRecordPopup);
        setPassedRoadRecordStatus(`記録しました（${kind === "blocked" ? "🚫 通れなかった" : "🔵 通れた"}・${formatDateTime(toDateTimeLocal(endedAt.toISOString()))}）。`, "");
        showMintsukuHint(kind === "blocked");
      } else {
        status.textContent = `送れませんでした（${result.error}）`;
        status.classList.add("is-error");
        root.querySelectorAll(".mrp-btn").forEach(b => { b.disabled = false; });
      }
    });
  });
}

// ↩ 自分の記録の取り消し。誤タップやテスト送信で自宅の位置が公開されたままにならないよう、
// 送信から10分以内・同じ端末からだけ非表示にできる（サーバー側 DELETE が端末IDと時間を確認する）。
const PASSED_ROADS_OWN_KEY = "cbi-disaster-passed-roads-own-v1";
const UNDO_WINDOW_MS = 10 * 60 * 1000;

function ownPassedRoads() {
  try {
    const list = JSON.parse(localStorage.getItem(PASSED_ROADS_OWN_KEY) || "[]");
    const fresh = Array.isArray(list) ? list.filter(x => x && Date.now() - new Date(x.createdAt).getTime() < UNDO_WINDOW_MS) : [];
    localStorage.setItem(PASSED_ROADS_OWN_KEY, JSON.stringify(fresh));
    return fresh;
  } catch { return []; }
}

function rememberOwnPassedRoad(id, createdAt) {
  const list = ownPassedRoads().filter(x => x.id !== id);
  list.push({ id, createdAt });
  localStorage.setItem(PASSED_ROADS_OWN_KEY, JSON.stringify(list));
}

function isOwnRecentPassedRoad(id) {
  return ownPassedRoads().some(x => x.id === id);
}

async function undoPassedRoad(id) {
  const endpoint = String(APP_CONFIG.passedRoadsEndpoint || "").trim();
  if (!endpoint) return;
  if (!window.confirm("この記録を取り消して地図から消します。よろしいですか？")) return;
  try {
    const url = `${endpoint}?id=${encodeURIComponent(id)}&deviceId=${encodeURIComponent(passedRoadDeviceId())}`;
    const response = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reasons = { too_late: "送信から10分を過ぎたため取り消せません（運営にご連絡ください）", not_found: "この端末から送った記録ではないため取り消せません" };
      throw new Error(reasons[payload.error] || payload.error || `HTTP ${response.status}`);
    }
    localStorage.setItem(PASSED_ROADS_OWN_KEY, JSON.stringify(ownPassedRoads().filter(x => x.id !== id)));
    setPassedRoadRecordStatus("取り消しました。地図から消えています。", "");
    await ensurePassedRoadsLayer(true);
  } catch (error) {
    setPassedRoadRecordStatus(`取り消せませんでした（${error?.message || "接続エラー"}）`, "error");
  }
}

// 状態文の下に「↩ 取り消す」を出す（左パネルと固定バーの両方）。id が無ければ消す
function setUndoLink(id) {
  [document.getElementById("passed-road-undo"), document.getElementById("quick-undo")].forEach(node => {
    if (!node) return;
    node.hidden = !id;
    node.innerHTML = id ? `間違えて送った？ <button type="button" class="undo-link" data-undo-id="${escapeAttribute(id)}">↩ この記録を取り消す（10分以内）</button>` : "";
  });
}

// 記録を1件送る共通処理（GPSの現在地・軌跡・地図の長押しのいずれも同じ）
// ============================================================
// 🛣 記録した道を、道路に沿わせる（2026-09-24）
// 地図をタップしてなぞる方式では、始点と終点の2点だけで送られることが多く（実測で半数）、
// 曲がった道が直線で結ばれて畑や沼を突っ切って見えていた（途中のずれは中央値14m）。
// 送る直前に、OpenStreetMap の車道（simulation-data/road_risk.json・ODbL 1.0）で
// 点と点のあいだを道なりにたどって折れ線にする。
// ⚠ 迷ったら直さない。次のときは元のまま送る：
//    ・道路データがまだ読めていない（災害中に入力を待たせない）
//    ・端点の近く（30m）に車道がない（農道・堤防の上など）
//    ・道なりが直線の2.5倍を超える／元の線から100m以上離れる（別の道をたどった疑い）
// ============================================================
const SNAP_MAX_M = 30;         // 端点をここまで道路へ寄せる
const SNAP_DETOUR_MAX = 2.5;   // 直線距離の何倍までを同じ道とみなすか
const SNAP_DEVIATION_M = 100;  // 元の線からこれ以上離れたら使わない
const SNAP_MIN_LEG_M = 25;     // これより短い区間はそのまま
const SNAP_LEG_MAX_M = 3000;   // 1区間でたどる上限

let roadSnapSegments = null;   // [[lat,lon],[lat,lon]] の配列
let roadSnapLoading = null;

// 道路データを読む（凡例の「地形から見た冠水しやすさ」と同じファイル。1回だけ）
function ensureRoadSnapData() {
  if (roadSnapSegments) return Promise.resolve(roadSnapSegments);
  if (roadSnapLoading) return roadSnapLoading;
  roadSnapLoading = fetch("./simulation-data/road_risk.json", { headers: { Accept: "application/json" } })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(payload => {
      const q = payload.quantize || 100000;
      const segs = [];
      (payload.lines || []).forEach(entry => {
        let lat = entry[1], lon = entry[2];
        let prev = [lat / q, lon / q];
        for (let i = 3; i < entry.length; i += 2) {
          lat += entry[i]; lon += entry[i + 1];
          const next = [lat / q, lon / q];
          segs.push([prev, next]);
          prev = next;
        }
      });
      roadSnapSegments = segs;
      return segs;
    })
    .catch(() => { roadSnapLoading = null; return null; });
  return roadSnapLoading;
}

function snapMeters(a, b) {
  const my = 111320, mx = 111320 * Math.cos(a[0] * Math.PI / 180);
  return Math.hypot((b[0] - a[0]) * my, (b[1] - a[1]) * mx);
}

// なぞった線の周りだけを切り出して、小さな経路網を作る（全県ぶんを繋ぐと重い）
function buildLocalGraph(segments, bounds) {
  const adj = new Map();
  const key = p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const pos = new Map();
  const link = (a, b) => {
    const ka = key(a), kb = key(b), w = snapMeters(a, b);
    if (!pos.has(ka)) pos.set(ka, a);
    if (!pos.has(kb)) pos.set(kb, b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push([kb, w]);
    adj.get(kb).push([ka, w]);
  };
  segments.forEach(([a, b]) => {
    if (a[0] < bounds.s || a[0] > bounds.n || a[1] < bounds.w || a[1] > bounds.e) return;
    const L = snapMeters(a, b);
    if (L <= 25) { link(a, b); return; }
    const n = Math.floor(L / 25) + 1;      // 長い直線にも寄せられるよう途中に点を足す
    let prev = a;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const mid = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      link(prev, mid); prev = mid;
    }
    link(prev, b);
  });
  return { adj, pos };
}

function nearestGraphNode(graph, point) {
  let best = null, bd = Infinity;
  graph.pos.forEach((p, k) => {
    const d = snapMeters(point, p);
    if (d < bd) { bd = d; best = k; }
  });
  return { key: best, distance: bd };
}

// A*（限度を超えたら諦める）
function routeOnGraph(graph, startKey, goalKey, limitM) {
  const goal = graph.pos.get(goalKey);
  const g = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [[snapMeters(graph.pos.get(startKey), goal), startKey]];
  let guard = 0;
  while (open.length) {
    open.sort((x, y) => x[0] - y[0]);
    const [, k] = open.shift();
    if (k === goalKey) {
      const out = [k];
      let cur = k;
      while (prev.has(cur)) { cur = prev.get(cur); out.push(cur); }
      return out.reverse().map(x => graph.pos.get(x));
    }
    if (++guard > 20000) return null;
    const base = g.get(k) ?? Infinity;
    for (const [m, w] of (graph.adj.get(k) || [])) {
      const ng = base + w;
      if (ng > limitM) continue;
      if (ng < (g.get(m) ?? Infinity)) {
        g.set(m, ng); prev.set(m, k);
        open.push([ng + snapMeters(graph.pos.get(m), goal), m]);
      }
    }
  }
  return null;
}

/** なぞった線を道なりに直す。直せないときは元の線をそのまま返す */
async function snapPathToRoads(path) {
  try {
    if (!Array.isArray(path) || path.length < 2) return path;
    const segments = await ensureRoadSnapData();
    if (!segments) return path;
    const lats = path.map(p => p[0]), lons = path.map(p => p[1]);
    const pad = 0.012; // 約1.3km。遠回りの道も含めて切り出す
    const graph = buildLocalGraph(segments, {
      s: Math.min(...lats) - pad, n: Math.max(...lats) + pad,
      w: Math.min(...lons) - pad, e: Math.max(...lons) + pad
    });
    if (!graph.pos.size) return path;
    const out = [[path[0][0], path[0][1]]];
    for (let i = 0; i + 1 < path.length; i++) {
      const A = [Number(path[i][0]), Number(path[i][1])];
      const B = [Number(path[i + 1][0]), Number(path[i + 1][1])];
      const straight = snapMeters(A, B);
      if (straight < SNAP_MIN_LEG_M) { out.push([B[0], B[1]]); continue; }
      const na = nearestGraphNode(graph, A), nb = nearestGraphNode(graph, B);
      if (!na.key || !nb.key || na.distance > SNAP_MAX_M || nb.distance > SNAP_MAX_M) return path;
      const line = routeOnGraph(graph, na.key, nb.key, Math.min(SNAP_LEG_MAX_M, straight * SNAP_DETOUR_MAX));
      if (!line) return path;
      // 元の線から離れすぎていないか（別の道をたどった疑い）
      const my = 111320, mx = 111320 * Math.cos(A[0] * Math.PI / 180);
      const vy = (B[0] - A[0]) * my, vx = (B[1] - A[1]) * mx;
      const L2 = vy * vy + vx * vx;
      let far = 0;
      for (const k of line) {
        const wy = (k[0] - A[0]) * my, wx = (k[1] - A[1]) * mx;
        const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, (wy * vy + wx * vx) / L2));
        far = Math.max(far, Math.hypot(wy - t * vy, wx - t * vx));
      }
      if (far > SNAP_DEVIATION_M) return path;
      for (let k = 1; k < line.length; k++) out.push([Number(line[k][0].toFixed(6)), Number(line[k][1].toFixed(6))]);
      out[out.length - 1] = [B[0], B[1]];
    }
    const cleaned = [out[0]];
    for (let i = 1; i < out.length; i++) if (snapMeters(cleaned[cleaned.length - 1], out[i]) > 0.5) cleaned.push(out[i]);
    return cleaned.length >= 2 ? cleaned : path;
  } catch (error) {
    return path; // 直せなくても記録は必ず送る
  }
}


// 📷 記録に写真を1枚つける（2026-09-25）
// 台風25号の冠水地点の再募集で、写真があると場所と深さが伝わるため。
// サーバー側は「その記録を送った端末から・30分以内・1枚まで」しか受けない。
// ⚠ すぐ公開されるので、注意書き（顔・ナンバー・表札）は index.html に赤字で出してある。
const CITIZEN_PHOTO_MAX_PX = 1600;   // 長辺。これより大きい写真は縮めてから送る
const CITIZEN_PHOTO_QUALITY = 0.82;

// 写真を縮めて JPEG にする（通信量を減らし、位置情報などのExifも落ちる）
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error("画像を選んでください")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("写真を読めませんでした"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("写真を読めませんでした"));
      img.onload = () => {
        const scale = Math.min(1, CITIZEN_PHOTO_MAX_PX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("写真を変換できませんでした"))),
          "image/jpeg", CITIZEN_PHOTO_QUALITY);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** 送信した記録に写真をつける。失敗しても記録は残るので、知らせるだけにする */
async function attachCitizenPhoto(roadId) {
  const input = document.getElementById("citizen-road-photo");
  const file = input && input.files && input.files[0];
  if (!file || !roadId) return "";
  const endpoint = String(APP_CONFIG.passedRoadsEndpoint || "").trim();
  if (!endpoint) return "";
  try {
    const blob = await shrinkPhoto(file);
    const form = new FormData();
    form.append("roadId", String(roadId));
    form.append("deviceId", passedRoadDeviceId());
    form.append("image", blob, "photo.jpg");
    const response = await fetch(`${endpoint}/image`, { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reasons = {
        image_too_large: "写真が大きすぎました",
        too_late: "写真を付けられる時間（30分）を過ぎていました",
        too_many_images: "写真はすでに1枚付いています",
        forbidden: "この記録に写真を付けられませんでした"
      };
      return `（写真は付けられませんでした：${reasons[payload.error] || payload.error || response.status}）`;
    }
    return "写真も付けました。";
  } catch (error) {
    return `（写真は付けられませんでした：${(error && error.message) || "不明"}）`;
  } finally {
    if (input) input.value = "";
  }
}

async function submitPassedRoadRecord(record) {
  const endpoint = String(APP_CONFIG.passedRoadsEndpoint || "").trim();
  if (!endpoint) return { ok: false, error: "送信先が設定されていません" };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      // 運営の合言葉がある端末は付けて送る（サーバーが連続記録の待ち時間を免除する）
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(moderationKey() ? { "x-moderation-key": moderationKey() } : {}) },
      body: JSON.stringify({ deviceId: passedRoadDeviceId(), ...record })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reasons = {
        too_frequent: `前の記録からの待ち時間です。あと${Number.isFinite(Number(payload.retryAfterSeconds)) && Number(payload.retryAfterSeconds) > 0 ? Math.ceil(Number(payload.retryAfterSeconds)) : 120}秒ほど待って、もう一度送ってください（入力内容はそのままです）`,
        outside_inzai: "印西市の周辺ではないため受け付けられません",
        too_short: "記録が短すぎます（50m以上必要です）",
        too_long: "記録が長すぎます（30km以内で区切ってください）",
        stale_time: "24時間より前の時刻は記録できません",
        invalid_source_url: "SNSの投稿URLが正しくありません（https:// で始まるアドレスを1つだけ）"
      };
      return { ok: false, error: reasons[payload.error] || payload.error || `HTTP ${response.status}`,
        retryAfterSeconds: payload.error === "too_frequent" ? (Number.isFinite(Number(payload.retryAfterSeconds)) && Number(payload.retryAfterSeconds) > 0 ? Math.ceil(Number(payload.retryAfterSeconds)) : 120) : 0 };
    }
    if (payload.id) { rememberOwnPassedRoad(payload.id, payload.createdAt || new Date().toISOString()); setUndoLink(payload.id); }
    ensurePassedRoadsOverlayOn();
    await ensurePassedRoadsLayer(true);
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: error?.message || "接続エラー" };
  }
}

function passedRoadDeviceId() {
  let id = localStorage.getItem(PASSED_ROADS_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = `pr-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
    localStorage.setItem(PASSED_ROADS_KEY, id);
  }
  return id;
}

function passedRoadTier(endedAt) {
  const at = new Date(endedAt).getTime();
  const hours = Number.isFinite(at) ? (Date.now() - at) / 3600000 : Infinity;
  return PASSED_ROAD_TIERS.find(tier => hours <= tier.maxHours) || PASSED_ROAD_TIERS[PASSED_ROAD_TIERS.length - 1];
}

function formatAgo(value) {
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

function setPassedRoadsStatus(text, isError) {
  const status = document.getElementById("passed-roads-status");
  if (!status) return;
  status.textContent = text;
  status.classList.toggle("is-error", Boolean(isError));
}

const MINTSUKU_URL = "https://mintsuku-chiba-kansuimap.com/";

// 通れない地点（冠水で止まった現在地・1点）。みんつくの赤い線と同じ意味なので、
// ポップアップから本家にも投稿できるよう導線を置く（本家に外部向けAPIはない）
// 通れない道は、みんつくへの投稿（renderKansuiLayer）と見た目をそろえる（2026-09-22）：
// 同じ赤・濃い＝対象日の記録／薄い＝それより前・1地点は白ふちの赤い丸
function blockedPointShape(road) {
  const isOld = !isTargetDayRecord(road.endedAt);
  const marker = road.path.length > 1 ? L.polyline(road.path, {
    pane: "passedRoadsPane", renderer: passedRoadsRenderer, color: KANSUI_COLOR, weight: isOld ? 4 : 6, opacity: isOld ? .5 : .95
  }) : L.circleMarker(road.path[0], {
    pane: "passedRoadsPane", renderer: passedRoadsRenderer, radius: isOld ? 5 : 7, color: "#ffffff", weight: 2,
    fillColor: KANSUI_COLOR, fillOpacity: isOld ? .55 : .95
  });
  marker.bindPopup(
    `<strong>🚫 ${road.path.length > 1 ? "通れない道" : "通れない地点"}（市民の記録）</strong><br>` +
    `記録時刻 ${escapeHtml(formatDateTime(toDateTimeLocal(road.endedAt)) || "不明")}（${escapeHtml(formatAgo(road.endedAt))}）` +
    `・${escapeHtml(passedRoadSourceLabel(road))}` +
    (road.note ? `<br>メモ: ${escapeHtml(road.note)}` : "") +
    window.RoadRecordEditor.render(road) +
    `<br><span style="font-size:11px;">${isOld
      ? "対象日より前の記録です。すでに通れるようになっている可能性があります。"
      : "この地図を見ている人が通れなかった場所を記録したものです。公式の通行止めではありません。"}</span>` +
    rainVerdictHtml(road) +
    `<br><a href="${MINTSUKU_URL}" target="_blank" rel="noreferrer">みんつく千葉冠水マップにも投稿する ↗</a>` +
    profileButtonHtml("passed", road) +
    passedRoadHideButtonHtml(road)
  );
  return marker;
}

// ☔ 記録時刻の雨量（最寄りアメダス）から「冠水による通れない」か「工事・事故など別の理由」かの目安を出す。
// 判定はサーバー（CiDAO）が保存時に行い、ここは表示だけ。確定ではないので言い切らない
const RAIN_VERDICTS = {
  flood_likely: { icon: "☔", label: "雨あり → 冠水の可能性が高い" },
  light_rain: { icon: "🌦", label: "少雨 → 冠水か別の理由かは判断保留" },
  no_rain: { icon: "🌤", label: "雨なし → 工事・事故など冠水以外の理由の可能性" },
  unknown: { icon: "❓", label: "雨量を取得できませんでした" }
};

function rainVerdictOf(road) {
  return RAIN_VERDICTS[road?.rain?.verdict] || RAIN_VERDICTS.unknown;
}

// ☔ 記録した時刻の雨量でしぼり込む（2026-09-23 中司さんの要望）。
// 3つとも押された状態（既定）はしぼり込みなし＝雨量を取れなかった記録も出す。
// 1つでも外すと、選んだ判定の記録だけを出す（雨量なし・取得失敗は外れる）。
// みんつくの投稿（kansui）は雨量を持たないため対象外（注記を凡例に出す）。
var rainVerdictFilter = { flood_likely: true, light_rain: true, no_rain: true };
// 💧 積算雨量のしぼり込み（2026-09-23 追加指示）。window は r1h／r3h／r24h、min は mm（null＝未指定）
var rainAmountFilter = { window: "r24h", min: null };
const RAIN_WINDOW_LABELS = { r1h: "1時間", r3h: "3時間", r24h: "24時間" };

function rainFilterActive() {
  return Object.values(rainVerdictFilter).some(on => !on) || rainAmountFilter.min !== null;
}

function passesRainFilter(road) {
  if (!rainFilterActive()) return true;
  const rain = road?.rain;
  if (!rain) return false; // 雨量を持たない記録は、しぼり込み中は出さない
  if (Object.values(rainVerdictFilter).some(on => !on)) {
    if (!rain.verdict || !rainVerdictFilter[rain.verdict]) return false;
  }
  if (rainAmountFilter.min !== null) {
    const value = rain[rainAmountFilter.window];
    if (typeof value !== "number" || value < rainAmountFilter.min) return false;
  }
  return true;
}

// しぼり込みの中身は凡例のボタン1つに畳んである（行が増えると地図が下がるため）。
// 何で絞っているかはボタンの文字で示す（例：💧 ☔🌦 ／ 24時間30mm以上）
function syncRainFilterNote() {
  const chip = document.getElementById("legend-rain-amount");
  const active = rainFilterActive();
  document.querySelectorAll("#rain-panel [data-rain]").forEach(button => {
    button.setAttribute("aria-pressed", String(Boolean(rainVerdictFilter[button.dataset.rain])));
  });
  if (!chip) return;
  const parts = [];
  if (Object.values(rainVerdictFilter).some(on => !on)) {
    parts.push(Object.keys(rainVerdictFilter).filter(key => rainVerdictFilter[key]).map(key => RAIN_VERDICTS[key].icon).join("") || "該当なし");
  }
  if (rainAmountFilter.min !== null) parts.push(`${RAIN_WINDOW_LABELS[rainAmountFilter.window]}${rainAmountFilter.min}mm以上`);
  chip.textContent = active ? `💧 ${parts.join(" ／ ")}` : "💧 雨量";
  chip.setAttribute("aria-pressed", String(active));
  chip.title = active
    ? "記録した時刻の雨量でしぼり込み中（みんつくの投稿は雨量が無いため対象外）。押すと変更・解除"
    : "記録した時刻の雨量でしぼり込む（雨の有無・積算雨量）";
}

function applyRainFilter() {
  syncRainFilterNote();
  renderPassedRoadsLayer();
  renderPassedRoadsList();
}

function resetRainFilter() {
  Object.keys(rainVerdictFilter).forEach(key => { rainVerdictFilter[key] = true; });
  rainAmountFilter.min = null;
  const input = document.getElementById("rain-min-input");
  if (input) input.value = "";
  applyRainFilter();
}

// 💧 雨量のパネル。期間・色の見方と同じ場所に出すので、開いたら他方を閉じる
function initRainPanel() {
  const panel = document.getElementById("rain-panel");
  const chip = document.getElementById("legend-rain-amount");
  if (!panel || !chip) return;
  const input = () => document.getElementById("rain-min-input");
  // ⚠ この初期化はファイル前半から呼ばれ、rainAmountFilter の代入（後方）はまだ走っていない。
  // var の巻き上げで宣言だけがあり値は undefined なので、既定値で読む（2026-09-23 に踏んだ）
  const state = () => (typeof rainAmountFilter !== "undefined" && rainAmountFilter) || { window: "r24h", min: null };
  const syncWindowButtons = () => {
    panel.querySelectorAll("[data-rain-window]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.rainWindow === state().window));
    });
  };
  chip.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      document.getElementById("range-panel")?.setAttribute("hidden", "");
      document.getElementById("color-guide")?.setAttribute("hidden", "");
      syncWindowButtons();
      if (input() && rainAmountFilter.min !== null) input().value = String(rainAmountFilter.min);
    }
    syncRainFilterNote();
  });
  panel.addEventListener("click", event => {
    const verdict = event.target.closest("[data-rain]");
    if (verdict) {
      rainVerdictFilter[verdict.dataset.rain] = verdict.getAttribute("aria-pressed") !== "true";
      applyRainFilter();
      return;
    }
    const win = event.target.closest("[data-rain-window]");
    if (win) {
      rainAmountFilter.window = win.dataset.rainWindow;
      syncWindowButtons();
      if (rainAmountFilter.min !== null) applyRainFilter();
      return;
    }
    const preset = event.target.closest("[data-rain-min]");
    if (preset) {
      rainAmountFilter.min = Number(preset.dataset.rainMin);
      if (input()) input().value = preset.dataset.rainMin;
      applyRainFilter();
      return;
    }
    if (event.target.closest("#rain-apply")) {
      const value = Number(input()?.value);
      rainAmountFilter.min = Number.isFinite(value) && value > 0 ? value : null;
      applyRainFilter();
      panel.hidden = true;
      return;
    }
    if (event.target.closest("#rain-clear")) {
      resetRainFilter();
      panel.hidden = true;
    }
  });
  document.addEventListener("click", event => {
    if (panel.hidden) return;
    if (event.target.closest("#rain-panel") || event.target.closest("#legend-rain-amount")) return;
    panel.hidden = true;
  });
  syncWindowButtons();
}

function rainVerdictHtml(road) {
  const rain = road?.rain;
  if (!rain) return "";
  const v = rainVerdictOf(road);
  const mm = x => (x === null || x === undefined ? "−" : `${x}mm`);
  const detail = rain.verdict === "unknown"
    ? ""
    : `<br><span style="font-size:11px;">記録時の雨量（アメダス${escapeHtml(rain.station || "")}・${escapeHtml(formatDateTime(toDateTimeLocal(rain.at)) || "")}）1時間 ${mm(rain.r1h)}／3時間 ${mm(rain.r3h)}／24時間 ${mm(rain.r24h)}</span>`;
  return `<br><strong>${v.icon} ${escapeHtml(v.label)}</strong>${detail}`;
}

function passedRoadSourceLabel(road) {
  return road.source === "map" ? "地図で場所を指定（時刻は記録者の申告）" : "現地でGPS記録";
}

function passedRoadShape(road) {
  if (road.kind === "blocked") return blockedPointShape(road);
  const tier = passedRoadTier(road.endedAt);
  const isOld = isBeforeEvent(road.endedAt);
  const line = road.path.length === 1
    ? L.marker(road.path[0], {
        pane: "passedRoadsPane", renderer: passedRoadsRenderer,
        icon: L.divIcon({ className: "", html: `<div class="passed-gps-point${isOld ? " is-old" : ""}" aria-label="通れた地点"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
      })
    : L.polyline(road.path, { pane: "passedRoadsPane", renderer: passedRoadsRenderer, color: tier.color, weight: isOld ? 4 : tier.weight, opacity: isOld ? 0.4 : 0.9 });
  line.bindPopup(
    `<strong>🔵 ${escapeHtml(tier.label)}</strong><br>` +
    `通れた時刻 ${escapeHtml(formatDateTime(toDateTimeLocal(road.endedAt)) || "不明")}（${escapeHtml(formatAgo(road.endedAt))}）<br>` +
    (road.path.length === 1 ? "地点の記録" : `距離 約${Math.round(road.lengthM || 0)}m`) +
    `・${escapeHtml(passedRoadSourceLabel(road))}` +
    (road.note ? `<br>メモ: ${escapeHtml(road.note)}` : "") +
    window.RoadRecordEditor.render(road) +
    `<br><span style="font-size:11px;">${isOld
      ? "今回の大雨より前の記録です。冠水時に通れた実績として残していますが、より強い雨では冠水することがあります。"
      : "この地図を見ている人が通れた道を記録したものです。現在の安全や通行可否を保証するものではありません。"}</span>` +
    rainAmountHtml(road) +
    profileButtonHtml("passed", road) +
    passedRoadHideButtonHtml(road)
  );
  return line;
}

// 運営の合言葉がある端末だけ、いたずら・誤った記録を地図から伏せるボタンを出す（冠水の投稿と同じ作り）
function passedRoadHideButtonHtml(road) {
  return moderationKey() && road?.id != null
    ? `<br><button type="button" class="kansui-hide-btn" data-passed-edit="${escapeAttribute(String(road.id))}">✏ 時刻・メモを直す（運営）</button>` +
      `<br><button type="button" class="kansui-hide-btn" data-passed-hide="${escapeAttribute(String(road.id))}">🗑 この記録を地図から伏せる（運営）</button>`
    : "";
}

// 通れた道：どのくらいの雨で通れたかの参考に、記録時刻の雨量（最寄りアメダス）だけを添える（2026-09-22）。
// 「冠水の可能性」の判定は通れない記録のためのものなので、ここには出さない
function rainAmountHtml(road) {
  const rain = road?.rain;
  if (!rain || rain.verdict === "unknown" || !rain.station) return "";
  const mm = x => (x === null || x === undefined ? "−" : `${x}mm`);
  return `<br><span style="font-size:11px;">☔ 記録時の雨量（アメダス${escapeHtml(rain.station)}・${escapeHtml(formatDateTime(toDateTimeLocal(rain.at)) || "")}）1時間 ${mm(rain.r1h)}／3時間 ${mm(rain.r3h)}／24時間 ${mm(rain.r24h)}</span>`;
}

// 記録の絞り込み（凡例バーのチップ）。「本日」「過去の実績」はどちらも既定ON。
// from / to（ミリ秒）を入れると、そちらが優先される（⏱ 期間・2026-09-21 追加）
const recordWhenFilter = { today: true, past: true, from: null, to: null, label: "" };

// その記録が対象日のものか。対象日を変えれば、その日の記録が「本日」側になる
function isTargetDayRecord(iso) {
  const key = String(toDateTimeLocal(iso) || "").slice(0, 10);
  const target = document.getElementById("incident-date")?.value || todayJst();
  return Boolean(key) && key === target;
}

function passesWhenFilter(iso) {
  const time = Date.parse(iso || "");
  // 期間を指定しているあいだは「本日／過去の実績」ではなく期間だけで絞る
  if (recordWhenFilter.from !== null || recordWhenFilter.to !== null) {
    if (!Number.isFinite(time)) return false;
    if (recordWhenFilter.from !== null && time < recordWhenFilter.from) return false;
    if (recordWhenFilter.to !== null && time > recordWhenFilter.to) return false;
    return true;
  }
  return isTargetDayRecord(iso) ? recordWhenFilter.today : recordWhenFilter.past;
}

// ⏱ 期間の絞り込み。災害中は「直近3時間」をすぐ押せることが大事なので、
// よく使う範囲のボタンと、開始・終了の手入力の両方を出す（2026-09-21 中司さんの要望）
// 災害ごとのボタン（2026-09-23 事業主指示）。「8月の豪雨」「台風25号」の記録だけを一発で見る。
// 期間は、みんつくの投稿数とCBIの記録数の山から決めた（8/24 428件・8/25 2371件・8/26 795件・
// 8/27 464件・8/28 95件／9/20 147件・9/21 463件、CBIの記録は9/21〜9/23で256件）。
// 終わりが null の災害（進行中）は「今まで」の意味になる。
// 定数ではなく関数にしてある：初期化（ファイル前半の initRecordEvents()）から呼ぶため。
// const で書くと、宣言より前に呼ばれて TDZ エラーになり、以降の初期化が全部止まる（2026-09-23 に踏んだ）
function recordEvents() {
  return {
    aug2026: { label: "8月豪雨", from: "2026-08-24T00:00:00+09:00", to: "2026-08-29T00:00:00+09:00" },
    typhoon25: { label: "台風25号", from: "2026-09-20T00:00:00+09:00", to: null },
  };
}

function syncEventChips() {
  document.querySelectorAll("#map-legend [data-event]").forEach(button => {
    const event = recordEvents()[button.dataset.event];
    const on = Boolean(event) && recordWhenFilter.label === event.label;
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function initRecordEvents() {
  document.querySelectorAll("#map-legend [data-event]").forEach(button => {
    button.addEventListener("click", () => {
      const event = recordEvents()[button.dataset.event];
      if (!event) return;
      // もう一度押したら解除（「本日／過去の実績」に戻る）
      if (recordWhenFilter.label === event.label) applyRecordRange(null, null, "");
      else applyRecordRange(Date.parse(event.from), event.to ? Date.parse(event.to) : null, event.label);
      document.getElementById("range-panel")?.setAttribute("hidden", "");
    });
  });
  // ここで syncEventChips() は呼ばない。初期化はファイル前半で走るため、
  // 後ろで宣言している recordWhenFilter に触れると TDZ で全体が止まる（2026-09-23 に踏んだ）。
  // 押した状態は applyRecordRange のたびに合わせている
}

function applyRecordRange(from, to, label) {
  // 通行止め（役所の発表）も同じ期間で絞る（2026-09-23 事業主指示A）
  if (typeof roadClosuresData !== "undefined" && roadClosuresData) setTimeout(() => renderRoadClosures(), 0);
  recordWhenFilter.from = from;
  recordWhenFilter.to = to;
  recordWhenFilter.label = label || "";
  const chip = document.getElementById("legend-range");
  if (chip) {
    chip.textContent = label ? `⏱ ${label}` : "⏱ 期間";
    chip.setAttribute("aria-pressed", label ? "true" : "false");
  }
  // 期間を使っているあいだは「本日／過去の実績」を押せなくする（どちらが効いているか分からなくなるため）
  document.querySelectorAll("#map-legend [data-when]").forEach(button => {
    button.disabled = Boolean(label);
    button.classList.toggle("is-muted", Boolean(label));
  });
  if (typeof syncEventChips === "function") syncEventChips();
  renderKansuiLayer();
  renderPassedRoadsLayer();
}

function toLocalInputValue(ms) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

// ⓘ 色の見方のパネル。期間のパネルと同じ場所に出すので、片方を開いたらもう片方は閉じる
function initColorGuide() {
  const panel = document.getElementById("color-guide");
  const chip = document.getElementById("legend-colors");
  if (!panel || !chip) return;
  chip.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    chip.setAttribute("aria-pressed", String(!panel.hidden));
    if (!panel.hidden) {
      document.getElementById("range-panel")?.setAttribute("hidden", "");
      document.getElementById("rain-panel")?.setAttribute("hidden", "");
    }
  });
  document.getElementById("legend-range")?.addEventListener("click", () => {
    panel.hidden = true;
    chip.setAttribute("aria-pressed", "false");
  });
  document.addEventListener("click", event => {
    if (panel.hidden) return;
    if (event.target.closest("#color-guide") || event.target.closest("#legend-colors")) return;
    panel.hidden = true;
    chip.setAttribute("aria-pressed", "false");
  });
}


// ============================================================
// 🔍 場所をさがす（2026-09-23）
// 「報告のあった冠水場所を探すのが大変」（中司さん）への対応。
//   ・地名／駅／施設名 → 国土地理院の住所検索（CORS 可・費用0）で座標を得て地図を動かす
//   ・記録のメモ、アンダーパスの名前、避難所の名前 → この画面が持っているデータから探す
// 飛んだ先では、半径500mにある記録の件数を地図上端の帯に出す（探す手間を減らすため）。
// ============================================================
const PLACE_SEARCH_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=";
const PLACE_NEAR_RADIUS_M = 500;
let placeSearchMarker = null;
let placeSearchTimer = null;
let placeSearchSeq = 0;

function metersBetween(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * 111320;
  const dLon = (bLon - aLon) * 111320 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

function nearbyRecordCounts(lat, lon, radius = PLACE_NEAR_RADIUS_M) {
  const counts = { blocked: 0, passed: 0, kansui: 0 };
  const hit = path => Array.isArray(path)
    && path.some(point => metersBetween(lat, lon, Number(point[0]), Number(point[1])) <= radius);
  (passedRoadsData || []).forEach(road => {
    if (!hit(road.path)) return;
    if (passedRoadKindOf(road) === "blocked") counts.blocked += 1;
    else counts.passed += 1;
  });
  (kansuiData || []).forEach(road => { if (hit(road.path)) counts.kansui += 1; });
  return counts;
}

function jumpToPlace(lat, lon, label) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  userMovedMap = true;   // 検索で動かした後は、初期表示の自動あわせを止める
  map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
  if (placeSearchMarker) map.removeLayer(placeSearchMarker);
  placeSearchMarker = L.marker([lat, lon], {
    icon: L.divIcon({ className: "", html: '<div class="place-pin" aria-hidden="true">📍</div>', iconSize: [26, 26], iconAnchor: [13, 24] }),
    zIndexOffset: 1000,
  }).addTo(map);
  const c = nearbyRecordCounts(lat, lon);
  const near = (c.blocked + c.passed + c.kansui)
    ? `半径${PLACE_NEAR_RADIUS_M}m：通れない道 ${c.blocked + c.kansui}件・通れた道 ${c.passed}件`
    : `半径${PLACE_NEAR_RADIUS_M}m に記録はありません`;
  placeSearchMarker.bindPopup(`<strong>${escapeHtml(label)}</strong><br><span style="font-size:11.5px;">${escapeHtml(near)}</span>`).openPopup();
  const status = document.getElementById("map-status");
  if (status) status.textContent = `🔍 ${label}　${near}`;
}

function placeHitHtml(item) {
  return `<button type="button" class="place-hit" data-place-lat="${item.lat}" data-place-lon="${item.lon}"` +
    (item.roadId != null ? ` data-place-road="${escapeAttribute(String(item.roadId))}"` : "") +
    ` data-place-label="${escapeAttribute(item.label)}">${escapeHtml(item.label)}` +
    (item.sub ? `<span class="ph-sub">${escapeHtml(item.sub)}</span>` : "") + `</button>`;
}

function searchLocalRecords(query) {
  const q = query.toLowerCase();
  const hits = [];
  (passedRoadsData || []).forEach(road => {
    const note = String(road.note || "");
    if (!note.toLowerCase().includes(q)) return;
    const kind = passedRoadKindOf(road) === "blocked" ? "🚫 通れない道" : "🔵 通れた道";
    const mid = road.path?.[Math.floor((road.path.length - 1) / 2)];
    if (!mid) return;
    hits.push({ label: `${kind}　${note}`, sub: formatDateTime(toDateTimeLocal(road.endedAt)) || "",
                lat: Number(mid[0]), lon: Number(mid[1]), roadId: road.id });
  });
  (typeof roadFloodSites !== "undefined" ? roadFloodSites : []).forEach(site => {
    const text = `${site.name} ${site.city} ${site.route}`.toLowerCase();
    if (!text.includes(q)) return;
    hits.push({ label: `🚇 ${site.name}`, sub: `${site.city}　${site.route}`, lat: site.lat, lon: site.lng });
  });
  (shelterPayload?.shelters || []).forEach(shelter => {
    const text = `${shelter.name || ""} ${shelter.address || ""}`.toLowerCase();
    if (!text.includes(q)) return;
    const lat = Number(shelter.latitude), lon = Number(shelter.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    hits.push({ label: `🏫 ${shelter.name}`, sub: shelter.address || "避難所", lat, lon });
  });
  return hits.slice(0, 8);
}

async function searchPlaceNames(query) {
  const response = await fetch(PLACE_SEARCH_URL + encodeURIComponent(query), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({
      label: String(row?.properties?.title || "").trim(),
      lat: Number(row?.geometry?.coordinates?.[1]),
      lon: Number(row?.geometry?.coordinates?.[0]),
    }))
    .filter(item => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lon))
    .filter(item => (seen.has(item.label) ? false : seen.add(item.label)))
    // 千葉県のものを先に（同じ地名が全国にあるため）
    .sort((a, b) => Number(b.label.startsWith("千葉県")) - Number(a.label.startsWith("千葉県")))
    .slice(0, 8);
}

// OpenStreetMap（Nominatim）。国土地理院に無い「お店・橋・公園・名所」の名前を探せる。
// 利用規約で1秒1回まで・自動補完（入力のたびの検索）は禁止のため、押したときだけ1回呼ぶ。
// 出典表示（© OpenStreetMap contributors）を結果に添える。
const OSM_SEARCH_URL = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ja&countrycodes=jp&q=";
// 千葉県のあたりを先に見る（bounded=0 なので、外の候補も後ろに出る）
const OSM_VIEWBOX = "&viewbox=139.70,36.10,140.90,35.40";

async function searchOsmPlaces(query) {
  const response = await fetch(OSM_SEARCH_URL + encodeURIComponent(query) + OSM_VIEWBOX, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const full = String(row?.display_name || "");
      const parts = full.split("、").length > 1 ? full.split("、") : full.split(", ");
      return {
        label: (parts[0] || full).trim(),
        sub: parts.slice(1, 4).join(" ").trim(),
        lat: Number(row?.lat),
        lon: Number(row?.lon),
      };
    })
    .filter(item => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lon))
    // 同じ名前・ほぼ同じ場所のものが2件以上返ることがあるので1件にまとめる
    .filter((item, index, all) => index === all.findIndex(other => other.label === item.label
      && Math.abs(other.lat - item.lat) < 0.002 && Math.abs(other.lon - item.lon) < 0.002))
    .slice(0, 8);
}

async function runOsmSearch(query) {
  const results = document.getElementById("place-results");
  const more = document.getElementById("place-more");
  if (!results) return;
  if (more) { more.disabled = true; more.textContent = "OpenStreetMap を探しています…"; }
  let rows = [];
  let failed = "";
  try {
    rows = await searchOsmPlaces(query);
  } catch (error) {
    failed = error?.message || "接続エラー";
  }
  const block = rows.length
    ? `<p class="place-group">お店・目印（OpenStreetMap）</p>${rows.map(placeHitHtml).join("")}` +
      `<p class="place-credit">© OpenStreetMap contributors</p>`
    : `<p class="place-group">${failed ? `OpenStreetMap を探せませんでした（${escapeHtml(failed)}）` : "OpenStreetMap にも見つかりませんでした"}</p>`;
  if (more) more.remove();
  results.insertAdjacentHTML("beforeend", block);
}

async function runPlaceSearch(query) {
  const results = document.getElementById("place-results");
  const note = document.getElementById("place-note");
  if (!results) return;
  const seq = ++placeSearchSeq;
  const local = searchLocalRecords(query);
  let html = local.length ? `<p class="place-group">この地図の記録</p>${local.map(placeHitHtml).join("")}` : "";
  results.innerHTML = html + `<p class="place-group">地名をさがしています…</p>`;
  let places = [];
  let failed = "";
  try {
    places = await searchPlaceNames(query);
  } catch (error) {
    failed = error?.message || "接続エラー";
  }
  if (seq !== placeSearchSeq) return;   // もっと新しい入力がある
  html += places.length
    ? `<p class="place-group">地名・施設（国土地理院）</p>${places.map(placeHitHtml).join("")}`
    : `<p class="place-group">${failed ? `地名をさがせませんでした（${escapeHtml(failed)}）` : "地名は見つかりませんでした"}</p>`;
  html += `<button type="button" class="place-more" id="place-more" data-place-query="${escapeAttribute(query)}">🔎 お店・目印の名前でさらに探す（OpenStreetMap）</button>`;
  results.innerHTML = html;
  if (note) note.textContent = `「${query}」の結果です。押すとその場所へ地図が動きます。`;
  // 地名が1件も無いときは、そのまま OpenStreetMap まで探す（押させる手間を省く）
  if (!places.length && !failed) runOsmSearch(query);
}

function initPlaceSearch() {
  const panel = document.getElementById("place-panel");
  const chip = document.getElementById("legend-place");
  const input = document.getElementById("place-search-input");
  const results = document.getElementById("place-results");
  if (!panel || !chip || !input || !results) return;

  const close = () => { panel.hidden = true; chip.setAttribute("aria-pressed", "false"); };
  chip.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    chip.setAttribute("aria-pressed", panel.hidden ? "false" : "true");
    document.getElementById("color-guide")?.setAttribute("hidden", "");
    if (!panel.hidden) input.focus();
  });
  document.addEventListener("click", event => {
    if (panel.hidden) return;
    if (event.target.closest("#place-panel") || event.target.closest("#legend-place")) return;
    close();
  });
  input.addEventListener("input", () => {
    const query = input.value.trim();
    window.clearTimeout(placeSearchTimer);
    if (query.length < 2) { results.innerHTML = ""; placeSearchSeq += 1; return; }
    placeSearchTimer = window.setTimeout(() => runPlaceSearch(query), 320);
  });
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    results.querySelector(".place-hit")?.click();
  });
  results.addEventListener("click", event => {
    const more = event.target.closest("#place-more");
    if (more) {
      runOsmSearch(String(more.dataset.placeQuery || input.value.trim()));
      return;
    }
    const button = event.target.closest(".place-hit");
    if (!button) return;
    const roadId = button.dataset.placeRoad;
    if (roadId) {
      focusPassedRoad(roadId);
    } else {
      jumpToPlace(Number(button.dataset.placeLat), Number(button.dataset.placeLon), button.dataset.placeLabel || "");
    }
    close();
  });
}

function initRecordRange() {
  const panel = document.getElementById("range-panel");
  const chip = document.getElementById("legend-range");
  if (!panel || !chip) return;
  chip.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      const now = Date.now();
      const fromInput = document.getElementById("range-from");
      const toInput = document.getElementById("range-to");
      if (!fromInput.value) fromInput.value = toLocalInputValue(now - 6 * 3600 * 1000);
      if (!toInput.value) toInput.value = toLocalInputValue(now);
    }
  });
  panel.addEventListener("click", event => {
    const preset = event.target.closest("[data-range]")?.dataset.range;
    if (!preset) return;
    const now = Date.now();
    if (preset === "all") applyRecordRange(null, null, "");
    else if (preset === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      applyRecordRange(start.getTime(), null, "今日");
    } else {
      const hours = Number(preset);
      applyRecordRange(now - hours * 3600 * 1000, null, `直近${hours}時間`);
    }
    panel.hidden = true;
  });
  document.getElementById("range-apply")?.addEventListener("click", () => {
    const from = document.getElementById("range-from").value;
    const to = document.getElementById("range-to").value;
    const fromMs = from ? Date.parse(from) : null;
    const toMs = to ? Date.parse(to) : null;
    if (fromMs !== null && toMs !== null && fromMs > toMs) {
      document.getElementById("range-note").textContent = "「から」が「まで」より後になっています。";
      return;
    }
    if (fromMs === null && toMs === null) { applyRecordRange(null, null, ""); panel.hidden = true; return; }
    // ボタンの文字は短く（長いと凡例が3行目に回り込み、ほかの表示の裏に隠れる）。
    // 同じ日なら「9/21 7:11〜13:11」、日をまたぐなら「9/12〜9/21」。正確な期間はボタンの説明に入れる
    const day = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };
    const hm = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
    const full = ms => formatDateTime(toDateTimeLocal(new Date(ms).toISOString())) || "";
    const label = fromMs !== null && toMs !== null
      ? (day(fromMs) === day(toMs) ? `${day(fromMs)} ${hm(fromMs)}〜${hm(toMs)}` : `${day(fromMs)}〜${day(toMs)}`)
      : fromMs !== null ? `${day(fromMs)} ${hm(fromMs)}から` : `${day(toMs)} ${hm(toMs)}まで`;
    const fullLabel = fromMs !== null && toMs !== null ? `${full(fromMs)}〜${full(toMs)}`
      : fromMs !== null ? `${full(fromMs)}から` : `${full(toMs)}まで`;
    document.getElementById("range-note").textContent = "";
    applyRecordRange(fromMs, toMs, label);
    document.getElementById("legend-range")?.setAttribute("title", `期間：${fullLabel}（押して変更）`);
    panel.hidden = true;
  });
  document.getElementById("range-clear")?.addEventListener("click", () => {
    document.getElementById("range-from").value = "";
    document.getElementById("range-to").value = "";
    document.getElementById("range-note").textContent = "";
    applyRecordRange(null, null, "");
    panel.hidden = true;
  });
  document.addEventListener("click", event => {
    if (panel.hidden) return;
    if (event.target.closest("#range-panel") || event.target.closest("#legend-range")) return;
    panel.hidden = true;
  });
}

// データは持ったまま、絞り込みだけを描き直す（取得し直さない）
// 凡例の「通れた道」「通れない道」で種類ごとに出し入れする（2026-09-22。以前は1つのボタンで両方が消え、
// 青いボタンで赤い線まで消えて分かりにくかった）
var passedKindFilter = { passed: true, blocked: true }; // var：初期化の早い段階（syncMapLegend）から参照されても止まらないように
function passedRoadKindOf(road) {
  return road.kind === "blocked" ? "blocked" : "passed";
}

function renderPassedRoadsLayer() {
  passedRoadsLayer.clearLayers();
  passedRoadShapes.clear();
  // 古い（薄い）線を先に描き、新しい（濃い）線を上に重ねる
  passedRoadsData.slice().reverse().forEach(road => {
    if (!passesWhenFilter(road.endedAt)) return;
    if (!passedKindFilter[passedRoadKindOf(road)]) return;
    if (!passesRainFilter(road)) return;
    const shape = passedRoadShape(road).addTo(passedRoadsLayer);
    passedRoadShapes.set(road.id, shape);
  });
}

async function ensurePassedRoadsLayer(force) {
  if (passedRoadsLoaded && !force) return;
  passedRoadsLoaded = true;
  const endpoint = String(APP_CONFIG.passedRoadsEndpoint || "").trim();
  if (!endpoint) { setPassedRoadsStatus("配信先が設定されていません", true); return; }
  setPassedRoadsStatus("読み込み中");
  try {
    // 一般向けの配信は Vercel 側で15秒保存される（2026-09-22）。記録・修正の直後（force）は保存を飛ばして最新を取る
    const url = force ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}` : endpoint;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const roads = (payload.roads || []).filter(road => Array.isArray(road.path) && road.path.length >= 1);
    passedRoadsData = roads;
    passedEventStart = payload.eventStart || null;
    document.querySelectorAll("[data-event-start-label]").forEach(node => { node.textContent = eventStartLabel() || "設定なし"; });
    renderPassedRoadsLayer();
    renderPassedRoadsList();
    const recent = roads.filter(road => passedRoadTier(road.endedAt).maxHours !== Infinity).length;
    const blocked = roads.filter(road => road.kind === "blocked").length;
    setPassedRoadsStatus(`通れた ${roads.length - blocked}件・通れない ${blocked}件（6時間以内 ${recent}件）・ ${formatDateTime(toDateTimeLocal(payload.generatedAt)) || ""}時点`);
  } catch (error) {
    passedRoadsLoaded = false;
    setPassedRoadsStatus(`取得できません（${error?.message || "接続エラー"}）`, true);
  }
}

// 記録ボタン。1回目で watchPosition を開始し、2回目で送信する。
// 精度の悪い点（50m超）と、前の点から5m未満しか動いていない点は捨てる。
const passedRoadRecorder = { watchId: null, points: [], startedAt: null, line: null };

// 📵 位置情報が拒否されたときの案内。Webページから端末の設定画面は開けない（iOS・Android ともAPIが無い）ので、
// 機種ごとの手順をその場に出し、GPS なしで記録できる「地図の長押し」へ誘導する。
function geoDeniedGuideHtml() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  let steps;
  // iPhone の Chrome／Firefox／Edge／LINE は Safari と違い、サイトごとの許可ではなく iOS の「アプリの位置情報」で決まる
  const iosApp = /CriOS/.test(ua) ? "Chrome" : /FxiOS/.test(ua) ? "Firefox" : /EdgiOS/.test(ua) ? "Edge" : /Line\//.test(ua) ? "LINE" : "";
  if (isIOS && iosApp) {
    steps = [
      `iPhone の「設定」→「アプリ」→「${iosApp}」→「位置情報」を「このAppの使用中」（または「確認」）にする（iOS 17 以前は「設定」を下にスクロールして「${iosApp}」）`,
      "「設定」→「プライバシーとセキュリティ」→「位置情報サービス」が ON になっているか確認する",
      `${iosApp} に戻ってページを読み直し、もう一度ボタンを押す（許可の確認が出たら「許可」）`
    ].concat(iosApp === "LINE" ? ["LINE の中では位置情報が使えないことがあります。右上の「…」や共有から Safari か Chrome で開き直してください"] : []);
  } else if (isIOS) {
    steps = [
      "Safari のアドレスバー左端のアイコン（「ぁあ」またはページメニュー）を押す →「Webサイトの設定」→「位置情報」を「許可」にして、ページを読み直す",
      "出てこないときは iPhone の「設定」→「アプリ」→「Safari」→「位置情報」を「確認」または「許可」にする（iOS 17 以前は「設定」→「Safari」）",
      "それでもダメなら「設定」→「プライバシーとセキュリティ」→「位置情報サービス」を ON にし、一覧の「Safari のWebサイト」を「このAppの使用中」にする",
      "LINE など他のアプリの中で開いている場合は、右上の「…」や共有から Safari で開き直す"
    ];
  } else if (isAndroid) {
    steps = [
      "Chrome のアドレスバー左端のアイコン（調整マーク または ⓘ）を押す →「権限」→「位置情報」を「許可」にして、ページを読み直す",
      "出てこないときは Chrome 右上の「⋮」→「設定」→「サイトの設定」→「位置情報」→「ブロック中」の一覧からこのサイトを選び「許可」にする",
      "それでもダメなら Android の「設定」→「位置情報」を ON にし、「アプリの権限」で Chrome の位置情報を許可する",
      "LINE など他のアプリの中で開いている場合は、右上の「⋮」から Chrome で開き直す"
    ];
  } else {
    steps = ["PC のブラウザは、アドレスバー左の🔒（サイト情報）から位置情報を「許可」にし、ページを読み直す"];
  }
  return `<div class="geo-denied-guide">
    <strong>📵 位置情報が許可されていません</strong>
    <p>このページから端末の設定画面を直接開くことはできません。次の手順で許可してから、もう一度ボタンを押してください。</p>
    <ol>${steps.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ol>
    <p>位置情報を許可しなくても、<strong>地図をタップして道をなぞる</strong>方法で記録できます。</p>
    <button type="button" class="geo-denied-map-btn" id="geo-denied-map-btn">地図をなぞって通れた道を記録する</button>
    <button type="button" class="geo-denied-close-btn" data-geo-guide-close>閉じる</button>
  </div>`;
}

function showGeoDeniedGuide(show) {
  [document.getElementById("passed-road-geo-guide"), document.getElementById("quick-geo-guide")].forEach(node => {
    if (!node) return;
    node.hidden = !show;
    node.innerHTML = show ? geoDeniedGuideHtml() : "";
  });
  if (show) {
    document.querySelectorAll("[data-geo-guide-close]").forEach(button => button.addEventListener("click", () => showGeoDeniedGuide(false)));
    document.querySelectorAll("#geo-denied-map-btn").forEach(button => button.addEventListener("click", () => {
      startCitizenRoadDrawing("passed");
    }));
  }
}

// 開いた時点で拒否済みなら、押す前から案内を出す（Permissions API がある端末だけ。無ければ押したときに分かる）
function checkGeoPermissionOnLoad() {
  if (!navigator.permissions?.query) return;
  navigator.permissions.query({ name: "geolocation" }).then(status => {
    const apply = () => {
      if (status.state === "denied") {
        showGeoDeniedGuide(true);
        setPassedRoadRecordStatus("位置情報が許可されていないため、GPSでの記録はできません（「通れない道を追加」から地図をなぞれば記録できます）。", "error");
      } else {
        showGeoDeniedGuide(false);
      }
    };
    apply();
    status.onchange = apply;
  }).catch(() => {});
}

function setPassedRoadRecordStatus(text, kind) {
  [document.getElementById("passed-road-record-status"), document.getElementById("quick-record-status")].forEach(node => {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-error", kind === "error");
    node.classList.toggle("is-live", kind === "live");
  });
}

// 記録ボタンの見た目（左パネルとスマホの固定バーの両方）
function setPassedRoadButtons(recording, disabled) {
  const panelBtn = document.getElementById("passed-road-record-btn");
  if (panelBtn) {
    panelBtn.textContent = recording ? "⏹ 通り終わった（記録を送る）" : "📍 通れた道を記録する（GPS）";
    panelBtn.classList.toggle("is-recording", recording);
    panelBtn.disabled = Boolean(disabled);
  }
  const blockedBtn = document.getElementById("blocked-point-record-btn");
  if (blockedBtn) blockedBtn.disabled = Boolean(disabled);
}

function showMintsukuHint(show) {
  const node = document.getElementById("passed-road-mintsuku");
  if (node) node.hidden = !show;
}

// 通れる道のレイヤーを ON にする（記録の結果がすぐ見えるように）
function ensurePassedRoadsOverlayOn() {
  const overlayBox = document.querySelector('[data-overlay="passedRoads"]');
  if (overlayBox && !overlayBox.checked) { overlayBox.checked = true; toggleOverlay("passedRoads", true); }
}

// 🚫 ここは通れない：現在地を1点だけ送る（冠水で止まった場所でワンタップ）
let blockedPointBusy = false;
async function recordBlockedPoint() {
  if (blockedPointBusy) return;
  if (passedRoadRecorder.watchId !== null) {
    setPassedRoadRecordStatus("「通れた道」を記録中です。先に停止（送信）してください。", "error");
    return;
  }
  if (!navigator.geolocation) { setPassedRoadRecordStatus("この端末では位置情報が使えません。", "error"); return; }
  blockedPointBusy = true;
  setPassedRoadButtons(false, true);
  setPassedRoadRecordStatus("現在地を取得しています…", "live");
  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }));
    const { latitude, longitude, accuracy } = position.coords;
    showGeoDeniedGuide(false);
    if (Number.isFinite(accuracy) && accuracy > 150) {
      throw new Error(`GPSの精度が低すぎます（±${Math.round(accuracy)}m）。空が見える場所で再度お試しください`);
    }
    const noteInput = document.getElementById("passed-road-note");
    const note = noteInput ? noteInput.value.trim().slice(0, 200) : "";
    if (!window.confirm(`いまいる場所（精度 ±${Math.round(accuracy || 0)}m）を「通れない地点」として地図に送ります。\n端末の匿名IDと位置だけが送られ、名前や電話番号は送られません。よろしいですか？`)) {
      setPassedRoadRecordStatus("送信をやめました。", "");
      return;
    }
    const now = new Date().toISOString();
    const result = await submitPassedRoadRecord({ kind: "blocked", source: "gps", path: [[latitude, longitude]], startedAt: now, endedAt: now, note });
    if (!result.ok) throw new Error(result.error);
    if (noteInput) noteInput.value = "";
    map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
    setPassedRoadRecordStatus("送りました。地図に赤い×で表示されました。みんつく千葉冠水マップにも投稿すると県全体の地図にも残ります。", "");
    showMintsukuHint(true);
  } catch (error) {
    const messages = { 1: "位置情報が許可されていません（下の手順を見てください）", 2: "現在地を取得できません。", 3: "位置情報の取得がタイムアウトしました。" };
    if (error?.code === 1) showGeoDeniedGuide(true);
    setPassedRoadRecordStatus(`送れませんでした（${messages[error?.code] || error?.message || "接続エラー"}）`, "error");
  } finally {
    blockedPointBusy = false;
    setPassedRoadButtons(false, false);
  }
}

function passedRoadDistanceM([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function passedRoadPathLengthM(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += passedRoadDistanceM(points[i - 1], points[i]);
  return total;
}

function startPassedRoadRecording() {
  if (!navigator.geolocation) {
    setPassedRoadRecordStatus("この端末では位置情報が使えません。", "error");
    return;
  }
  if (blockedPointBusy) return;
  showMintsukuHint(false);
  setUndoLink(null);
  passedRoadRecorder.points = [];
  passedRoadRecorder.startedAt = new Date().toISOString();
  passedRoadRecorder.line = L.polyline([], { pane: "passedRoadsPane", renderer: passedRoadsRenderer, color: "#1565c0", weight: 5, opacity: 0.9, dashArray: "6 8" }).addTo(passedRoadDraftLayer);
  passedRoadDraftLayer.addTo(map);
  // 記録中は通れた道レイヤーも出して、赤（冠水）と見比べられるようにする
  ensurePassedRoadsOverlayOn();
  setPassedRoadButtons(true, false);
  setPassedRoadRecordStatus("GPSを待っています…（屋外で数秒かかります）", "live");
  passedRoadRecorder.watchId = navigator.geolocation.watchPosition(
    position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      showGeoDeniedGuide(false);
      if (Number.isFinite(accuracy) && accuracy > 50) {
        setPassedRoadRecordStatus(`記録中（GPS精度 ±${Math.round(accuracy)}m・精度が上がるのを待っています）`, "live");
        return;
      }
      const point = [latitude, longitude];
      const last = passedRoadRecorder.points[passedRoadRecorder.points.length - 1];
      if (last && passedRoadDistanceM(last, point) < 5) return;
      passedRoadRecorder.points.push(point);
      passedRoadRecorder.line.addLatLng(point);
      const length = Math.round(passedRoadPathLengthM(passedRoadRecorder.points));
      setPassedRoadRecordStatus(`記録中 ${passedRoadRecorder.points.length}点・約${length}m（もう一度押すと送ります）`, "live");
    },
    error => {
      const messages = { 1: "位置情報が許可されていません（下の手順を見てください）", 2: "現在地を取得できません。", 3: "位置情報の取得がタイムアウトしました。" };
      if (error.code === 1) { showGeoDeniedGuide(true); stopPassedRoadRecording(); }
      setPassedRoadRecordStatus(messages[error.code] || error.message || "位置情報エラー", "error");
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
  );
}

async function stopPassedRoadRecording() {
  const noteInput = document.getElementById("passed-road-note");
  if (passedRoadRecorder.watchId !== null) navigator.geolocation.clearWatch(passedRoadRecorder.watchId);
  passedRoadRecorder.watchId = null;
  setPassedRoadButtons(false, false);

  const points = passedRoadRecorder.points;
  const lengthM = passedRoadPathLengthM(points);
  const reset = () => { passedRoadDraftLayer.clearLayers(); passedRoadRecorder.points = []; passedRoadRecorder.line = null; };
  if (points.length < 3 || lengthM < 50) {
    reset();
    setPassedRoadRecordStatus(`記録が短すぎるため送りませんでした（${points.length}点・約${Math.round(lengthM)}m。50m以上必要です）。`, "error");
    return;
  }
  if (!window.confirm(`約${Math.round(lengthM)}m の軌跡を「通れた道」として地図に送ります。\n端末の匿名IDと軌跡だけが送られ、名前や電話番号は送られません。よろしいですか？`)) {
    reset();
    setPassedRoadRecordStatus("送信をやめました。", "");
    return;
  }
  setPassedRoadButtons(false, true);
  setPassedRoadRecordStatus("送信中…", "live");
  try {
    const result = await submitPassedRoadRecord({
      kind: "passed",
      source: "gps",
      path: points,
      startedAt: passedRoadRecorder.startedAt,
      endedAt: new Date().toISOString(),
      note: noteInput ? noteInput.value.trim().slice(0, 200) : ""
    });
    if (!result.ok) throw new Error(result.error);
    reset();
    if (noteInput) noteInput.value = "";
    setPassedRoadRecordStatus(`送りました（約${result.payload.lengthM || Math.round(lengthM)}m）。地図の青い線に反映されました。`, "");
  } catch (error) {
    reset();
    setPassedRoadRecordStatus(`送れませんでした（${error?.message || "接続エラー"}）`, "error");
  } finally {
    setPassedRoadButtons(false, false);
  }
}

// ⚙ 運営用：上部の運営・検証向けボタン（登録・CSV・GeoJSON・管理記録・印刷・状態チップ）は既定で隠す。
// ふだんの利用者に必要なのは「使い方」「公式情報」だけ。開閉は端末に記憶し、?ops=1 でも開く。
const OPERATOR_TOOLS_KEY = "cbi-disaster-operator-tools-open-v1";
function initOperatorTools() {
  const toggle = document.getElementById("operator-tools-toggle");
  const box = document.getElementById("operator-tools");
  if (!toggle || !box) return;
  const apply = open => {
    box.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.classList.toggle("is-open", open);
    toggle.textContent = open ? "⚙ 運営用を閉じる" : "⚙ 運営用";
  };
  let open = false;
  try { open = localStorage.getItem(OPERATOR_TOOLS_KEY) === "1"; } catch {}
  if (new URLSearchParams(location.search).get("ops") === "1") open = true;
  apply(open);
  toggle.addEventListener("click", () => {
    open = box.hidden;
    apply(open);
    try { localStorage.setItem(OPERATOR_TOOLS_KEY, open ? "1" : "0"); } catch {}
  });
}

function initPassedRoadRecorder() {
  const togglePassed = () => {
    if (passedRoadRecorder.watchId !== null) stopPassedRoadRecording();
    else startPassedRoadRecording();
  };
  document.getElementById("passed-road-record-btn")?.addEventListener("click", togglePassed);
  document.getElementById("quick-passed-btn")?.addEventListener("click", () => startCitizenRoadDrawing("passed"));
  document.getElementById("blocked-point-record-btn")?.addEventListener("click", recordBlockedPoint);
  document.getElementById("quick-blocked-btn")?.addEventListener("click", () => startCitizenRoadDrawing("blocked"));
  document.getElementById("quick-profile-btn")?.addEventListener("click", () => startCitizenRoadDrawing("profile"));
  document.querySelectorAll("[data-draw-citizen-road]").forEach(button => button.addEventListener("click", () => startCitizenRoadDrawing(button.dataset.drawCitizenRoad)));
  document.getElementById("citizen-road-back").addEventListener("click", () => {
    if (citizenRoadDraft.busy) return;
    citizenRoadDraft.points.pop();
    drawCitizenRoadPreview();
    citizenRoadMessage("1点戻しました。道に沿ってタップして続けてください。");
  });
  document.getElementById("citizen-road-cancel").addEventListener("click", closeCitizenRoadDrawing);
  document.getElementById("citizen-road-finish").addEventListener("click", finishCitizenRoadDrawing);
  L.DomEvent.disableClickPropagation(document.getElementById("citizen-road-editor"));
  L.DomEvent.disableScrollPropagation(document.getElementById("citizen-road-editor"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && citizenRoadDraft.active) closeCitizenRoadDrawing();
  });
  document.getElementById("passed-roads-sort")?.addEventListener("change", renderPassedRoadsList);
  document.getElementById("passed-roads-filter")?.addEventListener("change", renderPassedRoadsList);
  document.getElementById("passed-roads-list")?.addEventListener("click", event => {
    const undo = event.target.closest("[data-undo-id]");
    if (undo) { undoPassedRoad(undo.dataset.undoId); return; }
    const button = event.target.closest("[data-passed-road]");
    if (button) focusPassedRoad(button.dataset.passedRoad);
  });
  document.addEventListener("click", event => {
    const undo = event.target.closest("#passed-road-undo [data-undo-id], #quick-undo [data-undo-id]");
    if (undo) { setUndoLink(null); undoPassedRoad(undo.dataset.undoId); }
  });
  document.getElementById("quick-list-btn")?.addEventListener("click", () => {
    ensurePassedRoadsOverlayOn();
    const group = document.getElementById("passed-roads-list-wrap")?.closest("details.layer-group");
    if (group) group.open = true;
    document.getElementById("passed-roads-list-wrap")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  // 長押し（スマホ）／右クリック（PC）は Leaflet の contextmenu イベントとして届く
  map.on("contextmenu", event => {
    if (citizenRoadDraft.active) return;
    if (event.originalEvent) event.originalEvent.preventDefault();
    openMapRecordPopup(event.latlng);
  });
}

// 警報・注意報カードのすぐ下に「直近の地震」を1行で出す。
// 地震情報は別カードにあるが、災害時に下までスクロールしないと気づけないため、
// 気象の警報と同じ視線の位置で分かるようにする（12時間以内の地震だけ）。
function renderQuakeBrief(latest, inzaiIntensity) {
  const node = document.getElementById("quake-brief");
  if (!node) return;
  const at = toDateTimeLocal(latest?.at);
  const happenedAt = at ? new Date(at).getTime() : NaN;
  if (!Number.isFinite(happenedAt) || Date.now() - happenedAt > 12 * 60 * 60 * 1000) {
    node.hidden = true;
    return;
  }
  const rank = intensityRank(inzaiIntensity || latest?.maxi);
  node.hidden = false;
  node.className = `quake-brief${rank >= 4 ? " is-strong" : ""}`;
  node.innerHTML = `
    <span class="quake-brief-label">直近の地震</span>
    <span class="quake-brief-body">${escapeHtml(formatDateTime(at))}　${escapeHtml(latest.anm || "震源地不明")}${latest.mag ? ` M${escapeHtml(String(latest.mag))}` : ""}
      ${inzaiIntensity
        ? `／<strong>印西市 震度${escapeHtml(intensityLabel(inzaiIntensity))}</strong>`
        : `／最大震度${escapeHtml(intensityLabel(latest.maxi))}（印西市の震度記録なし）`}</span>
  `;
}

async function refreshEarthquakeSummary(manual) {
  const node = document.getElementById("earthquake-summary-content");
  const endpoint = String(APP_CONFIG.earthquakeListEndpoint || "https://www.jma.go.jp/bosai/quake/data/list.json");
  if (manual) node.innerHTML = '<div class="detail-empty">最新情報を更新中です。</div>';
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = await response.json();
    const reports = Array.isArray(items)
      ? items.filter(item => String(item.ttl || "").includes("震源・震度") && item.ift !== "取消")
      : [];
    const latest = reports[0];
    const inzai = reports.find(item => Array.isArray(item.int) && item.int.some(prefecture =>
      Array.isArray(prefecture.city) && prefecture.city.some(city => String(city.code) === "1223100")
    ));
    if (!latest) throw new Error("表示対象の地震情報がありません");
    const inzaiIntensity = inzai ? findCityIntensity(inzai, "1223100") : "";
    renderQuakeBrief(latest, inzaiIntensity);

    // 地図用: 座標が取れた地震を新しい順に最大20件保持する。
    // 印西市に震度記録がある地震は、市内への影響が分かるよう優先して残す
    quakeEvents = reports
      .map(item => {
        const position = parseJmaCoordinate(item.cod);
        if (!position) return null;
        return {
          at: item.at,
          name: item.anm || "",
          mag: item.mag || "",
          maxi: item.maxi || "",
          position,
          inzaiIntensity: findCityIntensity(item, "1223100") || ""
        };
      })
      .filter(Boolean)
      .slice(0, 20);
    renderQuakeLayer();
    node.innerHTML = `
      <div class="earthquake-event">
        <strong>最新: ${escapeHtml(latest.anm || "震源地不明")} M${escapeHtml(latest.mag || "-")}</strong>
        <span>${escapeHtml(formatJmaDateTime(latest.at))} / 最大震度 <span class="intensity-value">${escapeHtml(latest.maxi || "-")}</span></span>
        ${inzai ? `<span>印西市の直近観測: ${escapeHtml(formatJmaDateTime(inzai.at))} / 震度 <span class="intensity-value">${escapeHtml(inzaiIntensity || "-")}</span></span>` : '<span>取得範囲内に印西市の震度記録はありません。</span>'}
        <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer">気象庁の地震情報を確認</a>
      </div>
    `;
  } catch (error) {
    node.innerHTML = '<div class="detail-empty">地震情報を取得できません。気象庁の公式ページを確認してください。</div>';
    if (manual) appendSystemWorkLog("気象庁 地震情報", "blocked", `地震情報を取得できませんでした: ${error?.message || "不明なエラー"}`, "気象庁公式ページと配信URLを確認する");
  }
}

async function refreshWeatherWarnings(manual) {
  const node = document.getElementById("weather-warning-content");
  const panel = document.getElementById("weather-warning-panel");
  const button = document.getElementById("refresh-weather-warning-button");
  const endpoint = String(APP_CONFIG.weatherWarningEndpoint || "https://www.jma.go.jp/bosai/warning/data/r8/120000.json");
  if (manual) node.innerHTML = '<div class="weather-warning-loading">最新情報を更新中です。</div>';
  node.setAttribute("aria-busy", "true");
  button.disabled = true;
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reports = await response.json();
    const summary = parseInzaiWeatherWarnings(reports);
    renderWeatherWarnings(node, panel, summary);
  } catch (error) {
    setWeatherWarningPanelState(panel, "error");
    node.innerHTML = `
      <div class="weather-warning-error">
        <strong>現在の発表状況を取得できません</strong>
        <span>「発表なし」ではありません。通信状況を確認し、気象庁の公式ページで確認してください。</span>
        ${weatherWarningOfficialLink("気象庁で警報・注意報を確認")}
      </div>
    `;
    if (manual) appendSystemWorkLog("印西市の警報・注意報", "blocked", `気象庁の警報・注意報を取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁の現行配信URLを確認する");
  } finally {
    node.setAttribute("aria-busy", "false");
    button.disabled = false;
  }
}

function parseInzaiWeatherWarnings(payload) {
  if (!Array.isArray(payload)) throw new Error("現行の警報データ形式ではありません");
  const latestByCode = new Map();
  let latestLocalReport = null;
  let foundCity = false;

  payload.forEach(report => {
    const city = (report?.warning?.class20Items || []).find(item => String(item.areaCode) === INZAI_CITY_CODE);
    if (!city) return;
    foundCity = true;
    const reportTime = new Date(report.reportDatetime || 0);
    if (!Number.isNaN(reportTime.getTime()) && (!latestLocalReport || reportTime > new Date(latestLocalReport.reportDatetime))) {
      latestLocalReport = report;
    }
    (city.kinds || []).forEach(kind => {
      const code = String(kind.code || "").padStart(2, "0");
      if (!kind.code) return;
      const existing = latestByCode.get(code);
      if (!existing || reportTime > new Date(existing.reportDatetime || 0)) {
        const definition = weatherWarningDefinitions[code] || {
          name: `気象警報・注意報（コード${code}）`,
          element: "other",
          level: 20
        };
        latestByCode.set(code, { ...definition, code, status: String(kind.status || "発表"), reportDatetime: report.reportDatetime, headlineText: report.headlineText || "", publishingOffice: report.publishingOffice || "気象庁" });
      }
    });
  });

  if (!foundCity) throw new Error("印西市の発表区域が見つかりません");
  const active = Array.from(latestByCode.values())
    .filter(item => !/解除|発表警報・注意報はなし|発表なし/.test(item.status))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "ja"));
  return {
    active,
    reportDatetime: latestLocalReport?.reportDatetime || "",
    publishingOffice: latestLocalReport?.publishingOffice || "気象庁"
  };
}

function renderWeatherWarnings(node, panel, summary) {
  const checkedAt = formatJmaDateTime(new Date());
  const reportAt = summary.reportDatetime ? formatJmaDateTime(summary.reportDatetime) : "-";
  if (!summary.active.length) {
    setWeatherWarningPanelState(panel, "clear");
    node.innerHTML = `
      <div class="weather-warning-clear">
        <span class="weather-warning-state-mark" aria-hidden="true"></span>
        <div>
          <strong>発表中の警報・注意報はありません</strong>
          <span>印西市を対象にした気象庁情報を確認しました。</span>
        </div>
      </div>
      <div class="weather-warning-meta">情報元 ${escapeHtml(summary.publishingOffice)} / 最新発表 ${escapeHtml(reportAt)} / 取得確認 ${escapeHtml(checkedAt)}</div>
      <div class="weather-warning-note">河川ごとの氾濫情報と印西市の避難情報は別に発表されます。</div>
      ${weatherWarningOfficialLink("気象庁の印西市ページを確認")}
    `;
    weatherAlertLevelNow = 0;
    updateEvacCardNote();
    return;
  }

  const highestLevel = Math.max(...summary.active.map(item => item.level));
  const state = highestLevel >= 50 ? "emergency" : highestLevel >= 40 ? "danger" : highestLevel >= 30 ? "warning" : "advisory";
  const stateLabel = highestLevel >= 50 ? "特別警報" : highestLevel >= 40 ? "危険警報" : highestLevel >= 30 ? "警報" : "注意報";
  const alertLevel = Math.max(0, ...summary.active.filter(item => item.level === highestLevel).map(item => Number(item.alertLevel || 0)));
  const headline = summary.active.map(item => item.headlineText).find(Boolean) || "";
  const actions = Array.from(new Set(summary.active.map(item => weatherWarningActions[item.element]).filter(Boolean))).slice(0, 3);
  setWeatherWarningPanelState(panel, state);
  node.innerHTML = `
    <div class="weather-warning-alert-head">
      <span class="weather-warning-level">${escapeHtml(alertLevel ? `警戒レベル${alertLevel}相当` : stateLabel)}</span>
      <strong>印西市に${escapeHtml(stateLabel)}が発表中</strong>
    </div>
    <div class="weather-warning-items">
      ${summary.active.map(item => `
        <div class="weather-warning-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.status)}</span>
        </div>
      `).join("")}
    </div>
    ${headline ? `<p class="weather-warning-headline">${escapeHtml(headline)}</p>` : ""}
    ${actions.length ? `<div class="weather-warning-guidance"><strong>行動の目安</strong>${actions.map(action => `<span>${escapeHtml(action)}</span>`).join("")}</div>` : ""}
    <div class="weather-warning-meta">情報元 ${escapeHtml(summary.publishingOffice)} / 最新発表 ${escapeHtml(reportAt)} / 取得確認 ${escapeHtml(checkedAt)}</div>
    <div class="weather-warning-note">${alertLevel ? "警戒レベル相当情報は避難指示そのものではありません。" : "この表示は印西市の避難情報ではありません。"}印西市の避難情報も確認してください。</div>
    ${weatherWarningOfficialLink("気象庁で詳細・時系列を確認")}
  `;
  weatherAlertLevelNow = alertLevel;
  updateEvacCardNote();
}

function setWeatherWarningPanelState(panel, state) {
  panel.classList.remove("is-clear", "is-advisory", "is-warning", "is-danger", "is-emergency", "is-error");
  panel.classList.add(`is-${state}`);
}

function weatherWarningOfficialLink(label) {
  return `<a class="weather-warning-official-link" href="https://www.jma.go.jp/bosai/warning/#area_type=class20s&amp;area_code=1223100" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function findCityIntensity(report, cityCode) {
  for (const prefecture of report.int || []) {
    const city = (prefecture.city || []).find(item => String(item.code) === cityCode);
    if (city) return String(city.maxi || "");
  }
  return "";
}

function formatJmaDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatJmaTime(value) {
  const text = String(value || "");
  if (!/^\d{14}$/.test(text)) return text;
  const date = new Date(Date.UTC(
    Number(text.slice(0, 4)),
    Number(text.slice(4, 6)) - 1,
    Number(text.slice(6, 8)),
    Number(text.slice(8, 10)),
    Number(text.slice(10, 12)),
    Number(text.slice(12, 14))
  ));
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

setInterval(() => {
  if (document.querySelector('[data-overlay="rainNowcast"]')?.checked) refreshRainNowcast(true);
}, 5 * 60 * 1000);
setInterval(() => {
  if (Object.keys(KIKIKURU_ELEMENTS).some(key => document.querySelector(`[data-overlay="${key}"]`)?.checked)) refreshKikikuru(false);
}, 5 * 60 * 1000);

setInterval(() => refreshEarthquakeSummary(false), 10 * 60 * 1000);
setInterval(() => refreshAmedas(false), 5 * 60 * 1000);
setInterval(() => refreshRiverLevel(false), 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
setInterval(refreshEvacAlert, 5 * 60 * 1000 * CIDAO_POLL_SLOWDOWN);
setInterval(() => {
  if (document.querySelector('[data-overlay="rainForecast"]')?.checked) refreshRainForecast(false);
}, 10 * 60 * 1000);
setInterval(() => refreshWeatherWarnings(false), 5 * 60 * 1000);

function initBoundary() {
  fetch("https://geoshape.ex.nii.ac.jp/jma/resource/AreaInformationCity_risk/20241025/1223100.geojson")
    .then(response => {
      if (!response.ok) throw new Error("Boundary fetch failed");
      return response.json();
    })
    .then(data => {
      boundaryLayer.addData(data);
      buildCityMask(data);
      // 境界が届く前に「印西市の外を伏せる」を押されていた場合はここで描き直す
      const cityMaskBox = document.querySelector('[data-overlay="maskCity"]');
      if (cityMaskBox?.checked) maskCityGroup.addTo(map);
      fitToInzai();
      document.getElementById("map-status").textContent = `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
    })
    .catch(() => {
      document.getElementById("map-status").textContent = "境界データを取得できませんでした。背景地図と手元データで表示しています。";
    });
}

// 開いたときに印西市が画面へちょうど収まるようにする（2026-09-21 中司さんの指示）。
// 市境が届いてから1回だけ動かす。利用者が地図を動かしたあと（moveend が起きたあと）は
// 勝手に戻さない。URL で場所を指定して開いた場合も動かさない。
var inzaiFitDone = false;
var userMovedMap = false;
var fittingInzai = false; // 自分で合わせた移動を「利用者が動かした」と数えないため
map.on("movestart", () => { if (inzaiFitDone && !fittingInzai) userMovedMap = true; });
// 地図の上に重なる凡例・警告帯と、下の記録バーの高さを実測する
function inzaiFitPadding() {
  const mapRect = map.getContainer().getBoundingClientRect();
  let top = 12;
  ["map-legend", "river-alert"].forEach(id => {
    const node = document.getElementById(id);
    if (!node || node.hidden || !node.offsetParent) return;
    const rect = node.getBoundingClientRect();
    if (rect.height && rect.bottom > mapRect.top && rect.top < mapRect.bottom) top = Math.max(top, rect.bottom - mapRect.top + 8);
  });
  let bottom = 92;
  const bar = document.getElementById("quick-record-bar");
  if (bar && !bar.hidden && bar.getClientRects().length) { // スマホでは fixed なので offsetParent は null になる
    const rect = bar.getBoundingClientRect();
    if (rect.height && rect.top < mapRect.bottom && rect.bottom > mapRect.top) bottom = Math.max(12, mapRect.bottom - rect.top + 8);
  }
  return { top, bottom };
}
// 警告帯が出た・消えたときも、利用者がまだ地図を動かしていなければ合わせ直す（force）
function fitToInzai(force = false) {
  if (userMovedMap || (inzaiFitDone && !force)) return;
  const params = new URLSearchParams(location.search);
  if (params.has("lat") || params.has("lon") || params.has("zoom")) { inzaiFitDone = true; userMovedMap = true; return; }
  const bounds = boundaryLayer.getBounds?.();
  if (!bounds || !bounds.isValid()) return;
  inzaiFitDone = true;
  const pad = inzaiFitPadding();
  // 上下の余白をそろえる（2026-09-24 中司さんの指摘「開くと茨城県が映る」）。
  // 上だけ帯の分を空けると、その分だけ市が下へ押し下げられ、画面の中心が北（利根川の向こう）へ寄っていた。
  const vertical = Math.max(pad.top, pad.bottom);
  fittingInzai = true;
  map.fitBounds(bounds, { paddingTopLeft: [12, vertical], paddingBottomRight: [12, vertical], animate: false });
  fittingInzai = false;
}

function renderRoadFloodSites() {
  roadFloodLayer.clearLayers();
  roadFloodSites.forEach(site => {
    const marker = L.marker([site.lat, site.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="risk-point${site.precise ? "" : " is-approx"}" aria-hidden="true"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">🚇 冠水に注意するアンダーパス等 No.${site.no}</div>
      <div class="reference-warning">いま冠水しているという意味ではありません</div>
      ${UNDERPASS_WARNING_HTML}
      <div>${escapeHtml(site.city)}　${escapeHtml(site.name)}</div>
      <div class="detail-meta">${escapeHtml(site.roadType)}　${escapeHtml(site.route)}<br>位置：${escapeHtml(site.accuracy)}</div>
      <a href="${escapeAttribute(ROAD_FLOOD_SOURCE_URL)}" target="_blank" rel="noreferrer">出典：千葉国道事務所「道路冠水注意箇所マップ」（令和8年6月30日更新）</a>
    `);
    roadFloodLayer.addLayer(marker);
  });
}

function renderAll() {
  renderDateScope();
  renderRecords();
  renderList();
  renderSummary();
  renderPhotoQueue();
  renderLocationQueue();
  renderDetail();
  renderSearchLog();
}

function renderDateScope() {
  const target = getFormValue("incident-date");
  const showAll = document.getElementById("show-all-dates").checked;
  document.getElementById("date-scope-label").textContent = showAll
    ? "過去記録を含めて表示中"
    : `${target ? target.replace(/-/g, "/") : "対象日"} の記録だけ表示中`;
}

function renderRecords() {
  recordLayer.clearLayers();
  getFilteredRecords().forEach(record => {
    const roadGeometry = getDisplayRoadGeometry(record);
    const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
    if (!displayCoordinates || getLocationStatus(record) !== "pinned") return;
    const alignment = deriveAlignment(record);
    const passability = getPassability(record);
    const platform = getRecordPlatform(record);
    const hasSourceUrl = isHttpUrl(record.sourceUrl);
    const hasSnsPost = record.sourceType === "sns" && isHttpUrl(record.sourceUrl);
    const popupPhoto = getPopupPhoto(record);
    const popupContent = `
      <div class="popup-title">${escapeHtml(record.title)}</div>
      ${popupPhoto ? `<div class="popup-photo-wrap ${popupPhoto.blurred ? "is-blurred" : ""}"><img src="${escapeAttribute(popupPhoto.src)}" alt="登録されたSNS投稿の証跡写真" loading="lazy" referrerpolicy="no-referrer"></div>` : ""}
      <div>${escapeHtml(categoryLabels[record.category] || record.category)} / ${escapeHtml(statusLabels[record.status] || record.status)}</div>
      <div class="detail-meta">情報源: ${escapeHtml(sourceLabels[record.sourceType] || record.sourceType)}</div>
      ${platform ? `<div class="detail-meta">情報元: ${escapeHtml(platformLabels[platform] || platform)}</div>` : ""}
      ${passability !== "none" ? `<div class="detail-meta">${escapeHtml(passabilityLabels[passability])} ・ ${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</div>` : ""}
      ${roadGeometry ? `<div class="detail-meta">道路区間 ${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))} ・ ${escapeHtml(roadDirectionLabels[record.roadDirection] || roadDirectionLabels.unknown)}</div>` : ""}
      <div class="detail-meta">${escapeHtml(alignmentLabels[alignment])} ・ ${escapeHtml(photoLabels[record.photoStatus] || "")}</div>
      ${hasSnsPost ? `
        <div class="popup-source-actions">
          <a class="popup-source-link" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">元のSNS投稿を見る</a>
          ${PUBLIC_VIEW ? "" : `<button class="popup-question-button" type="button" data-popup-question-record="${escapeAttribute(record.id)}">質問文をコピーして投稿を開く</button>`}
        </div>
        ${PUBLIC_VIEW ? "" : '<div class="popup-contact-note">コメント送信はSNS画面で内容を確認してから行います。</div>'}
      ` : hasSourceUrl
        ? `<div class="popup-source-actions"><a class="popup-source-link" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">根拠情報を開く</a></div>`
        : '<div class="popup-contact-note">根拠URLが登録されていません。</div>'}
    `;

    if (roadGeometry) {
      const color = markerColor(record, alignment);
      const casing = L.polyline(roadGeometry, {
        color: "#ffffff",
        weight: 11,
        opacity: 0.92,
        interactive: false
      });
      const line = L.polyline(roadGeometry, {
        color,
        weight: 7,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
        dashArray: passability === "passed" ? "10 8" : null
      });
      line.on("click", () => selectRecord(record.id, false, { preserveMap: true }));
      line.bindPopup(popupContent);
      line.on("popupopen", () => bindMarkerPopupActions(line, record));
      recordLayer.addLayer(casing);
      recordLayer.addLayer(line);
      return;
    }

    const isPointClosure = passability === "closed" || passability === "impassable";
    const marker = L.marker([displayCoordinates.lat, displayCoordinates.lng], {
      icon: L.divIcon({
        className: "",
        html: isPointClosure
          ? '<div class="closure-cross" aria-label="通行止め地点">×</div>'
          : `<div class="marker-pin" style="background:${markerColor(record, alignment)}"><span></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, isPointClosure ? 14 : 28]
      })
    });
    marker.on("click", () => selectRecord(record.id, false, { preserveMap: true }));
    marker.bindPopup(popupContent);
    marker.on("popupopen", () => bindMarkerPopupActions(marker, record));
    recordLayer.addLayer(marker);
  });
}

function bindMarkerPopupActions(marker, record) {
  const popupElement = marker.getPopup()?.getElement();
  const button = popupElement?.querySelector("[data-popup-question-record]");
  if (!button) return;
  button.addEventListener("click", () => beginLocationContactForRecord(record.id, "comment"), { once: true });
}

function getPopupPhoto(record) {
  if (!record) return null;
  const publicPhotoAllowed = record.photoPrivacy === "public" || record.photoPrivacy === "public-blurred";
  if (PUBLIC_VIEW && (!publicPhotoAllowed || record.category === "rescue_request")) return null;
  const evidenceImage = String(record.evidenceImage || "");
  const directPhotoUrl = String(record.photoUrl || "");
  const src = evidenceImage.startsWith("data:image/")
    ? evidenceImage
    : isDirectImageUrl(directPhotoUrl)
      ? directPhotoUrl
      : "";
  return src ? { src, blurred: PUBLIC_VIEW && record.photoPrivacy === "public-blurred" } : null;
}

function isDirectImageUrl(value) {
  if (!isHttpUrl(value)) return false;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /\.(?:avif|gif|jpe?g|png|webp)$/.test(pathname);
  } catch {
    return false;
  }
}

function renderList() {
  const list = document.getElementById("record-list");
  const filtered = getFilteredRecords();
  if (!filtered.length) {
    list.innerHTML = '<div class="detail-empty">対象日に一致する登録地点はありません。対象日または「過去記録も表示」を確認してください。</div>';
    return;
  }
  list.innerHTML = filtered
    .sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")))
    .map(record => {
      const alignment = deriveAlignment(record);
      const passability = getPassability(record);
      const roadGeometry = getDisplayRoadGeometry(record);
      const platform = getRecordPlatform(record);
      const opensSnsPost = record.sourceType === "sns" && isHttpUrl(record.sourceUrl);
      const cardTag = opensSnsPost ? "a" : "article";
      const linkAttributes = opensSnsPost
        ? `href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="元のSNS投稿を開く"`
        : "";
      return `
        <${cardTag} class="record-card ${opensSnsPost ? "has-source-link" : ""} ${record.id === selectedId ? "is-selected" : ""}" data-record-id="${record.id}" ${linkAttributes} style="border-left-color:${markerColor(record, alignment)}">
          <h3>${escapeHtml(record.title)}</h3>
          <div class="record-meta">
            <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
            <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
            ${platform ? `<span class="badge blue">${escapeHtml(platformLabels[platform] || platform)}</span>` : ""}
            ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
            ${roadGeometry ? `<span class="badge blue">道路区間 ${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))}</span>` : ""}
            <span>${escapeHtml(categoryLabels[record.category] || record.category)}</span>
            <span>${escapeHtml(PUBLIC_VIEW && record.publicLocationPrecision !== "exact" ? (record.publicLocationPrecision === "approximate" ? "概略位置" : "位置非公開") : (record.locationName || "場所名なし"))}</span>
            <span class="badge ${getLocationStatus(record) === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusDisplayLabel(record))}</span>
          </div>
        </${cardTag}>
      `;
    })
    .join("");
  list.querySelectorAll("[data-record-id]").forEach(card => {
    card.addEventListener("click", () => selectRecord(card.dataset.recordId, true));
  });
}

function renderSummary() {
  const filtered = getFilteredRecords();
  const outside = filtered.filter(record => deriveAlignment(record) === "unexpected").length;
  const needsPhoto = filtered.filter(record => record.photoStatus === "needs-photo" || record.photoStatus === "has-photo").length;
  const verified = filtered.filter(record => ["verified", "actioning", "resolved"].includes(record.status)).length;
  const official = filtered.filter(record => record.sourceType === "official" || record.sourceType === "staff").length;
  const locationPending = filtered.filter(record => getLocationStatus(record) !== "pinned").length;
  const blocked = filtered.filter(record => ["closed", "impassable"].includes(getPassability(record))).length;
  document.getElementById("summary-stats").innerHTML = `
    <div class="stat"><strong>${filtered.length}</strong><span>登録候補</span></div>
    <div class="stat"><strong>${verified}</strong><span>確認済・対応中</span></div>
    <div class="stat"><strong>${outside}</strong><span>想定外候補</span></div>
    <div class="stat"><strong>${needsPhoto}</strong><span>写真確認待ち</span></div>
    <div class="stat"><strong>${official}</strong><span>公式/職員根拠</span></div>
    <div class="stat"><strong>${locationPending}</strong><span>場所確認待ち</span></div>
    <div class="stat"><strong>${blocked}</strong><span>通行止め・不能</span></div>
    <div class="stat"><strong>${roadFloodSites.length}</strong><span>参考リスク箇所</span></div>
  `;
}

function renderPhotoQueue() {
  const queue = getFilteredRecords().filter(record => record.photoStatus !== "official-verified" && record.status !== "resolved");
  const node = document.getElementById("photo-queue");
  if (!queue.length) {
    node.innerHTML = '<div class="detail-empty">写真確認待ちはありません。</div>';
    return;
  }
  node.innerHTML = queue
    .map(record => `
      <article class="queue-item" data-record-id="${record.id}">
        <h3>${escapeHtml(record.title)}</h3>
        <div class="queue-meta">
          <span class="badge ${record.photoStatus === "needs-photo" ? "yellow" : "blue"}">${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)}</span>
          <span>${escapeHtml(record.locationName || "場所名なし")}</span>
          <span>${escapeHtml(record.assignedTo || "担当未設定")}</span>
        </div>
      </article>
    `)
    .join("");
  node.querySelectorAll("[data-record-id]").forEach(item => {
    item.addEventListener("click", () => selectRecord(item.dataset.recordId, true));
  });
}

function renderLocationQueue() {
  const queue = getFilteredRecords().filter(record => getLocationStatus(record) !== "pinned" && record.status !== "resolved");
  const node = document.getElementById("location-queue");
  if (!queue.length) {
    node.innerHTML = '<div class="detail-empty">場所確認待ちはありません。</div>';
    return;
  }
  node.innerHTML = queue.map(record => `
    <article class="queue-item" data-record-id="${record.id}">
      <h3>${escapeHtml(record.title)}</h3>
      <div class="queue-meta">
        <span class="badge yellow">${escapeHtml(locationStatusDisplayLabel(record))}</span>
        <span>${escapeHtml(record.evidenceOperator || record.assignedTo || "担当未設定")}</span>
      </div>
    </article>
  `).join("");
  node.querySelectorAll("[data-record-id]").forEach(item => {
    item.addEventListener("click", () => selectRecord(item.dataset.recordId, false));
  });
}

function renderDetail() {
  const detail = document.getElementById("detail-panel");
  const record = records.find(item => item.id === selectedId);
  if (!record || (PUBLIC_VIEW && record.publicationStatus !== "published")) {
    if (PUBLIC_VIEW && record) selectedId = null;
    detail.innerHTML = "地図または一覧から地点を選択してください。";
    return;
  }
  const alignment = deriveAlignment(record);
  const riskHits = getRiskHits(record);
  const locationStatus = getLocationStatus(record);
  const passability = getPassability(record);
  const platform = getRecordPlatform(record);
  const roadGeometry = getDisplayRoadGeometry(record);
  const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
  const publicApproximate = PUBLIC_VIEW && record.publicLocationPrecision === "approximate";
  const displayLocationName = publicApproximate ? "公開用の概略位置" : (record.locationName || "-");
  detail.innerHTML = `
    <div class="detail-title">
      <h3>${escapeHtml(record.title)}</h3>
      <div class="detail-meta">
        <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
        <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
        <span class="badge ${photoBadgeColor(record.photoStatus)}">${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)}</span>
        <span class="badge ${locationStatus === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusDisplayLabel(record))}</span>
        ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-row"><span>分類</span><span>${escapeHtml(categoryLabels[record.category] || record.category)}</span></div>
      ${passability !== "none" ? `<div class="detail-row"><span>通行状況</span><span>${escapeHtml(passabilityLabels[passability])}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>対象</span><span>${escapeHtml(passabilityModeLabels[record.passabilityMode] || passabilityModeLabels.unknown)}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>最終確認</span><span>${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</span></div>` : ""}
      ${roadGeometry ? `<div class="detail-row"><span>道路区間</span><span>${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))}</span></div>` : ""}
      ${roadGeometry ? `<div class="detail-row"><span>規制方向</span><span>${escapeHtml(roadDirectionLabels[record.roadDirection] || roadDirectionLabels.unknown)}</span></div>` : ""}
      <div class="detail-row"><span>場所</span><span>${escapeHtml(displayLocationName)}</span></div>
      <div class="detail-row"><span>座標</span><span>${displayCoordinates ? `${displayCoordinates.lat.toFixed(publicApproximate ? 3 : 6)}, ${displayCoordinates.lng.toFixed(publicApproximate ? 3 : 6)}${publicApproximate ? "（概略）" : ""}` : PUBLIC_VIEW ? "非公開" : "未特定"}</span></div>
      <div class="detail-row"><span>場所確認</span><span>${escapeHtml(locationStatusDisplayLabel(record))}</span></div>
      ${record.locationCandidateSource ? `<div class="detail-row"><span>場所候補根拠</span><span>${escapeHtml(locationCandidateSourceLabel(record.locationCandidateSource))} / 確度${Math.round(Number(record.locationCandidateConfidence || 0) * 100)}%${record.locationCandidateOutsideArea ? " / 印西市外" : ""}</span></div>` : ""}
      ${record.locationAskedAt ? `<div class="detail-row"><span>質問日時</span><span>${escapeHtml(formatDateTime(record.locationAskedAt))}</span></div>` : ""}
      ${record.locationContactMethod ? `<div class="detail-row"><span>確認手段</span><span>${escapeHtml(locationContactLabels[record.locationContactMethod] || record.locationContactMethod)}</span></div>` : ""}
      ${record.locationAnsweredAt ? `<div class="detail-row"><span>回答確認</span><span>${escapeHtml(formatDateTime(record.locationAnsweredAt))}</span></div>` : ""}
      ${record.locationAnswerNote ? `<div class="detail-row"><span>場所回答</span><span>${escapeHtml(record.locationAnswerNote)}</span></div>` : ""}
      <div class="detail-row"><span>時刻</span><span>${escapeHtml(formatDateTime(record.observedAt))}${record.observedAtDerived ? `（${escapeHtml(record.evidenceRelativeTime || "相対表記")}から逆算）` : ""}</span></div>
      <div class="detail-row"><span>情報源</span><span>${escapeHtml(sourceLabels[record.sourceType] || record.sourceType)}</span></div>
      ${platform ? `<div class="detail-row"><span>SNS媒体</span><span>${escapeHtml(platformLabels[platform] || platform)}</span></div>` : ""}
      ${!PUBLIC_VIEW && record.sourceUsername ? `<div class="detail-row"><span>投稿者</span><span>@${escapeHtml(record.sourceUsername)}</span></div>` : ""}
      ${!PUBLIC_VIEW ? `<div class="detail-row"><span>担当</span><span>${escapeHtml(record.assignedTo || "-")}</span></div>` : ""}
      ${!PUBLIC_VIEW && record.evidenceOperator ? `<div class="detail-row"><span>確認者</span><span>${escapeHtml(record.evidenceOperator)}</span></div>` : ""}
      ${record.evidenceCheckedAt ? `<div class="detail-row"><span>確認時刻</span><span>${escapeHtml(formatDateTime(record.evidenceCheckedAt))}</span></div>` : ""}
      <div class="detail-row"><span>ハザード</span><span>${riskHits.length ? riskHits.map(escapeHtml).join("、") : "該当なし/未判定"}</span></div>
      <div class="detail-row"><span>写真</span><span>${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)} / ${escapeHtml(record.photoPrivacy || "internal")}</span></div>
      <div class="detail-row"><span>公開状態</span><span>${escapeHtml(publicationStatusLabel(record.publicationStatus))} / ${escapeHtml(publicLocationPrecisionLabel(record.publicLocationPrecision))}</span></div>
      ${record.evidencePlatform ? `<div class="detail-row"><span>証跡</span><span>${escapeHtml(platformLabels[record.evidencePlatform] || record.evidencePlatform)} / ${escapeHtml(record.evidenceQuery || "-")}</span></div>` : ""}
      ${!PUBLIC_VIEW ? `<div class="detail-row"><span>メモ</span><span>${escapeHtml(record.notes || "-")}</span></div>` : ""}
    </div>
    ${!PUBLIC_VIEW && record.evidenceImage ? `<img class="evidence-preview" src="${record.evidenceImage}" alt="検索画面スクリーンショット切り出し">` : ""}
    ${!PUBLIC_VIEW && isHttpUrl(record.photoUrl) && record.photoUrl !== record.evidenceImage ? `<a href="${escapeAttribute(record.photoUrl)}" target="_blank" rel="noreferrer"><img class="evidence-preview" src="${escapeAttribute(record.photoUrl)}" alt="投稿に添付された被害候補写真" loading="lazy"></a>` : ""}
    ${!PUBLIC_VIEW && record.sourceText ? `<div class="source-text-block"><strong>投稿本文・要約</strong><p>${escapeHtml(record.sourceText)}</p></div>` : ""}
    ${!PUBLIC_VIEW && record.sourceComments ? `<div class="source-text-block"><strong>場所に関係するコメント</strong><p>${escapeHtml(record.sourceComments)}</p></div>` : ""}
    ${!PUBLIC_VIEW && record.evidenceOcrText ? `<pre class="evidence-ocr">${escapeHtml(record.evidenceOcrText)}</pre>` : ""}
    ${PUBLIC_VIEW ? "" : `<div class="detail-actions">
      ${record.sourceUrl && locationStatus !== "pinned" ? `<button class="tool-button primary" type="button" data-action="ask-location">場所を質問（コメント / DM）</button>` : ""}
      ${(record.sourceText || record.sourceComments || record.evidenceOcrText) ? `<button class="tool-button" type="button" data-action="search-location">本文・コメントから場所候補</button>` : ""}
      ${locationStatus !== "pinned" ? `<button class="tool-button" type="button" data-action="locate">${locationStatus === "identified" ? "場所候補を地図で確認してピン" : "回答後、地図でピンを置く"}</button>` : ""}
      <button class="tool-button" type="button" data-action="edit">編集</button>
      <button class="tool-button" type="button" data-action="verified">確認済</button>
      <button class="tool-button" type="button" data-action="photo">写真確認済</button>
      <button class="tool-button" type="button" data-action="actioning">対応中</button>
      <button class="tool-button" type="button" data-action="resolved">解消済</button>
      ${record.evidenceImage ? `<button class="tool-button" type="button" data-action="download-evidence">証跡画像DL</button>` : ""}
      ${record.sourceUrl ? `<a class="tool-button" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noreferrer">根拠を開く</a>` : ""}
      <button class="tool-button danger" type="button" data-action="delete">🗑 削除</button>
    </div>`}
  `;
  detail.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handleDetailAction(button.dataset.action));
  });
}

function selectRecord(id, panTo, options = {}) {
  selectedId = id;
  const record = records.find(item => item.id === id);
  const roadGeometry = getDisplayRoadGeometry(record);
  const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
  if (record && panTo && roadGeometry) {
    map.fitBounds(L.latLngBounds(roadGeometry).pad(0.5), { maxZoom: 16 });
  } else if (record && panTo && displayCoordinates) {
    map.setView([displayCoordinates.lat, displayCoordinates.lng], Math.max(map.getZoom(), 15));
  }
  if (options.preserveMap) {
    renderList();
    renderDetail();
  } else {
    renderAll();
  }
}

function openRoadStatusDialog() {
  const checkedAt = incidentDateTimeInput();
  openRecordDialog({
    category: "traffic",
    severity: "high",
    sourceType: "citizen",
    passability: "impassable",
    passabilityMode: "all",
    passabilityCheckedAt: checkedAt,
    observedAt: checkedAt
  });
}

function openRecordDialog(seed = {}) {
  const record = seed.id ? records.find(item => item.id === seed.id) : null;
  const dialog = document.getElementById("record-dialog");
  document.getElementById("record-dialog-title").textContent = record
    ? getRoadGeometry(record) ? "道路区間編集" : "地点編集"
    : seed.category === "traffic" ? "道路通行情報を追加" : "地点追加";
  document.getElementById("delete-record-button").style.visibility = record ? "visible" : "hidden";
  recordFormLocationCandidate = null;

  const seedHasCoordinates = hasCoordinates(seed);
  const values = record || {
    id: "",
    category: seed.category || "road_flood",
    status: seed.status || "unconfirmed",
    severity: seed.severity || "medium",
    sourceType: seed.sourceType || "sns",
    title: seed.title || "",
    locationName: seed.locationName || "",
    lat: seedHasCoordinates ? seed.lat : null,
    lng: seedHasCoordinates ? seed.lng : null,
    locationStatus: seed.locationStatus || (seedHasCoordinates ? "pinned" : "unknown"),
    locationContactMethod: seed.locationContactMethod || "",
    locationAnsweredAt: seed.locationAnsweredAt || "",
    locationAnswerNote: seed.locationAnswerNote || "",
    observedAt: seed.observedAt || "",
    assignedTo: seed.assignedTo || "",
    sourceUrl: seed.sourceUrl || "",
    sourceText: seed.sourceText || "",
    sourceComments: seed.sourceComments || "",
    publicationStatus: seed.publicationStatus || "internal",
    publicLocationPrecision: seed.publicLocationPrecision || (seed.category === "rescue_request" ? "approximate" : "hidden"),
    passability: seed.passability || "none",
    passabilityMode: seed.passabilityMode || "unknown",
    passabilityCheckedAt: seed.passabilityCheckedAt || "",
    roadDirection: seed.roadDirection || "unknown",
    roadGeometry: getRoadGeometry(seed) || [],
    photoStatus: seed.photoStatus || "needs-photo",
    photoPrivacy: seed.photoPrivacy || "internal",
    photoUrl: seed.photoUrl || "",
    notes: seed.notes || "",
    hazardFlags: seed.hazardFlags || { flood: false, inland: false, road: false, landslide: false }
  };

  setFormValue("record-id", values.id || "");
  setFormValue("record-category", values.category);
  setFormValue("record-status", values.status);
  setFormValue("record-severity", values.severity);
  setFormValue("record-source-type", values.sourceType);
  setFormValue("record-passability", getPassability(values));
  setFormValue("record-passability-mode", values.passabilityMode || "unknown");
  setFormValue("record-passability-checked-at", values.passabilityCheckedAt || "");
  setFormValue("record-road-direction", values.roadDirection || "unknown");
  setFormValue("record-road-geometry", JSON.stringify(getRoadGeometry(values) || []));
  setFormValue("record-title", values.title);
  setFormValue("record-location", values.locationName);
  setFormValue("record-lat", hasCoordinates(values) ? Number(values.lat).toFixed(6) : "");
  setFormValue("record-lng", hasCoordinates(values) ? Number(values.lng).toFixed(6) : "");
  setFormValue("record-location-status", getLocationStatus(values));
  setFormValue("record-location-contact-method", values.locationContactMethod || "");
  setFormValue("record-location-answered-at", values.locationAnsweredAt || "");
  setFormValue("record-location-answer-note", values.locationAnswerNote || "");
  setFormValue("record-observed-at", values.observedAt || "");
  setFormValue("record-assignee", values.assignedTo);
  setFormValue("record-source-url", values.sourceUrl);
  setFormValue("record-source-text", values.sourceText || values.evidenceOcrText || "");
  setFormValue("record-source-comments", values.sourceComments || "");
  setFormValue("record-publication-status", values.publicationStatus || "internal");
  setFormValue("record-public-location-precision", values.publicLocationPrecision || "hidden");
  setFormValue("record-photo-status", values.photoStatus);
  setFormValue("record-photo-privacy", values.photoPrivacy);
  setFormValue("record-photo-url", values.photoUrl);
  setFormValue("record-notes", values.notes);
  document.getElementById("hazard-flood").checked = Boolean(values.hazardFlags?.flood);
  document.getElementById("hazard-inland").checked = Boolean(values.hazardFlags?.inland);
  document.getElementById("hazard-road").checked = Boolean(values.hazardFlags?.road);
  document.getElementById("hazard-landslide").checked = Boolean(values.hazardFlags?.landslide);
  renderRoadGeometrySummary();
  updateRoadColorPreview();

  const formHelp = document.getElementById("record-form-help");
  if (record?.evidencePlatform || getLocationStatus(values) !== "pinned") {
    formHelp.hidden = false;
    formHelp.textContent = getLocationStatus(values) === "pinned"
      ? "最後に、分類・重要度・場所を確認して保存してください。"
      : "場所が分からない間は座標を空欄のまま保存できます。投稿者へ確認後、「地図でピンを置く」から場所を設定してください。";
  } else {
    formHelp.hidden = true;
    formHelp.textContent = "";
  }

  dialog.showModal();
  renderRecordDuplicateWarning();
}

function useMapCenter() {
  const center = map.getCenter();
  setFormValue("record-lat", center.lat.toFixed(6));
  setFormValue("record-lng", center.lng.toFixed(6));
  setFormValue("record-location-status", "pinned");
}

function saveRecordFromForm(event) {
  event.preventDefault();
  const existingId = getFormValue("record-id");
  const existingRecord = existingId ? records.find(item => item.id === existingId) : null;
  const latValue = parseOptionalNumber(getFormValue("record-lat"));
  const lngValue = parseOptionalNumber(getFormValue("record-lng"));
  const roadGeometry = parseRoadGeometry(getFormValue("record-road-geometry"));
  const roadCenter = roadGeometry ? roadGeometryCenter(roadGeometry) : null;
  const record = {
    ...(existingRecord || {}),
    id: existingId || `rec-${Date.now()}`,
    title: getFormValue("record-title"),
    category: getFormValue("record-category"),
    locationName: getFormValue("record-location"),
    lat: roadCenter?.lat ?? latValue,
    lng: roadCenter?.lng ?? lngValue,
    locationStatus: roadGeometry ? "pinned" : getFormValue("record-location-status"),
    locationContactMethod: getFormValue("record-location-contact-method"),
    locationAnsweredAt: getFormValue("record-location-answered-at"),
    locationAnswerNote: getFormValue("record-location-answer-note"),
    observedAt: getFormValue("record-observed-at"),
    incidentDate: existingRecord?.incidentDate || getFormValue("incident-date"),
    sourceType: getFormValue("record-source-type"),
    sourceUrl: getFormValue("record-source-url"),
    sourceText: getFormValue("record-source-text"),
    sourceComments: getFormValue("record-source-comments"),
    publicationStatus: getFormValue("record-publication-status"),
    publicLocationPrecision: getFormValue("record-public-location-precision"),
    status: getFormValue("record-status"),
    severity: getFormValue("record-severity"),
    passability: getFormValue("record-passability"),
    passabilityMode: getFormValue("record-passability-mode"),
    passabilityCheckedAt: getFormValue("record-passability-checked-at"),
    roadDirection: getFormValue("record-road-direction"),
    roadGeometry: roadGeometry || [],
    photoStatus: getFormValue("record-photo-status"),
    photoUrl: getFormValue("record-photo-url"),
    photoPrivacy: getFormValue("record-photo-privacy"),
    assignedTo: getFormValue("record-assignee"),
    notes: getFormValue("record-notes"),
    hazardFlags: {
      flood: document.getElementById("hazard-flood").checked,
      inland: document.getElementById("hazard-inland").checked,
      road: document.getElementById("hazard-road").checked,
      landslide: document.getElementById("hazard-landslide").checked
    }
  };

  if (recordFormLocationCandidate) {
    Object.assign(record, locationCandidateAuditFields(recordFormLocationCandidate));
  }

  if ((record.lat === null) !== (record.lng === null)) {
    alert("緯度と経度は両方入力するか、両方空欄にしてください。");
    return;
  }
  if (!hasCoordinates(record) && record.locationStatus === "pinned") record.locationStatus = "unknown";
  if (record.category === "rescue_request" && record.publicationStatus === "published" && record.publicLocationPrecision === "exact") {
    alert("救助・安否確認要請の正確な位置は公開できません。『概略位置』または『位置を非公開』を選んでください。");
    return;
  }

  const duplicates = detectDuplicates(record, existingId);
  if (duplicates.length && !confirmDuplicateRegistration(duplicates)) return;

  records = existingId
    ? records.map(item => (item.id === existingId ? record : item))
    : [...records, record];
  selectedId = record.id;
  persistRecords();
  document.getElementById("record-dialog").close();
  renderAll();
}

function deleteCurrentRecord() {
  const id = getFormValue("record-id");
  if (!id) return;
  if (!confirm("この地点を削除しますか。")) return;
  records = records.filter(record => record.id !== id);
  selectedId = null;
  persistRecords();
  document.getElementById("record-dialog").close();
  renderAll();
}

function handleDetailAction(action) {
  const record = records.find(item => item.id === selectedId);
  if (!record) return;
  if (action === "edit") {
    openRecordDialog({ id: record.id });
    return;
  }
  if (action === "download-evidence") {
    downloadDataUrl(record.evidenceImage, `evidence-${record.id}.jpg`);
    return;
  }
  if (action === "ask-location") {
    locationContactRecordId = record.id;
    document.getElementById("location-contact-dialog").showModal();
    return;
  }
  if (action === "search-location") {
    openLocationSearchDialog({ source: "record", recordId: record.id });
    return;
  }
  if (action === "locate") {
    startLocationPick(record.id);
    return;
  }
  if (action === "delete") {
    // 誤登録の取り消し用。取り消し（アンドゥ）はないため必ず確認を挟む
    if (!confirm(`「${record.title || "この地点"}」を削除しますか。元に戻せません。`)) return;
    records = records.filter(item => item.id !== record.id);
    selectedId = null;
    persistRecords();
    renderAll();
    return;
  }
  if (action === "photo") {
    record.photoStatus = "official-verified";
    record.photoPrivacy = record.photoPrivacy || "internal";
  } else {
    record.status = action;
  }
  persistRecords();
  renderAll();
}

function beginLocationContact(method) {
  beginLocationContactForRecord(locationContactRecordId, method);
}

function beginLocationContactForRecord(recordId, method) {
  const record = records.find(item => item.id === recordId);
  if (!record) return;
  const question = buildLocationQuestion(method);
  navigator.clipboard?.writeText(question).catch(() => {});
  const opened = window.open(record.sourceUrl, "_blank");
  if (opened) opened.opener = null;
  if (getLocationStatus(record) !== "pinned") record.locationStatus = "asked";
  record.locationContactMethod = method;
  record.locationAskedAt = nowLocalInput();
  record.locationAskedBy = record.evidenceOperator || loadOperator();
  record.assignedTo = record.assignedTo === "場所確認待ち" ? "投稿者へ確認中" : record.assignedTo;
  locationContactRecordId = null;
  const dialog = document.getElementById("location-contact-dialog");
  if (dialog.open) dialog.close();
  persistRecords();
  renderAll();
  document.getElementById("map-status").textContent = `${locationContactLabels[method]}用の質問文をコピーしました。元投稿を開いて貼り付けてください。`;
}

function buildLocationQuestion(method) {
  const body = "印西市内の災害状況確認のため、差し支えない範囲で撮影場所（町名・道路名・目印）と撮影時刻、現在も同じ状況かを教えていただけますか。個人名・電話番号・個人宅の詳細住所は書かないでください。";
  return method === "dm" ? `突然のご連絡失礼します。${body}` : body;
}

function startLocationPick(recordId) {
  const record = records.find(item => item.id === recordId);
  if (!record) return;
  locationPickRecordId = recordId;
  selectedId = recordId;
  document.getElementById("location-pick-banner").hidden = false;
  document.querySelector(".map-pane").classList.add("is-location-pick");
  document.getElementById("map-status").textContent = "投稿者から確認できた場所を地図上でクリックしてください。";
  if (hasCoordinates(record)) map.setView([Number(record.lat), Number(record.lng)], Math.max(map.getZoom(), 15));
  else map.fitBounds(INZAI_BOUNDS);
  document.querySelector(".map-pane").scrollIntoView({ behavior: "smooth", block: "center" });
  scheduleMapResize();
}

function completeLocationPick(latlng) {
  const record = records.find(item => item.id === locationPickRecordId);
  if (!record) {
    cancelLocationPick();
    return;
  }
  record.lat = Number(latlng.lat.toFixed(6));
  record.lng = Number(latlng.lng.toFixed(6));
  if (record.locationStatus === "asked" && !record.locationAnsweredAt) record.locationAnsweredAt = nowLocalInput();
  record.locationStatus = "pinned";
  if (!record.locationName || ["場所未特定", "位置未確定"].includes(record.locationName)) {
    record.locationName = "地図指定地点";
  }
  locationPickRecordId = null;
  document.getElementById("location-pick-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-location-pick");
  selectedId = record.id;
  persistRecords();
  map.setView([record.lat, record.lng], Math.max(map.getZoom(), 15));
  renderAll();
  openRecordDialog({ id: record.id });
}

function cancelLocationPick() {
  locationPickRecordId = null;
  document.getElementById("location-pick-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-location-pick");
  document.getElementById("map-status").textContent = `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
}

function startRoadSectionSelection() {
  const geometry = parseRoadGeometry(getFormValue("record-road-geometry")) || [];
  roadDrawingOriginal = geometry.map(point => [...point]);
  roadDrawingPoints = geometry.map(point => [...point]);
  roadDrawingMode = true;
  clickAddMode = false;
  document.getElementById("map-click-button").setAttribute("aria-pressed", "false");
  document.getElementById("record-dialog").close();
  document.getElementById("road-draw-banner").hidden = false;
  document.querySelector(".map-pane").classList.add("is-road-drawing");
  renderRoadDrawingPreview();
  if (roadDrawingPoints.length >= 2) map.fitBounds(L.latLngBounds(roadDrawingPoints).pad(0.35));
  scheduleMapResize();
}

function addRoadSectionPoint(latlng) {
  if (!roadDrawingMode) return;
  roadDrawingPoints.push([Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))]);
  renderRoadDrawingPreview();
}

function undoRoadSectionPoint() {
  roadDrawingPoints.pop();
  renderRoadDrawingPreview();
}

function cancelRoadSectionSelection() {
  setFormValue("record-road-geometry", JSON.stringify(roadDrawingOriginal));
  closeRoadSectionSelection();
}

function finishRoadSectionSelection() {
  if (roadDrawingPoints.length < 2) return;
  setFormValue("record-road-geometry", JSON.stringify(roadDrawingPoints));
  const center = roadGeometryCenter(roadDrawingPoints);
  if (center) {
    setFormValue("record-lat", center.lat.toFixed(6));
    setFormValue("record-lng", center.lng.toFixed(6));
    setFormValue("record-location-status", "pinned");
  }
  closeRoadSectionSelection();
}

function closeRoadSectionSelection() {
  roadDrawingMode = false;
  roadDrawingLayer.clearLayers();
  document.getElementById("road-draw-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-road-drawing");
  document.getElementById("record-dialog").showModal();
  renderRoadGeometrySummary();
  renderRecordDuplicateWarning();
}

function clearRoadSection() {
  setFormValue("record-road-geometry", "[]");
  renderRoadGeometrySummary();
}

function renderRoadDrawingPreview() {
  roadDrawingLayer.clearLayers();
  if (roadDrawingPoints.length >= 2) {
    roadDrawingLayer.addLayer(L.polyline(roadDrawingPoints, {
      color: "#b8322c",
      weight: 7,
      opacity: 0.94,
      dashArray: "10 7",
      interactive: false
    }));
  }
  roadDrawingPoints.forEach((point, index) => {
    const marker = L.circleMarker(point, {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#b8322c",
      fillOpacity: 1,
      interactive: false
    });
    const pointLabel = index === 0
      ? "始点"
      : index === roadDrawingPoints.length - 1
        ? "終点"
        : `中間${index}`;
    marker.bindTooltip(pointLabel, {
      permanent: true,
      direction: "top",
      offset: [0, -8]
    });
    roadDrawingLayer.addLayer(marker);
  });
  const status = document.getElementById("road-draw-status");
  status.textContent = roadDrawingPoints.length === 0
    ? "まず通行止め区間の始点となる交差点を選んでください。"
    : roadDrawingPoints.length === 1
      ? "次の交差点を選んでください。曲がる道路では中間点を続けて追加できます。"
      : `${roadDrawingPoints.length}点・${formatRoadDistance(roadDrawingPoints)}。曲がりに沿って点を追加するか、この区間で確定してください。`;
  document.getElementById("road-draw-undo-button").disabled = roadDrawingPoints.length === 0;
  document.getElementById("road-draw-finish-button").disabled = roadDrawingPoints.length < 2;
}

function renderRoadGeometrySummary() {
  const geometry = parseRoadGeometry(getFormValue("record-road-geometry"));
  const node = document.getElementById("record-road-geometry-summary");
  node.textContent = geometry
    ? `道路区間を設定済み（${geometry.length}点・${formatRoadDistance(geometry)}）`
    : "区間未設定（通行止め・通行不能は地図上に×で表示）";
  document.getElementById("record-road-clear-button").disabled = !geometry;
  document.getElementById("record-road-draw-button").textContent = geometry ? "道路区間を変更" : "道路区間を地図で指定";
}

function updateRoadColorPreview() {
  const passability = getFormValue("record-passability");
  const colors = {
    closed: "#b8322c",
    impassable: "#b8322c",
    restricted: "#c96321",
    reopened: "#24745a",
    passed: "#2365a8",
    none: "#6b737a"
  };
  const node = document.getElementById("record-road-color-preview");
  node.querySelector("span").style.background = colors[passability] || colors.none;
  node.querySelector("strong").textContent = `${passabilityLabels[passability] || passabilityLabels.none}の表示色`;
}

function toggleClickAddMode() {
  clickAddMode = !clickAddMode;
  const button = document.getElementById("map-click-button");
  button.setAttribute("aria-pressed", String(clickAddMode));
  document.getElementById("map-status").textContent = clickAddMode
    ? "地図上をクリックすると被害候補を追加します。"
    : `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
}

function importCsv(event) {
  event.preventDefault();
  const text = document.getElementById("csv-input").value.trim();
  if (!text) return;
  const imported = parseCsv(text).map(row => normalizeImportedRow(row)).filter(Boolean);
  if (!imported.length) {
    alert("取り込める行がありませんでした。");
    return;
  }
  records = [...records, ...imported];
  selectedId = imported[0].id;
  persistRecords();
  document.getElementById("import-dialog").close();
  renderAll();
}

function openScreenshotDialog(seed = {}) {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  setFormValue("evidence-platform", seed.platform || getFormValue("evidence-platform") || "instagram");
  setFormValue("evidence-query", seed.query || "");
  setFormValue("evidence-url", seed.url || "");
  setFormValue("evidence-operator", seed.operator || loadOperator());
  setFormValue("evidence-observed-at", seed.observedAt || "");
  setFormValue("evidence-checked-at", seed.checkedAt || local);
  setFormValue("evidence-notes", seed.notes || "");
  setFormValue("evidence-ocr-text", "");
  document.getElementById("ocr-status").textContent = "OCR未実行";
  document.getElementById("ocr-status").classList.remove("is-active");
  document.getElementById("screenshot-dialog").showModal();
  drawScreenshotCanvas();
  renderEvidenceDuplicateWarning();
}

async function loadScreenshotFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await loadScreenshotBlob(file, { inspectGps: true });
}

function handleScreenshotPaste(event) {
  const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
  if (!imageItem) return;
  event.preventDefault();
  loadScreenshotBlob(imageItem.getAsFile(), { inspectGps: true });
}

function bindScreenshotDropZone() {
  const zone = document.getElementById("paste-zone");
  zone.addEventListener("dragover", event => {
    event.preventDefault();
    zone.classList.add("is-dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
  zone.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("is-dragover");
    const file = Array.from(event.dataTransfer?.files || []).find(item => item.type.startsWith("image/"));
    if (file) loadScreenshotBlob(file, { inspectGps: true });
  });
  zone.addEventListener("click", () => zone.focus());
}

async function captureScreen() {
  const status = document.getElementById("ocr-status");
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert("このブラウザでは画面キャプチャが利用できません。スクリーンショットを貼り付けるか、画像を選択してください。");
    appendSystemWorkLog("SNS画面キャプチャ", "blocked", "このブラウザは画面キャプチャAPIに対応していません。", "画像ファイルまたは貼り付けで証跡を登録する");
    return;
  }
  let stream = null;
  try {
    setFormValue("evidence-ocr-text", "");
    screenshotState.relativeTime = null;
    screenshotState.locationCandidate = null;
    screenshotState.gpsInspectionState = "not-checked";
    screenshotState.autoGpsRecordId = null;
    status.classList.add("is-active");
    status.textContent = "共有画面で、投稿を表示したSNSタブを選んでください...";
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 1, max: 5 } },
      audio: false,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "exclude"
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await waitForCapturedFrame(video);
    if (!video.videoWidth || !video.videoHeight) throw new Error("共有画面の画像サイズを取得できませんでした");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (isCanvasBlank(canvas, context)) throw new Error("共有画面が白紙として取得されました");
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    if (!blob) throw new Error("共有画面を画像へ変換できませんでした");
    loadScreenshotBlob(blob);
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
      status.textContent = "画面共有はキャンセルされました。必要なときにもう一度お試しください。";
    } else {
      status.textContent = `画面を取得できませんでした。${error?.message || "画像選択または貼り付けをお試しください。"}`;
      appendSystemWorkLog("SNS画面キャプチャ", "blocked", status.textContent, "SNSタブを明示選択して再試行し、難しい場合は画像貼り付けを利用する");
    }
  } finally {
    stream?.getTracks().forEach(track => track.stop());
    status.classList.remove("is-active");
  }
}

function waitForCapturedFrame(video) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = callback => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => finish(() => reject(new Error("共有画面の読み込みがタイムアウトしました"))), 5000);
    const ready = () => {
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(() => finish(resolve));
      } else {
        requestAnimationFrame(() => requestAnimationFrame(() => finish(resolve)));
      }
    };
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("resize", ready, { once: true });
    ready();
  });
}

function isCanvasBlank(canvas, context) {
  const sampleWidth = Math.min(canvas.width, 80);
  const sampleHeight = Math.min(canvas.height, 45);
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const data = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let min = 255;
  let max = 0;
  let alphaCount = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
    if (data[index + 3] > 0) alphaCount += 1;
  }
  return alphaCount === 0 || (min > 248 && max - min < 3);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function loadScreenshotBlob(blob, options = {}) {
  if (!blob) return;
  const gpsInspection = options.inspectGps
    ? await inspectImageGps(blob)
    : { state: "not-checked", candidate: null };
  const gpsCandidate = gpsInspection.candidate;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      screenshotState.image = image;
      screenshotState.crop = null;
      screenshotState.relativeTime = null;
      screenshotState.locationCandidate = gpsCandidate;
      screenshotState.gpsInspectionState = gpsInspection.state;
      if (!gpsCandidate) screenshotState.autoGpsRecordId = null;
      setFormValue("evidence-ocr-text", "");
      drawScreenshotCanvas();
      if (gpsCandidate) autoSaveGpsDraft(gpsCandidate);
      document.getElementById("ocr-status").textContent = gpsCandidate
        ? `GPSあり（${gpsCandidate.lat.toFixed(6)}, ${gpsCandidate.lng.toFixed(6)}）。内部確認中のピンとして自動保存しました。`
        : gpsInspection.state === "absent"
          ? "GPS情報なし。本文・コメント・OCRから場所候補を確認してください。"
          : gpsInspection.state === "unavailable"
            ? "GPS情報を判定できませんでした。写真形式または解析機能の読み込みを確認してください。"
            : "画面キャプチャには元写真のGPSは含まれません。投稿部分を囲んでOCRしてください。";
      renderEvidenceDuplicateWarning();
    };
    image.onerror = () => {
      document.getElementById("ocr-status").textContent = "画像を読み込めませんでした。別の画像でお試しください。";
      appendSystemWorkLog("SNS証跡画像", "blocked", "選択または貼り付けた画像を読み込めませんでした。", "別形式の画像で再試行する");
    };
    image.src = reader.result;
  };
  reader.onerror = () => {
    document.getElementById("ocr-status").textContent = "画像ファイルを読み込めませんでした。";
  };
  reader.readAsDataURL(blob);
}

async function inspectImageGps(blob) {
  if (!window.exifr?.gps) return { state: "unavailable", candidate: null };
  try {
    const gps = await window.exifr.gps(blob);
    const lat = Number(gps?.latitude);
    const lng = Number(gps?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { state: "absent", candidate: null };
    const candidate = {
      title: "元画像GPS位置",
      lat,
      lng,
      source: "image-exif",
      confidence: 1,
      query: "EXIF GPS",
      reason: "選択した元画像に記録されたGPS緯度経度",
      outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
      autoPin: true
    };
    return { state: "found", candidate };
  } catch {
    return { state: "unavailable", candidate: null };
  }
}

function autoSaveGpsDraft(candidate) {
  const checkedAt = getFormValue("evidence-checked-at") || nowLocalInput();
  const observedAt = getFormValue("evidence-observed-at") || checkedAt;
  const platform = getFormValue("evidence-platform") || "other";
  const existingId = screenshotState.autoGpsRecordId;
  const existing = existingId ? records.find(record => record.id === existingId) : null;
  const id = existing?.id || `gps-draft-${Date.now()}`;
  const draft = {
    ...(existing || {}),
    id,
    title: existing?.title && !existing.autoGpsDraft ? existing.title : "GPS付き写真（内容確認待ち）",
    category: existing?.category || "other",
    locationName: "元画像GPS位置",
    lat: candidate.lat,
    lng: candidate.lng,
    locationStatus: "pinned",
    observedAt,
    incidentDate: getFormValue("incident-date"),
    sourceType: platform === "web" ? "web" : "sns",
    sourceUrl: getFormValue("evidence-url"),
    status: existing?.status || "unconfirmed",
    severity: existing?.severity || "medium",
    passability: existing?.passability || "none",
    passabilityMode: existing?.passabilityMode || "unknown",
    passabilityCheckedAt: existing?.passabilityCheckedAt || observedAt,
    photoStatus: existing?.photoStatus || "needs-photo",
    photoUrl: existing?.photoUrl || "",
    photoPrivacy: "internal",
    assignedTo: "画像内容・位置確認待ち",
    notes: "元画像のEXIF GPSだけを自動保存した確認待ち記録。画像証跡と投稿内容は未確定。",
    hazardFlags: existing?.hazardFlags || { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: getFormValue("evidence-query"),
    evidenceOperator: getFormValue("evidence-operator"),
    evidenceCheckedAt: checkedAt,
    sourceText: existing?.sourceText || "",
    sourceComments: existing?.sourceComments || "",
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    ...locationCandidateAuditFields(candidate, checkedAt),
    autoGpsDraft: true
  };
  records = existing
    ? records.map(record => record.id === id ? draft : record)
    : [...records, draft];
  screenshotState.autoGpsRecordId = id;
  selectedId = id;
  persistRecords();
  renderAll();
  map.setView([candidate.lat, candidate.lng], 16);
}

function bindCropCanvas() {
  const canvas = document.getElementById("screenshot-canvas");
  canvas.addEventListener("pointerdown", event => {
    if (!screenshotState.image) return;
    const point = canvasPoint(event, canvas);
    screenshotState.dragging = true;
    screenshotState.start = point;
    screenshotState.crop = { x: point.x, y: point.y, w: 1, h: 1 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!screenshotState.dragging || !screenshotState.start) return;
    const point = canvasPoint(event, canvas);
    const x = Math.min(point.x, screenshotState.start.x);
    const y = Math.min(point.y, screenshotState.start.y);
    const w = Math.abs(point.x - screenshotState.start.x);
    const h = Math.abs(point.y - screenshotState.start.y);
    screenshotState.crop = clampCrop({ x, y, w, h }, canvas);
    drawScreenshotCanvas();
  });
  canvas.addEventListener("pointerup", event => {
    screenshotState.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
}

function drawScreenshotCanvas() {
  const canvas = document.getElementById("screenshot-canvas");
  const ctx = canvas.getContext("2d");
  if (!screenshotState.image) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f6fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5d6b74";
    ctx.font = "14px sans-serif";
    ctx.fillText("スクリーンショットを貼り付けるか画像を選択してください", 24, 48);
    return;
  }

  const image = screenshotState.image;
  const maxWidth = 720;
  const maxHeight = 520;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  screenshotState.scale = scale;
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (!screenshotState.crop) {
    screenshotState.crop = {
      x: Math.round(canvas.width * 0.08),
      y: Math.round(canvas.height * 0.10),
      w: Math.round(canvas.width * 0.84),
      h: Math.round(canvas.height * 0.58)
    };
  }

  const crop = clampCrop(screenshotState.crop, canvas);
  screenshotState.crop = crop;
  ctx.save();
  ctx.fillStyle = "rgba(22, 33, 42, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
  ctx.strokeStyle = "#0c6e99";
  ctx.lineWidth = 3;
  ctx.strokeRect(crop.x + 1.5, crop.y + 1.5, crop.w - 3, crop.h - 3);
  ctx.restore();
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function clampCrop(crop, canvas) {
  const x = Math.max(0, Math.min(crop.x, canvas.width - 1));
  const y = Math.max(0, Math.min(crop.y, canvas.height - 1));
  const w = Math.max(1, Math.min(crop.w, canvas.width - x));
  const h = Math.max(1, Math.min(crop.h, canvas.height - y));
  return { x, y, w, h };
}

function resetCrop() {
  screenshotState.crop = null;
  drawScreenshotCanvas();
}

function clearScreenshot() {
  screenshotState = {
    image: null,
    scale: 1,
    crop: null,
    dragging: false,
    start: null,
    locationCandidate: null,
    relativeTime: null,
    gpsInspectionState: "not-checked",
    autoGpsRecordId: null
  };
  document.getElementById("screenshot-file").value = "";
  setFormValue("evidence-ocr-text", "");
  document.getElementById("ocr-status").textContent = "OCR未実行";
  document.getElementById("ocr-status").classList.remove("is-active");
  drawScreenshotCanvas();
  renderEvidenceDuplicateWarning();
}

async function runEvidenceOcr() {
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んで、文字を抽出する範囲を指定してください。");
    return;
  }
  if (!window.Tesseract?.recognize) {
    alert("OCR機能を読み込めませんでした。通信状態を確認して再読み込みしてください。");
    appendSystemWorkLog("SNS画像OCR", "blocked", "OCRライブラリを読み込めませんでした。", "通信状態とCDN接続を確認する");
    return;
  }

  const button = document.getElementById("run-ocr-button");
  const status = document.getElementById("ocr-status");
  button.disabled = true;
  status.classList.add("is-active");
  status.textContent = "OCR準備中...";
  try {
    const result = await window.Tesseract.recognize(dataUrl, "jpn+eng", {
      logger(message) {
        if (message.status === "recognizing text") {
          status.textContent = `OCR解析中 ${Math.round((message.progress || 0) * 100)}%`;
        }
      }
    });
    const text = String(result?.data?.text || "").trim();
    setFormValue("evidence-ocr-text", text);
    status.textContent = text ? `OCR完了 ${text.length}文字。場所候補を確認中...` : "文字を認識できませんでした";
    screenshotState.relativeTime = text
      ? deriveObservedAtFromRelativeText(text, getFormValue("evidence-checked-at") || nowLocalInput())
      : null;
    if (screenshotState.relativeTime) {
      setFormValue("evidence-observed-at", screenshotState.relativeTime.observedAt);
    }
    if (screenshotState.locationCandidate?.source !== "image-exif") {
      screenshotState.locationCandidate = text ? await suggestLocationFromOcr(text) : null;
    }
    if (text) {
      const messages = [`OCR完了 ${text.length}文字`];
      if (screenshotState.relativeTime) {
        messages.push(`${screenshotState.relativeTime.label}から投稿時刻を逆算`);
      }
      if (screenshotState.locationCandidate) messages.push(`場所候補: ${screenshotState.locationCandidate.title}`);
      else messages.push("場所は未特定");
      status.textContent = messages.join(" / ");
    }
    renderEvidenceDuplicateWarning();
  } catch (error) {
    status.textContent = "OCRに失敗しました。切り出し範囲を調整して再実行してください。";
    appendSystemWorkLog("SNS画像OCR", "testing", `OCRに失敗しました: ${error?.message || "不明なエラー"}`, "投稿本文だけを囲んで再実行し、難しい場合は本文を手入力する");
  } finally {
    button.disabled = false;
    status.classList.remove("is-active");
  }
}

function getCroppedEvidenceDataUrl() {
  if (!screenshotState.image || !screenshotState.crop) return "";
  const crop = screenshotState.crop;
  const scale = screenshotState.scale || 1;
  const sourceX = Math.round(crop.x / scale);
  const sourceY = Math.round(crop.y / scale);
  const sourceW = Math.round(crop.w / scale);
  const sourceH = Math.round(crop.h / scale);
  const maxOutputWidth = 1200;
  const outputScale = Math.min(maxOutputWidth / sourceW, 1);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(sourceW * outputScale));
  output.height = Math.max(1, Math.round(sourceH * outputScale));
  output.getContext("2d").drawImage(
    screenshotState.image,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    0,
    0,
    output.width,
    output.height
  );
  return output.toDataURL("image/jpeg", 0.84);
}

function downloadCrop() {
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んでください。");
    return;
  }
  downloadDataUrl(dataUrl, `sns-evidence-${dateStamp()}.jpg`);
}

function saveScreenshotEvidence(event) {
  event.preventDefault();
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んでください。");
    return;
  }
  const platform = getFormValue("evidence-platform");
  const query = getFormValue("evidence-query");
  const operator = getFormValue("evidence-operator");
  const checkedAt = getFormValue("evidence-checked-at");
  const ocrText = getFormValue("evidence-ocr-text");
  const locationCandidate = screenshotState.locationCandidate;
  const autoGpsRecordId = screenshotState.autoGpsRecordId;
  const record = {
    id: autoGpsRecordId || `rec-${Date.now()}`,
    title: ocrText ? truncateText(ocrText, 72) : `${platformLabels[platform] || "検索"}証跡: ${query || "検索結果"}`,
    category: inferCategory(ocrText),
    locationName: locationCandidate?.title || "場所未特定",
    lat: locationCandidate?.lat ?? null,
    lng: locationCandidate?.lng ?? null,
    locationStatus: locationCandidate?.autoPin ? "pinned" : locationCandidate ? "identified" : "unknown",
    observedAt: getFormValue("evidence-observed-at"),
    incidentDate: getFormValue("incident-date"),
    sourceType: platform === "web" ? "web" : "sns",
    sourceUrl: getFormValue("evidence-url"),
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(ocrText),
    passabilityMode: "unknown",
    passabilityCheckedAt: getFormValue("evidence-observed-at") || checkedAt,
    photoStatus: "has-photo",
    photoUrl: "ローカルスクショ証跡",
    photoPrivacy: "internal",
    assignedTo: locationCandidate?.autoPin ? "画像GPS位置確認待ち" : locationCandidate ? "ピン位置確認待ち" : "場所確認待ち",
    notes: getFormValue("evidence-notes") || "スクリーンショットから登録。投稿者へ撮影場所を確認後、地図へピンを設定する。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: query,
    evidenceOperator: operator,
    evidenceCheckedAt: checkedAt,
    evidenceRelativeTime: screenshotState.relativeTime?.label || "",
    observedAtDerived: Boolean(screenshotState.relativeTime),
    sourceText: ocrText,
    sourceComments: "",
    evidenceOcrText: ocrText,
    evidenceImage: dataUrl,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: locationCandidate?.source || "",
    locationCandidateConfidence: locationCandidate?.confidence ?? null,
    locationCandidateQuery: locationCandidate?.query || "",
    locationCandidateReason: locationCandidate?.reason || "",
    locationCandidateOutsideArea: Boolean(locationCandidate?.outsideInzai),
    locationSearchCheckedAt: locationCandidate ? nowLocalInput() : ""
  };
  const duplicates = detectDuplicates(record, autoGpsRecordId || "");
  if (duplicates.length && !confirmDuplicateRegistration(duplicates)) return;
  saveOperator(operator);
  records = autoGpsRecordId && records.some(item => item.id === autoGpsRecordId)
    ? records.map(item => item.id === autoGpsRecordId ? record : item)
    : [...records, record];
  selectedId = record.id;
  persistRecords();
  document.getElementById("screenshot-dialog").close();
  logSearch({ platform, query, operator, checkedAt, method: "screenshot", resultCount: 1 });
  clearScreenshot();
  renderAll();
  document.getElementById("map-status").textContent = locationCandidate?.autoPin
    ? "元画像のGPS緯度経度でピン留めし、スクリーンショット証跡を登録しました。公開前に位置と内容を確認してください。"
    : "スクリーンショットを登録しました。場所が不明な場合は、元投稿から投稿者へ確認できます。";
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function normalizeImportedRow(row) {
  let lat = parseOptionalNumber(row.lat || row.latitude || row["緯度"]);
  let lng = parseOptionalNumber(row.lng || row.lon || row.longitude || row["経度"]);
  const roadGeometry = parseRoadGeometry(row.roadGeometry || row.road_geometry || row["道路区間"]);
  const roadCenter = roadGeometry ? roadGeometryCenter(roadGeometry) : null;
  if (roadCenter) {
    lat = roadCenter.lat;
    lng = roadCenter.lng;
  }
  if (!row.title || ((lat === null) !== (lng === null))) return null;
  return {
    id: row.id || `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: row.title,
    category: row.category || "other",
    locationName: row.locationName || row.location || row["場所"] || "",
    lat,
    lng,
    locationStatus: row.locationStatus || (lat === null ? "unknown" : "pinned"),
    locationAskedAt: row.locationAskedAt || "",
    locationAskedBy: row.locationAskedBy || "",
    locationContactMethod: row.locationContactMethod || "",
    locationAnsweredAt: row.locationAnsweredAt || "",
    locationAnswerNote: row.locationAnswerNote || "",
    observedAt: row.observedAt || row.time || "",
    incidentDate: row.incidentDate || extractLocalDate(row.observedAt || row.time || row.evidenceCheckedAt || ""),
    sourceType: row.sourceType || "web",
    sourceUrl: row.sourceUrl || "",
    status: row.status || "unconfirmed",
    severity: row.severity || "medium",
    passability: row.passability || (row.category === "traffic" ? "closed" : "none"),
    passabilityMode: row.passabilityMode || "unknown",
    passabilityCheckedAt: row.passabilityCheckedAt || row.observedAt || row.time || "",
    roadDirection: row.roadDirection || "unknown",
    roadGeometry: roadGeometry || [],
    photoStatus: row.photoStatus || "needs-photo",
    photoUrl: row.photoUrl || "",
    photoPrivacy: row.photoPrivacy || "internal",
    assignedTo: row.assignedTo || "",
    notes: row.notes || "",
    evidencePlatform: row.evidencePlatform || "",
    evidenceQuery: row.evidenceQuery || "",
    evidenceOperator: row.evidenceOperator || "",
    evidenceCheckedAt: row.evidenceCheckedAt || "",
    evidenceRelativeTime: row.evidenceRelativeTime || "",
    observedAtDerived: toBool(row.observedAtDerived),
    sourceText: row.sourceText || row.postText || "",
    sourceComments: row.sourceComments || row.comments || "",
    evidenceOcrText: row.evidenceOcrText || "",
    externalId: row.externalId || "",
    sourceUsername: row.sourceUsername || "",
    publicationStatus: row.publicationStatus || "internal",
    publicLocationPrecision: row.publicLocationPrecision || "hidden",
    locationCandidateSource: row.locationCandidateSource || "",
    locationCandidateConfidence: parseOptionalNumber(row.locationCandidateConfidence),
    locationCandidateQuery: row.locationCandidateQuery || "",
    locationCandidateReason: row.locationCandidateReason || "",
    locationCandidateOutsideArea: toBool(row.locationCandidateOutsideArea),
    locationSearchCheckedAt: row.locationSearchCheckedAt || "",
    evidenceImage: "",
    hazardFlags: {
      flood: toBool(row.hazardFlood),
      inland: toBool(row.hazardInland),
      road: toBool(row.hazardRoad),
      landslide: toBool(row.hazardLandslide)
    }
  };
}

function copyCsvTemplate() {
  const template = "title,category,locationName,lat,lng,roadGeometry,roadDirection,incidentDate,locationStatus,locationAskedAt,locationAskedBy,locationContactMethod,locationAnsweredAt,locationAnswerNote,observedAt,sourceType,sourceUrl,status,severity,passability,passabilityMode,passabilityCheckedAt,photoStatus,photoUrl,photoPrivacy,publicationStatus,publicLocationPrecision,hazardFlood,hazardInland,hazardRoad,hazardLandslide,assignedTo,evidencePlatform,evidenceQuery,evidenceOperator,evidenceCheckedAt,evidenceRelativeTime,observedAtDerived,sourceText,sourceComments,locationCandidateSource,locationCandidateConfidence,locationCandidateQuery,locationCandidateReason,locationCandidateOutsideArea,locationSearchCheckedAt,externalId,sourceUsername,notes\n";
  navigator.clipboard?.writeText(template);
  document.getElementById("csv-input").value = template;
}

function exportCsv() {
  const headers = [
    "id", "title", "category", "locationName", "lat", "lng", "roadGeometry", "roadDirection", "incidentDate", "locationStatus", "locationAskedAt", "locationAskedBy", "locationContactMethod", "locationAnsweredAt", "locationAnswerNote", "observedAt", "sourceType",
    "sourceUrl", "status", "severity", "passability", "passabilityMode", "passabilityCheckedAt", "photoStatus", "photoUrl", "photoPrivacy", "publicationStatus", "publicLocationPrecision",
    "hazardFlood", "hazardInland", "hazardRoad", "hazardLandslide", "assignedTo", "evidencePlatform", "evidenceQuery",
    "evidenceOperator", "evidenceCheckedAt", "evidenceRelativeTime", "observedAtDerived", "sourceText", "sourceComments", "evidenceOcrText",
    "locationCandidateSource", "locationCandidateConfidence", "locationCandidateQuery", "locationCandidateReason", "locationCandidateOutsideArea", "locationSearchCheckedAt",
    "externalId", "sourceUsername", "evidenceHasImage", "notes"
  ];
  const rows = records.map(record => headers.map(key => {
    if (key.startsWith("hazard")) {
      const flag = key.replace("hazard", "").toLowerCase();
      const normalized = flag === "flood" ? "flood" : flag === "inland" ? "inland" : flag === "road" ? "road" : "landslide";
      return csvCell(record.hazardFlags?.[normalized] ? "true" : "false");
    }
    if (key === "evidenceHasImage") return csvCell(record.evidenceImage ? "true" : "false");
    if (key === "roadGeometry") return csvCell(JSON.stringify(getRoadGeometry(record) || []));
    return csvCell(record[key] ?? "");
  }).join(","));
  downloadText(`inzai-disaster-records-${dateStamp()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
}

function exportGeoJson() {
  const geojson = {
    type: "FeatureCollection",
    name: "inzai_disaster_records",
    features: records.map(record => ({
      type: "Feature",
      geometry: getRoadGeometry(record) ? {
        type: "LineString",
        coordinates: getRoadGeometry(record).map(point => [point[1], point[0]])
      } : hasCoordinates(record) ? {
          type: "Point",
          coordinates: [Number(record.lng), Number(record.lat)]
        } : null,
      properties: {
        ...withoutLargeImage(record),
        alignment: deriveAlignment(record),
        riskHits: getRiskHits(record).join(", ")
      }
    }))
  };
  downloadText(`inzai-disaster-records-${dateStamp()}.geojson`, JSON.stringify(geojson, null, 2), "application/geo+json");
}

function withoutLargeImage(record) {
  const copy = { ...record };
  copy.evidenceHasImage = Boolean(copy.evidenceImage);
  delete copy.evidenceImage;
  return copy;
}

function loadDemoRecords() {
  if (records.some(record => record.id.startsWith("demo-"))) {
    alert("サンプルはすでに表示されています。");
    return;
  }
  records = [...records, ...demoRecords];
  selectedId = demoRecords[0].id;
  persistRecords();
  renderAll();
}

function clearFilters() {
  document.getElementById("keyword-filter").value = "";
  document.getElementById("photo-filter").value = "all";
  document.getElementById("passability-filter").value = "all";
  document.querySelectorAll("[data-status]").forEach(input => {
    input.checked = true;
  });
  renderAll();
}

function getFilteredRecords() {
  const keyword = document.getElementById("keyword-filter").value.trim().toLowerCase();
  const photoFilter = document.getElementById("photo-filter").value;
  const passabilityFilter = document.getElementById("passability-filter").value;
  const activeStatuses = new Set(
    Array.from(document.querySelectorAll("[data-status]"))
      .filter(input => input.checked)
      .map(input => input.dataset.status)
  );

  return records.filter(record => {
    if (PUBLIC_VIEW && record.publicationStatus !== "published") return false;
    if (!matchesIncidentDate(record)) return false;
    if (!activeStatuses.has(record.status)) return false;
    if (photoFilter !== "all" && record.photoStatus !== photoFilter) return false;
    if (!matchesPassabilityFilter(record, passabilityFilter)) return false;
    if (!keyword) return true;
    const haystack = [
      record.title,
      record.locationName,
      record.notes,
      record.assignedTo,
      record.evidenceOperator,
      record.sourceText,
      record.sourceComments,
      record.evidenceOcrText,
      record.sourceUsername,
      record.sourceUrl,
      categoryLabels[record.category],
      passabilityLabels[getPassability(record)],
      passabilityModeLabels[record.passabilityMode],
      sourceLabels[record.sourceType]
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

function matchesIncidentDate(record) {
  if (document.getElementById("show-all-dates").checked) return true;
  const target = getFormValue("incident-date");
  if (!target) return true;
  return getRecordIncidentDate(record) === target;
}

function getRecordIncidentDate(record) {
  return extractLocalDate(record?.observedAt) ||
    String(record?.incidentDate || "") ||
    extractLocalDate(record?.evidenceCheckedAt) ||
    extractLocalDate(record?.passabilityCheckedAt) ||
    extractLocalDate(record?.locationAskedAt);
}

function extractLocalDate(value) {
  const text = String(value || "");
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getPassability(record) {
  if (record?.passability && passabilityLabels[record.passability]) return record.passability;
  return record?.category === "traffic" ? "closed" : "none";
}

function matchesPassabilityFilter(record, filter) {
  if (filter === "all") return true;
  const passability = getPassability(record);
  if (filter === "blocked") return passability === "closed" || passability === "impassable";
  return passability === filter;
}

function renderRecordDuplicateWarning() {
  const node = document.getElementById("record-duplicate-warning");
  const id = getFormValue("record-id");
  const candidate = {
    id,
    title: getFormValue("record-title"),
    locationName: getFormValue("record-location"),
    lat: parseOptionalNumber(getFormValue("record-lat")),
    lng: parseOptionalNumber(getFormValue("record-lng")),
    observedAt: getFormValue("record-observed-at"),
    sourceUrl: getFormValue("record-source-url")
  };
  renderDuplicateWarning(node, detectDuplicates(candidate, id));
}

function renderEvidenceDuplicateWarning() {
  const node = document.getElementById("evidence-duplicate-warning");
  const platform = getFormValue("evidence-platform");
  const query = getFormValue("evidence-query");
  const ocrText = getFormValue("evidence-ocr-text");
  const candidate = {
    title: `${platformLabels[platform] || platform}証跡: ${query || "検索結果"}`,
    sourceUrl: getFormValue("evidence-url"),
    observedAt: getFormValue("evidence-observed-at") || getFormValue("evidence-checked-at"),
    evidencePlatform: platform,
    evidenceQuery: query,
    evidenceOcrText: ocrText
  };
  renderDuplicateWarning(node, detectDuplicates(candidate));
}

function renderDuplicateWarning(node, duplicates) {
  if (!node) return;
  if (!duplicates.length) {
    node.hidden = true;
    node.innerHTML = "";
    return;
  }
  node.hidden = false;
  node.innerHTML = `
    <strong>重複候補 ${duplicates.length}件</strong>
    ${duplicates.slice(0, 3).map(item => `${escapeHtml(item.record.title)}（${escapeHtml(item.reason)}）`).join("<br>")}
  `;
}

function detectDuplicates(candidate, excludeId = "") {
  if (!candidate) return [];
  const candidateUrl = canonicalUrl(candidate.sourceUrl);
  const candidateText = normalizeForMatch(candidate.evidenceOcrText || candidate.sourceText || candidate.title);
  const candidateTime = parseTime(candidate.observedAt || candidate.evidenceCheckedAt);
  const matches = [];

  records.forEach(record => {
    if (record.id === excludeId) return;
    let reason = "";
    if (candidate.externalId && record.externalId && candidate.externalId === record.externalId) {
      reason = "投稿IDが一致";
    } else if (candidateUrl && candidateUrl === canonicalUrl(record.sourceUrl)) {
      reason = "根拠URLが一致";
    } else if (
      candidate.evidencePlatform &&
      candidate.evidenceQuery &&
      candidate.evidencePlatform === record.evidencePlatform &&
      normalizeForMatch(candidate.evidenceQuery) === normalizeForMatch(record.evidenceQuery) &&
      isWithinHours(candidateTime, parseTime(record.observedAt || record.evidenceCheckedAt), 24)
    ) {
      reason = "同じ検索語・24時間以内";
    } else if (
      candidateText.length >= 8 &&
      textSimilarity(candidateText, normalizeForMatch(record.evidenceOcrText || record.sourceText || record.title)) >= 0.72 &&
      isWithinHours(candidateTime, parseTime(record.observedAt || record.evidenceCheckedAt), 48)
    ) {
      reason = "本文・OCRが類似";
    } else if (
      Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng) &&
      Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng)) &&
      distanceMeters(candidate.lat, candidate.lng, Number(record.lat), Number(record.lng)) <= 150 &&
      textSimilarity(normalizeForMatch(candidate.title), normalizeForMatch(record.title)) >= 0.55 &&
      isWithinHours(candidateTime, parseTime(record.observedAt), 24)
    ) {
      reason = "近接地点・類似件名";
    }
    if (reason) matches.push({ record, reason });
  });
  return matches;
}

function confirmDuplicateRegistration(duplicates) {
  const summary = duplicates.slice(0, 3).map(item => `・${item.record.title}（${item.reason}）`).join("\n");
  return confirm(`重複候補が見つかりました。別情報として登録しますか。\n\n${summary}`);
}

function canonicalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "igshid"].forEach(key => url.searchParams.delete(key));
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return text.replace(/\/$/, "").toLowerCase();
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .slice(0, 500);
}

function textSimilarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftSet = bigrams(left);
  const rightSet = bigrams(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach(value => {
    if (rightSet.has(value)) intersection += 1;
  });
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function bigrams(value) {
  const set = new Set();
  for (let index = 0; index < value.length - 1; index += 1) set.add(value.slice(index, index + 2));
  return set;
}

function parseTime(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinHours(left, right, hours) {
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= hours * 60 * 60 * 1000;
}

function parseOptionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function hasCoordinates(record) {
  return record?.lat !== null && record?.lat !== "" && record?.lat !== undefined &&
    record?.lng !== null && record?.lng !== "" && record?.lng !== undefined &&
    Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng));
}

function parseRoadGeometry(value) {
  let source = value;
  if (typeof source === "string") {
    const text = source.trim();
    if (!text) return null;
    try {
      source = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(source)) return null;
  const points = source
    .map(point => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : null)
    .filter(point => point && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180);
  return points.length >= 2 ? points : null;
}

function getRoadGeometry(record) {
  return parseRoadGeometry(record?.roadGeometry);
}

function getDisplayRoadGeometry(record) {
  const geometry = getRoadGeometry(record);
  if (!geometry) return null;
  if (!PUBLIC_VIEW) return geometry;
  const precision = record.publicLocationPrecision || "hidden";
  if (precision === "hidden") return null;
  if (precision === "approximate") {
    return geometry.map(point => [Number(point[0].toFixed(3)), Number(point[1].toFixed(3))]);
  }
  return geometry;
}

function roadGeometryCenter(geometry) {
  const points = parseRoadGeometry(geometry);
  if (!points) return null;
  const center = L.latLngBounds(points).getCenter();
  return { lat: center.lat, lng: center.lng };
}

function formatRoadDistance(geometry) {
  const points = parseRoadGeometry(geometry);
  if (!points) return "距離未設定";
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    meters += distanceMeters(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
  }
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.max(1, Math.round(meters))}m`;
}

function getDisplayCoordinates(record) {
  if (!hasCoordinates(record)) return null;
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!PUBLIC_VIEW) return { lat, lng };
  const precision = record.publicLocationPrecision || "hidden";
  if (precision === "hidden") return null;
  if (precision === "approximate") {
    return { lat: Number(lat.toFixed(3)), lng: Number(lng.toFixed(3)) };
  }
  return { lat, lng };
}

function getLocationStatus(record) {
  if (record?.locationStatus && locationStatusLabels[record.locationStatus]) return record.locationStatus;
  return hasCoordinates(record) || getRoadGeometry(record) ? "pinned" : "unknown";
}

function locationStatusDisplayLabel(record) {
  const status = getLocationStatus(record);
  if (status === "pinned" && getRoadGeometry(record)) return "道路区間設定済";
  return locationStatusLabels[status] || status;
}

function deriveAlignment(record) {
  if (record.status === "resolved") return "resolved";
  const riskHits = getRiskHits(record);
  const hasReliableSignal = ["official", "staff", "citizen", "news"].includes(record.sourceType) || ["corroborated", "verified", "actioning"].includes(record.status);
  if (riskHits.length && ["verified", "actioning", "corroborated", "unconfirmed"].includes(record.status)) return "expected";
  if (!riskHits.length && hasReliableSignal) return "unexpected";
  if (!riskHits.length && record.sourceType === "sns") return "uncertain";
  return riskHits.length ? "highRisk" : "uncertain";
}

function getRiskHits(record) {
  const hits = [];
  if (record.hazardFlags?.flood) hits.push("洪水");
  if (record.hazardFlags?.inland) hits.push("内水");
  if (record.hazardFlags?.landslide) hits.push("土砂");
  const nearRoad = hasCoordinates(record) && roadFloodSites.some(site => site.precise && distanceMeters(record.lat, record.lng, site.lat, site.lng) <= 220);
  if (record.hazardFlags?.road || nearRoad) hits.push("道路冠水注意箇所");
  return [...new Set(hits)];
}

function markerColor(record, alignment) {
  const passability = getPassability(record);
  if (passability === "closed" || passability === "impassable") return "#b8322c";
  if (passability === "restricted") return "#c96321";
  if (passability === "reopened") return "#24745a";
  if (passability === "passed") return "#2365a8";
  if (record.status === "resolved") return "#6b737a";
  if (record.status === "verified" || record.status === "actioning") return "#b8322c";
  if (record.status === "corroborated") return "#c96321";
  if (alignment === "highRisk") return "#2365a8";
  if (alignment === "unexpected") return "#7050a8";
  return "#a77708";
}

function badgeColor(status) {
  if (status === "verified" || status === "actioning") return "red";
  if (status === "corroborated") return "orange";
  if (status === "resolved") return "green";
  return "yellow";
}

function alignmentColor(alignment) {
  if (alignment === "expected") return "blue";
  if (alignment === "unexpected") return "purple";
  if (alignment === "highRisk") return "blue";
  if (alignment === "resolved") return "green";
  return "yellow";
}

function photoBadgeColor(status) {
  if (status === "official-verified") return "green";
  if (status === "has-photo") return "blue";
  if (status === "unavailable") return "purple";
  return "yellow";
}

function passabilityBadgeColor(passability) {
  if (passability === "closed" || passability === "impassable") return "red";
  if (passability === "restricted") return "orange";
  if (passability === "reopened") return "green";
  if (passability === "passed") return "blue";
  return "yellow";
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRad = value => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    notifyHost();
    queueSharedRecordsSync();
  } catch {
    alert("ブラウザのローカル保存容量を超えました。証跡画像を切り出しDLしてから、画像なしでCSV/GeoJSON管理してください。");
  }
}

function queueSharedRecordsSync() {
  const endpoint = String(APP_CONFIG.sharedRecordsEndpoint || "").trim();
  const permissions = window.CBIDisasterOperator?.permissions || {};
  if (!endpoint || !(permissions.canEdit || permissions.canCreate)) return;
  clearTimeout(sharedRecordsSyncTimer);
  sharedRecordsSyncTimer = setTimeout(async () => {
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appVersion: APP_CONFIG.appVersion || "", records })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      document.getElementById("map-status").textContent = "共有台帳へ保存しました。";
    } catch (error) {
      document.getElementById("map-status").textContent = `端末には保存しましたが、共有台帳へ送信できませんでした（${error?.message || "接続エラー"}）。`;
      appendSystemWorkLog("自主防災組織 共有台帳", "blocked", "共有台帳への保存に失敗しました。", "認証状態とCBI連携APIを確認する");
    }
  }, 600);
}

function appendSystemWorkLog(feature, status, summary, nextAction) {
  try {
    const current = JSON.parse(localStorage.getItem(WORK_LOG_KEY) || "[]");
    const now = new Date();
    const duplicate = current.some(item =>
      item.feature === feature &&
      item.summary === summary &&
      now.getTime() - new Date(item.loggedAt).getTime() < 30 * 60 * 1000
    );
    if (duplicate) return;
    current.unshift({
      id: `work-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      feature,
      status,
      owner: "",
      loggedAt: now.toISOString(),
      summary,
      nextAction,
      referenceUrl: "",
      origin: "system"
    });
    localStorage.setItem(WORK_LOG_KEY, JSON.stringify(current.slice(0, 500)));
  } catch {}
}

function notifyHost() {
  if (window.parent === window) return;
  const targetOrigin = String(APP_CONFIG.hostOrigin || window.location.origin);
  window.parent.postMessage({
    type: "cbi:disaster-map:records-changed",
    count: records.length,
    selectedId,
    updatedAt: new Date().toISOString()
  }, targetOrigin);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  const headers = rows.shift()?.map(value => value.trim()) || [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

// 日本時間の今日（YYYY-MM-DD）。対象日の既定値に使う。
// UTC基準の toISOString だと日本の早朝に前日になってしまうため、必ずJSTで求める
function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function nowLocalInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function incidentDateTimeInput() {
  const now = nowLocalInput();
  const incidentDate = getFormValue("incident-date");
  return incidentDate ? `${incidentDate}${now.slice(10)}` : now;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatDateTime(value) {
  if (!value) return "-";
  return value.replace("T", " ");
}

function setFormValue(id, value) {
  document.getElementById(id).value = value ?? "";
}

function getFormValue(id) {
  return document.getElementById(id).value.trim();
}

function toBool(value) {
  return ["true", "1", "yes", "y", "該当", "あり"].includes(String(value || "").trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

// ============================================================
// ⚡ 停電の円表示（2026-09-22・東京電力パワーグリッドの許可待ち）
// 地区（丁目・大字）の代表点に、停電軒数に応じた大きさの円を置く。数値は東電の発表どおり（加工しない）。
// ⛔ 許可が出るまで一般の画面には出さない：config.js の teidenEndpoint は空、見本は ?teiden=demo のときだけ
//    teiden-sample.json（架空の数値）を読む。許可後は CiDAO が同じ形の JSON を10分に1回以下の取得で配る。
// 形：{ sample, fetchedAt, source:{name,url}, areas:[{city, district, households, occurredAt, restoreEta, lat?, lon?}] }
// ============================================================
const TEIDEN_POINT_CACHE_KEY = "cbi-disaster-teiden-points-v1";
const teidenRenderer = L.svg({ pane: "teidenPane" });
const teidenLayer = L.layerGroup();
const teidenMode = new URLSearchParams(window.location.search).get("teiden") === "demo"
  ? "demo"
  : (String(APP_CONFIG.teidenEndpoint || "").trim() ? "live" : "");

function teidenRadius(households) {
  return 5 + Math.sqrt(Math.max(0, Number(households) || 0)) * 0.45;
}

// 地区の代表点。データに無ければ国土地理院の住所検索で引き、この端末に覚える
async function teidenPoint(area) {
  if (Number.isFinite(Number(area.lat)) && Number.isFinite(Number(area.lon))) return { lat: Number(area.lat), lon: Number(area.lon) };
  const query = `千葉県${area.city || ""}${area.district || ""}`;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(TEIDEN_POINT_CACHE_KEY) || "{}") || {}; } catch {}
  if (cache[query]) return cache[query];
  // 1件の検索が返らなくても、ほかの地区の円は出す（8秒で諦める）
  const point = await Promise.race([
    geocodeCity(query).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), 8000))
  ]);
  if (point) {
    cache[query] = point;
    try { localStorage.setItem(TEIDEN_POINT_CACHE_KEY, JSON.stringify(cache)); } catch {}
  }
  return point;
}

async function refreshTeidenLayer() {
  if (!teidenMode) return;
  const url = teidenMode === "demo" ? "teiden-sample.json" : String(APP_CONFIG.teidenEndpoint).trim();
  let data;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    // 取れないときは古い円を消す（前の停電が続いているように見せない）
    teidenLayer.clearLayers();
    return;
  }
  const sample = Boolean(data.sample) || teidenMode === "demo";
  const sourceName = data.source?.name || "東京電力パワーグリッド「停電情報」";
  const sourceUrl = data.source?.url || "https://teideninfo.tepco.co.jp/flash/12000000000.html";
  const fetchedAt = data.fetchedAt ? formatDateTime(toDateTimeLocal(new Date(data.fetchedAt).toISOString())) : "";
  const areas = Array.isArray(data.areas) ? data.areas.filter(a => Number(a.households) > 0) : [];
  const points = await Promise.all(areas.map(teidenPoint));
  teidenLayer.clearLayers();
  areas.forEach((area, index) => {
    const point = points[index];
    if (!point) return; // 代表点が引けない地区は描かない（違う場所に置かない）
    const n = Number(area.households);
    const r = teidenRadius(n);
    const name = `${area.city && area.city !== "印西市" ? area.city : ""}${area.district || ""}`;
    L.circleMarker([point.lat, point.lon], {
      renderer: teidenRenderer, pane: "teidenPane",
      radius: r, color: "#a05a00", weight: 1.5, fillColor: "#f0a020", fillOpacity: 0.55
    }).bindPopup(`
      <div class="teiden-popup">
        <strong>⚡ ${escapeHtml(name)}の停電${sample ? "（見本・架空の数値）" : ""}</strong>
        <div class="teiden-popup-n">約${escapeHtml(n.toLocaleString())}軒</div>
        <div>発生：${escapeHtml(area.occurredAt || "不明")}／復旧見込み：${escapeHtml(area.restoreEta || "調査中")}</div>
        <div class="teiden-popup-note">円の位置は地区の代表点で、停電の範囲そのものではありません。</div>
        <div class="teiden-popup-note">出典：<a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceName)} ↗</a>${fetchedAt ? `（${escapeHtml(fetchedAt)}取得）` : ""}${sample ? "。この表示は見本で、実際の停電ではありません。" : ""}</div>
      </div>`).addTo(teidenLayer);
    L.marker([point.lat, point.lon], {
      pane: "teidenPane", interactive: false,
      icon: L.divIcon({ className: "", iconAnchor: [-r - 3, 9], html: `<span class="teiden-label">${escapeHtml(name)} 約${escapeHtml(n.toLocaleString())}軒${sample ? "（見本）" : ""}</span>` })
    }).addTo(teidenLayer);
  });
}

if (teidenMode) {
  teidenLayer.addTo(map);
  refreshTeidenLayer();
  if (teidenMode === "live") setInterval(refreshTeidenLayer, 10 * 60 * 1000);
}

// ============================================================
// 🏠 この場所は想定区域に入っているか（2026-09-24）
// 調査（保管庫 cidao/2026-09-24_冠水MAPの改善_住民ニーズと先行事例の調査.md）でいちばん効くと分かった機能。
// 内閣府の調査では、自宅がリスク区域内だと認識していた人の避難率は4割強、認識していない人は1〜2割。
// 一方で「自宅が区域に入っているか知らなかった」人が52%いる（国土交通省の資料）。
// ⚠ 判定は公式ハザードのタイルの色を読んでいるだけで、CBIの独自判断は足していない。
// ⚠ 色が付いていない＝安全ではない（2026年8月の千葉豪雨では浸水報告の55.7%が想定区域の外だった）。
// ============================================================
const HAZARD_CHECK_LAYERS = [
  {
    key: "flood", label: "洪水（想定最大規模）", z: 16,
    url: "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png",
    // 国交省の統一凡例（浸水深）。実際のタイルから採った色で照合する
    colors: [
      { rgb: [247, 245, 169], text: "0.5m未満（床下まで）" },
      { rgb: [255, 216, 192], text: "0.5〜3m（1階が浸かる高さ）" },
      { rgb: [255, 183, 183], text: "3〜5m（2階が浸かる高さ）" },
      { rgb: [255, 145, 145], text: "5〜10m（3階以上まで）" },
      { rgb: [242, 133, 201], text: "10〜20m" },
      { rgb: [220, 122, 220], text: "20m以上" }
    ]
  },
  {
    key: "inland", label: "内水（雨水が流れきらない浸水）", z: 16,
    url: "https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png",
    colors: [
      { rgb: [247, 245, 169], text: "0.5m未満" },
      { rgb: [255, 216, 192], text: "0.5〜3m" },
      { rgb: [255, 183, 183], text: "3〜5m" },
      { rgb: [255, 145, 145], text: "5m以上" }
    ]
  },
  {
    key: "kaoku", label: "家屋倒壊等氾濫想定区域（氾濫流）", z: 16,
    url: "https://disaportaldata.gsi.go.jp/raster/01_flood_l2_kaokutoukai_hanran_data/{z}/{x}/{y}.png",
    colors: [{ rgb: [255, 153, 0], text: "区域内（木造家屋が倒れるおそれ）" }]
  },
  {
    key: "dosha", label: "土砂災害（急傾斜地の崩壊）", z: 16,
    url: "https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png",
    colors: [
      { rgb: [250, 230, 0], text: "警戒区域（イエロー）" },
      { rgb: [250, 40, 0], text: "特別警戒区域（レッド）" }
    ]
  }
];

const hazardTileCache = new Map();
let hazardPickMarker = null;
let hazardPickMode = false;

function hazardTile(url, z, x, y) {
  const key = url + "/" + z + "/" + x + "/" + y;
  if (!hazardTileCache.has(key)) {
    hazardTileCache.set(key, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 256; canvas.height = 256;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, 256, 256).data);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null); // そこに想定が無ければタイル自体が無い（404）
      img.src = url.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    }));
  }
  return hazardTileCache.get(key);
}

// 1地点の色を読み、いちばん近い凡例の色に当てる（色が無ければ null）
async function hazardAtPoint(layer, lat, lon) {
  const n = 2 ** layer.z;
  const fx = (lon + 180) / 360 * n;
  const rad = lat * Math.PI / 180;
  const fy = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  const data = await hazardTile(layer.url, layer.z, Math.floor(fx), Math.floor(fy));
  if (!data) return null;
  const px = Math.min(255, Math.max(0, Math.floor((fx % 1) * 256)));
  const py = Math.min(255, Math.max(0, Math.floor((fy % 1) * 256)));
  const i = (py * 256 + px) * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
  if (a < 40) return null; // 透明＝区域の外
  let best = null;
  layer.colors.forEach(c => {
    const d = Math.abs(c.rgb[0] - r) + Math.abs(c.rgb[1] - g) + Math.abs(c.rgb[2] - b);
    if (!best || d < best.d) best = { d: d, text: c.text };
  });
  return best && best.d <= 120 ? best.text : "区域内（色の区分は判別できませんでした）";
}

async function hazardCheckAt(lat, lon) {
  return Promise.all(HAZARD_CHECK_LAYERS.map(async layer => ({
    label: layer.label,
    hit: await hazardAtPoint(layer, lat, lon)
  })));
}

function setHazardResult(html) {
  const node = document.getElementById("hazard-result");
  if (node) node.innerHTML = html;
}

function setHazardPickMode(on) {
  hazardPickMode = on;
  document.getElementById("legend-hazard")?.setAttribute("aria-pressed", String(on));
  const panel = document.getElementById("hazard-panel");
  if (panel) panel.hidden = !on;
  if (on) {
    document.getElementById("range-panel")?.setAttribute("hidden", "");
    document.getElementById("rain-panel")?.setAttribute("hidden", "");
    document.getElementById("place-panel")?.setAttribute("hidden", "");
    setHazardResult('<p class="hazard-hint">調べたい場所を地図でタップしてください（自宅・職場・通り道など）。住所でも探せます。</p>');
  } else {
    // 閉じたら 🏠 の印も消す（2026-09-24：印だけ地図に残って消せないという指摘）
    if (hazardPickMarker) { map.removeLayer(hazardPickMarker); hazardPickMarker = null; }
    setHazardResult("");
    const input = document.getElementById("hazard-search-input");
    if (input) input.value = "";
  }
}

function hazardPinIcon() {
  return L.divIcon({ className: "", html: '<div class="hazard-pin" aria-hidden="true">🏠</div>', iconSize: [28, 28], iconAnchor: [14, 26] });
}

async function showHazardCheck(lat, lon, placeLabel) {
  setHazardResult('<p class="hazard-hint">公式の想定を確認しています…</p>');
  const where = placeLabel ? escapeHtml(placeLabel) : "緯度 " + lat.toFixed(5) + "／経度 " + lon.toFixed(5);
  try {
    const results = await hazardCheckAt(lat, lon);
    const hits = results.filter(r => r.hit);
    const rows = results.map(r =>
      '<li class="' + (r.hit ? "is-hit" : "is-none") + '"><strong>' + escapeHtml(r.label) + "</strong>：" +
      (r.hit ? escapeHtml(r.hit) : "この地点に色は付いていません") + "</li>").join("");
    const head = hits.length
      ? '<p class="hazard-verdict is-hit">この場所は <strong>' + hits.length + "件の想定区域に入っています</strong></p>"
      : '<p class="hazard-verdict is-none">この場所には、公式の想定の色が付いていません</p>';
    setHazardResult(
      head +
      '<p class="hazard-where">' + where + "</p>" +
      '<ul class="hazard-list">' + rows + "</ul>" +
      '<p class="hazard-note">⚠ <strong>色が付いていない＝安全ではありません。</strong>2026年8月の千葉豪雨では、浸水の報告の55.7%が想定区域の外でした（ウェザーニュース調べ）。雨水が流れきらずに道路や低い土地が浸かることがあります。</p>' +
      '<p class="hazard-note">出典：ハザードマップポータル（国土地理院・国土交通省）の公開データを、この画面が読み取って判定しています。避難の判断は市の避難情報に従ってください。</p>'
    );
  } catch (error) {
    setHazardResult('<p class="hazard-hint is-error">確認できませんでした（' + escapeHtml((error && error.message) || "接続エラー") + "）。時間をおいて試してください。</p>");
  }
}

function initHazardCheck() {
  const chip = document.getElementById("legend-hazard");
  if (!chip) return;
  chip.addEventListener("click", () => setHazardPickMode(!hazardPickMode));
  document.getElementById("hazard-close")?.addEventListener("click", () => setHazardPickMode(false));
  // 地図のタップで判定（記録の入力中・地点指定中は邪魔しない）
  map.on("click", event => {
    if (!hazardPickMode) return;
    if ((typeof citizenRoadDraft !== "undefined" && citizenRoadDraft && citizenRoadDraft.active) || roadDrawingMode || locationPickRecordId) return;
    if (hazardPickMarker) map.removeLayer(hazardPickMarker);
    hazardPickMarker = L.marker(event.latlng, { icon: hazardPinIcon() }).addTo(map);
    showHazardCheck(event.latlng.lat, event.latlng.lng, "");
  });
  document.getElementById("hazard-search-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const q = String(document.getElementById("hazard-search-input")?.value || "").trim();
    if (!q) return;
    setHazardResult('<p class="hazard-hint">住所を探しています…</p>');
    try {
      const response = await fetch(PLACE_SEARCH_URL + encodeURIComponent(q));
      const rows = await response.json();
      const hit = Array.isArray(rows) ? rows[0] : null;
      const point = hit && hit.geometry && hit.geometry.coordinates;
      if (!point) {
        setHazardResult('<p class="hazard-hint is-error">その住所は見つかりませんでした。地図をタップしても調べられます。</p>');
        return;
      }
      const lon = Number(point[0]), lat = Number(point[1]);
      map.setView([lat, lon], Math.max(map.getZoom(), 16), { animate: false });
      if (hazardPickMarker) map.removeLayer(hazardPickMarker);
      hazardPickMarker = L.marker([lat, lon], { icon: hazardPinIcon() }).addTo(map);
      showHazardCheck(lat, lon, (hit.properties && hit.properties.title) || q);
    } catch (error) {
      setHazardResult('<p class="hazard-hint is-error">住所を探せませんでした（' + escapeHtml((error && error.message) || "接続エラー") + "）</p>");
    }
  });
}

// 最初の画面は冠水の情報だけにする（2026-09-21 中司さんの実機指摘）。開いた直後に
// 避難所55施設のピン・被害候補のピン・洪水浸水想定の赤い面が全部出ていて、地図そのものが
// 読めなかった。浸水想定と避難所は「🌊 浸水の想定」「🏫 避難所」のボタン（プリセット）か
// レイヤー一覧からONにする。
// ⚠ ここはファイル末尾でなければならない。kansuiLayer・passedRoadsLayer は const で
// 後方に宣言されており、上の初期化ブロック（baseLayers.pale.addTo あたり）で呼ぶと
// 「Cannot access 'kansuiLayer' before initialization」でページ全体の初期化が止まる。
// 状態は index.html の checked と PRESETS.reset（「↺ 最初の表示」）にも書いてあるので、
// 変えるときは3か所そろえること。
(function initInitialOverlays() {
  document.querySelectorAll("[data-overlay]").forEach(input => {
    if (!input.checked) return;
    const name = input.dataset.overlay;
    // 既定でONのうち、boundary は上の初期化で addTo 済み
    if (name === "boundary") return;
    toggleOverlay(name, true);
  });
  // 「見たいもの」の最初のボタンを押した状態で開く。いま何が出ているのかを分かるようにする
  // （2026-09-21 中司さんの指示）。applyPreset は呼ばない（チェックは上で入れ終えており、
  // 左パネルの開閉とスクロールまで動かす必要がないため）
  document.querySelector('.preset-btn[data-preset="kansui"]')?.classList.add("is-current");
  // 「見たいもの」は横スクロールの行なので、選んでいるボタンが画面外から始まらないようにする
  // （2026-09-21 実機で、右端の「いまの雨・土砂災害」だけが見えている状態になっていた）
  document.querySelector(".preset-items")?.scrollTo?.({ left: 0 });
})();
