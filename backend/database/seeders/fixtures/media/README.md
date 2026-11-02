# Baseline media library

These photographs are real Pexels photos, resized to WebP for the demo. Each slot is a real picture of that kind of room or building. They are not photos of the Đà Nẵng buildings in `da-nang-places.json`, and they must not be presented as homes that are actually for rent. Photographer, Pexels license, and source page for every file are stored in `manifest.json`.

Refresh the library with:

```bash
python3 database/seeders/fixtures/media/download_library.py
```

`manifest.json` lists 22 coherent sets plus shared parking and laundry images. Files live under `library/` and are uploaded once to paths under `seed/`. Many properties reuse one path. `BaselineSeeder` copies each file's SHA-256, MIME type, and byte size onto every `property_media` row that references it.

`fixtures:media-upload` sends each path once. It skips an object that is already in the bucket unless `--overwrite` is set.
