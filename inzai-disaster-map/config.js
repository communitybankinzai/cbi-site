window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    locationAiEndpoint: "",
    operatorSessionEndpoint: "",
    sharedRecordsEndpoint: "",
    cidaoLoginUrl: "https://cidao.vercel.app/login?next=/disaster-map",
    earthquakeListEndpoint: "https://www.jma.go.jp/bosai/quake/data/list.json",
    weatherWarningEndpoint: "https://www.jma.go.jp/bosai/warning/data/r8/120000.json",
    hostOrigin: window.location.origin,
    appVersion: "2026.08.15.4"
  },
  window.CBI_DISASTER_CONFIG || {}
);
