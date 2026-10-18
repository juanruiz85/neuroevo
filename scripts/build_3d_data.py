#!/usr/bin/env python3
"""
Build de los datos 3D reales de NeuroEvo (modo «3D — cuerpo y cerebro»).

Produce dos JSON compactos a partir de fuentes públicas:

1. src/lib/sim/data/c_elegans_3d.json
   Posiciones 3D reales de los somas de las 302 neuronas de C. elegans
   (µm). Geometría: WormBase Virtual Worm (C. Grove & P. Sternberg,
   Caltech, dominio público), vía OpenWorm c302 (MIT),
   examples/c302_C_Full.net.nml — el «modelo 3D del gusano» de OpenWorm.

2. src/lib/sim/data/fly_cns_3d.json
   Nube voxelizada de los 141.781 somas con posición del conectoma del
   CNS adulto masculino de D. melanogaster (neuPrint male-cns:v1.0,
   Berg et al., Cell 2026; datos CC BY 4.0) + anclajes anatómicos para
   los 29 grupos del conectoma larvario que simula el motor (Winding
   2023). Binario fuente: malecns-v1.0.flyb.gz del proyecto
   fly-brain-minecraft (github.com/blendi-remade/fly-brain-minecraft,
   código MIT, datos CC BY 4.0).

La nube se normaliza a una caja [0, 32767] por eje y se codifica en
base64 (Uint16 little-endian ×3 por punto + Uint8 de clase) — el mismo
esquema de clases de color que usa el build de bloques de Minecraft
(BrainBuilder.java): 8 clases de superclase neuPrint.

Reproducible: python3 scripts/build_3d_data.py \
  [--nml /home/z/3d-data/c302_C_Full.net.nml] \
  [--flyb /home/z/3d-data/malecns-v1.0.flyb.gz]
"""
import argparse
import base64
import gzip
import io
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

import numpy as np

# 29 grupos del conectoma larvario (prefijos de nombre en
# drosophila_connectome.json; ver docs/MODO-3D.md §anclajes).
LARVAL_GROUPS = [
    "ORN", "GRN", "GNP", "MEC", "M23", "PRO", "THc", "THw", "RSP",
    "NOC", "PR", "GUT", "ASC", "DNV", "DNS", "pDNV", "pDNS",
    "PN", "mPN", "LN", "LHN", "KC", "MBON", "MBIN", "MBF", "MBFF",
    "CN", "RGN", "UNK",
]

# Clases de color (heredadas del build de bloques de Minecraft, mismo orden
# de precedencia que BrainBuilder.classOf).
COLOR_CLASSES = [
    {"key": "other", "label": "Otras / sin clase", "color": "#9ca3af"},
    {"key": "ol", "label": "Lóbulos ópticos", "color": "#22d3ee"},
    {"key": "cb", "label": "Cerebro central", "color": "#e5e7eb"},
    {"key": "vnc", "label": "Cordón nervioso ventral", "color": "#a3e635"},
    {"key": "sens", "label": "Sensoriales (CNS)", "color": "#facc15"},
    {"key": "dn", "label": "Descendentes", "color": "#f87171"},
    {"key": "motor", "label": "Motoras / eferentes", "color": "#fb923c"},
    {"key": "an", "label": "Ascendentes", "color": "#7dd3fc"},
    {"key": "vis", "label": "Visuales (proyección)", "color": "#e879f9"},
]

# Conversión µm → caja 32767 (el worm se dibuja a su escala propia).
NORM = 32767.0


def b64_u16(a: np.ndarray) -> str:
    return base64.b64encode(a.astype("<u2").tobytes()).decode("ascii")


def b64_u8(a: np.ndarray) -> str:
    return base64.b64encode(a.astype(np.uint8).tobytes()).decode("ascii")


def norm_box(pts: np.ndarray) -> np.ndarray:
    """Normaliza [n,3] float a [0, NORM] por eje."""
    mn, mx = pts.min(0), pts.max(0)
    return (pts - mn) / np.maximum(mx - mn, 1e-9) * NORM


# ────────────────────────── 1. C. elegans (c302 NML) ────────────────────────

def build_worm(nml_path: str, out_path: str) -> None:
    tree = ET.parse(nml_path)
    soma = {}
    # El NML usa namespace por defecto; iter() no acepta comodines →
    # filtramos por nombre local de etiqueta.
    def local(tag: str) -> str:
        return tag.split("}")[-1]

    for pop in tree.iter():
        if local(pop.tag) != "population":
            continue
        name = pop.get("id")
        if name is None:
            continue
        # Excluir músculos (MDL01…, MVR…): posiciones de rejilla genérica.
        if re.match(r"^M[DLVR]{2}\d+$", name):
            continue
        loc = next(
            (el for el in pop.iter() if local(el.tag) == "location"), None
        )
        if loc is None:
            continue
        x, y, z = (float(loc.get(k)) for k in ("x", "y", "z"))
        if x == 0.0 and y == 0.0 and z == 0.0:
            continue
        # Normalización de nombres a las familias del conectoma
        # (DA1→DA01: el conectoma del proyecto usa dos dígitos).
        m = re.match(r"^([A-Z]{2})(\d)$", name)
        norm = f"{m.group(1)}0{m.group(2)}" if m else name
        soma[norm] = [round(x, 2), round(y, 2), round(z, 2)]

    data = {
        "meta": {
            "source": "OpenWorm c302 — examples/c302_C_Full.net.nml",
            "geometry": "WormBase Virtual Worm (C. Grove & P. Sternberg, Caltech), dominio público",
            "paper": "Gleeson et al. 2018, Phil. Trans. R. Soc. B 373, doi:10.1098/rstb.2017.0379",
            "units": "µm",
            "axes": "+x izquierda · −y cabeza · +y cola · +z dorsal",
            "note": "Somas reales de las 302 neuronas hermafroditas (incluye CANL/CANR). "
                    "Nombres normalizados a las familias del conectoma (DA1→DA01).",
            "license": "c302 MIT · geometría Virtual Worm dominio público",
            "normalizacion": "DA1→DA01 (conectoma del proyecto con dos dígitos; CANL/CANR extra de c302)",
        },
        "soma": soma,
    }
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"worm: {len(soma)} somas → {out_path}")


# ─────────────────────── 2. Drosophila adulto (FLYB) ────────────────────────

def parse_flyb(path: str):
    buf = io.BytesIO(gzip.open(path, "rb").read())
    rd = lambda fmt: struct.unpack(fmt, buf.read(struct.calcsize(fmt)))
    assert buf.read(4) == b"FLYB", "no es un binario FLYB"
    version, n, n_edges, n_retina = rd("<IIII")
    s16 = lambda: buf.read(rd("<H")[0]).decode("utf8")
    s32 = lambda: buf.read(rd("<I")[0]).decode("utf8")
    dataset, meta_json = s16(), s32()
    table = lambda: [s16() for _ in range(rd("<H")[0])]
    tabs = {
        nm: table()
        for nm in ["types", "superclasses", "classes", "subclasses",
                   "nts", "sides", "dimorphisms", "fruDsx", "neuromeres", "nerves"]
    }
    body_id = np.frombuffer(buf.read(8 * n), dtype="<i8")
    type_idx = np.frombuffer(buf.read(4 * n), dtype="<i4")
    super_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    class_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    sub_idx = np.frombuffer(buf.read(2 * n), dtype="<u2")
    nt_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    nt_sign = np.frombuffer(buf.read(n), dtype=np.int8)
    side_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    hex1 = np.frombuffer(buf.read(n), dtype=np.int8)
    hex2 = np.frombuffer(buf.read(n), dtype=np.int8)
    dimo_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    fru_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    neu_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    nerve_idx = np.frombuffer(buf.read(n), dtype=np.uint8)
    soma = np.frombuffer(buf.read(12 * n), dtype="<f4").reshape(n, 3)
    pre_syn = np.frombuffer(buf.read(4 * n), dtype="<i4")
    post_syn = np.frombuffer(buf.read(4 * n), dtype="<i4")
    # aristas CSR y retina no se necesitan para la geometría, pero la retina sí
    buf.read(4 * (n + 1))           # rowPtr
    buf.read(4 * n_edges)           # postIdx
    buf.read(2 * n_edges)           # weight
    retina = {
        "neuron": np.frombuffer(buf.read(4 * n_retina), dtype="<i4"),
        "kind": np.frombuffer(buf.read(n_retina), dtype=np.uint8),
    }
    return {
        "dataset": dataset, "n": n, "tabs": tabs,
        "type_idx": type_idx, "super_idx": super_idx, "class_idx": class_idx,
        "sub_idx": sub_idx, "neu_idx": neu_idx, "side_idx": side_idx,
        "soma": soma, "retina": retina,
    }


def color_class_of(superclass: str) -> int:
    """Misma precedencia que BrainBuilder.classOf del mod de Minecraft."""
    if superclass.startswith("ol_"):
        return 1
    if superclass == "descending_neuron":
        return 5
    if superclass.endswith("_motor") or superclass.endswith("_efferent"):
        return 6
    if "sensory" in superclass:
        return 4
    if superclass.startswith("ascending"):
        return 7
    if superclass.startswith("vnc_"):
        return 3
    if superclass.startswith("visual_"):
        return 8
    if superclass.startswith("cb_"):
        return 2
    return 0


def build_fly(flyb_path: str, out_path: str, target_cells: int = 15000) -> None:
    F = parse_flyb(flyb_path)
    tabs = F["tabs"]
    n = F["n"]
    soma = F["soma"]
    has_soma = ~np.isnan(soma[:, 0])

    tn = np.array(tabs["types"], dtype=object)[F["type_idx"]]
    cls = np.array(tabs["classes"], dtype=object)[F["class_idx"]]
    sub = np.array(tabs["subclasses"], dtype=object)[F["sub_idx"]]
    sup = np.array(tabs["superclasses"], dtype=object)[F["super_idx"]]

    # ——— Nube voxelizada (dedupe por celdas, mayoría de clase) ————————————
    pos = soma[has_soma]
    sc_names = sup[has_soma]
    ccls = np.array([color_class_of(s) for s in sc_names.tolist()], dtype=np.uint8)
    mn, mx = pos.min(0), pos.max(0)
    span = float((mx - mn).max())

    # Busca el tamaño de rejilla cuyo nº de celdas únicas ~ target_cells.
    for g in range(56, 220, 2):
        cells = np.floor((pos - mn) / span * (g - 1)).astype(np.int64)
        keys = cells[:, 0] * (g * g) + cells[:, 1] * g + cells[:, 2]
        uniq = np.unique(keys)
        if len(uniq) >= target_cells:
            break
    grid = g
    votes = defaultdict(lambda: np.zeros(9, dtype=np.int32))
    for k, c in zip(keys.tolist(), ccls.tolist()):
        votes[k][c] += 1
    rng = np.random.default_rng(20260904)
    keys_all = np.array(sorted(votes.keys()), dtype=np.int64)
    if len(keys_all) > target_cells:
        # submuestreo estratificado por clase de mayoría (preserva minoritarias)
        maj = np.array([int(np.argmax(votes[k])) for k in keys_all.tolist()], dtype=np.uint8)
        pick = np.zeros(len(keys_all), dtype=bool)
        for c in range(9):
            idx = np.where(maj == c)[0]
            want = max(1, int(round(target_cells * (len(idx) / len(keys_all)))))
            if len(idx):
                pick[rng.choice(idx, size=min(want, len(idx)), replace=False)] = True
        keys_all = keys_all[pick]
    cloud_pos = np.zeros((len(keys_all), 3), dtype=np.float64)
    cloud_cls = np.zeros(len(keys_all), dtype=np.uint8)
    for i, k in enumerate(keys_all.tolist()):
        gx, r = divmod(int(k), grid * grid)
        gy, gz = divmod(r, grid)
        cloud_pos[i] = [gx, gy, gz]
        cloud_cls[i] = int(np.argmax(votes[k]))
    # Celda → coordenadas normalizadas [0, 32767] (centro de la celda).
    cloud_norm = np.round(
        (cloud_pos + 0.5) / grid * NORM
    ).clip(0, NORM).astype(np.uint16)
    span_box = (mx - mn)
    anchors_raw = {}

    def anchor_of(mask_total, mask_soma, label, note, fallback=None):
        """Anclaje = centroide de los somas con posición; si el grupo es
        periférico (sin soma), usa el fallback (otra máscara con soma)."""
        n_tot = int(mask_total.sum())
        m = mask_total & mask_soma
        if int(m.sum()) == 0 and fallback is not None:
            m = fallback & mask_soma
            return {
                "posN": [int(x) for x in np.round(norm_of(soma[m]).mean(0))],
                "rN": radius_of(m),
                "n": n_tot, "nSoma": int(m.sum()),
                "family": label, "note": note, "fallback": True,
            }
        if int(m.sum()) == 0:
            raise RuntimeError(f"anclaje sin datos: {label}")
        return {
            "posN": [int(x) for x in np.round(norm_of(soma[m]).mean(0))],
            "rN": radius_of(m),
            "n": n_tot, "nSoma": int(m.sum()),
            "family": label, "note": note, "fallback": False,
        }

    all_norm = norm_box(pos)  # para el fallback difuso
    def norm_of(pts):
        return (pts - mn) / span_box * NORM
    def radius_of(mask):
        p = norm_of(soma[mask])
        if len(p) < 3:
            return 600
        return int(np.round(np.sqrt(((p - p.mean(0)) ** 2).sum(1).mean())))

    # Máscaras por clase/subclase/superclase/tipo (string tables del FLYB).
    def m_class(name):
        return cls == name
    def m_sub(name):
        return sub == name
    def m_super(name):
        return sup == name
    def m_type_pref(*prefixes):
        out = np.zeros(n, dtype=bool)
        for t in tabs["types"]:
            if isinstance(t, str) and any(t.startswith(p) for p in prefixes):
                out |= tn == t
        return out

    # Fallbacks anatómicos reales (con soma):
    alpn = m_class("ALPN")           # neuronas de proyección del lóbulo antenal
    sezpn = m_class("SEZPN")         # zona subesofágica (sabores)
    mbon = m_class("MBON")
    cb_int = m_super("cb_intrinsic")
    cb_endo = m_super("cb_endocrine")

    # Fotoreceptores del sistema real: la tabla retina del binario
    # (kind 3/4/5 = L1/L2/L3, monopolares de la lámina, con soma en el CNS).
    ret = F["retina"]
    l123 = ret["neuron"][np.isin(ret["kind"], (3, 4, 5))]

    descending = m_super("descending_neuron")
    asc = m_super("ascending_neuron")
    # 4 sub-nubes de descendentes a lo largo del eje rostro-caudal (y).
    desc_idx = np.where(descending & has_soma)[0]
    desc_y = soma[desc_idx, 1]
    order = np.argsort(desc_y)
    q = np.array_split(order, 4)
    def desc_mask(qi):
        out = np.zeros(n, dtype=bool)
        out[desc_idx[q[qi]]] = True
        return out

    A = anchors_raw
    A["ORN"] = anchor_of(m_class("olfactory"), has_soma,
        "Sensoriales olfativas (periféricas, antena)",
        "Los ORN adultos viven en la antena (sin soma en el CNS): ancladas a su entrada real, el lóbulo antenal (ALPN).",
        fallback=alpn)
    A["GRN"] = anchor_of(m_class("gustatory"), has_soma,
        "Sensoriales gustativas (periféricas, labello/tarsos)",
        "GRN adultas periféricas: ancladas a la zona subesofágica (SEZ), donde entra el gusto real.",
        fallback=sezpn)
    A["GNP"] = anchor_of(m_class("gustatory") & m_sub("pharyngeal sensillum"), has_soma,
        "Gustativas faríngeas",
        "Sensilos faríngeos adultos: anclados a la SEZ (vía gustativa faríngea).",
        fallback=sezpn)
    A["MEC"] = anchor_of(m_class("mechanosensory"), has_soma,
        "Mecanosensores (órgano de Johnston, cerdas)",
        "Mecanosensores adultos periféricos: anclados a la SEZ.",
        fallback=sezpn)
    A["M23"] = anchor_of(m_class("mechanosensory_tactile"), has_soma,
        "Mecanotáctiles (cerdas)",
        "Cerdas táctiles adultas: ancladas a la SEZ.",
        fallback=sezpn)
    A["PRO"] = anchor_of(m_class("mechanosensory_proprioceptive"), has_soma,
        "Propioceptivas (halteros, placas ciliares)",
        "Propioceptivas del adulto (halteros): las pocas con soma en el CNS marcan la posición real.",
        fallback=sezpn)
    A["THc"] = anchor_of(m_class("thermosensory"), has_soma,
        "Termosensoriales",
        "Termorreceptores adultos (arista): anclados al lóbulo antenal.",
        fallback=alpn)
    A["THw"] = anchor_of(m_class("thermosensory"), has_soma,
        "Termosensoriales (frío)",
        "Como THc: el homólogo adulto vive en la antena; ancladas al lóbulo antenal.",
        fallback=alpn)
    A["RSP"] = anchor_of(m_class("hygrosensory"), has_soma,
        "Higrosensoriales",
        "Higroreceptores adultos: anclados al lóbulo antenal.",
        fallback=alpn)
    A["NOC"] = anchor_of(m_class("chemosensory"), has_soma,
        "Quimiosensoriales multipulpa",
        "Las nociceptivas mdIV larvarias no tienen homólogo etiquetado en el CNS adulto: ancladas a la SEZ (vía quimiosensorial).",
        fallback=sezpn)
    A["PR"] = anchor_of(np.isin(np.arange(n), l123), has_soma,
        "Fotorreceptores / lámina (L1-L3)",
        "Anclaje real: monopolares L1/L2/L3 de la lámina (tabla retina del male-cns). Los fotorreceptores R1-R8 son periféricos.")
    A["GUT"] = anchor_of(m_super("ENS"), has_soma,
        "Sistema nervioso entérico",
        "ENS adulto (pocas células con soma): anclado a la SEZ, la vía viscero-sensorial real.",
        fallback=sezpn)
    A["ASC"] = anchor_of(asc, has_soma, "Ascendentes", "Ascendentes reales del cordón ventral al cerebro (VNC→cerebro).")
    A["DNV"] = anchor_of(desc_mask(0), has_soma, "Descendentes (rostro-caudal 1/4)",
        "Sub-nube real de descendentes (primer cuartil del eje rostro-caudal).")
    A["DNS"] = anchor_of(desc_mask(1), has_soma, "Descendentes (2/4)",
        "Sub-nube real de descendentes (segundo cuartil del eje rostro-caudal).")
    A["pDNV"] = anchor_of(desc_mask(2), has_soma, "Descendentes (3/4)",
        "Sub-nube real de descendentes (tercer cuartil del eje rostro-caudal).")
    A["pDNS"] = anchor_of(desc_mask(3), has_soma, "Descendentes (4/4)",
        "Sub-nube real de descendentes (cuarto cuartil del eje rostro-caudal).")
    A["PN"] = anchor_of(alpn, has_soma, "Neuronas de proyección del lóbulo antenal (ALPN)", "ALPN reales: dendritas en el lóbulo antenal, somas junto a él.")
    A["mPN"] = anchor_of(alpn, has_soma, "PN multiglomerulares", "Comparten la familia ALPN del adulto (anclaje al lóbulo antenal).")
    A["LN"] = anchor_of(m_class("ALIN"), has_soma, "Interneuronas locales del lóbulo antenal", "ALIN reales.")
    A["LHN"] = anchor_of(m_type_pref("LH"), has_soma, "Neuronas del cuerno lateral (LH)", "Familia LH real del adulto.")
    A["KC"] = anchor_of(m_class("Kenyon_Cell"), has_soma, "Células de Kenyon (cuerpo fungiforme)", "Células de Kenyon reales: los lóbulos del cuerpo fungiforme.")
    A["MBON"] = anchor_of(m_class("MBON"), has_soma, "Salidas del cuerpo fungiforme (MBON)", "MBON reales.")
    A["MBIN"] = anchor_of(m_class("DAN"), has_soma, "Dopaminérgicas de entrada al MB (PAM/PPL1)", "DAN reales (recompensa/castigo del aprendizaje asociativo).")
    A["MBF"] = anchor_of(m_class("MBON"), has_soma, "Retroalimentación del cuerpo fungiforme",
        "El feedback del MB larvario se ancla a las MBON adultas.", fallback=mbon)
    A["MBFF"] = anchor_of(m_class("MBON"), has_soma, "Feedforward del cuerpo fungiforme",
        "Ídem MBF: anclaje MBON.", fallback=mbon)
    A["CN"] = anchor_of(m_class("CX"), has_soma, "Cuerpo central (CX)", "Neuronas del cuerpo central reales (orientación espacial).")
    A["RGN"] = anchor_of(cb_endo, has_soma, "Endocrinas (glándula del anillo)",
        "Las RGN larvarias (glándula del anillo) se anclan a las cb_endocrine adultas (glándula del anillo/corpora cardiaca).")
    A["UNK"] = anchor_of(cb_int, has_soma, "Interneuronas centrales (difusas)",
        "Grupo sin anotación del que se conoce su posición: anclado al centro del cerebro central (atenuado en la vista).")

    assert set(A.keys()) == set(LARVAL_GROUPS), (
        f"grupos sin anclaje: {set(LARVAL_GROUPS) - set(A.keys())}")

    # ——— Conteo por clase de color (para la leyenda) ————————————————————
    cnt = Counter(ccls.tolist())
    for i, c in enumerate(COLOR_CLASSES):
        c["n"] = cnt.get(i, 0)

    data = {
        "meta": {
            "dataset": F["dataset"] + " — Berg et al., Cell 189(18), 2026, doi:10.1016/j.cell.2026.08.015",
            "via": "github.com/blendi-remade/fly-brain-minecraft (malecns-v1.0.flyb.gz)",
            "license": "Datos CC BY 4.0 · código de extracción MIT",
            "neuronsTotal": n,
            "neuronsWithSoma": int(has_soma.sum()),
            "cloudCells": int(len(keys_all)),
            "grid": grid,
            "bboxRaw": [[float(v) for v in mn], [float(v) for v in mx]],
            "units": "voxels neuPrint (8 nm) → normalizado a [0, 32767] por eje",
            "frame": "y neuPrint crece ventral; el eje largo (cerebro→cordón) es y. "
                     "El visor lo pone de pie (dorsal arriba), como el build de bloques.",
            "note": "Anatomía: CNS adulto masculino (male-cns). Actividad en vivo: conectoma "
                    "larvario (Winding 2023) simulado por el motor, anclado a las familias "
                    "adultas homólogas — simplificación declarada en docs/MODO-3D.md.",
        },
        "classes": COLOR_CLASSES,
        "cloud": {
            "enc": "b64u16le×3 + b64u8 clase",
            "n": int(len(keys_all)),
            "pos": b64_u16(cloud_norm.reshape(-1)),
            "cls": b64_u8(cloud_cls),
        },
        "anchors": {g: A[g] for g in LARVAL_GROUPS},
    }
    with open(out_path, "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"fly: {int(has_soma.sum())} somas → {len(keys_all)} celdas voxel "
          f"(rejilla {grid}) + {len(A)} anclajes → {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--nml", default="/home/z/3d-data/c302_C_Full.net.nml")
    ap.add_argument("--flyb", default="/home/z/3d-data/malecns-v1.0.flyb.gz")
    ap.add_argument("--out-dir", default="src/lib/sim/data")
    ap.add_argument("--cells", type=int, default=15000)
    args = ap.parse_args()
    build_worm(args.nml, f"{args.out_dir}/c_elegans_3d.json")
    build_fly(args.flyb, f"{args.out_dir}/fly_cns_3d.json", args.cells)


if __name__ == "__main__":
    main()
