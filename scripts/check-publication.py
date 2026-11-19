"""Check staged source for private artifacts and common credential formats.
This is a bounded pre-publication check, not a comprehensive security audit.
"""
from pathlib import Path
import io,re,subprocess,sys,zipfile
root=Path.cwd()
paths=subprocess.check_output(['git','ls-files','--cached','-z']).decode().split('\0')
patterns=[rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{30,}',rb'AIza[0-9A-Za-z_-]{30,}',rb'sk-proj-[A-Za-z0-9_-]{25,}',rb'AKIA[0-9A-Z]{16}']
known=[]
# Optional private file is read locally; its values are never printed.
if len(sys.argv)>1:
 for line in Path(sys.argv[1]).read_text().splitlines():
  if '=' in line:
   k,v=line.split('=',1);v=v.strip().strip('"').strip("'")
   if any(x in k.upper() for x in ['TOKEN','KEY','SECRET','PASSWORD']) and len(v)>=24 and not v.startswith('replace-'):known.append(v.encode())
problems=[]
def inspect(name,data):
 if any(re.search(p,data) for p in patterns) or any(s in data for s in known):problems.append(name+': possible credential')
 if re.search(rb'C:\\\\?Users\\\\?[^\\\r\n]+',data):problems.append(name+': personal absolute path')
for name in filter(None,paths):
 p=Path(name)
 if not p.is_file():continue
 if any(x in p.parts for x in ['artifacts','node_modules','.webguide-local','secrets','.openai']) or (any(x.startswith('.') for x in p.parts[:-1]) and p.parts[0] != '.github'):problems.append(name+': private/cache directory')
 if (p.name.startswith('.env') and p.name!='.env.example') or re.search(r'\.(db|sqlite3?)(-(wal|shm|journal))?$',name) or p.suffix in ['.pem','.key','.log']:problems.append(name+': private artifact')
 data=p.read_bytes();inspect(name,data)
 if p.suffix=='.zip':
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   for n in z.namelist():
    if n.endswith('/'):continue
    if Path(n).name.startswith('.env') or '..' in Path(n).parts:problems.append(name+': unsafe archive member')
    inspect(name+'!'+n,z.read(n))
if problems:
 print('\n'.join(problems));sys.exit(1)
print('Publication scan passed:',len(list(filter(None,paths))),'tracked paths; private-artifact, credential-pattern and archive checks.')
