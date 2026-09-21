window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    snsMonitorEndpoint: "https://cidao.vercel.app/api/disaster/sns-monitor",
    shelterEndpoint: "https://cidao.vercel.app/api/disaster/inzai-shelters",
    wellEndpoint: "https://cidao.vercel.app/api/disaster/inzai-wells",
    kansuiEndpoint: "https://cidao.vercel.app/api/disaster/kansui",
    passedRoadsEndpoint: "https://cidao.vercel.app/api/disaster/passed-roads",
    // 鉄道・バスの運休。市が再開を発表するとサーバー側で自動的に解除される。
    // 取得できないときは同じフォルダの rail-status.json（静的）を使う。
    railStatusEndpoint: "https://cidao.vercel.app/api/disaster/rail-status",
    timelineEndpoint: "https://cidao.vercel.app/api/disaster/timeline",
    // 手賀沼・西印旛沼・北印旛沼の水位（千葉県のページをCiDAOが5分キャッシュで読み取る）と利根川の洪水予報（気象庁）
    riverLevelEndpoint: "https://cidao.vercel.app/api/disaster/river-level",
    // 市の避難情報（避難指示など）。防災速報から拾い、解除・24時間経過・運営のオフで消える
    evacAlertEndpoint: "https://cidao.vercel.app/api/disaster/evac-alert",
    openDataEndpoint: "https://cidao.vercel.app/api/disaster/inzai-opendata",
    presenceEndpoint: "https://cidao.vercel.app/api/metaverse-presence",
    locationAiEndpoint: "",
    operatorSessionEndpoint: "",
    sharedRecordsEndpoint: "",
    cidaoLoginUrl: "https://cidao.vercel.app/login?next=/disaster-map",
    earthquakeListEndpoint: "https://www.jma.go.jp/bosai/quake/data/list.json",
    weatherWarningEndpoint: "https://www.jma.go.jp/bosai/warning/data/r8/120000.json",
    jshisPshmWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/pshm/Y2024",
    jshisGroundWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/sstrct/V4",
    hostOrigin: window.location.origin,
    appVersion: "2026.09.18.01"
  },
  window.CBI_DISASTER_CONFIG || {}
);
