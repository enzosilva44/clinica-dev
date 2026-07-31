from gerar_drawio import build_xml
from paginas import TODAS

pages = [f() for f in TODAS]
xml = build_xml(pages)
with open("mapeamento-sistemico.drawio", "w", encoding="utf-8") as fh:
    fh.write(xml)
print(f"OK - {len(pages)} paginas")
for p in pages:
    print(f"  {p.name}: {len(p.cells)} celulas")
