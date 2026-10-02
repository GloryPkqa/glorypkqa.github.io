import hashlib
import json
from pathlib import Path
import zipfile
import sys

directory = Path(sys.argv[1]).resolve()
destination = (directory / 'runtime').resolve()
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(directory / 'official-server.jar') as bundle:
    for category in ('versions', 'libraries'):
        for line in bundle.read(f'META-INF/{category}.list').decode().splitlines():
            digest, _, relative = line.split('\t')
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination):
                raise ValueError('Bundled path escapes isolated directory')
            contents = bundle.read(f'META-INF/{category}/{relative}')
            if hashlib.sha256(contents).hexdigest() != digest:
                raise ValueError(f'Bundled checksum mismatch: {relative}')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents)
            if category == 'versions':
                game_jar = target
with zipfile.ZipFile(game_jar) as game:
    recipes = {Path(name).stem: json.loads(game.read(name)) for name in game.namelist()
               if name.startswith('data/minecraft/recipes/') and name.endswith('.json')}
    (directory / 'official-recipes.json').write_text(json.dumps(recipes), encoding='utf8')
print('Extracted verified 1.20.4 runtime and recipes in isolated directory')
