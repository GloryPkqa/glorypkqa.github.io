import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { mount, flush, respond } from "./mc-interaction-runtime.mjs";
import { loadTs } from "./mc-test-runtime.mjs";

const { MC_VERSIONS } = loadTs("../src/lib/mc/give.ts");
const { isMcCatalog } = loadTs("../src/lib/mc/catalog.ts");
const catalogs = Object.fromEntries(MC_VERSIONS.map((v) => [v, JSON.parse(readFileSync(new URL(`../public/mc-data/${v}.json`, import.meta.url), "utf8"))]));
const counts = { catalogIntegrity: 0, playerBoundaries: 0, requestLifecycle: 0, serverEvidence: 0, capeRecovery: 0, versionRecovery: 0 };
function checked(group, callback) { callback(); counts[group]++; }
const input = (ui) => ui.all("input")[0];
const abortWithRejection = (request) => request.signal.addEventListener("abort", () => request.reject(new DOMException("Aborted", "AbortError")), { once: true });
const playerData = (extra = {}, username = "Pkqa") => ({ data: { player: { username, id: "d5ebe79d-588c-4cba-b338-f5f27109ec83", ...extra } } });

// A structurally valid but empty/duplicated/numerically corrupt asset must not
// become a usable catalog or silently feed invalid commands into child tools.
for (const version of MC_VERSIONS) {
  const original = catalogs[version];
  checked("catalogIntegrity", () => assert.equal(isMcCatalog(original, version), true));
  const mutations = [
    (data) => { data.sourceVersion = ""; },
    ...["items", "blocks", "entities", "effects", "enchantments"].flatMap((key) => [
      (data) => { data[key] = []; },
      (data) => { data[key].push({ ...data[key][0] }); },
      (data) => { data[key][0].name = ""; },
      (data) => { data[key][0].displayName = ""; },
    ]),
    ...[0, -1, 1.5].flatMap((number) => [
      (data) => { data.items[0].stackSize = number; },
      (data) => { data.enchantments[0].maxLevel = number; },
    ]),
    (data) => { data.effects[0].id = -1; },
    (data) => { data.effects[0].id = 1.5; },
    (data) => { data.recipes = { diamond: [] }; },
    (data) => { data.recipes = { diamond: [{ ingredients: [], count: 1 }] }; },
    (data) => { data.recipes = { diamond: [{ ingredients: Array(10).fill("stone"), count: 1 }] }; },
    (data) => { data.recipes = { diamond: [{ shape: [[null]], count: 1 }] }; },
    (data) => { data.recipes = { diamond: [{ shape: [[""]], count: 1 }] }; },
    (data) => { data.recipes = { diamond: [{ ingredients: [""], count: 1 }] }; },
    ...[0, -1, 1.5].map((number) => (data) => { data.recipes = { diamond: [{ ingredients: ["stone"], count: number }] }; }),
  ];
  if (original.processingRecipes.length) {
    mutations.push(
      (data) => { data.recipes = {}; },
      (data) => { data.processingRecipes = []; },
      ...[0, -1, 1.5].map((number) => (data) => { data.processingRecipes[0].count = number; }),
      (data) => { data.processingRecipes[0].ticks = -1; },
      (data) => { data.processingRecipes[0].ticks = Infinity; },
      (data) => { data.processingRecipes[0].xp = -0.1; },
      (data) => { data.processingRecipes[0].xp = NaN; },
    );
  }
  for (const mutate of mutations) {
    const data = structuredClone(original); mutate(data);
    checked("catalogIntegrity", () => assert.equal(isMcCatalog(data, version), false));
  }
  const workbench = mount("McWorkbench");
  workbench.edit(workbench.all("select")[0], version); workbench.text();
  const current = workbench.requests.at(-1);
  respond(current, { ...original, items: [] }); await flush();
  checked("catalogIntegrity", () => assert.match(workbench.text(), /暂时无法加载/));
  workbench.button("重新载入").props.onClick(); workbench.text();
  respond(workbench.requests.at(-1), original); await flush();
  checked("catalogIntegrity", () => assert.match(workbench.text(), new RegExp(`已载入 Java ${version.replaceAll(".", "\\.")}`)));
  workbench.unmount();
}

// Full response validation, safe resource URLs, partial texture-cache recovery
// and optional timestamps. JSX escaping is also checked with real React SSR.
for (const bad of [null, [], 0, "broken", {}, { data: null }, { data: { player: null } }]) {
  const ui = mount("PlayerLookup"); ui.tick(0); respond(ui.requests[0], bad); await flush();
  checked("playerBoundaries", () => {
    assert.match(ui.text(), /没有查到这个玩家/);
    assert.doesNotMatch(ui.text(), /Cannot read|TypeError/);
    assert.equal(ui.button("查找玩家").props.disabled, false);
  }); ui.unmount();
}
for (const malformed of [null, {}, [null], [{ name: "textures", value: {} }], [{ name: {}, value: "encoded" }]]) {
  const ui = mount("PlayerLookup"); ui.tick(0); respond(ui.requests[0], playerData({ properties: malformed })); await flush();
  checked("playerBoundaries", () => assert.match(ui.text(), /数据不完整/)); ui.unmount();
}
for (const badJson of [new SyntaxError("Unexpected token secret"), new Error("Failed to fetch")]) {
  const ui = mount("PlayerLookup"); ui.tick(0);
  ui.requests[0].resolve({ ok: true, status: 200, json: async () => { throw badJson; } }); await flush();
  checked("playerBoundaries", () => { assert.match(ui.text(), /玩家查询暂时不可用/); assert.doesNotMatch(ui.text(), /secret|Unexpected token|Failed to fetch/); }); ui.unmount();
}
const skin = "https://textures.minecraft.net/texture/abcd1234";
const capeUrl = "https://textures.minecraft.net/texture/efab9876";
for (const cache of [undefined, null, {}, "yesterday", -1, NaN, Infinity, 1e30, 1700000000]) {
  const ui = mount("PlayerLookup"); ui.tick(0); respond(ui.requests[0], playerData({ meta: { cached_at: cache } })); await flush();
  checked("playerBoundaries", () => {
    assert.match(ui.text(), /找到玩家/); assert.doesNotMatch(ui.text(), /Invalid Date|NaN/);
    assert.equal(ui.text().includes("资料缓存时间"), cache === 1700000000);
    assert.doesNotThrow(() => renderToStaticMarkup(ui.all("section")[0]));
  }); ui.unmount();
}
for (const [properties, rawSkin, expectSkin, expectCape] of [
  [{ textures: { SKIN: { url: skin.replace("https:", "http:") }, CAPE: { url: capeUrl } } }, undefined, true, true],
  [{ textures: { CAPE: { url: capeUrl } } }, undefined, false, true],
  [{ textures: { SKIN: { url: "https://evil.example/texture/abcd" }, CAPE: { url: "javascript:alert(1)" } } }, "https://evil.example/skin.png", false, false],
  [null, skin, true, false],
]) {
  const ui = mount("PlayerLookup"); ui.tick(0);
  respond(ui.requests[0], playerData({ skin_texture: rawSkin, properties: [{ name: "textures", value: btoa(JSON.stringify(properties)) }] })); await flush();
  checked("playerBoundaries", () => {
    assert.equal(ui.text().includes("原始皮肤贴图"), expectSkin);
    assert.equal(ui.text().includes("打开披风原图"), expectCape);
    assert.equal(ui.text().includes("未装备披风"), !expectCape);
    assert.ok(ui.all("a").every((node) => !/^javascript:|evil\.example/.test(node.props.href)));
    if (expectCape && !expectSkin) assert.equal(ui.all("img").some((node) => node.props.src === capeUrl), true);
  }); ui.unmount();
}
for (const [status, message] of [[429, "查询太频繁"], [404, "玩家不存在"], [500, "玩家不存在"]]) {
  const ui = mount("PlayerLookup"); ui.tick(0); respond(ui.requests[0], {}, status); await flush();
  checked("playerBoundaries", () => { assert.match(ui.text(), new RegExp(message)); assert.equal(ui.button("查找玩家").props.disabled, false); }); ui.unmount();
}
const escaped = mount("PlayerLookup"); escaped.tick(0); respond(escaped.requests[0], playerData({}, '<img src=x onerror="bad">')); await flush();
checked("playerBoundaries", () => { const html = renderToStaticMarkup(escaped.all("section")[0]); assert.ok(html.includes("&lt;img")); assert.equal(escaped.all("img").length, 1); }); escaped.unmount();

const imagePlayer = mount("PlayerLookup"); imagePlayer.tick(0); respond(imagePlayer.requests[0], playerData({ skin_texture: skin })); await flush();
const oldAvatar = imagePlayer.all("img").find((node) => node.props.src.startsWith("https://crafthead.net/"));
oldAvatar.props.onError(); oldAvatar.props.onError();
checked("playerBoundaries", () => { assert.equal(imagePlayer.all("svg").length, 1); assert.equal(imagePlayer.all("img").length, 1); assert.equal(imagePlayer.requests.length, 1); });
const oldSkin = imagePlayer.all("img")[0]; oldSkin.props.onError(); oldSkin.props.onError();
checked("playerBoundaries", () => { assert.equal(imagePlayer.all("img").length, 0); assert.match(imagePlayer.text(), /皮肤预览暂不可用/); assert.equal(imagePlayer.all("a").some((node) => node.props.href === skin), true); assert.equal(imagePlayer.requests.length, 1); });
imagePlayer.submit(); respond(imagePlayer.requests[1], playerData({ skin_texture: skin })); await flush();
checked("playerBoundaries", () => { assert.equal(imagePlayer.all("img").length, 2); assert.equal(imagePlayer.all("svg").length, 0); });
imagePlayer.edit(input(imagePlayer), "Notch"); imagePlayer.submit(); respond(imagePlayer.requests[2], playerData({ id: "069a79f4-44e9-4726-a5be-fca90e38aaf5", skin_texture: "https://textures.minecraft.net/texture/1234abcd" }, "Notch")); await flush();
oldAvatar.props.onError(); oldSkin.props.onError();
checked("playerBoundaries", () => { assert.equal(imagePlayer.all("img").length, 2); assert.equal(imagePlayer.all("svg").length, 0); assert.doesNotMatch(imagePlayer.text(), /皮肤预览暂不可用/); }); imagePlayer.unmount();
const rawCape = mount("PlayerLookup"); rawCape.tick(0); respond(rawCape.requests[0], playerData({ properties: [{ name: "textures", value: btoa(JSON.stringify({ textures: { CAPE: { url: capeUrl } } })) }] })); await flush();
const capeImage = rawCape.all("img").find((node) => node.props.src === capeUrl); capeImage.props.onError(); capeImage.props.onError();
checked("playerBoundaries", () => { assert.equal(rawCape.all("img").length, 1); assert.match(rawCape.text(), /披风预览暂不可用/); assert.equal(rawCape.all("a").some((node) => node.props.href === capeUrl), true); assert.equal(rawCape.requests.length, 1); }); rawCape.unmount();

for (const end of ["edit", "new-request", "unmount", "timeout"]) {
  const ui = mount("PlayerLookup"); ui.tick(0); const old = ui.requests[0];
  if (end === "edit") ui.edit(input(ui), "Notch");
  if (end === "new-request") ui.submit();
  if (end === "unmount") ui.unmount();
  if (end === "timeout") { abortWithRejection(old); ui.tick(10000); }
  checked("requestLifecycle", () => assert.equal(old.signal.aborted, true));
  if (end === "new-request") respond(ui.requests[1], playerData({}, "Newest"));
  respond(old, playerData({}, "StalePlayer")); await flush();
  checked("requestLifecycle", () => assert.doesNotMatch(ui.text(), /StalePlayer/));
  if (end === "timeout") {
    checked("requestLifecycle", () => { assert.match(ui.text(), /查询超时/); assert.equal(ui.button("查找玩家").props.disabled, false); });
    ui.submit(); respond(ui.requests[1], playerData({}, "Recovered")); await flush();
    checked("requestLifecycle", () => assert.match(ui.text(), /Recovered/));
  }
  ui.unmount();
}

for (const edition of ["java", "bedrock"]) {
  for (const primary of ["offline", "failure", "malformed", "timeout"]) {
    for (const secondary of ["online", "offline", "failure", "malformed", "timeout"]) {
      const ui = mount("ServerLookup"); if (edition === "bedrock") ui.button("Bedrock Edition").props.onClick();
      ui.edit(input(ui), "example.com"); ui.submit();
      const first = ui.requests[0];
      if (primary === "offline") respond(first, { online: false });
      if (primary === "failure") first.reject(new Error("network"));
      if (primary === "malformed") respond(first, { online: true, players: { online: {} } });
      if (primary === "timeout") { abortWithRejection(first); ui.tick(11000); }
      await flush(); assert.equal(ui.requests.length, 2);
      const second = ui.requests[1];
      if (secondary === "online") respond(second, { online: true, version: "Fallback", players: { online: 2, max: 20 }, motd: { clean: ["&lt;Server&gt;", "&amp; text"] } });
      if (secondary === "offline") respond(second, { online: false });
      if (secondary === "failure") second.reject(new Error("network"));
      if (secondary === "malformed") respond(second, { online: true, motd: { clean: [null] } });
      if (secondary === "timeout") { abortWithRejection(second); ui.tick(11000); }
      await flush();
      checked("serverEvidence", () => {
        assert.equal(ui.button("查询服务器").props.disabled, false);
        if (secondary === "online") { assert.match(ui.text(), /服务器在线/); assert.match(ui.text(), /<Server>/); assert.match(ui.text(), /& text/); }
        else if (secondary === "offline") {
          assert.match(ui.text(), /暂未探测到在线响应/);
          assert.equal(ui.text().includes("两家服务都未探测"), primary === "offline");
          assert.equal(ui.text().includes("首个查询源暂时不可用"), primary !== "offline");
        } else assert.match(ui.text(), primary === "offline" ? /备用源也无法确认/ : /两家状态接口暂时无法访问/);
        assert.doesNotThrow(() => renderToStaticMarkup(ui.all("section")[0]));
      }); ui.unmount();
    }
  }
  for (const finish of ["edit", "edition", "unmount", "new-request"]) {
    const ui = mount("ServerLookup"); if (edition === "bedrock") ui.button("Bedrock Edition").props.onClick();
    ui.edit(input(ui), "old.example.com"); ui.submit(); respond(ui.requests[0], { online: false }); await flush();
    const fallback = ui.requests[1];
    if (finish === "edit") ui.edit(input(ui), "new.example.com");
    if (finish === "edition") ui.button(edition === "java" ? "Bedrock Edition" : "Java Edition").props.onClick();
    if (finish === "unmount") ui.unmount();
    if (finish === "new-request") ui.submit();
    checked("requestLifecycle", () => assert.equal(fallback.signal.aborted, true));
    respond(fallback, { online: true, version: "StaleResponse" }); await flush();
    checked("requestLifecycle", () => assert.doesNotMatch(ui.text(), /StaleResponse/));
    ui.unmount();
  }
}

const manifest = { latest: { release: "26.1", snapshot: "26.2-snapshot" }, versions: [
  { id: "26.2-snapshot", type: "snapshot", releaseTime: "2026-10-02T00:00:00Z" },
  { id: "26.1", type: "release", releaseTime: "2026-03-24T00:00:00Z" },
  { id: "legacy", type: "old_alpha", releaseTime: "2010-07-01T00:00:00Z" },
] };
for (const outcome of ["failure", "malformed", "timeout", "success"]) {
  const ui = mount("VersionFeed"); ui.tick(0); respond(ui.requests[0], manifest); await flush();
  checked("versionRecovery", () => { assert.equal(ui.all("time").length, 1); assert.match(ui.text(), /26\.1/); });
  ui.edit(ui.all("input")[0], true);
  checked("versionRecovery", () => assert.equal(ui.all("time").length, 2));
  ui.button("刷新").props.onClick(); const refresh = ui.requests[1];
  if (outcome === "failure") refresh.reject(new Error("network"));
  if (outcome === "malformed") respond(refresh, { latest: null, versions: [] });
  if (outcome === "timeout") { abortWithRejection(refresh); ui.tick(10000); }
  if (outcome === "success") respond(refresh, { ...manifest, latest: { release: "26.3", snapshot: "26.3" } });
  await flush();
  checked("versionRecovery", () => { assert.equal(ui.button("刷新").props.disabled, false); assert.equal(ui.all("time").length, 2); assert.match(ui.text(), outcome === "success" ? /26\.3/ : /26\.1/); });
  ui.button("刷新").props.onClick(); respond(ui.requests[2], manifest); await flush();
  checked("versionRecovery", () => { assert.doesNotMatch(ui.text(), /超时|格式无法识别|network/); assert.doesNotThrow(() => renderToStaticMarkup(ui.all("section")[0])); });
  ui.unmount();
}
for (const finish of ["new-request", "unmount"]) {
  const ui = mount("VersionFeed"); ui.tick(0); const old = ui.requests[0];
  if (finish === "new-request") { ui.button("正在刷新").props.onClick(); respond(ui.requests[1], manifest); }
  else ui.unmount();
  checked("requestLifecycle", () => assert.equal(old.signal.aborted, true));
  respond(old, { ...manifest, latest: { release: "StaleRelease", snapshot: "StaleSnapshot" } }); await flush();
  checked("requestLifecycle", () => assert.doesNotMatch(ui.text(), /StaleRelease|StaleSnapshot/)); ui.unmount();
}
const unordered = mount("VersionFeed"); unordered.tick(0);
const unorderedManifest = { latest: { release: "release-12", snapshot: "snapshot" }, versions: [
  ...Array.from({ length: 12 }, (_, index) => ({ id: `release-${index + 1}`, type: "release", releaseTime: `2026-${String(index + 1).padStart(2, "0")}-01T00:00:00Z` })),
  { id: "snapshot", type: "snapshot", releaseTime: "2027-01-01T00:00:00Z" },
] };
const originalOrder = unorderedManifest.versions.map((entry) => entry.id);
respond(unordered.requests[0], unorderedManifest); await flush();
checked("versionRecovery", () => { assert.equal(unordered.all("time").length, 8); assert.equal(unordered.all("time")[0].props.dateTime, "2026-12-01T00:00:00Z"); assert.equal(unordered.all("time").at(-1).props.dateTime, "2026-05-01T00:00:00Z"); assert.deepEqual(unorderedManifest.versions.map((entry) => entry.id), originalOrder); });
unordered.edit(unordered.all("input")[0], true);
checked("versionRecovery", () => { assert.equal(unordered.all("time").length, 8); assert.equal(unordered.all("time")[0].props.dateTime, "2027-01-01T00:00:00Z"); assert.equal(unordered.all("time").at(-1).props.dateTime, "2026-06-01T00:00:00Z"); }); unordered.unmount();

let mode = "fail", observers = [], viewers = [];
class Viewer {
  constructor() { this.playerObject = { rotation: {} }; this.disposals = 0; this.renders = 0; viewers.push(this); }
  loadSkin() { if (mode === "pending") return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); return mode === "fail" ? Promise.reject(new Error("texture")) : Promise.resolve(); }
  loadCape() { return Promise.resolve(); }
  render() { this.renders++; }
  dispose() { this.disposals++; }
}
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
  observe() {}
  disconnect() { this.disconnected = true; }
};
function capeMount() {
  const ui = mount("CapePreview", { skinUrl: "skin-a", capeUrl: "cape-a", playerName: "A" }, { imports: { skinview3d: { SkinViewer: Viewer } } });
  ui.all("canvas")[0].props.ref.current = {};
  ui.all("div")[0].props.ref.current = { clientWidth: 100, clientHeight: 150 };
  return ui;
}
const cape = capeMount(); await flush();
checked("capeRecovery", () => { assert.equal(cape.all("canvas")[0].props.hidden, true); assert.equal(viewers[0].disposals, 1); });
const fallbackImage = cape.all("img")[0]; fallbackImage.props.onError(); fallbackImage.props.onError();
checked("capeRecovery", () => { assert.equal(cape.all("img").length, 0); assert.match(cape.text(), /披风预览暂不可用/); });
mode = "success"; cape.props({ skinUrl: "skin-b", capeUrl: "cape-b", playerName: "B" }); await flush();
checked("capeRecovery", () => { assert.equal(cape.all("canvas")[0].props.hidden, false); assert.equal(cape.all("img").length, 0); });
cape.props({ skinUrl: "skin-a", capeUrl: "cape-a", playerName: "A" }); await flush();
checked("capeRecovery", () => { assert.equal(cape.all("canvas")[0].props.hidden, false); assert.equal(cape.all("img").length, 0); });
const activeViewer = viewers.at(-1); const observer = observers.at(-1); observer.callback();
checked("capeRecovery", () => assert.equal(activeViewer.renders, 2));
cape.unmount(); observer.callback();
checked("capeRecovery", () => { assert.equal(activeViewer.disposals, 1); assert.equal(activeViewer.renders, 2); assert.equal(observer.disconnected, true); });
for (const result of ["resolve", "reject"]) {
  mode = "pending"; const ui = capeMount(); await flush(); const old = viewers.at(-1);
  ui.props({ skinUrl: "skin-b", capeUrl: "cape-b", playerName: "B" }); await flush(); const newer = viewers.at(-1);
  old[result](result === "reject" ? new Error("old failure") : undefined); await flush();
  checked("capeRecovery", () => { assert.equal(old.disposals, 1); assert.equal(ui.all("canvas")[0].props.hidden, false); });
  newer.resolve(); await flush(); ui.unmount();
  checked("capeRecovery", () => assert.equal(newer.disposals, 1));
  const pending = capeMount(); await flush(); const last = viewers.at(-1); pending.unmount(); last[result](result === "reject" ? new Error("late failure") : undefined); await flush();
  checked("capeRecovery", () => { assert.equal(last.disposals, 1); assert.equal(last.renders, 0); });
}
console.log("Seventh-pass network/profile checks passed:", JSON.stringify(counts), "total", Object.values(counts).reduce((a, b) => a + b, 0));
