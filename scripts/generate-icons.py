#!/usr/bin/env python3
"""
Icon generation script for Lumark (Wails v3).
Consolidates source SVGs from build/icons-src/ into production icon formats:
- App Icon: Colored logo without background -> build/appicon.png, windows/icon.ico, darwin/icons.icns
- Document Icon: White logo with dark background -> build/document.png, windows/document.ico, darwin/document.icns
- System Tray Icon: White logo without background -> build/trayicon.png (32x32)
- Favicon: Colored logo with dark background -> frontend/public/favicon.svg
"""

import os
import shutil
import subprocess
import sys
import ctypes
from ctypes import c_char_p, c_int, c_double, c_void_p, POINTER, Structure

class RsvgRectangle(Structure):
    _fields_ = [('x', c_double), ('y', c_double), ('width', c_double), ('height', c_double)]

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(ROOT_DIR, "build")
ICONS_SRC_DIR = os.path.join(BUILD_DIR, "icons-src")

# Load native librsvg and libcairo via ctypes
rsvg = ctypes.CDLL("librsvg-2.so.2")
cairo = ctypes.CDLL("libcairo.so.2")

rsvg.rsvg_handle_new_from_data.restype = c_void_p
rsvg.rsvg_handle_new_from_data.argtypes = [c_char_p, c_int, c_void_p]
cairo.cairo_image_surface_create.restype = c_void_p
cairo.cairo_image_surface_create.argtypes = [c_int, c_int, c_int]
cairo.cairo_create.restype = c_void_p
cairo.cairo_create.argtypes = [c_void_p]
cairo.cairo_surface_write_to_png.restype = c_int
cairo.cairo_surface_write_to_png.argtypes = [c_void_p, c_char_p]
rsvg.rsvg_handle_render_document.argtypes = [c_void_p, c_void_p, POINTER(RsvgRectangle), c_void_p]
rsvg.rsvg_handle_render_document.restype = c_int
cairo.cairo_destroy.argtypes = [c_void_p]
cairo.cairo_surface_destroy.argtypes = [c_void_p]

def render_svg_to_png(svg_path, out_png_path, canvas_w, canvas_h, target_h=None, target_w=None):
    with open(svg_path, "rb") as f:
        svg_bytes = f.read()

    handle = rsvg.rsvg_handle_new_from_data(svg_bytes, len(svg_bytes), None)
    if not handle:
        raise RuntimeError(f"Failed to load SVG from {svg_path}")

    surface = cairo.cairo_image_surface_create(0, canvas_w, canvas_h) # CAIRO_FORMAT_ARGB32 = 0
    cr = cairo.cairo_create(surface)

    if target_h is not None and target_w is not None:
        x_off = (float(canvas_w) - float(target_w)) / 2.0
        y_off = (float(canvas_h) - float(target_h)) / 2.0
        vp = RsvgRectangle(x_off, y_off, float(target_w), float(target_h))
    else:
        vp = RsvgRectangle(0.0, 0.0, float(canvas_w), float(canvas_h))

    rsvg.rsvg_handle_render_document(handle, cr, ctypes.byref(vp), None)
    os.makedirs(os.path.dirname(os.path.abspath(out_png_path)), exist_ok=True)
    cairo.cairo_surface_write_to_png(surface, out_png_path.encode("utf-8"))
    cairo.cairo_destroy(cr)
    cairo.cairo_surface_destroy(surface)
    print(f"  [OK] Rendered {out_png_path} ({canvas_w}x{canvas_h})")

def main():
    print("Generating Lumark icons from build/icons-src/ ...")

    # 1. App Icon: Colored SVG without background -> build/appicon.png (1024x1024 with padding)
    icon_color_svg = os.path.join(ICONS_SRC_DIR, "icon-color.svg")
    appicon_png = os.path.join(BUILD_DIR, "appicon.png")
    # aspect ratio is 395 / 421
    render_svg_to_png(icon_color_svg, appicon_png, 1024, 1024, target_h=840, target_w=840 * 395 / 421)

    # 2. Document Icon: White SVG with dark background -> build/document.png (1024x1024 square tile)
    icon_white_bg_svg = os.path.join(ICONS_SRC_DIR, "icon-white-bg.svg")
    document_png = os.path.join(BUILD_DIR, "document.png")
    render_svg_to_png(icon_white_bg_svg, document_png, 1024, 1024)

    # 3. System Tray Icon: White SVG without background -> build/trayicon.png (32x32)
    icon_white_svg = os.path.join(ICONS_SRC_DIR, "icon-white.svg")
    trayicon_png = os.path.join(BUILD_DIR, "trayicon.png")
    render_svg_to_png(icon_white_svg, trayicon_png, 32, 32, target_h=26, target_w=26 * 395 / 421)

    # 4. Favicon: Colored SVG with dark background -> frontend/public/favicon.svg
    icon_color_bg_svg = os.path.join(ICONS_SRC_DIR, "icon-color-bg.svg")
    favicon_svg = os.path.join(ROOT_DIR, "frontend", "public", "favicon.svg")
    shutil.copy2(icon_color_bg_svg, favicon_svg)
    print(f"  [OK] Copied {favicon_svg}")

    # Fallback wails.png
    wails_png = os.path.join(ROOT_DIR, "frontend", "public", "wails.png")
    render_svg_to_png(icon_color_bg_svg, wails_png, 256, 256)

    # 5. Run wails3 generate icons for App Icon (windows/icon.ico & darwin/icons.icns)
    print("Generating Windows .ico and macOS .icns for App Icon...")
    subprocess.run([
        "wails3", "generate", "icons",
        "-input", "appicon.png",
        "-macfilename", "darwin/icons.icns",
        "-windowsfilename", "windows/icon.ico",
        "-iconcomposerinput", "appicon.icon",
        "-macassetdir", "darwin"
    ], cwd=BUILD_DIR, check=True)

    # 6. Run wails3 generate icons for Document Icon (windows/document.ico & darwin/document.icns)
    print("Generating Windows document.ico and macOS document.icns for Document Icon...")
    subprocess.run([
        "wails3", "generate", "icons",
        "-input", "document.png",
        "-macfilename", "darwin/document.icns",
        "-windowsfilename", "windows/document.ico"
    ], cwd=BUILD_DIR, check=True)

    print("Icon generation completed successfully.")

if __name__ == "__main__":
    main()
