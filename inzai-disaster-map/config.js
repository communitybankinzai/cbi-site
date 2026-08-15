window.CBI_DISASTER_CONFIG = Object.assign(
  {
    cbiHomeUrl: "../",
    snsSearchEndpoint: "",
    locationAiEndpoint: "",
    operatorSessionEndpoint: "",
    sharedRecordsEndpoint: "",
    cidaoLoginUrl: "https://cidao.vercel.app/login?next=/disaster-map",
    earthquakeListEndpoint: "https://www.jma.go.jp/bosai/quake/data/list.json",
    hostOrigin: window.location.origin,
    appVersion: "2026.08.15.3"
  },
  window.CBI_DISASTER_CONFIG || {}
);
