"""Download real Pexels photographs for the shared demo library.

Pexels grants a free license for these files: https://www.pexels.com/license/
They show room and building types for the university demo. They are not
photographs of the Đà Nẵng properties in da-nang-places.ts.
Credits are stored in manifest.json.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIBRARY = ROOT / "library"
USER_AGENT = "Mozilla/5.0 (compatible; rentOS-seed/1.0; university demo)"
MAX_EDGE = "1200"

BUCKETS: list[tuple[str, list[str], int]] = [
    ("studio_exterior", ["apartment building exterior", "residential apartment complex"], 8),
    ("studio_bedroom", ["studio apartment bedroom", "small apartment bedroom"], 8),
    ("studio_kitchen", ["small apartment kitchen", "studio kitchen"], 8),
    ("studio_bathroom", ["apartment bathroom", "small bathroom interior"], 8),
    ("apartment_exterior", ["condominium building exterior", "modern apartment facade"], 8),
    ("apartment_living", ["apartment living room", "modern living room interior"], 8),
    ("apartment_kitchen", ["apartment kitchen", "modern kitchen interior"], 8),
    ("apartment_bedroom", ["apartment bedroom", "modern bedroom interior"], 8),
    ("apartment_bathroom", ["modern bathroom interior", "bathroom sink interior"], 8),
    ("house_exterior", ["house exterior front", "suburban house exterior"], 6),
    ("house_living", ["house living room", "cozy living room interior"], 6),
    ("house_kitchen", ["house kitchen", "family kitchen interior"], 6),
    ("house_bedroom", ["house bedroom", "master bedroom interior"], 6),
    ("house_bathroom", ["house bathroom", "bathroom with shower"], 6),
    ("parking", ["outdoor parking lot", "residential parking spaces"], 3),
    ("laundry", ["laundry room", "washing machine laundry room"], 3),
]

ATTR = re.compile(
    r'"type":"photo","attributes":\{.*?"id":(\d+),"slug":"([^"]*)","description":"([^"]*)".{0,2200}?"first_name":"([^"]*)","last_name":"([^"]*)"',
    re.S,
)
SKIP = re.compile(
    r"\b(hotel|office|restaurant|illustration|render|3d|drawing|painting|logo|icon|diagram|wedding|fashion show)\b",
    re.IGNORECASE,
)


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code in {404, 410}:
                return b""
            if attempt == 3:
                raise
            print(f"retry {url} after {error}")
            time.sleep(3 * (attempt + 1))
        except Exception as error:
            if attempt == 3:
                raise
            print(f"retry {url} after {error}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("unreachable")


def search(query: str) -> list[dict[str, str]]:
    photos: list[dict[str, str]] = []
    seen: set[str] = set()
    slug = urllib.parse.quote(query)
    for page in (1, 2):
        url = f"https://www.pexels.com/search/{slug}/" + (f"?page={page}" if page > 1 else "")
        print(f"search: {query} page {page}")
        html = fetch(url).decode("utf-8", "replace")
        time.sleep(0.6)
        if html == "":
            break
        for photo_id, slug, description, first, last in ATTR.findall(html):
            if photo_id in seen or SKIP.search(description):
                continue
            seen.add(photo_id)
            creator = " ".join(part for part in (first, last) if part).strip()
            photos.append(
                {
                    "id": photo_id,
                    "description": description or slug.replace("-", " "),
                    "creator": f"Photo by {creator} on Pexels" if creator else "Photo on Pexels",
                    "source": f"https://www.pexels.com/photo/{slug}-{photo_id}/",
                    "license": "Pexels License",
                    "thumb": f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w={MAX_EDGE}",
                }
            )
        if len(photos) >= 16:
            break
    return photos


def collect(reserved: set[str]) -> dict[str, list[dict[str, str]]]:
    chosen: dict[str, list[dict[str, str]]] = {}
    for key, queries, count in BUCKETS:
        pool: list[dict[str, str]] = []
        seen = set(reserved)
        for query in queries:
            for photo in search(query):
                if photo["id"] in seen:
                    continue
                seen.add(photo["id"])
                pool.append(photo)
        picked = pool[: count + 4]
        if len(picked) < count:
            raise SystemExit(f"{key} only found {len(picked)} of {count} photographs")
        reserved.update(photo["id"] for photo in picked)
        chosen[key] = picked
        print(f"  {key}: {len(picked)} candidates")
    return chosen


def save_photo(photo: dict[str, str], destination: Path) -> None:
    data = fetch(photo["thumb"])
    if len(data) < 20_000 or not data.startswith(b"\xff\xd8\xff"):
        raise RuntimeError(f"photo {photo['id']} is not a usable jpeg")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(".jpg")
    temp.write_bytes(data)
    subprocess.run(["sips", "-Z", MAX_EDGE, str(temp)], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["cwebp", "-quiet", "-q", "75", str(temp), "-o", str(destination)], check=True)
    temp.unlink(missing_ok=True)
    if destination.stat().st_size < 8_000:
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"photo {photo['id']} encoded too small")


def take(pool: list[dict[str, str]], index: int, used: set[str], relative: str) -> dict[str, str]:
    destination = ROOT / relative
    for photo in pool:
        if photo["id"] in used:
            continue
        try:
            print(f"save {relative} <- {photo['id']}")
            save_photo(photo, destination)
        except Exception as error:
            print(f"  skip {photo['id']}: {error}")
            destination.unlink(missing_ok=True)
            continue
        used.add(photo["id"])
        time.sleep(0.15)
        return photo
    raise SystemExit(f"no downloadable photograph left for {relative}")


def record(relative: str, storage: str, level: str, caption: str, photo: dict[str, str]) -> dict[str, object]:
    return {
        "file": relative,
        "storage_path": storage,
        "level": level,
        "caption": caption,
        "credit": {
            "title": photo["description"][:180],
            "creator": photo["creator"],
            "license": photo["license"],
            "source": photo["source"],
        },
    }


def main() -> None:
    pools = collect(set())
    used: set[str] = set()
    written: list[Path] = []
    sets: list[dict[str, object]] = []
    groups = [
        ("studios", "studio", 8, ["APARTMENT", "APARTMENT_BUILDING"], ["STUDIO"], [
            ("studio_exterior", "exterior", "property", "Mặt ngoài"),
            ("studio_bedroom", "bedroom", "unit", "Phòng ngủ"),
            ("studio_kitchen", "kitchen", "unit", "Bếp"),
            ("studio_bathroom", "bathroom", "unit", "Nhà vệ sinh"),
        ]),
        ("apartments", "apartment", 8, ["APARTMENT", "APARTMENT_BUILDING"], ["APARTMENT"], [
            ("apartment_exterior", "exterior", "property", "Mặt ngoài"),
            ("apartment_living", "living", "unit", "Phòng khách"),
            ("apartment_kitchen", "kitchen", "unit", "Bếp"),
            ("apartment_bedroom", "bedroom", "unit", "Phòng ngủ"),
            ("apartment_bathroom", "bathroom", "unit", "Nhà vệ sinh"),
        ]),
        ("houses", "house", 6, ["HOUSE"], ["HOUSE", "ROOM"], [
            ("house_exterior", "exterior", "property", "Mặt ngoài"),
            ("house_living", "living", "unit", "Phòng khách"),
            ("house_kitchen", "kitchen", "unit", "Bếp"),
            ("house_bedroom", "bedroom", "unit", "Phòng ngủ"),
            ("house_bathroom", "bathroom", "unit", "Nhà vệ sinh"),
        ]),
    ]

    for folder, kind, count, property_types, unit_kinds, roles in groups:
        for index in range(count):
            name = f"{kind}-{index + 1:02d}"
            images = []
            for bucket, role, level, caption in roles:
                relative = f"library/{folder}/{name}/{role}.webp"
                photo = take(pools[bucket], index, used, relative)
                images.append(record(relative, f"seed/{folder}/{name}/{role}.webp", level, caption, photo))
                written.append(ROOT / relative)
            sets.append({"id": name, "property_types": property_types, "unit_kinds": unit_kinds, "images": images})

    shared = []
    for index in range(3):
        for amenity, bucket, caption in (
            ("parking", "parking", "Chỗ để xe"),
            ("laundry", "laundry", "Khu giặt"),
        ):
            filename = f"{amenity}-{index + 1:02d}.webp"
            relative = f"library/shared/{filename}"
            photo = take(pools[bucket], index, used, relative)
            shared.append({"amenity": amenity, **record(relative, f"seed/shared/{filename}", "property", caption, photo)})
            written.append(ROOT / relative)

    (ROOT / "manifest.json").write_text(json.dumps({"sets": sets, "shared": shared}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    keep = {path.resolve() for path in written}
    for stale in LIBRARY.rglob("*"):
        if stale.is_file() and stale.resolve() not in keep:
            stale.unlink()
    print(f"sets={len(sets)} shared={len(shared)} images={len(written)}")


if __name__ == "__main__":
    main()
