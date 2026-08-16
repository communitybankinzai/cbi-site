window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    snsMonitorEndpoint: "https://cidao.vercel.app/api/disaster/sns-monitor",
    locationAiEndpoint: "",
    operatorSessionEndpoint: "",
    sharedRecordsEndpoint: "",
    cidaoLoginUrl: "https://cidao.vercel.app/login?next=/disaster-map",
    earthquakeListEndpoint: "https://www.jma.go.jp/bosai/quake/data/list.json",
    weatherWarningEndpoint: "https://www.jma.go.jp/bosai/warning/data/r8/120000.json",
    jshisPshmWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/pshm/Y2024",
    jshisGroundWmsUrl: "https://www.j-shis.bosai.go.jp/map/wms/sstrct/V4",
    hostOrigin: window.location.origin,
    appVersion: "2026.08.16.1"
  },
  window.CBI_DISASTER_CONFIG || {}
);
