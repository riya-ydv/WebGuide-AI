"""Build and verify a private-data-free WebGuide AI source bundle."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path.cwd()
try:
    candidates = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        stderr=subprocess.DEVNULL,
    ).decode().split("\0")
except subprocess.CalledProcessError:
    candidates = [str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()]
excluded = {"node_modules", "local-runtime", "artifacts", ".git", ".output", ".nitro",
            ".tanstack", ".webguide-local", "release", ".wrangler", ".codex", ".agents", "__pycache__"}
secrets = []
env = root / ".env"
for line in (env.read_text() if env.exists() else "").splitlines():
    if "=" in line:
        key, value = line.split("=", 1)
        if ("KEY" in key or "TOKEN" in key) and len(value.strip()) >= 24:
            secrets.append(value.strip().encode())
# Assemble the legacy-name detector without embedding a legacy label in this bundle.
old_name = re.compile("mal" + r"kin[\s_\-]*ji", re.IGNORECASE)
paths = []
for filename in sorted(set(candidates)):
    path = Path(filename)
    if not filename or not path.is_file() or excluded.intersection(path.parts) or (any(part.startswith(".") for part in path.parts[:-1]) and path.parts[0] != ".github"):
        continue
    if path.name == "WebGuide_AI_Gap_to_Feature_Mapping.docx" or any(part.startswith(".source-") for part in path.parts):
        continue
    if path.name.startswith(".env") and path.name != ".env.example":
        continue
    if (path.suffix in {".zip", ".patch", ".log", ".pyc", ".pdf"} and path.as_posix() != "public/webguide-companion.zip" and not (path.suffix == ".pdf" and path.parts[0] == "submission")) or path.name.endswith(".sha256") or path.name == "bun.lock":
        continue
    # Data directories are configurable: exclude private stores even outside the default directory.
    private_name = path.name.lower()
    if re.search(r"\.(?:sqlite3?|db)(?:-(?:wal|shm|journal))?$", private_name) or private_name == "jobs.json":
        continue
    if path.is_symlink():
        raise ValueError("Symlink not allowed in source bundle: " + filename)
    content = path.read_bytes()
    if any(secret in content for secret in secrets):
        raise ValueError("Credential detected in source: " + filename)
    if old_name.search(path.as_posix()) or any(old_name.search(content.decode(encoding, errors="ignore")) for encoding in ("utf-8", "utf-16-le")):
        raise ValueError("Legacy branding detected in source: " + filename)
    paths.append(path)
archive = root / "webguide-ai.zip"
# Writing a temporary archive also normalises filename casing on Windows.
temporary = root / "release" / "webguide-ai.pending.zip"
temporary.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as bundle:
    for path in paths:
        info = zipfile.ZipInfo.from_file(path, "webguide-ai/" + path.as_posix())
        info.create_system = 3
        info.external_attr = ((0o100755 if path.suffix in {".command", ".sh"} else 0o100644) << 16)
        info.compress_type = zipfile.ZIP_DEFLATED
        content = path.read_bytes()
        if path.suffix in {".command", ".sh"}:
            assert b"\r\n" not in content, "Mac launcher needs LF line endings: " + str(path)
        bundle.writestr(info, content)
    manifest = {path.as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    bundle.writestr("webguide-ai/FILE_MANIFEST.json", json.dumps(manifest, indent=2))
with zipfile.ZipFile(temporary) as bundle:
    assert bundle.testzip() is None
    manifest = json.loads(bundle.read("webguide-ai/FILE_MANIFEST.json"))
    for name, digest in manifest.items():
        assert hashlib.sha256(bundle.read("webguide-ai/" + name)).hexdigest() == digest
    assert "webguide-ai/START_HERE.md" in bundle.namelist()
    bundle.extractall(root / "release" / "check")
if archive.exists():
    archive.unlink()
temporary.replace(archive)
checksum = root / "webguide-ai.zip.sha256"
if checksum.exists():
    checksum.unlink()
checksum.write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  webguide-ai.zip\n")
print(f"ZIP validated: {len(paths)} source files; {archive.stat().st_size} bytes; name, manifest and credential checks passed")
