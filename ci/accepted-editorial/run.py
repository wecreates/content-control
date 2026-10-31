"""Verify this reviewed source snapshot and execute first-party fixture tests only."""
from pathlib import Path,PurePosixPath
import hashlib,json,os,re,shutil,subprocess,sys
root=Path(__file__).resolve().parent
def require(ok):
    if not ok:raise RuntimeError('REVIEWED_FIXTURE_GATE_BLOCKED')
require(shutil.disk_usage(root).free>=int(2.5*1024**3))
manifest=root/'SOURCE-MANIFEST.json';digest=hashlib.sha256(manifest.read_bytes()).hexdigest()
require(os.environ.get('REVIEWED_MANIFEST_SHA256')==digest)
if os.environ.get('GITHUB_ACTIONS')=='true':
    expected=os.environ.get('EXPECTED_SOURCE_SHA','');require(re.fullmatch('[a-f0-9]{40}',expected) is not None and expected==os.environ.get('ACTUAL_SOURCE_SHA'))
    require(sys.version_info[:3]==(3,12,3))
    require(subprocess.check_output(['node','--version'],text=True).strip()=='v24.12.0')
data=json.loads(manifest.read_text());require(data['scope']=='FIRST_PARTY_FIXTURES_ONLY' and data['upstream_execution'] is False)
seen=set()
for entry in data['files']:
    rel=PurePosixPath(entry['path']);require(not rel.is_absolute() and '..' not in rel.parts and entry['path'] not in seen);seen.add(entry['path'])
    p=root/entry['path'];require(p.resolve().is_relative_to(root) and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'])
env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','EDITORIAL_TEST_PYTHON':sys.executable,'PUBLICATION_ENABLED':'false','PAID_GENERATION_ENABLED':'false'}
subprocess.run([sys.executable,'-B','release-review/dashboard-candidate/scripts/test_repository_editorial.py'],cwd=root,env=env,check=True,timeout=120)
subprocess.run([sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_*window*.py'],cwd=root/'release-review/dashboard-candidate',env=env,check=True,timeout=120)
subprocess.run(['node','--test','release-review/multiframe-integration/export-editorial-handoff.test.mjs','release-review/multiframe-integration/openmontage-consumer.test.mjs'],cwd=root,env=env,check=True,timeout=120)
print(json.dumps({'status':'FIRST_PARTY_FIXTURES_PASS','scope':'Mocked upstream/media/DB/provider only; not installation or production acceptance','publication_enabled':False,'production_approved':False}))
