// A tiny ZIP store writer for the JSON-only data packs generated in the browser.
// It keeps GitHub Pages hosting fully static and avoids a runtime dependency.
export function zipFiles(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  const paths = new Set<string>();
  let offset = 0;
  if (files.length > 0xffff) throw new Error("ZIP 文件数量超过格式上限");

  function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const file of files) {
    if (!file.name || file.name.startsWith("/") || /^[a-z]:/i.test(file.name) || file.name.split("/").some((part) => !part || part === ".." || part === ".") || file.name.includes("\\") || file.name.includes("\0")) throw new Error("ZIP 路径无效");
    if (paths.has(file.name)) throw new Error("ZIP 中存在重复路径");
    paths.add(file.name);
    const name = encoder.encode(file.name);
    const body = encoder.encode(file.content);
    if (name.length > 0xffff) throw new Error("ZIP 文件名超过格式长度上限");
    if (body.length > 0xffffffff || offset + 30 + name.length + body.length > 0xffffffff) throw new Error("ZIP 内容超过格式大小上限");
    const crc = crc32(body);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, body.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, body);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, body.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + body.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  if (directorySize > 0xffffffff || offset + directorySize + 22 > 0xffffffff) throw new Error("ZIP 内容超过格式大小上限");
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const part of [...chunks, ...directory, end]) { result.set(part, at); at += part.length; }
  return result;
}
