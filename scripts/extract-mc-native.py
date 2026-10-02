"""Extract only the hash-verified libraries listed by Mojang's server bundler."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

archive, destination = map(Path, sys.argv[1:3])
destination = destination.resolve()
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as bundle:
    for category in ("versions", "libraries"):
        for line in bundle.read(f"META-INF/{category}.list").decode().splitlines():
            digest, _, relative = line.split("\t")
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination):
                raise ValueError("Bundled path escapes extraction directory")
            contents = bundle.read(f"META-INF/{category}/{relative}")
            if hashlib.sha256(contents).hexdigest() != digest:
                raise ValueError(f"Bundled checksum mismatch: {relative}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents)
            if category == "versions":
                game_jar = target
with zipfile.ZipFile(game_jar) as game:
    recipes = {Path(name).stem: json.loads(game.read(name)) for name in game.namelist()
               if name.startswith("data/minecraft/recipe/") and name.endswith(".json")}
    tags = {name.removeprefix("data/minecraft/tags/item/").removesuffix(".json"): json.loads(game.read(name))
            for name in game.namelist() if name.startswith("data/minecraft/tags/item/") and name.endswith(".json")}
    (destination.parent / "official26-recipes.json").write_text(json.dumps(recipes), encoding="utf8")
    (destination.parent / "official26-tags.json").write_text(json.dumps(tags), encoding="utf8")
print("Verified and extracted official Minecraft server libraries")
