"""Bundle the official, checksum-pinned Persian Vosk model; no runtime download."""
from pathlib import Path
import hashlib, urllib.request, zipfile
ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / 'scripts/vosk-fa.zip'
SHA256 = '977cb5faa538f3a835ccfd35f5f6d8284b5c450b89c700b9bd4736b66536ad46'
if not ARCHIVE.exists():
    with urllib.request.urlopen('https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip', timeout=120) as source, ARCHIVE.open('wb') as out:
        while block := source.read(1024 * 1024):
            out.write(block)
if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != SHA256:
    raise RuntimeError('Persian model checksum mismatch; build stopped')
dest = ROOT / 'android/app/src/main/assets/model-fa'
dest.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(ARCHIVE) as archive:
    for entry in archive.infolist():
        parts = Path(entry.filename).parts
        if parts[0] != 'vosk-model-small-fa-0.42' or '..' in parts or entry.file_size > 200_000_000:
            raise RuntimeError('Unexpected model archive entry')
        target = dest.joinpath(*parts[1:]).resolve()
        target.relative_to(dest.resolve())
        if entry.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(entry))
for name in ['Apache-2.0.txt', 'VOSK-NOTICE.txt']:
    (dest / name).write_bytes((ROOT / 'licenses' / name).read_bytes())
(dest / 'version').write_text(SHA256, encoding='ascii')
print('Verified and bundled Persian offline model: fa-0.42')
