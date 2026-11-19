from pathlib import Path
import zipfile, subprocess
subprocess.run(["node", "scripts/build-assistance.mjs"],check=True)
root=Path("browser-extension")
files=["manifest.json","background.js","popup.html","popup.js","page-assistance.js","companion.js","README.md"]
files += [f"icons/webguide-{size}.png" for size in (16, 32, 48, 128)]
with zipfile.ZipFile("public/webguide-companion.zip","w",zipfile.ZIP_DEFLATED) as z:
 for name in files:z.write(root/name,"webguide-companion/"+name)
 z.write("docs/EXTENSION_QUICK_START.md","webguide-companion/START_HERE.md")
with zipfile.ZipFile("public/webguide-companion.zip") as z:
 assert z.testzip() is None
 assert all("webguide-companion/"+name in z.namelist() for name in files)
print("Companion download packaged and verified")
