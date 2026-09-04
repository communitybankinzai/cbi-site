(function () {
  "use strict";

  const query = new URLSearchParams(location.search);
  const RACE_MODE = query.get("race");
  const VS_MODES = { "vs": true, "cultural-vs": true };
  const STORAGE_KEY = "cbi-meta-vs-race-results-v1";
  const AXIS_DEADZONE = 0.16;
  const LOOK_DEADZONE = 0.12;
  const DEFAULT_HEIGHT = 220;
  const DEFAULT_RADIUS = 120;
  const MIN_FLIGHT_HEIGHT = 18;
  const COUNTDOWN_STEPS = [
    { until: 700, label: "READY" },
    { until: 1500, label: "3" },
    { until: 2300, label: "2" },
    { until: 3100, label: "1" },
    { until: 3800, label: "START" }
  ];

  const RACE_CONFIG = {
    version: "2026-09-04",
    defaultMode: "cultural-vs",
    defaultCourse: "cultural_beginner",
    defaultCityCourse: "city_01",
    defaultRadius: DEFAULT_RADIUS,
    courses: {}
  };
  window.RACE_CONFIG = RACE_CONFIG;

  const race = {
    enabled: false,
    state: "idle",
    mode: RACE_MODE || "",
    courseId: "",
    course: null,
    frameId: 0,
    lastFrame: 0,
    countdownStart: 0,
    startMs: 0,
    pauseStarted: 0,
    pauseTotal: 0,
    paused: false,
    winnerId: null,
    message: "",
    messageUntil: 0,
    inputTest: false,
    stored: false,
    p2Fps: 0,
    p2Frames: 0,
    p2FpsSince: 0
  };

  const players = [
    makePlayer(1, 0, "PLAYER 1", "#38bdf8"),
    makePlayer(2, 1, "PLAYER 2", "#fbbf24")
  ];

  window.vsRaceState = race;
  window.vsRacePlayers = players;

  const ui = {};

  function makePlayer(id, gamepadIndex, name, color) {
    return {
      id,
      gamepadIndex,
      name,
      color,
      viewer: null,
      ready: false,
      connected: false,
      lastConnected: false,
      padName: "",
      prevButtons: [],
      center: [0, 0, 0, 0, 0, 0],
      centerReady: false,
      input: { lx: 0, ly: 0, rx: 0, ry: 0, up: 0, boost: false },
      nextIndex: 0,
      nextDistance: null,
      passed: [],
      finished: false,
      forced: false,
      finishMs: null,
      markerIds: [],
      startPoint: null,
      restore: null,
      groundTick: 0,
      minHeight: MIN_FLIGHT_HEIGHT
    };
  }

  function get(id) {
    return document.getElementById(id);
  }

  function wireUi() {
    const ids = [
      "vsRaceStatus", "vsCourseSelect", "vsExitBtn", "vsHudP1Name", "vsHudP1Next",
      "vsHudP1Time", "vsHudP2Name", "vsHudP2Next", "vsHudP2Time", "vsP1Status",
      "vsP1Pad", "vsP2Status", "vsP2Pad", "vsReadyP1", "vsReadyP2", "vsCenterP1",
      "vsCenterP2", "vsStartBtn", "vsResetBtn", "vsFullBtn", "vsInputBtn",
      "vsForceEndBtn", "vsPauseOnDisconnect", "vsFpsP1", "vsFpsP2", "vsGoalCount",
      "vsP1AxisLX", "vsP1AxisLY", "vsP2AxisLX", "vsP2AxisLY", "vsCountdown",
      "vsResultModal", "vsResultTitle", "vsResultSummary", "vsResultRows",
      "vsRematchBtn", "vsCourseBtn", "vsResultCloseBtn"
    ];
    ids.forEach(id => { ui[id] = get(id); });
    if (!ui.vsRaceStatus || !ui.vsCourseSelect) return false;

    const startButton = get("vsRaceBtn");
    if (startButton) {
      startButton.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.set("mode", "event");
        url.searchParams.set("race", "cultural-vs");
        history.replaceState(null, "", url);
        enableVsRace("cultural-vs");
      });
    }

    ui.vsCourseSelect.addEventListener("change", () => setCourse(ui.vsCourseSelect.value, true));
    ui.vsExitBtn.addEventListener("click", disableVsRace);
    ui.vsReadyP1.addEventListener("click", () => toggleReady(players[0], false));
    ui.vsReadyP2.addEventListener("click", () => toggleReady(players[1], false));
    ui.vsCenterP1.addEventListener("click", () => centerPad(players[0], true));
    ui.vsCenterP2.addEventListener("click", () => centerPad(players[1], true));
    ui.vsStartBtn.addEventListener("click", beginCountdown);
    ui.vsResetBtn.addEventListener("click", () => resetRace(true));
    ui.vsFullBtn.addEventListener("click", toggleFullscreen);
    ui.vsInputBtn.addEventListener("click", () => {
      race.inputTest = !race.inputTest;
      ui.vsInputBtn.textContent = race.inputTest ? "INPUT ON" : "INPUT";
      setStatus(race.inputTest ? "入力テスト表示をONにしました" : "入力テスト表示をOFFにしました", 1400);
    });
    ui.vsForceEndBtn.addEventListener("click", forceEndRace);
    ui.vsRematchBtn.addEventListener("click", () => {
      hideResult();
      resetRace(true);
    });
    ui.vsCourseBtn.addEventListener("click", () => {
      hideResult();
      resetRace(true);
      ui.vsCourseSelect.focus();
    });
    ui.vsResultCloseBtn.addEventListener("click", hideResult);

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("gamepadconnected", e => {
      setStatus("ゲームパッドを認識しました: " + padLabel(e.gamepad), 2200);
    });
    window.addEventListener("gamepaddisconnected", e => {
      setStatus("ゲームパッドが切断されました: index " + e.gamepad.index, 2600);
    });
    return true;
  }

  function onKeyDown(e) {
    if (!race.enabled || e.repeat) return;
    if (e.code === "Space") {
      e.preventDefault();
      beginCountdown();
    } else if (e.code === "KeyR") {
      resetRace(true);
    } else if (e.code === "Escape") {
      if (race.state === "setup") disableVsRace();
      else resetRace(true);
    } else if (e.code === "KeyF") {
      toggleFullscreen();
    }
  }

  function buildRaceCourses() {
    const tt = typeof TT_CONFIG !== "undefined" ? TT_CONFIG : null;
    const ttCourses = tt && tt.courses ? tt.courses : {};
    const ttRadius = tt && tt.radius ? tt.radius : 90;
    const idx = (key, fallback) => (
      ttCourses[key] && Array.isArray(ttCourses[key].idx)
        ? ttCourses[key].idx.slice()
        : fallback.slice()
    );

    return {
      city_01: {
        id: "city_01",
        type: "fixed",
        title: "千葉ニュータウン中央 スカイライン",
        radius: 130,
        start: { lon: 140.1146, lat: 35.8012, height: DEFAULT_HEIGHT },
        checkpoints: [
          { name: "千葉ニュータウン中央駅", lon: 140.1158, lat: 35.8005, height: 150 },
          { name: "BIG HOP ガーデンモール印西", lon: 140.1623, lat: 35.8032, height: 150 },
          { name: "牧の原公園", lon: 140.1685, lat: 35.7997, height: 150 },
          { name: "印西市役所方面フィニッシュ", lon: 140.1498, lat: 35.8317, height: 160 }
        ]
      },
      cultural_beginner: {
        id: "cultural_beginner",
        type: "cultural",
        title: "文化財 初級3か所",
        radius: ttRadius,
        idx: idx("beginner", [0, 1, 2])
      },
      cultural_intermediate: {
        id: "cultural_intermediate",
        type: "cultural",
        title: "文化財 中級5か所",
        radius: ttRadius,
        idx: idx("intermediate", [0, 1, 2, 3, 4])
      },
      cultural_advanced: {
        id: "cultural_advanced",
        type: "cultural",
        title: "文化財 上級8か所",
        radius: ttRadius,
        idx: idx("advanced", [0, 1, 2, 3, 4, 5, 6, 7])
      },
      cultural_full: {
        id: "cultural_full",
        type: "cultural",
        title: "文化財 全件チャレンジ",
        radius: ttRadius,
        idx: idx("full", Array.from({ length: 50 }, (_, i) => i))
      }
    };
  }

  function refreshCourseOptions(selectedId) {
    RACE_CONFIG.courses = buildRaceCourses();
    ui.vsCourseSelect.textContent = "";
    Object.keys(RACE_CONFIG.courses).forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = RACE_CONFIG.courses[id].title;
      ui.vsCourseSelect.appendChild(option);
    });
    ui.vsCourseSelect.value = selectedId || RACE_CONFIG.defaultCourse;
  }

  function resolveCourse(courseId) {
    const raw = RACE_CONFIG.courses[courseId] || RACE_CONFIG.courses[RACE_CONFIG.defaultCourse];
    if (!raw) return null;
    if (raw.type === "fixed") {
      return {
        id: raw.id,
        type: raw.type,
        title: raw.title,
        radius: raw.radius || DEFAULT_RADIUS,
        start: raw.start,
        checkpoints: raw.checkpoints.map((cp, i) => ({
          order: i + 1,
          name: cp.name,
          lon: Number(cp.lon),
          lat: Number(cp.lat),
          height: Number(cp.height || 140)
        }))
      };
    }

    if (typeof BUNKAZAI === "undefined" || !Array.isArray(BUNKAZAI) || !BUNKAZAI.length) return null;
    const checkpoints = raw.idx
      .map((bunkazaiIndex, order) => {
        const b = BUNKAZAI[bunkazaiIndex];
        if (!b || !Number.isFinite(Number(b.lat)) || !Number.isFinite(Number(b.lon))) return null;
        return {
          order: order + 1,
          sourceIndex: bunkazaiIndex,
          name: b.name || ("文化財 " + (bunkazaiIndex + 1)),
          lon: Number(b.lon),
          lat: Number(b.lat),
          height: 120
        };
      })
      .filter(Boolean);
    if (!checkpoints.length) return null;
    return {
      id: raw.id,
      type: raw.type,
      title: raw.title,
      radius: raw.radius || DEFAULT_RADIUS,
      checkpoints
    };
  }

  function enableVsRace(mode, requestedCourseId) {
    if (!wireUiOnce() || !cesiumReady()) return;
    race.enabled = true;
    race.mode = mode || "cultural-vs";
    window.vsRaceModeEnabled = true;
    document.body.classList.add("vsRaceMode");

    try { if (typeof applyMode === "function") applyMode("event"); } catch (e) {}
    try { if (typeof ttActive !== "undefined" && ttActive && typeof ttAbort === "function") ttAbort(); } catch (e) {}
    try { if (typeof setTonbiVisible === "function") setTonbiVisible(false); } catch (e) {}

    players[0].viewer = mainViewer();
    createSecondViewer();
    players.forEach(p => applyViewerRaceProfile(p));

    const defaultCourse = race.mode === "vs" ? RACE_CONFIG.defaultCityCourse : RACE_CONFIG.defaultCourse;
    refreshCourseOptions(requestedCourseId || query.get("course") || defaultCourse);
    setCourse(ui.vsCourseSelect.value, false);
    startFrameLoop();
    setTimeout(resizeRaceViewers, 80);
  }

  let uiWired = false;
  function wireUiOnce() {
    if (uiWired) return true;
    uiWired = wireUi();
    return uiWired;
  }

  function cesiumReady() {
    return typeof Cesium !== "undefined" && typeof viewer !== "undefined";
  }

  function mainViewer() {
    return typeof viewer !== "undefined" ? viewer : null;
  }

  function noTilesMode() {
    return typeof NO_TILES !== "undefined" && !!NO_TILES;
  }

  function createSecondViewer() {
    if (players[1].viewer) return players[1].viewer;
    const v = new Cesium.Viewer("vsCesium2", {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      shouldAnimate: true,
      requestRenderMode: false,
      contextOptions: { webgl: { preserveDrawingBuffer: false } }
    });
    players[1].viewer = v;
    try { v.scene.backgroundColor = Cesium.Color.fromCssColorString("#020617"); } catch (e) {}
    try { v.scene.screenSpaceCameraController.enableInputs = false; } catch (e) {}
    try { v.scene.skyAtmosphere.show = false; } catch (e) {}
    try { v.scene.postProcessStages.fxaa.enabled = false; } catch (e) {}
    try { v.scene.msaaSamples = 1; } catch (e) {}
    try { v.targetFrameRate = 30; } catch (e) {}
    if (noTilesMode()) addGridToViewer(v, "vs-p2-grid");
    else loadSecondTiles(v);
    v.scene.postRender.addEventListener(() => {
      const now = performance.now();
      if (!race.p2FpsSince) race.p2FpsSince = now;
      race.p2Frames++;
      if (now - race.p2FpsSince >= 500) {
        race.p2Fps = Math.round(race.p2Frames * 1000 / (now - race.p2FpsSince));
        race.p2Frames = 0;
        race.p2FpsSince = now;
      }
    });
    return v;
  }

  function loadSecondTiles(v) {
    if (typeof GOOGLE_3DTILES_URL === "undefined") return;
    Cesium.Cesium3DTileset.fromUrl(GOOGLE_3DTILES_URL, {
      showCreditsOnScreen: true,
      maximumScreenSpaceError: 24,
      dynamicScreenSpaceError: true
    }).then(tiles => {
      v.scene.primitives.add(tiles);
      setStatus("2画面目の3D都市データを読み込みました", 1800);
    }).catch(err => {
      console.warn("VS race P2 tiles failed:", err);
      setStatus("2画面目の3D都市データを読み込めませんでした。検証モードで確認してください", 5000);
      addGridToViewer(v, "vs-p2-grid-fallback");
    });
  }

  function addGridToViewer(v, prefix) {
    const center = { lon: 140.145, lat: 35.805 };
    const span = 0.045;
    for (let i = -4; i <= 4; i++) {
      const lon = center.lon + i * span / 4;
      const lat = center.lat + i * span / 4;
      v.entities.add({
        id: prefix + "-lon-" + i,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([lon, center.lat - span, lon, center.lat + span]),
          width: i === 0 ? 2 : 1,
          material: Cesium.Color.CYAN.withAlpha(i === 0 ? 0.7 : 0.28)
        }
      });
      v.entities.add({
        id: prefix + "-lat-" + i,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([center.lon - span, lat, center.lon + span, lat]),
          width: i === 0 ? 2 : 1,
          material: Cesium.Color.CYAN.withAlpha(i === 0 ? 0.7 : 0.28)
        }
      });
    }
  }

  function applyViewerRaceProfile(player) {
    const v = player.viewer;
    if (!v) return;
    if (!player.restore) {
      player.restore = {
        resolutionScale: v.resolutionScale,
        targetFrameRate: v.targetFrameRate,
        inputs: v.scene && v.scene.screenSpaceCameraController
          ? v.scene.screenSpaceCameraController.enableInputs
          : true,
        fxaa: v.scene && v.scene.postProcessStages && v.scene.postProcessStages.fxaa
          ? v.scene.postProcessStages.fxaa.enabled
          : undefined,
        msaa: v.scene ? v.scene.msaaSamples : undefined
      };
    }
    try { v.resolutionScale = 0.72; } catch (e) {}
    try { v.targetFrameRate = 30; } catch (e) {}
    try { v.scene.screenSpaceCameraController.enableInputs = false; } catch (e) {}
    try { v.scene.postProcessStages.fxaa.enabled = false; } catch (e) {}
    try { v.scene.msaaSamples = 1; } catch (e) {}
  }

  function restoreViewerProfile(player) {
    const v = player.viewer;
    const r = player.restore;
    if (!v || !r) return;
    try { v.resolutionScale = r.resolutionScale; } catch (e) {}
    try { v.targetFrameRate = r.targetFrameRate; } catch (e) {}
    try { v.scene.screenSpaceCameraController.enableInputs = r.inputs; } catch (e) {}
    if (r.fxaa !== undefined) try { v.scene.postProcessStages.fxaa.enabled = r.fxaa; } catch (e) {}
    if (r.msaa !== undefined) try { v.scene.msaaSamples = r.msaa; } catch (e) {}
    player.restore = null;
  }

  function setCourse(courseId, reset) {
    if (!race.enabled) return;
    race.courseId = courseId;
    const course = resolveCourse(courseId);
    if (!course) {
      race.course = null;
      setStatus("文化財データを読み込み中です。少し待ってから開始してください", 2200);
      setTimeout(() => {
        if (race.enabled && race.courseId === courseId) setCourse(courseId, reset);
      }, 500);
      return;
    }
    race.course = course;
    clearMarkers();
    addCourseMarkers();
    resetRace(false);
    if (reset) setStatus("コースを変更しました: " + course.title, 1600);
  }

  function resetRace(showMessage) {
    if (!race.course) return;
    race.state = "setup";
    race.startMs = 0;
    race.countdownStart = 0;
    race.pauseStarted = 0;
    race.pauseTotal = 0;
    race.paused = false;
    race.winnerId = null;
    race.stored = false;
    hideResult();
    hideCountdown();
    players.forEach(p => {
      p.ready = false;
      p.nextIndex = 0;
      p.nextDistance = null;
      p.passed = [];
      p.finished = false;
      p.forced = false;
      p.finishMs = null;
      p.groundTick = 0;
      p.minHeight = MIN_FLIGHT_HEIGHT;
      placePlayerAtStart(p);
      centerPad(p, false);
    });
    if (showMessage) setStatus("スタート位置に戻しました", 1500);
    resizeRaceViewers();
    renderUi(performance.now());
  }

  function placePlayerAtStart(player) {
    if (!race.course || !player.viewer) return;
    const cp = race.course.checkpoints[0];
    const base = race.course.start || offsetMeters(cp, 0, -260, DEFAULT_HEIGHT);
    const laneEast = player.id === 1 ? -42 : 42;
    const start = offsetMeters(base, laneEast, 0, base.height || DEFAULT_HEIGHT);
    const heading = bearingRad(start, cp);
    player.startPoint = start;
    try {
      player.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(start.lon, start.lat, start.height || DEFAULT_HEIGHT),
        orientation: {
          heading,
          pitch: Cesium.Math.toRadians(-7),
          roll: 0
        }
      });
    } catch (e) {
      console.warn("VS race camera start failed:", e);
    }
  }

  function clearMarkers() {
    players.forEach(player => {
      const v = player.viewer;
      if (!v) return;
      player.markerIds.forEach(id => {
        try { v.entities.removeById(id); } catch (e) {}
      });
      player.markerIds = [];
    });
  }

  function addCourseMarkers() {
    if (!race.course) return;
    players.forEach(player => {
      const v = player.viewer;
      if (!v) return;
      const prefix = "vs-p" + player.id + "-";
      const positions = [];
      race.course.checkpoints.forEach((cp, i) => {
        const id = prefix + "cp-" + i;
        player.markerIds.push(id);
        positions.push(Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, cp.height || 120));
        v.entities.add({
          id,
          position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, cp.height || 120),
          point: {
            pixelSize: i === race.course.checkpoints.length - 1 ? 16 : 12,
            color: Cesium.Color.fromCssColorString(player.color),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: (i + 1) + " " + cp.name,
            font: "700 14px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
      });
      const routeId = prefix + "route";
      player.markerIds.push(routeId);
      v.entities.add({
        id: routeId,
        polyline: {
          positions,
          width: 3,
          material: Cesium.Color.fromCssColorString(player.color).withAlpha(0.62)
        }
      });
    });
  }

  function toggleReady(player, fromPad) {
    if (!fromPad) pollPad(player);
    if (race.state !== "setup") return;
    if (!player.connected) {
      setStatus(player.name + " のゲームパッド index " + player.gamepadIndex + " が未接続です", 2200);
      return;
    }
    player.ready = !player.ready;
    if (player.ready) centerPad(player, false);
    setStatus(player.name + (player.ready ? " READY" : " READY解除"), 1300);
    renderUi(performance.now());
  }

  function beginCountdown() {
    if (!race.enabled || !race.course || race.state === "countdown" || race.state === "running") return;
    players.forEach(pollPad);
    const missing = players.filter(p => !p.connected);
    if (missing.length) {
      setStatus("開始できません: " + missing.map(p => p.name).join(" / ") + " が未接続です", 2600);
      renderUi(performance.now());
      return;
    }
    const notReady = players.filter(p => !p.ready);
    if (notReady.length) {
      setStatus("開始できません: 両プレイヤーをREADYにしてください", 2200);
      return;
    }
    hideResult();
    players.forEach(p => {
      p.nextIndex = 0;
      p.nextDistance = null;
      p.passed = [];
      p.finished = false;
      p.forced = false;
      p.finishMs = null;
      placePlayerAtStart(p);
    });
    race.pauseTotal = 0;
    race.paused = false;
    race.winnerId = null;
    race.stored = false;
    race.state = "countdown";
    race.countdownStart = performance.now();
    setStatus("同時スタート準備中", 800);
  }

  function startRace(now) {
    race.state = "running";
    race.startMs = now;
    players.forEach(p => {
      p.ready = true;
      p.finishMs = null;
      p.finished = false;
      p.forced = false;
    });
    hideCountdown();
    setStatus("START", 900);
  }

  function forceEndRace() {
    if (!race.enabled || (race.state !== "running" && race.state !== "countdown")) return;
    const now = effectiveNow(performance.now());
    if (!race.startMs) race.startMs = now;
    players.forEach(p => {
      if (!p.finished) finishPlayer(p, now, true);
    });
    completeRace();
  }

  function finishPlayer(player, now, forced) {
    if (player.finished) return;
    player.finished = true;
    player.forced = !!forced;
    player.finishMs = Math.max(0, now - race.startMs - race.pauseTotal);
    if (!race.winnerId && !forced) race.winnerId = player.id;
    if (!race.winnerId) race.winnerId = player.id;
    setStatus(player.name + (forced ? " END" : " GOAL"), 1300);
  }

  function completeRace() {
    race.state = "finished";
    race.paused = false;
    saveResult();
    showResult();
  }

  function startFrameLoop() {
    if (race.frameId) cancelAnimationFrame(race.frameId);
    race.lastFrame = performance.now();
    race.frameId = requestAnimationFrame(frameLoop);
  }

  function frameLoop(now) {
    if (!race.enabled) return;
    const dt = Math.min(Math.max((now - race.lastFrame) / 1000, 0.001), 0.12);
    race.lastFrame = now;

    players.forEach(pollPad);
    updateCountdown(now);
    updateDisconnectPause(now);

    if (race.state === "running" && !race.paused) {
      players.forEach(p => {
        if (!p.finished && p.connected) {
          movePlayer(p, dt);
          checkCheckpoint(p, now);
        }
      });
      if (players.every(p => p.finished)) completeRace();
    }

    renderUi(now);
    race.frameId = requestAnimationFrame(frameLoop);
  }

  function updateCountdown(now) {
    if (race.state !== "countdown") return;
    const elapsed = now - race.countdownStart;
    const step = COUNTDOWN_STEPS.find(item => elapsed < item.until);
    if (step) showCountdown(step.label);
    else startRace(now);
  }

  function updateDisconnectPause(now) {
    if (race.state !== "running") return;
    const pauseOnDisconnect = ui.vsPauseOnDisconnect && ui.vsPauseOnDisconnect.checked;
    const missing = players.filter(p => !p.connected && !p.finished);
    if (missing.length && pauseOnDisconnect && !race.paused) {
      race.paused = true;
      race.pauseStarted = now;
      setStatus("接続待ち PAUSE: " + missing.map(p => p.name).join(" / "), 1000);
    } else if (!missing.length && race.paused) {
      race.pauseTotal += now - race.pauseStarted;
      race.paused = false;
      race.pauseStarted = 0;
      setStatus("再接続しました。レース再開", 1400);
    } else if (missing.length && !pauseOnDisconnect) {
      setStatus("切断中: " + missing.map(p => p.name).join(" / "), 700);
    }
  }

  function pollPad(player) {
    const pad = gamepadFor(player.gamepadIndex);
    player.lastConnected = player.connected;
    player.connected = !!pad;
    player.padName = pad ? padLabel(pad) : "Gamepad index " + player.gamepadIndex;
    if (!pad) {
      player.input = { lx: 0, ly: 0, rx: 0, ry: 0, up: 0, boost: false };
      player.prevButtons = [];
      return;
    }
    if (!player.centerReady || (!player.lastConnected && player.connected)) centerPad(player, false);
    const lx = normalizeAxis(player, pad, 0, AXIS_DEADZONE);
    const ly = normalizeAxis(player, pad, 1, AXIS_DEADZONE);
    const rx = normalizeAxis(player, pad, 2, LOOK_DEADZONE);
    const ry = normalizeAxis(player, pad, 3, LOOK_DEADZONE);
    const lt = triggerValue(pad, 6);
    const rt = triggerValue(pad, 7);
    player.input = {
      lx,
      ly,
      rx,
      ry,
      up: clamp(rt - lt, -1, 1),
      boost: isPressed(pad, 5) || rt > 0.86
    };

    const readyPressed = justPressed(player, pad, 9) || justPressed(player, pad, 0);
    if (readyPressed && race.state === "setup") toggleReady(player, true);
    if (justPressed(player, pad, 1) && race.state === "finished") {
      hideResult();
      resetRace(true);
    }
    for (let i = 0; i < Math.max(16, pad.buttons.length); i++) {
      player.prevButtons[i] = isPressed(pad, i);
    }
  }

  function gamepadFor(index) {
    try {
      if (typeof readGamepad === "function") return readGamepad(index);
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      return pads[index] || null;
    } catch (e) {
      return null;
    }
  }

  function padLabel(pad) {
    if (!pad) return "";
    return (pad.id || "Gamepad") + " / index " + pad.index;
  }

  function centerPad(player, notify) {
    const pad = gamepadFor(player.gamepadIndex);
    if (!pad) {
      if (notify) setStatus(player.name + " のゲームパッドが未接続です", 1800);
      return false;
    }
    for (let ch = 0; ch < 6; ch++) player.center[ch] = rawChannel(pad, ch);
    player.centerReady = true;
    if (notify) setStatus(player.name + " の中心を合わせました", 1500);
    return true;
  }

  function rawChannel(pad, ch) {
    try {
      if (typeof padRaw === "function") return padRaw(pad, ch);
    } catch (e) {}
    if (ch < 4) return Number(pad.axes[ch] || 0);
    const buttonIndex = ch === 4 ? 6 : 7;
    const button = pad.buttons[buttonIndex];
    return button ? Number(button.value || 0) : 0;
  }

  function normalizeAxis(player, pad, ch, deadzone) {
    const value = rawChannel(pad, ch) - (player.center[ch] || 0);
    const abs = Math.abs(value);
    if (abs < deadzone) return 0;
    return clamp(Math.sign(value) * ((abs - deadzone) / (1 - deadzone)), -1, 1);
  }

  function triggerValue(pad, buttonIndex) {
    const button = pad.buttons[buttonIndex];
    return button ? clamp(Number(button.value || 0), 0, 1) : 0;
  }

  function isPressed(pad, index) {
    return !!(pad.buttons[index] && pad.buttons[index].pressed);
  }

  function justPressed(player, pad, index) {
    return isPressed(pad, index) && !player.prevButtons[index];
  }

  function movePlayer(player, dt) {
    const v = player.viewer;
    if (!v) return;
    const cam = v.camera;
    const flySpeed = typeof FLY_SPEED !== "undefined" ? FLY_SPEED : 30;
    const boost = typeof SPEED_BOOST !== "undefined" ? SPEED_BOOST : 4;
    const speed = flySpeed * (player.input.boost ? boost : 1) * dt;
    const liftSpeed = flySpeed * 0.75 * (player.input.boost ? boost : 1) * dt;
    cam.moveForward(-player.input.ly * speed);
    cam.moveRight(player.input.lx * speed);
    cam.moveUp(player.input.up * liftSpeed);
    if (player.input.rx || player.input.ry) {
      cam.setView({
        orientation: {
          heading: cam.heading + player.input.rx * 1.65 * dt,
          pitch: Cesium.Math.clamp(
            cam.pitch - player.input.ry * 1.25 * dt,
            Cesium.Math.toRadians(-72),
            Cesium.Math.toRadians(34)
          ),
          roll: 0
        }
      });
    }
    keepAboveGround(player);
  }

  function keepAboveGround(player) {
    const v = player.viewer;
    if (!v || !v.camera) return;
    const c = Cesium.Cartographic.fromCartesian(v.camera.position);
    if ((player.groundTick++ % 8) === 0 && v.scene.sampleHeightSupported && !noTilesMode()) {
      try {
        const ground = v.scene.sampleHeight(c.clone());
        if (Number.isFinite(ground)) player.minHeight = Math.max(MIN_FLIGHT_HEIGHT, ground + 12);
      } catch (e) {}
    }
    if (c.height < player.minHeight) {
      const heading = v.camera.heading;
      const pitch = v.camera.pitch;
      v.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, player.minHeight),
        orientation: { heading, pitch, roll: 0 }
      });
    }
  }

  function checkCheckpoint(player, now) {
    if (!race.course || player.nextIndex >= race.course.checkpoints.length) return;
    const cp = race.course.checkpoints[player.nextIndex];
    const here = cameraPoint(player.viewer);
    const distance = distanceMeters(here, cp);
    player.nextDistance = distance;
    if (distance > race.course.radius) return;
    player.passed.push({
      name: cp.name,
      at: new Date().toISOString(),
      splitMs: Math.max(0, now - race.startMs - race.pauseTotal)
    });
    player.nextIndex += 1;
    if (player.nextIndex >= race.course.checkpoints.length) finishPlayer(player, now, false);
    else setStatus(player.name + " CP" + player.nextIndex + " 通過", 1200);
  }

  function cameraPoint(v) {
    const c = Cesium.Cartographic.fromCartesian(v.camera.position);
    return {
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
      height: c.height
    };
  }

  function offsetMeters(point, eastMeters, northMeters, height) {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    const cosLat = Math.max(0.2, Math.cos(Cesium.Math.toRadians(lat)));
    return {
      lon: lon + eastMeters / (111320 * cosLat),
      lat: lat + northMeters / 110540,
      height: height === undefined ? Number(point.height || DEFAULT_HEIGHT) : height
    };
  }

  function bearingRad(from, to) {
    const phi1 = Cesium.Math.toRadians(from.lat);
    const phi2 = Cesium.Math.toRadians(to.lat);
    const lambda1 = Cesium.Math.toRadians(from.lon);
    const lambda2 = Cesium.Math.toRadians(to.lon);
    const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
    return Cesium.Math.zeroToTwoPi(Math.atan2(y, x));
  }

  function distanceMeters(a, b) {
    const r = 6371008.8;
    const p1 = Cesium.Math.toRadians(a.lat);
    const p2 = Cesium.Math.toRadians(b.lat);
    const dp = p2 - p1;
    const dl = Cesium.Math.toRadians(b.lon - a.lon);
    const h = Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function renderUi(now) {
    if (!ui.vsRaceStatus) return;
    const p1 = players[0], p2 = players[1];
    ui.vsHudP1Name.textContent = p1.name;
    ui.vsHudP2Name.textContent = p2.name;
    ui.vsHudP1Time.textContent = formatClock(timeForPlayer(p1, now));
    ui.vsHudP2Time.textContent = formatClock(timeForPlayer(p2, now));
    ui.vsHudP1Next.textContent = nextText(p1);
    ui.vsHudP2Next.textContent = nextText(p2);
    ui.vsP1Status.textContent = playerStatus(p1);
    ui.vsP2Status.textContent = playerStatus(p2);
    ui.vsP1Pad.textContent = p1.padName || "Gamepad index 0";
    ui.vsP2Pad.textContent = p2.padName || "Gamepad index 1";
    ui.vsReadyP1.textContent = p1.ready ? "P1 READY OK" : "P1 READY";
    ui.vsReadyP2.textContent = p2.ready ? "P2 READY OK" : "P2 READY";
    ui.vsStartBtn.disabled = !(race.state === "setup" && p1.connected && p2.connected && p1.ready && p2.ready);
    ui.vsForceEndBtn.disabled = !(race.state === "running" || race.state === "countdown");
    ui.vsFpsP1.textContent = "P1 " + (typeof fpsValue !== "undefined" ? fpsValue : "--") + "fps";
    ui.vsFpsP2.textContent = "P2 " + (race.p2Fps || "--") + "fps";
    ui.vsGoalCount.textContent = players.filter(p => p.finished).length + " / 2 GOAL";
    ui.vsRaceStatus.textContent = statusText(now);
    updateAxisBar(ui.vsP1AxisLX, p1.input.lx);
    updateAxisBar(ui.vsP1AxisLY, p1.input.ly);
    updateAxisBar(ui.vsP2AxisLX, p2.input.lx);
    updateAxisBar(ui.vsP2AxisLY, p2.input.ly);
  }

  function playerStatus(player) {
    if (!player.connected) return "未接続";
    if (player.finished) return player.forced ? "END" : "GOAL";
    if (race.state === "running") return race.paused ? "PAUSE" : "走行中";
    if (player.ready) return "READY";
    return "接続中";
  }

  function nextText(player) {
    if (!race.course) return "CHECKPOINT --";
    if (player.finished) return player.forced ? "END" : "GOAL";
    const cp = race.course.checkpoints[player.nextIndex];
    if (!cp) return "GOAL";
    const dist = player.nextDistance === null ? "--" : Math.round(player.nextDistance) + "m";
    return "CP " + (player.nextIndex + 1) + "/" + race.course.checkpoints.length + " " + cp.name + " " + dist;
  }

  function statusText(now) {
    if (race.message && (!race.messageUntil || now < race.messageUntil)) {
      return race.message;
    }
    race.message = "";
    if (race.inputTest) {
      return "INPUT P1 LX " + players[0].input.lx.toFixed(2) + " LY " + players[0].input.ly.toFixed(2) +
        " / P2 LX " + players[1].input.lx.toFixed(2) + " LY " + players[1].input.ly.toFixed(2);
    }
    if (!race.course) return "コースデータを読み込み中です";
    if (race.state === "setup") {
      if (!players[0].connected || !players[1].connected) return "P1=index0 / P2=index1 のゲームパッドを接続してください";
      if (!players[0].ready || !players[1].ready) return "STARTボタンまたはAボタンで両プレイヤーをREADYにしてください";
      return "SPACEまたはSTARTで同時カウントダウンを開始できます";
    }
    if (race.state === "countdown") return "同時スタート準備中";
    if (race.paused) return "接続待ち PAUSE";
    if (race.state === "running") return race.course.title + " / 順番どおりにチェックポイントを通過";
    if (race.state === "finished") return "RESULT";
    return "2台のゲームパッドを接続してください";
  }

  function updateAxisBar(bar, value) {
    if (!bar) return;
    const v = clamp(value, -1, 1);
    const pct = Math.abs(v) * 50;
    bar.style.left = v < 0 ? (50 - pct) + "%" : "50%";
    bar.style.width = pct + "%";
    bar.style.background = Math.abs(v) > 0.7 ? "#fbbf24" : "#67e8f9";
  }

  function timeForPlayer(player, now) {
    if (!race.startMs) return 0;
    if (player.finishMs !== null) return player.finishMs;
    return Math.max(0, effectiveNow(now) - race.startMs - race.pauseTotal);
  }

  function effectiveNow(now) {
    return race.paused ? race.pauseStarted : now;
  }

  function formatClock(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const milli = Math.floor(ms % 1000);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(milli).padStart(3, "0");
  }

  function showCountdown(text) {
    ui.vsCountdown.textContent = text;
    ui.vsCountdown.classList.add("show");
  }

  function hideCountdown() {
    ui.vsCountdown.textContent = "";
    ui.vsCountdown.classList.remove("show");
  }

  function setStatus(text, holdMs) {
    race.message = text;
    race.messageUntil = holdMs ? performance.now() + holdMs : 0;
    if (ui.vsRaceStatus) ui.vsRaceStatus.textContent = text;
  }

  function showResult() {
    const winner = players.find(p => p.id === race.winnerId);
    ui.vsResultTitle.textContent = winner ? winner.name + " WIN" : "RESULT";
    ui.vsResultSummary.textContent = (race.course ? race.course.title : "2Pレース") +
      " / " + new Date().toLocaleString("ja-JP");
    ui.vsResultRows.innerHTML = players
      .slice()
      .sort((a, b) => (a.finishMs === null ? Infinity : a.finishMs) - (b.finishMs === null ? Infinity : b.finishMs))
      .map(p => {
        const checkpoint = p.passed.length + "/" + (race.course ? race.course.checkpoints.length : 0) +
          (p.forced ? " END" : "");
        return "<tr><td>" + esc(p.name) + "</td><td>" + esc(formatClock(p.finishMs || 0)) +
          "</td><td>" + esc(checkpoint) + "</td></tr>";
      })
      .join("");
    ui.vsResultModal.classList.add("show");
  }

  function hideResult() {
    if (ui.vsResultModal) ui.vsResultModal.classList.remove("show");
  }

  function saveResult() {
    if (race.stored || !race.course) return;
    race.stored = true;
    const record = {
      version: RACE_CONFIG.version,
      savedAt: new Date().toISOString(),
      mode: race.mode,
      courseId: race.course.id,
      courseTitle: race.course.title,
      winnerId: race.winnerId,
      pauseMs: Math.round(race.pauseTotal),
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        gamepadIndex: p.gamepadIndex,
        finished: p.finished,
        forced: p.forced,
        finishMs: p.finishMs,
        checkpoints: p.passed
      }))
    };
    try {
      const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      old.unshift(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(old.slice(0, 50)));
    } catch (e) {
      console.warn("VS race result save failed:", e);
    }
  }

  function esc(text) {
    if (typeof ttEsc === "function") return ttEsc(text);
    return String(text).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function toggleFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function resizeRaceViewers() {
    players.forEach(p => {
      try { if (p.viewer && typeof p.viewer.resize === "function") p.viewer.resize(); } catch (e) {}
    });
  }

  function disableVsRace() {
    race.enabled = false;
    race.state = "idle";
    window.vsRaceModeEnabled = false;
    document.body.classList.remove("vsRaceMode");
    hideCountdown();
    hideResult();
    if (race.frameId) cancelAnimationFrame(race.frameId);
    race.frameId = 0;
    restoreViewerProfile(players[0]);
    try { players[0].viewer && players[0].viewer.resize(); } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.delete("race");
    url.searchParams.delete("course");
    history.replaceState(null, "", url);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function bootRaceFromUrl() {
    if (!wireUiOnce()) return;
    if (RACE_MODE === "solo") {
      try { if (typeof applyMode === "function") applyMode("event"); } catch (e) {}
      setTimeout(() => {
        const ttButton = get("ttBtn");
        if (ttButton) ttButton.click();
      }, 450);
      return;
    }
    if (VS_MODES[RACE_MODE]) {
      enableVsRace(RACE_MODE, query.get("course"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootRaceFromUrl);
  } else {
    bootRaceFromUrl();
  }
})();
