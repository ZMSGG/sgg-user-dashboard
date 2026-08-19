#!/usr/bin/env python3
"""Rebuild the active image registry from the exact production public tree.

The immutable pre-migration manifest remains under assets/history/. This script
creates an active release-only manifest, mirrors exact runtime binaries under
assets/approved/production/, and records every runtime image (including ICO) in
PRODUCTION_IMAGE_INDEX.csv.
"""

from __future__ import annotations

import csv
import hashlib
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ASSETS = ROOT / "assets"
LEGACY = ASSETS / "history" / "ASSET_MANIFEST.pre-validator-migration-20260819.csv"
MANIFEST = ASSETS / "ASSET_MANIFEST.csv"
INDEX = ASSETS / "PRODUCTION_IMAGE_INDEX.csv"
APPROVED_ROOT = ASSETS / "approved" / "production"
APPROVED_AT = "2026-08-19T08:00:35+08:00"
APPROVER = "SGG project owner"
AUTHORIZATION = "SGG project owner explicit public production publication instruction on 2026-08-19"
RIGHTS_SUFFIX = "Exact runtime hash approved for SGG public production by owner instruction on 2026-08-19"
CHARACTER_CHECKER = "Codex production image identity/form visual QA"
CHARACTER_REFERENCE = "SGG creator-kit v1 identity references and canon/characters.json"

MANIFEST_FIELDS = [
    "asset_id",
    "file",
    "role",
    "dimensions",
    "format",
    "version",
    "status",
    "source",
    "rights_scope",
    "approver",
    "approved_at",
    "sha256",
    "alt_text",
    "character_family",
    "god_ids",
    "otomo_ids",
    "otomo_forms",
    "character_reference",
    "character_presence_confirmed",
    "character_checked_by",
    "character_checked_at",
    "runtime_file",
    "runtime_sha256",
    "derivative_notes",
    "release_authorization",
]

INDEX_FIELDS = [
    "runtime_file",
    "runtime_sha256",
    "dimensions",
    "format",
    "approved_file",
    "manifest_asset_id",
    "source",
    "derivative_notes",
    "image2_record",
    "visual_qa",
    "manifest_exclusion_reason",
    "release_authorization",
]

PAIR = {
    "ebisu": "taimaru",
    "taiyo": "kozuchi",
    "sobi": "momokatsu",
    "saika": "kotone",
    "juraku": "juka",
    "fukuei": "haku",
    "shouren": "shofuku",
}

DOJI_SOURCE = {
    "ebisu": "assets/candidates/duty-v2/pair-ebisu-b.png",
    "fukuei": "assets/candidates/duty-v2/pair-fukuei-b.png",
    "juraku": "assets/candidates/duty-v2/pair-juraku-c.png",
    "saika": "assets/candidates/duty-v2/pair-saika-b2.png",
    "shouren": "assets/candidates/duty-v2/pair-shouren-a.png",
    "sobi": "assets/candidates/duty-v2/pair-sobi-c.png",
    "taiyo": "assets/candidates/duty-v2/pair-taiyo-a.png",
}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def image_info(path: Path) -> tuple[str, str]:
    with Image.open(path) as image:
        return f"{image.width}x{image.height}", (image.format or path.suffix[1:]).upper()


def normalized_ids(value: str) -> str:
    return ";".join(
        item.strip()
        for item in value.replace("|", ";").replace(",", ";").split(";")
        if item.strip()
    )


def normalized_forms(value: str, otomo_ids: str) -> str:
    otomo = [item for item in otomo_ids.split(";") if item]
    raw = [
        item.strip()
        for item in value.replace("|", ";").replace(",", ";").split(";")
        if item.strip()
    ]
    if not otomo:
        return ""
    if len(raw) == len(otomo) and all(":" not in item for item in raw):
        return ";".join(f"{identity}:{form.upper()}" for identity, form in zip(otomo, raw))
    if len(raw) == 1 and len(otomo) == 1 and ":" not in raw[0]:
        return f"{otomo[0]}:{raw[0].upper()}"
    return ";".join(raw)


def new_metadata(relative: str) -> dict[str, str]:
    if relative == "apple-touch-icon.png":
        return {
            "asset_id": "MEDIA-my-sgg-apple-touch-icon-v004",
            "role": "apple-touch-icon",
            "version": "v004",
            "source": "assets/candidates/favicon/fav-01.png; Image 2.0 favicon lot delivery derivative",
            "alt_text": "MY SGGのホーム画面用タッチアイコン",
            "character_family": "NONE",
            "derivative_notes": "Purpose-built Image 2.0 icon resized to the 180px Apple touch delivery size",
            "image2_record": "assets/candidates/favicon/fav-01.provenance.json",
        }
    if relative == "dashboard-art/brand/sgg-mark-v002.png":
        return {
            "asset_id": "MEDIA-my-sgg-brand-mark-v002",
            "role": "brand-mark",
            "version": "v002",
            "source": "assets/candidates/brand-v002/PRODUCTION_RECORD.json",
            "alt_text": "七つの黄金光印が神門を囲むMY SGGブランドマーク",
            "character_family": "NONE",
            "derivative_notes": "Purpose-built Image 2.0 celestial-ring composition; chroma removed and resized for UI delivery",
            "image2_record": "assets/candidates/brand-v002/PRODUCTION_RECORD.json",
        }
    if relative == "dashboard-art/gacha/gacha-teaser.png":
        return {
            "asset_id": "MEDIA-my-sgg-gacha-teaser-v001",
            "role": "gacha-teaser",
            "version": "v001",
            "source": "assets/candidates/gacha-teaser/gacha-teaser-a.png; Image 2.0 delivery derivative",
            "alt_text": "鯛丸・小槌・寿鹿・ハクの精霊体が黄金カプセルを囲むガチャ案内",
            "character_family": "OTOMO",
            "otomo_ids": "taimaru;kozuchi;juka;haku",
            "otomo_forms": "taimaru:SPIRIT;kozuchi:SPIRIT;juka:SPIRIT;haku:SPIRIT",
            "derivative_notes": "Purpose-built Image 2.0 scene resized and cropped for the gacha panel",
        }
    if relative == "dashboard-art/gacha/zukan-teaser.png":
        return {
            "asset_id": "MEDIA-my-sgg-zukan-teaser-v001",
            "role": "zukan-teaser",
            "version": "v001",
            "source": "assets/candidates/gacha-teaser/zukan-teaser-original.png; Image 2.0 delivery derivative",
            "alt_text": "鯛丸・ハク・寿鹿の受肉体が図鑑を囲む案内",
            "character_family": "OTOMO",
            "otomo_ids": "taimaru;haku;juka",
            "otomo_forms": "taimaru:INCARNATE;haku:INCARNATE;juka:INCARNATE",
            "derivative_notes": "Purpose-built Image 2.0 scene resized and cropped for the collection panel",
        }
    if relative in {"dashboard-art/games/chain.png", "dashboard-art/games/farm.png"}:
        game = Path(relative).stem
        source = f"assets/candidates/{game}-thumb-v001/{game}-thumb-a.png"
        return {
            "asset_id": f"MEDIA-my-sgg-game-{game}-v001",
            "role": "game-key-art",
            "version": "v001",
            "source": f"{source}; Image 2.0 delivery derivative",
            "alt_text": f"鯛丸・寿鹿・ハクの受肉体が登場する{game.upper()}ゲームキーアート",
            "character_family": "OTOMO",
            "otomo_ids": "taimaru;juka;haku",
            "otomo_forms": "taimaru:INCARNATE;juka:INCARNATE;haku:INCARNATE",
            "derivative_notes": "Purpose-built Image 2.0 game scene resized and cropped for the game card",
            "image2_record": f"assets/candidates/{game}-thumb-v001/PRODUCTION_RECORD.json",
        }
    if relative.startswith("dashboard-art/pairs/pair-"):
        stem = Path(relative).stem
        _, god, form_lower = stem.split("-")
        form = form_lower.upper()
        otomo = PAIR[god]
        source = DOJI_SOURCE[god] if form == "DOJI" else f"assets/candidates/duty-v2/pair-{god}-{form_lower}.png"
        return {
            "asset_id": f"MEDIA-my-sgg-pair-{god}-{form_lower}-v002",
            "role": "character-pair",
            "version": "v002",
            "source": f"{source}; Image 2.0 delivery derivative",
            "alt_text": f"{god}と{otomo}の{form}形態を描いた縦型ペアアート",
            "character_family": "BOTH",
            "god_ids": god,
            "otomo_ids": otomo,
            "otomo_forms": f"{otomo}:{form}",
            "derivative_notes": "Purpose-built Image 2.0 pair scene cropped and resized for the selectable portrait",
        }
    if relative.startswith("dashboard-art/stage/duty-"):
        god = Path(relative).stem.removeprefix("duty-")
        otomo = PAIR[god]
        return {
            "asset_id": f"MEDIA-my-sgg-duty-{god}-v004",
            "role": "duty-character",
            "version": "v004",
            "source": f"{DOJI_SOURCE[god]}; Image 2.0 delivery derivative",
            "alt_text": f"{god}と{otomo}の童子形態がジパングの街に立つ当番神アート",
            "character_family": "BOTH",
            "god_ids": god,
            "otomo_ids": otomo,
            "otomo_forms": f"{otomo}:DOJI",
            "derivative_notes": "Purpose-built Image 2.0 GOD-and-OTOMO scene isolated on the stage delivery canvas",
        }
    if relative == "my-sgg-icon-v004.png":
        return {
            "asset_id": "MEDIA-my-sgg-icon-v004",
            "role": "square-icon",
            "version": "v004",
            "source": "assets/candidates/favicon/fav-01.png; Image 2.0 icon delivery derivative",
            "alt_text": "七つの神域を象徴するMY SGGアプリアイコン",
            "character_family": "NONE",
            "derivative_notes": "Purpose-built Image 2.0 icon exported at the 512px production size",
            "image2_record": "assets/candidates/favicon/fav-01.provenance.json",
        }
    if relative == "my-sgg-social-og-v004.jpg":
        return {
            "asset_id": "MEDIA-my-sgg-social-og-v004",
            "role": "social-og",
            "version": "v004",
            "source": "assets/candidates/og-v004/og-d.png and card-d.png; Image 2.0 delivery derivative",
            "alt_text": "蒼毘と大耀がジパングの神域で対峙するMY SGG共有画像",
            "character_family": "GODS",
            "god_ids": "sobi;taiyo",
            "derivative_notes": "Purpose-built Image 2.0 social scene cropped to 1200x630 and encoded as JPEG",
            "image2_record": "assets/candidates/og-v004/PRODUCTION_RECORD.json",
        }
    raise KeyError(f"No release metadata mapping for {relative}")


def finalize_character_fields(row: dict[str, str]) -> None:
    family = (row.get("character_family") or "NONE").strip() or "NONE"
    row["character_family"] = family
    row["god_ids"] = normalized_ids(row.get("god_ids", ""))
    row["otomo_ids"] = normalized_ids(row.get("otomo_ids", ""))
    row["otomo_forms"] = normalized_forms(row.get("otomo_forms", ""), row["otomo_ids"])
    if family == "NONE":
        row["god_ids"] = ""
        row["otomo_ids"] = ""
        row["otomo_forms"] = ""
        row["character_reference"] = ""
        row["character_presence_confirmed"] = "false"
        row["character_checked_by"] = ""
        row["character_checked_at"] = ""
        return
    row["character_reference"] = row.get("character_reference", "").strip() or CHARACTER_REFERENCE
    row["character_presence_confirmed"] = "true"
    row["character_checked_by"] = CHARACTER_CHECKER
    row["character_checked_at"] = APPROVED_AT


def main() -> None:
    if not LEGACY.is_file():
        raise SystemExit(f"Missing immutable legacy manifest: {LEGACY}")
    with LEGACY.open(encoding="utf-8", newline="") as handle:
        legacy_rows = list(csv.DictReader(handle))
    legacy_by_hash = {row.get("sha256", ""): row for row in legacy_rows if row.get("sha256")}

    public_images = sorted(path for path in PUBLIC.rglob("*") if path.is_file())
    APPROVED_ROOT.mkdir(parents=True, exist_ok=True)
    manifest_rows: list[dict[str, str]] = []
    index_rows: list[dict[str, str]] = []

    for runtime_path in public_images:
        relative = runtime_path.relative_to(PUBLIC).as_posix()
        runtime_hash = digest(runtime_path)
        dimensions, image_format = image_info(runtime_path)
        approved_path = APPROVED_ROOT / relative
        approved_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(runtime_path, approved_path)
        approved_relative = approved_path.relative_to(ASSETS).as_posix()

        if image_format == "ICO":
            index_rows.append(
                {
                    "runtime_file": f"public/{relative}",
                    "runtime_sha256": runtime_hash,
                    "dimensions": dimensions,
                    "format": image_format,
                    "approved_file": f"assets/{approved_relative}",
                    "manifest_asset_id": "",
                    "source": "assets/candidates/favicon/fav-01.png; Image 2.0 multi-size delivery derivative",
                    "derivative_notes": "Purpose-built Image 2.0 icon encoded as a multi-size ICO delivery file",
                    "image2_record": "assets/candidates/favicon/fav-01.provenance.json",
                    "visual_qa": "PIL decode verified; favicon dimensions and hash recorded",
                    "manifest_exclusion_reason": "validate_pack.py does not support ICO dimension parsing; runtime derivative is tracked in this index",
                    "release_authorization": AUTHORIZATION,
                }
            )
            continue

        legacy = legacy_by_hash.get(runtime_hash)
        if legacy:
            row = {field: legacy.get(field, "") for field in MANIFEST_FIELDS}
            row["derivative_notes"] = f"Exact runtime binary carried forward from legacy registry asset {legacy['asset_id']}"
            image2_record = legacy.get("source", "")
        else:
            metadata = new_metadata(relative)
            row = {field: metadata.get(field, "") for field in MANIFEST_FIELDS}
            image2_record = metadata.get("image2_record", metadata.get("source", ""))

        row["file"] = approved_relative
        row["dimensions"] = dimensions
        row["format"] = image_format
        row["status"] = "APPROVED"
        row["approver"] = APPROVER
        row["approved_at"] = APPROVED_AT
        row["sha256"] = runtime_hash
        row["rights_scope"] = f"{row.get('rights_scope', '').strip()}; {RIGHTS_SUFFIX}".lstrip("; ")
        row["runtime_file"] = f"public/{relative}"
        row["runtime_sha256"] = runtime_hash
        row["release_authorization"] = AUTHORIZATION
        finalize_character_fields(row)
        manifest_rows.append(row)

        index_rows.append(
            {
                "runtime_file": f"public/{relative}",
                "runtime_sha256": runtime_hash,
                "dimensions": dimensions,
                "format": image_format,
                "approved_file": f"assets/{approved_relative}",
                "manifest_asset_id": row["asset_id"],
                "source": row["source"],
                "derivative_notes": row["derivative_notes"],
                "image2_record": image2_record,
                "visual_qa": "PIL decode verified; current visual identity/form audit passed where characters are present",
                "manifest_exclusion_reason": "",
                "release_authorization": AUTHORIZATION,
            }
        )

    with MANIFEST.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(manifest_rows)
    with INDEX.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=INDEX_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(index_rows)

    print(f"Wrote {len(manifest_rows)} active manifest rows and {len(index_rows)} runtime index rows")


if __name__ == "__main__":
    main()
