#!/usr/bin/env python3
"""Analiza frecventei literelor dintr-un text (legea numerelor mari).

Utilizare:
    python3 frecventa_litere.py text_ro.txt [alt_text.txt ...] [--out rezultate]

Pentru fiecare fisier: total litere, litere distincte, frecventa absoluta,
frecventa relativa (probabilitatea), tabel CSV si grafic bar chart + pie chart.
Cu 2+ fisiere se genereaza si un grafic comparativ.
"""
import argparse
import csv
import os
import sys
import unicodedata
from collections import Counter

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Alfabetul limbii romane (31 litere)
ALFABET_RO = list("aăâbcdefghiîjklmnopqrsștțuvwxyz")

# Variantele cu sedila (ş, ţ) sunt unificate cu cele corecte (ș, ț)
NORMALIZARE = {"ş": "ș", "ţ": "ț"}


def citeste_text(cale):
    with open(cale, encoding="utf-8", errors="replace") as f:
        # NFC: compune diacriticele (a + breve -> ă)
        return unicodedata.normalize("NFC", f.read())


def numara_litere(text):
    """Numara doar literele (spatiile, cifrele, punctuatia sunt ignorate), case-insensitive."""
    c = Counter()
    for ch in text.lower():
        ch = NORMALIZARE.get(ch, ch)
        if ch.isalpha():
            c[ch] += 1
    return c


def ordine_litere(contor):
    """Alfabetul romanesc primul, apoi eventualele alte litere (ex. litere straine)."""
    extra = sorted(l for l in contor if l not in ALFABET_RO)
    return ALFABET_RO + extra


def raport(nume, contor):
    total = sum(contor.values())
    distincte = len(contor)
    lipsa = [l for l in ALFABET_RO if contor[l] == 0]
    print(f"\n=== {nume} ===")
    print(f"Total litere: {total}")
    if total < 50000:
        print("ATENTIE: textul are sub 50.000 de litere (cerinta minima).")
    print(f"Litere distincte: {distincte} (din 31 ale alfabetului romanesc)")
    print("Litere lipsa din alfabet:", ", ".join(lipsa) if lipsa else "niciuna")
    print(f"{'litera':<8}{'aparitii':>10}{'p (f. relativa)':>18}")
    for l, n in sorted(contor.items(), key=lambda x: -x[1]):
        print(f"{l:<8}{n:>10}{n / total:>18.5f}")
    return total


def salveaza_csv(cale, contor):
    total = sum(contor.values())
    with open(cale, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["litera", "aparitii", "frecventa_relativa"])
        for l in ordine_litere(contor):
            w.writerow([l, contor[l], f"{contor[l] / total:.6f}"])


def grafic_individual(cale_baza, nume, contor):
    total = sum(contor.values())
    litere = [l for l, _ in sorted(contor.items(), key=lambda x: -x[1])]
    probs = [contor[l] / total for l in litere]

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.bar(litere, probs, color="#3b6fb6")
    ax.set_title(f"Probabilitatea literelor – {nume} (N = {total})")
    ax.set_xlabel("Litera")
    ax.set_ylabel("p = aparitii / total")
    fig.tight_layout()
    fig.savefig(cale_baza + "_bar.png", dpi=150)
    plt.close(fig)

    # Pie: literele sub 1% sunt grupate la "altele" pentru lizibilitate
    mari = [(l, p) for l, p in zip(litere, probs) if p >= 0.01]
    altele = 1 - sum(p for _, p in mari)
    etichete = [l for l, _ in mari] + (["altele"] if altele > 0 else [])
    valori = [p for _, p in mari] + ([altele] if altele > 0 else [])
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.pie(valori, labels=etichete, autopct="%1.1f%%", startangle=90, pctdistance=0.85)
    ax.set_title(f"Distributia literelor – {nume}")
    fig.tight_layout()
    fig.savefig(cale_baza + "_pie.png", dpi=150)
    plt.close(fig)


def grafic_comparativ(cale, rezultate):
    litere = sorted({l for _, c in rezultate for l in c}, key=lambda l: (l not in ALFABET_RO, l))
    n = len(rezultate)
    latime = 0.8 / n
    fig, ax = plt.subplots(figsize=(14, 5))
    for i, (nume, c) in enumerate(rezultate):
        total = sum(c.values())
        xs = [j + i * latime for j in range(len(litere))]
        ax.bar(xs, [c[l] / total for l in litere], latime, label=nume)
    ax.set_xticks([j + 0.4 - latime / 2 for j in range(len(litere))])
    ax.set_xticklabels(litere)
    ax.set_ylabel("p = aparitii / total")
    ax.set_title("Comparatie distributie litere")
    ax.legend()
    fig.tight_layout()
    fig.savefig(cale, dpi=150)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fisiere", nargs="+", help="fisiere .txt (UTF-8)")
    ap.add_argument("--out", default="rezultate", help="director pentru rezultate")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rezultate = []
    for cale in args.fisiere:
        nume = os.path.splitext(os.path.basename(cale))[0]
        contor = numara_litere(citeste_text(cale))
        if not contor:
            sys.exit(f"Niciun caracter alfabetic in {cale}")
        raport(nume, contor)
        baza = os.path.join(args.out, nume)
        salveaza_csv(baza + ".csv", contor)
        grafic_individual(baza, nume, contor)
        rezultate.append((nume, contor))

    if len(rezultate) > 1:
        grafic_comparativ(os.path.join(args.out, "comparatie.png"), rezultate)
    print(f"\nRezultate salvate in: {args.out}/")


if __name__ == "__main__":
    main()
