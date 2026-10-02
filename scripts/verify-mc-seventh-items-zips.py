"""Read seventh-pass archives using Python's independent ZIP/CRC/UTF-8 reader."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent / "coverage" / "seventh-items-zips"
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
assert len(manifest) == 21
count = 0
for case in manifest:
    with zipfile.ZipFile(root / case["name"]) as archive:
        assert archive.testzip() is None, case["name"]
        assert archive.namelist() == [f["name"] for f in case["files"]]
        for file in case["files"]:
            assert archive.read(file["name"]).decode("utf-8") == file["content"]
            json.loads(file["content"])
            count += 1
print(f"Seventh independent ZIP reader passed: {len(manifest)} archives / {count} files")
