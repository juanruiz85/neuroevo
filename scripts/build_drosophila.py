#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# build_drosophila.py — pipeline del conectoma larvario de Drosophila
# (Winding et al. 2023, Science 379:eadd9330) al formato compacto de NeuroEvo.
#
# ENTRADA (data/source/larva_winding2023/):
#   larva_neurons.csv       2.956 neuronas: skid, hemisphere, homologue_skid,
#                           cell_type, annotations, level_7_cluster, I/O
#   larva_edges_etype.csv   116.922 aristas: source_skid, target_skid,
#                           synapse_count, etype (ad/aa/dd/da)
# SALIDA (src/lib/sim/data/drosophila_connectome.json):
#   { meta, neurons:[{n,c,t,h,a}], chem:{s,t,w,et} }
#
# REGLAS (documentadas en docs/CONECTOMA-DROSOPHILA.md):
#   · Umbral sináptico: aristas con ≥3 contactos (≈72 % de las sinapsis);
#     EXCEPCIÓN: toda arista que SALE de una neurona sensorial de primer
#     orden se conserva íntegra (los termosensores, p. ej., son solo 10 y
#     sus sinapsis son débiles: sin esta regla quedarían desconectados).
#   · Neurotransmisor NO viene en el dataset → derivado por tipo celular
#     (literatura): sensory/PN/LHN/KC/CN/ascending/pre-DN → ACh;
#     LN/MB-FBN → GABA; MBIN → DA; MBON → ACh; DNs → Glu; RGN → ACh.
#   · et: 0 = transmisión normal (ad/dd); 1 = modulación pre-sináptica
#     (aa/da, factor 0.5 aplicado en TypeScript).
#   · Peso: se guarda el synapse_count crudo; el escalado log2(1+w) con
#     signo por transmisor se calcula en drosophila.ts (como en elegans.ts).
#
# Uso:  python3 scripts/build_drosophila.py
# ─────────────────────────────────────────────────────────────────────────────
import csv
import json
import os
import sys
from collections import Counter, deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source", "larva_winding2023")
OUT = os.path.join(ROOT, "src", "lib", "sim", "data", "drosophila_connectome.json")

# ——— Neurotransmisor por tipo celular (tabla del plan §2) ————————
TX_BY_TYPE = {
    "sensory": "ACh", "PN": "ACh", "PN-somato": "ACh", "LHN": "ACh",
    "KC": "ACh", "CN": "ACh", "ascending": "ACh",
    "pre-DN-VNC": "ACh", "pre-DN-SEZ": "ACh", "MB-FFN": "ACh",
    "LN": "GABA", "MB-FBN": "GABA",
    "MBIN": "DA", "MBON": "ACh",
    "DN-VNC": "Glu", "DN-SEZ": "Glu",
    "RGN": "ACh", "": "ACh",
}

# ——— Prefijo de nombre legible por tipo ————————————————————————————
PREFIX = {
    "sensory": "SEN", "PN": "PN", "PN-somato": "mPN", "LHN": "LHN",
    "KC": "KC", "CN": "CN", "ascending": "ASC",
    "pre-DN-VNC": "pDNV", "pre-DN-SEZ": "pDNS", "MB-FFN": "MBFF",
    "LN": "LN", "MB-FBN": "MBF", "MBIN": "MBIN", "MBON": "MBON",
    "DN-VNC": "DNV", "DN-SEZ": "DNS", "RGN": "RGN", "": "UNK",
}


# ——— Modalidad sensorial de PRIMER orden (campo annotations) ————————
def first_order(ann: str):
    a = ann.split(";")[0].strip()
    m = {
        "olfactory": ("ORN", "olf"),
        "gustatory-external": ("GRN", "gus"),
        "gustatory-pharyngeal": ("GNP", "gnp"),
        "visual": ("PR", "vis"),
        "noci": ("NOC", "noc"),
        "thermo-cold": ("THc", "thc"),
        "thermo-warm": ("THw", "thw"),
        "mechano-Ch": ("MEC", "mec"),
        "mechano-II/III": ("M23", "mec"),
        "proprio": ("PRO", "pro"),
        "respiratory": ("RSP", "rsp"),
        "gut": ("GUT", "gut"),
    }
    return m.get(a)


def main() -> int:
    # 1) Neuronas
    neurons, by_skid = [], {}
    counter = Counter()
    with open(os.path.join(SRC, "larva_neurons.csv")) as f:
        for r in csv.DictReader(f):
            ct = r["cell_type"]
            ann = r["annotations"]
            # Sensor de primer orden: la PRIMERA componente de la anotación es
            # una modalidad exacta y no hay componentes de 2º orden. (Los
            # 'noci', 'mechano-Ch', 'proprio'... de primer orden figuran con
            # cell_type diverso, no solo 'sensory'.)
            fo = None
            if "2nd_order" not in ann:
                fo = first_order(ann)
            if fo:
                prefix, akey = fo
            else:
                prefix = PREFIX[ct]
                akey = ""
            hem = {"left": "L", "right": "R", "": "M"}[r["hemisphere"]]
            counter[(prefix, hem)] += 1
            name = f"{prefix}-{hem}{counter[(prefix, hem)]:02d}"
            # c: 0 sensorial (también si tiene modalidad de primer orden),
            # 2 eferente (DNs), 1 interneurona.
            cls = (
                2 if ct in ("DN-VNC", "DN-SEZ")
                else 0 if (ct == "sensory" or fo)
                else 1
            )
            neu = {"n": name, "c": cls, "t": TX_BY_TYPE[ct], "h": hem, "a": akey}
            by_skid[int(r["skid"])] = neu
            neurons.append(neu)

    skids = sorted(by_skid)
    idx = {s: i for i, s in enumerate(skids)}  # skid → índice compacto

    # 2) Aristas (umbral ≥3 salvo salida de sensorial de primer orden)
    kept, kept_syn, total_syn, self_loops = [], 0, 0, 0
    with open(os.path.join(SRC, "larva_edges_etype.csv")) as f:
        for r in csv.DictReader(f):
            s, t = int(r["source_skid"]), int(r["target_skid"])
            w, et = int(r["synapse_count"]), r["etype"]
            total_syn += w
            if s == t:
                self_loops += 1
                continue
            src_neu = by_skid.get(s)
            if src_neu is None or t not in by_skid:
                continue
            strong = w >= 3
            from_sensor = src_neu["a"] != ""
            if not (strong or from_sensor):
                continue
            kept.append((idx[s], idx[t], w, 0 if et in ("ad", "dd") else 1))
            kept_syn += w

    # 3) Estadísticas de conectividad (informe de validación)
    n = len(neurons)
    adj = [set() for _ in range(n)]
    radj = [set() for _ in range(n)]
    for s, t, _, _ in kept:
        adj[s].add(t)
        radj[t].add(s)
    sensors = [i for i, x in enumerate(neurons) if x["c"] == 0 and x["a"] != ""]
    dns = [i for i, x in enumerate(neurons) if x["c"] == 2]
    seen = set(sensors)
    q = deque(sensors)
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in seen:
                seen.add(v)
                q.append(v)
    reach_dn = sum(1 for i in seen if neurons[i]["c"] == 2)
    isolated = sum(1 for i in range(n) if not adj[i] and not radj[i])

    tx_counts = Counter(x["t"] for x in neurons)
    cls_counts = Counter(x["c"] for x in neurons)
    ann_counts = Counter(x["a"] for x in neurons if x["a"])

    # 4) Serialización
    out = {
        "meta": {
            "species": "Drosophila melanogaster (larva)",
            "paper": "Winding et al. 2023, Science 379(6636):eadd9330",
            "note": (
                "Cerebro larvario completo: 2.956 neuronas / 116.922 aristas "
                "crudas / 352.611 sinapsis. Umbral >=3 contactos (las salidas "
                "de sensores de primer orden se conservan siempre). Sin gap "
                "junctions en la fuente. Neurotransmisor derivado por tipo "
                "celular segun literatura."
            ),
            "provenance": [
                "https://networks.skewed.de/net/fly_larva",
                "Supplementary Data S1 Winding 2023 (validacion cruzada)",
                "scripts/build_drosophila.py (reproducible)",
            ],
            "counts": {
                "neurons": n,
                "chemical": len(kept),
                "synapseContacts": total_syn,
                "synapsesKept": kept_syn,
                "sensory": cls_counts[0],
                "inter": cls_counts[1],
                "motor": cls_counts[2],
                "sensorFirstOrder": len(sensors),
                "reachableFromSensors": len(seen),
                "reachableDNs": reach_dn,
                "isolated": isolated,
                "selfLoopsDropped": self_loops,
            },
            "tx": dict(tx_counts),
            "threshold": 3,
        },
        "neurons": neurons,
        "chem": {
            "s": [e[0] for e in kept],
            "t": [e[1] for e in kept],
            "w": [e[2] for e in kept],
            "et": [e[3] for e in kept],
        },
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size = os.path.getsize(OUT)
    print(f"neuronas:      {n} (sensoriales {cls_counts[0]}, inter {cls_counts[1]}, DNs {cls_counts[2]})")
    print(f"aristas:       {len(kept)} de 116.922 crudas (self-loops fuera: {self_loops})")
    print(f"sinapsis:      {kept_syn} de {total_syn} ({100*kept_syn/total_syn:.1f}%)")
    print(f"sensores 1er orden: {len(sensors)}  {dict(ann_counts)}")
    print(f"alcanzables desde sensores: {len(seen)} ({100*len(seen)/n:.1f}%)")
    print(f"DNs alcanzables: {reach_dn} de {len(dns)}")
    print(f"aisladas (sin aristas): {isolated}")
    print(f"tx: {dict(tx_counts)}")
    print(f"JSON: {size/1024:.0f} KB -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
