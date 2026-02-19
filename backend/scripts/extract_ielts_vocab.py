#!/usr/bin/env python3
"""
Extract IELTS vocabulary from ECDICT and produce a JSON file for IELTS-mate.

Output format per word:
{
    "word": "absorb",
    "phonetic": "/əbˈsɔːb/",
    "definition": "v. become imbued; take up mentally ...",
    "translation": "vt. 吸收, 使全神贯注, 同化",
    "pos": "v",
    "collins": 2,
    "oxford": 1,
    "tags": ["ielts", "cet4", "cet6"],
    "bnc": 2879,
    "frq": 3120,
    "exchange": "d:absorbed/p:absorbed/3:absorbs/i:absorbing",
    "example": ""
}

Additionally generates distractor data for four-choice quiz mode:
For each word, we store its Chinese translations which later can be
used to generate wrong options from other words in the same difficulty tier.

Usage:
    python backend/scripts/extract_ielts_vocab.py
"""

import csv
import json
import re
import sys
from pathlib import Path

ECDICT_CSV = Path(__file__).resolve().parents[1] / "data" / "dictionaries" / "ECDICT" / "ecdict.csv"
OUTPUT_FILE = Path(__file__).resolve().parents[1] / "data" / "ielts_vocabulary.json"
STATS_FILE = Path(__file__).resolve().parents[1] / "data" / "ielts_vocab_stats.json"


def clean_phonetic(raw: str) -> str:
    """Normalise phonetic to /.../ format."""
    p = raw.strip()
    if not p:
        return ""
    if not p.startswith("/"):
        p = "/" + p
    if not p.endswith("/"):
        p = p + "/"
    return p


def extract_primary_pos(pos_field: str, translation: str = "") -> str:
    """Extract the dominant part-of-speech from ECDICT pos field or translation prefix."""
    if pos_field.strip():
        parts = pos_field.strip().split("/")
        best_pos = ""
        best_ratio = -1
        for part in parts:
            if ":" in part:
                tag, ratio_str = part.split(":", 1)
                try:
                    ratio = float(ratio_str)
                except ValueError:
                    ratio = 0
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_pos = tag.strip()
        if best_pos:
            return best_pos

    # Fallback: extract from Chinese translation prefix like "vt. ...", "n. ...", "adj. ..."
    if translation:
        m = re.match(r'^(v[it]?|n|adj|adv|prep|conj|pron|a|interj)\.?\s', translation)
        if m:
            pos = m.group(1)
            pos_map = {"a": "adj", "vi": "v", "vt": "v"}
            return pos_map.get(pos, pos)
    return ""


def extract_primary_translation(translation: str) -> str:
    """Extract a clean, concise Chinese translation (first line, remove domain tags)."""
    if not translation:
        return ""
    lines = translation.replace("\\n", "\n").split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Remove domain tags like [医], [化], [计] etc.
        cleaned = re.sub(r'\[.{1,4}\]\s*', '', line)
        cleaned = cleaned.strip()
        if cleaned:
            return cleaned
    return translation.strip()[:200]


def parse_tags(tag_field: str) -> list[str]:
    """Parse space-separated tags."""
    return [t.strip() for t in tag_field.strip().split() if t.strip()]


def assign_difficulty(word_data: dict) -> int:
    """
    Assign a difficulty tier 1-5 based on frequency & exam tags.
    1 = easiest (high freq, basic exams), 5 = hardest (low freq, advanced).
    This helps generate appropriate distractors in quiz mode.
    """
    tags = word_data["tags"]
    bnc = word_data["bnc"]
    frq = word_data["frq"]
    collins = word_data["collins"]

    score = 0

    # Frequency-based
    avg_freq = 0
    if bnc > 0 and frq > 0:
        avg_freq = (bnc + frq) / 2
    elif bnc > 0:
        avg_freq = bnc
    elif frq > 0:
        avg_freq = frq

    if avg_freq > 0:
        if avg_freq <= 2000:
            score += 0
        elif avg_freq <= 5000:
            score += 1
        elif avg_freq <= 10000:
            score += 2
        elif avg_freq <= 20000:
            score += 3
        else:
            score += 4

    # Tag-based complexity
    basic_tags = {"zk", "gk", "cet4"}
    mid_tags = {"cet6", "ky"}
    adv_tags = {"toefl", "gre"}

    if basic_tags & set(tags):
        score += 0
    elif mid_tags & set(tags):
        score += 1
    elif adv_tags & set(tags):
        score += 2

    # Collins star rating (higher = more common)
    if collins >= 4:
        score -= 1
    elif collins <= 1:
        score += 1

    # Clamp to 1-5
    return max(1, min(5, score + 1))


def main():
    if not ECDICT_CSV.exists():
        print(f"Error: ECDICT CSV not found at {ECDICT_CSV}")
        print("Please git clone ECDICT into backend/data/dictionaries/ECDICT/")
        sys.exit(1)

    print(f"Reading ECDICT from {ECDICT_CSV} ...")
    ielts_words = []
    total_rows = 0

    with open(ECDICT_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows += 1
            tag = row.get("tag", "")
            if "ielts" not in tag:
                continue

            word = row.get("word", "").strip()
            if not word:
                continue

            # Skip phrases (containing spaces) and special chars
            if " " in word or len(word) > 40:
                continue

            # Skip words starting with - or ' (affixes, contractions)
            if word.startswith("-") or word.startswith("'"):
                continue

            translation_raw = row.get("translation", "")
            translation = extract_primary_translation(translation_raw)
            if not translation:
                continue

            phonetic = clean_phonetic(row.get("phonetic", ""))
            definition = row.get("definition", "").replace("\\n", "\n").strip()
            pos = extract_primary_pos(row.get("pos", ""), translation)
            tags = parse_tags(tag)

            try:
                collins = int(row.get("collins", 0) or 0)
            except ValueError:
                collins = 0
            try:
                oxford = int(row.get("oxford", 0) or 0)
            except ValueError:
                oxford = 0
            try:
                bnc = int(row.get("bnc", 0) or 0)
            except ValueError:
                bnc = 0
            try:
                frq = int(row.get("frq", 0) or 0)
            except ValueError:
                frq = 0

            exchange = row.get("exchange", "").strip()

            entry = {
                "word": word,
                "phonetic": phonetic,
                "definition": definition[:500] if definition else "",
                "translation": translation,
                "full_translation": translation_raw.replace("\\n", "\n").strip()[:500],
                "pos": pos,
                "collins": collins,
                "oxford": oxford,
                "tags": tags,
                "bnc": bnc,
                "frq": frq,
                "exchange": exchange,
                "example": "",
            }
            entry["difficulty"] = assign_difficulty(entry)
            ielts_words.append(entry)

    # De-duplicate by word (keep first occurrence)
    seen = set()
    unique_words = []
    for w in ielts_words:
        key = w["word"].lower()
        if key not in seen:
            seen.add(key)
            unique_words.append(w)

    # Sort by difficulty then by frequency
    unique_words.sort(key=lambda w: (w["difficulty"], w.get("bnc", 99999) or 99999))

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(unique_words, f, ensure_ascii=False, indent=2)

    # Stats
    difficulty_dist = {}
    for w in unique_words:
        d = w["difficulty"]
        difficulty_dist[d] = difficulty_dist.get(d, 0) + 1

    pos_dist = {}
    for w in unique_words:
        p = w["pos"] or "unknown"
        pos_dist[p] = pos_dist.get(p, 0) + 1

    stats = {
        "total_ecdict_rows": total_rows,
        "ielts_tagged_count": len(ielts_words),
        "unique_words": len(unique_words),
        "difficulty_distribution": {str(k): v for k, v in sorted(difficulty_dist.items())},
        "pos_distribution": dict(sorted(pos_dist.items(), key=lambda x: -x[1])[:10]),
        "sample_words": [w["word"] for w in unique_words[:20]],
    }

    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\n=== Extraction Complete ===")
    print(f"Total ECDICT rows scanned: {total_rows:,}")
    print(f"IELTS-tagged entries: {len(ielts_words):,}")
    print(f"Unique words (de-duplicated): {len(unique_words):,}")
    print(f"Difficulty distribution: {difficulty_dist}")
    print(f"\nOutput: {OUTPUT_FILE}")
    print(f"Stats:  {STATS_FILE}")


if __name__ == "__main__":
    main()
