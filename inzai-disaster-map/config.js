window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    snsMonitorEndpoint: "https://cidao.vercel.app/api/disaster/sns-monitor",
    shelterEndpoint: "https://cidao.vercel.app/api/disaster/inzai-shelters",
    wellEndpoint: "https://cidao.vercel.app/api/disaster/inzai-wells",
    kansuiEndpoint: "https://cidao.vercel.app/api/disaster/kansui",
    passedRoadsEndpoint: "https://cidao.vercel.app/api/disaster/passed-roads",
    // 「💬 要望を送る」の送り先（匿名・一覧は運営の合言葉があるときだけ返す）
    feedbackEndpoint: "https://cidao.vercel.app/api/disaster/feedback",
    // SNSの投稿をAIが読み取った「通れた／通れない／解除」（未確認・確度が高いものだけ配信される）
    snsRoadReportsEndpoint: "https://cidao.vercel.app/api/disaster/sns-road-reports",
    // 鉄道・バスの運休。市が再開を発表するとサーバー側で自動的に解除される。
    // 取得できないときは同じフォルダの rail-status.json（静的）を使う。
    railStatusEndpoint: "https://cidao.vercel.app/api/disaster/rail-status",
    roadClosuresEndpoint: "https://cidao.vercel.app/api/disaster/road-closures",
    // 県の道路規制状況図を CBI が最後に確かめた時刻（CiDAO が30分ごとに記録）
    prefKiseiCheckEndpoint: "https://cidao.vercel.app/api/disaster/pref-road-kisei",
    timelineEndpoint: "https://cidao.vercel.app/api/disaster/timeline",
    // 手賀沼・西印旛沼・北印旛沼の水位（千葉県のページをCiDAOが5分キャッシュで読み取る）と利根川の洪水予報（気象庁）
    riverLevelEndpoint: "https://cidao.vercel.app/api/disaster/river-level",
    // 市の避難情報（避難指示など）。防災速報から拾い、解除・24時間経過・運営のオフで消える
    evacAlertEndpoint: "https://cidao.vercel.app/api/disaster/evac-alert",
    // 停電の円表示（2026-09-30 東電PGの了承で公開）。CiDAO が印西市の XML を10分に1回以下で取って配る。
    // ⛔ 「⚡ 停電」を押す（層 teiden を ON）まで取りに行かない約束。見本は ?teiden=demo（teiden-sample.json・架空の数値）
    teidenEndpoint: "https://cidao.vercel.app/api/disaster/teiden",
    openDataEndpoint: "https://cidao.vercel.app/api/disaster/inzai-opendata",
    presenceEndpoint: "https://cidao.vercel.app/api/metaverse-presence",
    locationAiEndpoint: "",
    operatorSessionEndpoint: "",
    sharedRecordsEndpoint: "",
    cidaoLoginUrl: "https://cidao.vercel.app/login?next=/disaster-map",
    earthquakeListEndpoint: "https://www.jma.go.jp/bosai/quake/data/list.json",
    // 過去の地震の再生（直近1か月より前）。気象庁の発表を転載している P2P地震情報 の API（2026-10-02）
    p2pQuakeEndpoint: "https://api.p2pquake.net/v2/jma/quake",
    // 気象庁の地震ごとの詳細JSON（観測点ごとの震度と座標）。list.json の json 名を後ろに付ける
    earthquakeDetailBase: "https://www.jma.go.jp/bosai/quake/data/",
    weatherWarningEndpoint: "https://www.jma.go.jp/bosai/warning/data/r8/120000.json",
    jshisPshmWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/pshm/Y2024",
    jshisGroundWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/sstrct/V4",
    hostOrigin: window.location.origin,
    appVersion: "2026.09.18.01"
  },
  window.CBI_DISASTER_CONFIG || {}
);
