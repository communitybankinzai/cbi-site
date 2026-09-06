window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    snsMonitorEndpoint: "https://cidao.vercel.app/api/disaster/sns-monitor",
    shelterEndpoint: "https://cidao.vercel.app/api/disaster/inzai-shelters",
    wellEndpoint: "https://cidao.vercel.app/api/disaster/inzai-wells",
    timelineEndpoint: "https://cidao.vercel.app/api/disaster/timeline",
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
    appVersion: "2026.09.06.9"
  },
  window.CBI_DISASTER_CONFIG || {}
);
