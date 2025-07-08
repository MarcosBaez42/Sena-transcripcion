#!/usr/bin/env python3
"""Extrae el texto del Reglamento del Aprendiz en PDF y genera un JSON.

Uso:
  python scripts/extraer_reglamento.py ruta/al/reglamento.pdf config/reglamento.json

El archivo JSON contendrá un objeto ``articulos`` cuyas claves siguen el formato
"CAPITULO III - Articulo 8 - Numeral 6".
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict

from pdfminer.high_level import extract_text


CAPITULO_RE = re.compile(r"CAP[IÍ]TULO\s+([IVXLCDM]+)", re.IGNORECASE)
ARTICULO_RE = re.compile(r"ART[IÍ]CULO\s+(\d+)", re.IGNORECASE)
NUMERAL_RE = re.compile(r"^(\d+)\.")


def analizar_texto(texto: str) -> Dict[str, str]:
    """Devuelve un mapeo de claves de articulo a su texto."""
    articulos: Dict[str, str] = {}
    capitulo = None
    articulo = None
    for linea in texto.splitlines():
        linea = linea.strip()
        if not linea:
            continue
        m = CAPITULO_RE.match(linea)
        if m:
            capitulo = f"CAPITULO {m.group(1)}"
            continue
        m = ARTICULO_RE.match(linea)
        if m:
            articulo = f"Articulo {m.group(1)}"
            continue
        m = NUMERAL_RE.match(linea)
        if m and capitulo and articulo:
            numero = m.group(1)
            contenido = linea[m.end():].strip()
            clave = f"{capitulo} - {articulo} - Numeral {numero}"
            articulos[clave] = contenido
    return articulos


def main() -> None:
    if len(sys.argv) < 3:
        print("Uso: python scripts/extraer_reglamento.py REG.pdf salida.json")
        sys.exit(1)
    pdf_path = Path(sys.argv[1])
    json_path = Path(sys.argv[2])

    texto = extract_text(str(pdf_path))
    articulos = analizar_texto(texto)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump({"articulos": articulos}, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()