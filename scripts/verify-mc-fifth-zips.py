"""Independently read the real ZIP blobs exported by the fifth UI regression."""
import json
from pathlib import Path
import zipfile

FORMATS = {"1.16.5": 6, "1.17": 7, "1.20.4": 26, "1.20.6": 41,
           "1.21.5": 71, "1.21.8": 81, "26.1": 101}
root = Path(__file__).resolve().parent.parent / "coverage" / "fifth-downloads"
assert {p.stem for p in root.glob("*.zip")} == set(FORMATS)
for version, expected_format in FORMATS.items():
    modern_path = version in {"1.21.5", "1.21.8", "26.1"}
    recipe_path = f"data/edited/{'recipe' if modern_path else 'recipes'}/lucky_diamond.json"
    loot_path = f"data/edited/{'loot_table' if modern_path else 'loot_tables'}/starter_gift.json"
    with zipfile.ZipFile(root / f"{version}.zip") as archive:
        assert archive.testzip() is None, version
        assert len(archive.infolist()) == 3, version
        assert set(archive.namelist()) == {"pack.mcmeta", recipe_path, loot_path}, version
        files = {name: json.loads(archive.read(name).decode("utf-8")) for name in archive.namelist()}
    meta = files["pack.mcmeta"]["pack"]
    assert meta["pack_format"] == expected_format, version
    assert meta["description"] == "由 Pkqa MC 工具工坊制作", version
    if version == "26.1":
        assert meta["min_format"] == meta["max_format"] == [101, 1]
    recipe = files[recipe_path]
    assert recipe["pattern"] == ["AAA", " B ", " C "], version
    assert recipe["result"] == {"item" if version in {"1.16.5", "1.17", "1.20.4"} else "id": "minecraft:diamond_sword", "count": 1}, version
    assert recipe["key"]["A"] == ("minecraft:diamond" if modern_path else {"item": "minecraft:diamond"}), version
    entries = files[loot_path]["pools"][0]["entries"]
    assert entries[0]["name"] == "minecraft:diamond" and entries[0]["weight"] == 3, version
    assert entries[1]["functions"] == [{"function": "minecraft:set_count", "count": 4}], version
print("Independent ZIP reader passed: 7 archives / 21 files (CRC, UTF-8, paths, JSON)")
