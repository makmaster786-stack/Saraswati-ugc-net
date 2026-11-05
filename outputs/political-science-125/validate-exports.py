import json,zipfile,subprocess
from pathlib import Path

root=Path(__file__).resolve().parent
files=sorted((root/'Tests').glob('*.xlsx'))
if not files:raise ValueError('No populated workbooks exist')
for p in files:
    # Artifact export uses prefixed spreadsheet XML; the site's ExcelJS reader
    # expects the equivalent default namespace. Preserve all spreadsheet values.
    with zipfile.ZipFile(p) as z: items={n:z.read(n) for n in z.namelist()}
    with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
        for name,data in items.items():
            if name.endswith('.xml'):
                data=data.replace(b'xmlns:x=',b'xmlns=').replace(b'<x:',b'<').replace(b'</x:',b'</')
            z.writestr(name,data)
print(f'Normalized {len(files)} workbooks for the website reader.')
