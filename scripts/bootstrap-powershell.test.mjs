import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

test(
  "Windows bootstrap hash and confined ZIP extraction work without optional PowerShell modules",
  { skip: process.platform !== "win32" },
  async () => {
    const root = process.cwd();
    const runtime = path.join(root, ".webguide-local");
    await fs.mkdir(runtime, { recursive: true });
    const fixture = await fs.mkdtemp(path.join(runtime, "bootstrap-test-"));
    await fs.mkdir(path.join(fixture, "source"));
    await fs.writeFile(path.join(fixture, "source", "fixture.txt"), "checksum fixture");
    const expected = createHash("sha256").update("checksum fixture").digest("hex");
    const longEntry = "nested/" + "a".repeat(90) + "/" + "b".repeat(90) + "/fixture.txt";
    const script = `
$ErrorActionPreference='Stop'
$bootstrap = [IO.File]::ReadAllText([IO.Path]::Combine($env:WEBGUIDE_TEST_ROOT,'scripts','bootstrap-node.ps1'))
$prefix = $bootstrap.Substring(0,$bootstrap.IndexOf('$projectRoot ='))
. ([ScriptBlock]::Create($prefix))
$fixture = $env:WEBGUIDE_TEST_FIXTURE
$actual = Get-ArchiveSha256 ([IO.Path]::Combine($fixture,'source','fixture.txt'))
if ($actual -ne '${expected}') { throw 'Hash regression' }
[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$archive = [IO.Path]::Combine($fixture,'fixture.zip')
[IO.Compression.ZipFile]::CreateFromDirectory([IO.Path]::Combine($fixture,'source'),$archive)
$zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.CreateEntry('${longEntry}')
  $writer = [IO.StreamWriter]::new($entry.Open())
  try { $writer.Write('long path fixture') } finally { $writer.Dispose() }
} finally { $zip.Dispose() }
& ([IO.Path]::Combine($env:WEBGUIDE_TEST_ROOT,'scripts','extract-runtime.ps1')) -Archive $archive -Destination ([IO.Path]::Combine($fixture,'output'))
if ([IO.File]::ReadAllText([IO.Path]::Combine($fixture,'output','fixture.txt')) -ne 'checksum fixture') { throw 'Extraction regression' }
'PASS'
`;
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PSModulePath: path.join(fixture, "no-modules"),
          WEBGUIDE_TEST_ROOT: root,
          WEBGUIDE_TEST_FIXTURE: fixture,
        },
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
    const longFile = path.join(fixture, "output", longEntry);
    assert.ok(longFile.length > 260);
    assert.equal(await fs.readFile(longFile, "utf8"), "long path fixture");
  },
);
