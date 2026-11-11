#!/usr/bin/env python3
"""
merge_longman_lexicon.py
Deduplicates and appends all Longman-scale batches to project-desk/server/internal/desk/vocab_extra.txt
"""

import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SCRIPT_DIR)

from longman_batches.batch_a import WORDS_A
from longman_batches.batch_b_c import WORDS_B_C
from longman_batches.batch_d_e_f import WORDS_D_E_F
from longman_batches.batch_e_g_h import WORDS_E_G_H
from longman_batches.batch_f import WORDS_F
from longman_batches.batch_i_to_l import WORDS_I_TO_L
from longman_batches.batch_m_to_p import WORDS_M_TO_P
from longman_batches.batch_q_to_z import WORDS_Q_TO_Z
from longman_batches.batch_everyday_core import WORDS_EVERYDAY_CORE

VOCAB_EXTRA_PATH = os.path.join(
    SCRIPT_DIR, "../server/internal/desk/vocab_extra.txt"
)
IELTS_WORDS_PATH = os.path.join(
    SCRIPT_DIR, "../server/internal/desk/ielts_words.go"
)
VOCAB_WORLD_PATH = os.path.join(
    SCRIPT_DIR, "../server/internal/desk/vocab_world.go"
)

VALID_POS = {"n", "v", "vi", "adj", "adv"}


def main():
    # 1. Read existing headwords in ielts_words.go
    ielts_words = set()
    with open(IELTS_WORDS_PATH, "r", encoding="utf-8") as f:
        for m in re.finditer(r'\{\"([a-zA-Z\s-]+)\",', f.read()):
            w = m.group(1).strip().lower()
            if " " not in w:
                ielts_words.add(w)

    print(f"Existing in ielts_words.go: {len(ielts_words)} headwords")

    # 2. Read existing headwords in vocab_world.go
    world_words = set()
    with open(VOCAB_WORLD_PATH, "r", encoding="utf-8") as f:
        for m in re.finditer(r'Word:\s*\"([a-zA-Z-]+)\"', f.read()):
            world_words.add(m.group(1).strip().lower())

    print(f"Existing in vocab_world.go: {len(world_words)} headwords")

    # 3. Read existing headwords in vocab_extra.txt
    existing_extra = set()
    existing_lines = []
    with open(VOCAB_EXTRA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split("\t")
            if len(parts) >= 1 and parts[0]:
                word = parts[0].strip().lower()
                if (
                    word not in existing_extra
                    and word not in ielts_words
                    and word not in world_words
                ):
                    existing_extra.add(word)
                    existing_lines.append(stripped)

    print(f"Existing in vocab_extra.txt: {len(existing_extra)} headwords")

    all_existing = existing_extra | ielts_words | world_words
    print(
        f"Total unique headwords currently in codebase: {len(all_existing)}"
    )

    # 4. Gather and validate all batches
    all_batch_entries = (
        WORDS_A
        + WORDS_B_C
        + WORDS_D_E_F
        + WORDS_E_G_H
        + WORDS_F
        + WORDS_I_TO_L
        + WORDS_M_TO_P
        + WORDS_Q_TO_Z
        + WORDS_EVERYDAY_CORE
    )

    new_entries = []
    seen = set(all_existing)

    for entry in all_batch_entries:
        if len(entry) != 3:
            continue
        word, meaning, pos = entry
        word = word.strip().lower()
        meaning = meaning.strip()
        pos = pos.strip().lower()

        if not word or not meaning or not pos:
            continue
        if not word.isalpha():
            continue
        if pos not in VALID_POS:
            continue
        if word in seen:
            continue

        seen.add(word)
        new_entries.append((word, meaning, pos))

    print(f"New unique valid entries to add: {len(new_entries)}")

    # 5. Write deduplicated lines
    with open(VOCAB_EXTRA_PATH, "w", encoding="utf-8") as f:
        for line in existing_lines:
            f.write(line + "\n")
        for word, meaning, pos in new_entries:
            f.write(f"{word}\t{meaning}\t{pos}\n")

    # 6. Recalculate and print final totals
    final_extra = set()
    final_extra_count = 0
    with open(VOCAB_EXTRA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split("\t")
            if len(parts) >= 1 and parts[0]:
                final_extra.add(parts[0].strip().lower())
                final_extra_count += 1

    final_unique_total = final_extra | ielts_words | world_words

    print("\n--- FINAL VOCABULARY STATISTICS ---")
    print(f"Lines in vocab_extra.txt: {final_extra_count}")
    print(f"Unique headwords in vocab_extra.txt: {len(final_extra)}")
    print(f"Unique headwords in ielts_words.go: {len(ielts_words)}")
    print(f"Unique headwords in vocab_world.go: {len(world_words)}")
    print(f"OVERALL UNIQUE HEADWORDS: {len(final_unique_total)}")
    print("-----------------------------------")


if __name__ == "__main__":
    main()
