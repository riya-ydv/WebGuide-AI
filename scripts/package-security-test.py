"""Exercise the release builder in a disposable folder containing private data."""
from pathlib import Path
import json
import subprocess
import tempfile
import zipfile

script = Path(__file__).with_name("package-release.py").resolve()
with tempfile.TemporaryDirectory(prefix="webguide-package-security-") as directory:
    root = Path(directory)
    files = {
        "START_HERE.md": "Public instructions",
        "app.js": "export const publicApp = true;",
        "submission/Final_Report.pdf": "Public report",
        "stale.pdf": "Private old report",
        ".env": "WEBGUIDE_WORKER_TOKEN=" + "z" * 40,
        "elsewhere/webguide.sqlite": "private",
        "elsewhere/private.db-wal": "private",
        "elsewhere/private.sqlite3-shm": "private",
        "elsewhere/jobs.json": "private",
        ".webguide-local/private": "private",
        "nested/.env.production": "private",
    }
    for name, body in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)
    subprocess.run(["python", str(script)], cwd=root, capture_output=True, text=True, check=True)
    with zipfile.ZipFile(root / "webguide-ai.zip") as archive:
        assert set(archive.namelist()) == {
            "webguide-ai/START_HERE.md", "webguide-ai/app.js", "webguide-ai/FILE_MANIFEST.json", "webguide-ai/submission/Final_Report.pdf"
        }, archive.namelist()
    print(json.dumps({"result": "passed", "privateArtifactsRejected": 8, "publicSourcePreserved": 3}))
