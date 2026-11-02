"""Build reusable machine-readable tokens and effect references from this snapshot."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "source/src"))
from angerona.gui.theme import THEMES, MONO_FONT_FAMILY, SEVERITY_COLOR

tokens = {
    "project": "Angerona", "version": "1.15.0",
    "source": "source/src/angerona/gui/theme.py",
    "color_notation": "Qt QSS; 8-digit hex uses #AARRGGBB, unlike CSS #RRGGBBAA",
    "themes": THEMES,
    "mono_font_family": MONO_FONT_FAMILY,
    "scale": {"minimum": 0.75, "maximum": 1.35, "default": 1.0},
    "typography_design_px": {"base": 13, "brand": 26, "tagline": 11, "page_title": 20, "section_title": 13, "card_value": 30, "card_label": 11, "table_header": 11},
    "spacing_design_px": {"primary_button_vertical": 9, "primary_button_horizontal": 16, "button_vertical": 7, "button_horizontal": 14, "input": 7, "checkbox": 18},
    "severity": {severity.name.lower(): color for severity, color in SEVERITY_COLOR.items()},
    "progress_rgb": {"start": [255, 77, 77], "midpoint": [255, 176, 32], "complete": [47, 227, 138]},
}
(ROOT / "design-tokens.json").write_text(json.dumps(tokens, indent=2) + "\n", encoding="utf-8")

def effect(id, label, file, line, symbol, **more):
    return {"id": id, "label": label, "source": "source/src/angerona/gui/" + file,
            "line": line, "symbol": symbol, "provenance": "original-source", **more}

catalog = {
    "project": "Angerona", "source_version": "1.15.0",
    "motion_policy": {"source": "source/src/angerona/gui/header_controls.py", "line": 442, "symbol": "motion_allowed", "environment": "ANGERONA_REDUCE_MOTION", "config": "ui_motion_enabled", "os_preference": "Windows SPI_GETCLIENTAREAANIMATION"},
    "effects": [
        effect("window-open", "Live window reveal", "header_controls.py", 1015, "PanelRevealOverlay._start_target_reveal", duration_ms=360, easing="OutCubic", trigger="show content window", implementation="QPropertyAnimation and QWidget QRegion mask", preview="showcase.py: Open animated window"),
        effect("window-close", "Reverse content-window close", "header_controls.py", 1048, "PanelRevealOverlay._start_target_close", duration_formula="max(90, round(320 * current_progress))", easing="InCubic", trigger="close captured content window", preview="showcase.py: close the content window"),
        effect("orb-collapse", "Collapse outline to holographic orb", "holographic_orb.py", 133, "CollapseTrail", duration_ms=440, easing="InOutCubic", trigger="main close or minimize", completion_guard_grace_ms=750, preview="showcase.py: Collapse to holographic orb"),
        effect("orb-restore", "Restore outline from holographic orb", "holographic_orb.py", 1209, "HolographicOrbController.restore_window", duration_ms=440, easing="InOutCubic", trigger="orb double click / restore", preview="showcase.py: double-click orb"),
        effect("orb-menu", "Orb radial service moons", "holographic_orb.py", 274, "HolographicOrb", duration_ms=260, easing="OutCubic", frame_interval_ms=50, trigger="orb activation", preview="showcase.py: click orb"),
        effect("run-progress", "Progress ring and percentage", "animations.py", 162, "RunSpinner", frame_interval_ms=33, arc_degrees=105, step_degrees=11, completion_linger_ms=1500, completion_disappearance="hide; original comment calls it fade but no opacity driver exists", estimated_progress_formula="95 * (1 - (1 - elapsed / expected_seconds) ** 2)", preview="showcase.py: Replay loading sequence"),
        effect("global-loading", "Overlapping background loading indicator", "animations.py", 344, "GlobalLoadingIndicator", reveal_delay_ms=140, frame_interval_ms=33, lifecycle="token-counted begin/update/finish", preview="showcase.py: Replay loading sequence"),
        effect("threat-overlay", "Threat glyph sweep and red flash", "animations.py", 560, "ThreatOverlay", duration_ms=1500, fade_interval_ms=40, fade_step=0.04, preview="showcase.py: Preview alert sweep"),
        effect("shark-swim", "Vector shark with bubble wake", "animations.py", 618, "SharkSwimIndicator", frame_interval_ms=33, preview="showcase.py: animated shark"),
        effect("shark-banner", "Full-width vector shark banner", "animations.py", 747, "SharkSwimBanner", frame_interval_ms=50),
        effect("swords", "Vector clashing swords and spark", "animations.py", 873, "ClashingSwords", frame_interval_ms=40, preview="showcase.py: animated swords"),
        effect("mic-meter", "Smoothed level with held peak", "animations.py", 471, "_LevelBar", attack_factor=0.6, release_factor=0.3, peak_decay=0.015),
    ],
    "media": ["media/screenshots/dashboard-demo.png", "media/screenshots/effects-playground.png", "media/demo/effects-playground.gif"],
}
(ROOT / "effects.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
print("Wrote design-tokens.json and effects.json")
