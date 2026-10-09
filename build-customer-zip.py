#!/usr/bin/env python3
"""Build the customer-facing ZIP for Ultimate Budget, the same way Bill Tracker is packaged.

Run this from anywhere, with no arguments, every time before re-uploading to Etsy:

    python3 build-customer-zip.py

It never touches the source files in this folder. It only reads them and writes
a fresh ZIP to the path printed at the end (default: ../AllocateStudio-UltimateBudget.zip,
i.e. one level up, in outputs/).

What it does, matching Packaging-Checklist.md:
  - Bundles the 9 separate .js files into one app/app.bundle.js, in load order.
  - Copies styles.css, mobile.css, assets/ (logo, fonts, icon set), manifest.json
    and apple-touch-icon.png into app/, out of sight.
  - Rewrites index.html's <link>/<script>/<image> paths to match (app/styles.css,
    app/app.bundle.js, app/assets/..., etc.) and leaves everything else as is.
  - Copies the two instruction PDFs from packaging/ into the ZIP root, next to
    index.html, if they're there. If not, it still builds the app and prints a
    clear warning instead of failing, so you can check the app before the PDFs
    are ready.
  - Zips it all under one top folder, AllocateStudio-UltimateBudget/, so nothing
    spills loose when a buyer extracts it.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent
PRODUCT_FOLDER = "AllocateStudio-UltimateBudget"
OUT_ZIP = REPO.parent / f"{PRODUCT_FOLDER}.zip"

# Load order matters: these are plain global scripts, not modules.
JS_ORDER = [
    "demo.js", "engine.js", "app.js", "month-picker.js",
    "views.js", "no-spend.js", "forms.js", "zoom.js", "mobile.js",
]

WELCOME_PDF = "Ultimate_Budget_Welcome.pdf"
STARTHERE_PDF = "Ultimate_Budget_StartHere.pdf"


def bundle_js(staging: Path):
    out = staging / "app" / "app.bundle.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    parts = []
    for name in JS_ORDER:
        src = REPO / name
        if not src.exists():
            sys.exit(f"Missing source file: {name}")
        parts.append(f"/* ---- {name} ---- */\n{src.read_text()}")
    out.write_text("\n".join(parts))
    return out


def build_index_html(staging: Path):
    html = (REPO / "index.html").read_text()

    # Collapse the 9 individual <script src="...">...</script> tags into one.
    script_block = "".join(f'<script src="{n}"></script>' for n in JS_ORDER)
    if script_block not in html:
        sys.exit("index.html's script tags don't match JS_ORDER. Update this script.")
    html = html.replace(script_block, '<script src="app/app.bundle.js"></script>')

    # Everything else that moved under app/.
    replacements = {
        'href="styles.css"': 'href="app/styles.css"',
        'href="mobile.css"': 'href="app/mobile.css"',
        'href="manifest.json"': 'href="app/manifest.json"',
        'href="apple-touch-icon.png"': 'href="app/apple-touch-icon.png"',
        'href="assets/allocate-studio-logo.png"': 'href="app/assets/allocate-studio-logo.png"',
    }
    for old, new in replacements.items():
        if old not in html:
            sys.exit(f"Expected to find {old!r} in index.html. Update this script.")
        html = html.replace(old, new)

    (staging / "index.html").write_text(html)


def copy_app_assets(staging: Path):
    app = staging / "app"
    shutil.copy2(REPO / "styles.css", app / "styles.css")
    shutil.copy2(REPO / "mobile.css", app / "mobile.css")
    shutil.copy2(REPO / "manifest.json", app / "manifest.json")
    shutil.copy2(REPO / "apple-touch-icon.png", app / "apple-touch-icon.png")
    shutil.copytree(REPO / "assets", app / "assets")


def copy_pdfs(staging: Path):
    packaging_dir = REPO / "packaging"
    missing = []
    for name in (WELCOME_PDF, STARTHERE_PDF):
        src = packaging_dir / name
        if src.exists():
            shutil.copy2(src, staging / name)
        else:
            missing.append(name)
    return missing


def make_zip(staging: Path, out_zip: Path):
    if out_zip.exists():
        out_zip.unlink()
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                zf.write(path, Path(PRODUCT_FOLDER) / path.relative_to(staging))


def main():
    staging_root = REPO.parent / ".zip-staging"
    if staging_root.exists():
        shutil.rmtree(staging_root)
    staging = staging_root / PRODUCT_FOLDER
    staging.mkdir(parents=True)

    bundle_js(staging)
    copy_app_assets(staging)
    build_index_html(staging)
    missing_pdfs = copy_pdfs(staging)

    make_zip(staging, OUT_ZIP)
    shutil.rmtree(staging_root)

    size_kb = OUT_ZIP.stat().st_size / 1024
    print(f"Built {OUT_ZIP} ({size_kb:.0f} KB)")
    if missing_pdfs:
        print("WARNING: the zip is missing these PDFs (place them in packaging/ and rebuild):")
        for name in missing_pdfs:
            print(f"  - packaging/{name}")


if __name__ == "__main__":
    main()
