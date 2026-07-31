#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o arquivo .drawio consolidado do mapeamento sistemico do Iasoclin.
Saida: mapeamento-sistemico.drawio (multi-pagina, editavel no diagrams.net)

Cada pagina e montada a partir de uma lista declarativa de nos e arestas,
com coordenadas explicitas para evitar sobreposicao e cruzamento de setas.
"""
import html
import xml.etree.ElementTree as ET
from xml.dom import minidom

# ── Paleta (legenda visual do briefing) ───────────────────────────────────────
AZUL    = "fillColor=#dae8fc;strokeColor=#6c8ebf;"   # acao do usuario
VERDE   = "fillColor=#d5e8d4;strokeColor=#82b366;"   # processamento concluido
AMARELO = "fillColor=#fff2cc;strokeColor=#d6b656;"   # regra / decisao
ROXO    = "fillColor=#e1d5e7;strokeColor=#9673a6;"   # comunicacao / notificacao
LARANJA = "fillColor=#ffe6cc;strokeColor=#d79b00;"   # integracao externa
VERMELHO= "fillColor=#f8cecc;strokeColor=#b85450;"   # erro / risco / incompleto
CINZA   = "fillColor=#f5f5f5;strokeColor=#666666;"   # banco / persistencia
BRANCO  = "fillColor=#ffffff;strokeColor=#000000;"

BORDA_RISCO = "strokeColor=#b85450;strokeWidth=3;dashed=1;"

FONTE = "fontSize=11;align=center;verticalAlign=middle;whiteSpace=wrap;html=1;"

def shp(fill, extra=""):
    return "rounded=1;arcSize=12;" + fill + FONTE + extra

def dec(fill=AMARELO, extra=""):
    return "rhombus;" + fill + FONTE + extra

def db(extra=""):
    return "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;" + CINZA + FONTE + extra

def term(fill, extra=""):
    return "ellipse;" + fill + FONTE + extra


class Page:
    def __init__(self, name):
        self.name = name
        self.cells = []
        self.uid = 0

    def _id(self, prefix="n"):
        self.uid += 1
        return f"{prefix}{self.uid}"

    def node(self, label, x, y, w=200, h=50, style=None, nid=None, parent="1"):
        nid = nid or self._id()
        self.cells.append({
            "kind": "node", "id": nid, "label": label, "style": style or shp(BRANCO),
            "x": x, "y": y, "w": w, "h": h, "parent": parent,
        })
        return nid

    def lane(self, label, x, y, w, h, fill="#f0f0f0"):
        """Swimlane horizontal (raia de responsabilidade)."""
        nid = self._id("lane")
        style = (f"swimlane;horizontal=0;startSize=32;html=1;whiteSpace=wrap;fontSize=12;"
                 f"fontStyle=1;fillColor={fill};strokeColor=#999999;swimlaneFillColor=none;")
        self.cells.append({
            "kind": "node", "id": nid, "label": label, "style": style,
            "x": x, "y": y, "w": w, "h": h, "parent": "1",
        })
        return nid

    def edge(self, src, dst, label="", dashed=False, style_extra=""):
        eid = self._id("e")
        style = ("edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;fontSize=10;"
                 "jumpStyle=arc;jumpSize=8;" + ("dashed=1;" if dashed else "dashed=0;") + style_extra)
        self.cells.append({
            "kind": "edge", "id": eid, "label": label, "style": style,
            "src": src, "dst": dst,
        })
        return eid

    def note(self, text, x, y, w=260, h=70, fill=BRANCO):
        style = ("shape=note;whiteSpace=wrap;html=1;size=14;fontSize=10;align=left;"
                 "verticalAlign=top;spacingLeft=6;spacingTop=2;" + fill)
        return self.node(text, x, y, w, h, style)

    def title(self, text, x=40, y=20, w=900):
        style = "text;html=1;fontSize=20;fontStyle=1;align=left;verticalAlign=middle;"
        return self.node(text, x, y, w, 34, style)

    def subtitle(self, text, x=40, y=54, w=900):
        style = "text;html=1;fontSize=11;align=left;verticalAlign=middle;fontColor=#555555;"
        return self.node(text, x, y, w, 22, style)


def legend(p, x, y):
    """Bloco de legenda padrao, repetido em todas as paginas."""
    items = [
        ("Acao do usuario", AZUL), ("Processamento OK", VERDE),
        ("Regra / decisao", AMARELO), ("Comunicacao", ROXO),
        ("Integracao externa", LARANJA), ("Erro / ponta solta", VERMELHO),
        ("Banco de dados", CINZA),
    ]
    cont = p.node("LEGENDA", x, y, 200, 30 + len(items) * 26 + 44,
                  "swimlane;startSize=26;html=1;fontSize=11;fontStyle=1;"
                  "fillColor=#fbfbfb;strokeColor=#b3b3b3;")
    yy = 32
    for label, fill in items:
        p.node(label, 10, yy, 180, 22, shp(fill, "fontSize=10;"), parent=cont)
        yy += 26
    p.node("--- linha continua = sincrono\n- - - linha tracejada = assincrono",
           10, yy, 180, 38,
           "text;html=1;fontSize=9;align=left;verticalAlign=middle;", parent=cont)
    return cont


def build_xml(pages):
    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net", "type": "device",
        "agent": "iasoclin-mapeamento", "version": "24.7.5",
    })
    for p in pages:
        diagram = ET.SubElement(mxfile, "diagram", {"id": p.name.replace(" ", "_")[:40], "name": p.name})
        model = ET.SubElement(diagram, "mxGraphModel", {
            "dx": "1400", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1",
            "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1",
            "page": "1", "pageScale": "1", "pageWidth": "1654", "pageHeight": "1169",
            "math": "0", "shadow": "0",
        })
        root = ET.SubElement(model, "root")
        ET.SubElement(root, "mxCell", {"id": "0"})
        ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
        for c in p.cells:
            if c["kind"] == "node":
                cell = ET.SubElement(root, "mxCell", {
                    "id": c["id"], "value": c["label"], "style": c["style"],
                    "vertex": "1", "parent": c["parent"],
                })
                ET.SubElement(cell, "mxGeometry", {
                    "x": str(c["x"]), "y": str(c["y"]),
                    "width": str(c["w"]), "height": str(c["h"]), "as": "geometry",
                })
            else:
                cell = ET.SubElement(root, "mxCell", {
                    "id": c["id"], "value": c["label"], "style": c["style"],
                    "edge": "1", "parent": "1", "source": c["src"], "target": c["dst"],
                })
                ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    raw = ET.tostring(mxfile, encoding="unicode")
    return minidom.parseString(raw).toprettyxml(indent="  ")
