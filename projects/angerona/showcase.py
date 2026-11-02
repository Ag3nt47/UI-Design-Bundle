"""UI-only Angerona effect playground. No app startup, telemetry, or services.

python showcase.py
python showcase.py --screenshot ../../screenshots/angerona-effects.png
"""
from __future__ import annotations

import argparse
import faulthandler
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "source/src"))

if os.environ.get("UI_BUNDLE_TRACE") == "1":
    faulthandler.enable()
    faulthandler.dump_traceback_later(30, repeat=True)
    print("Loading Qt bindings", flush=True)

from PySide6.QtCore import QPropertyAnimation, QTimer, Qt
from PySide6.QtGui import QColor, QFont, QFontDatabase, QImage, QPainter
from PySide6.QtWidgets import (
    QApplication, QComboBox, QDialog, QFrame, QHBoxLayout, QLabel,
    QMainWindow, QPushButton, QVBoxLayout, QWidget,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshot", type=Path)
    parser.add_argument("--record", type=Path, help="Record original open/close, orb and loading effects to a synthetic GIF; requires Pillow")
    parser.add_argument("--quit-after", type=int, default=0, help="Milliseconds; optional smoke run")
    args = parser.parse_args()
    app = QApplication(sys.argv[:1])
    # Windows' offscreen platform does not always enumerate installed fonts.
    # Register installed fonts for local rendering; no font files are bundled.
    if os.name == "nt":
        font_directory = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
        for font_name in ("segoeui.ttf", "segoeuib.ttf", "consola.ttf"):
            font_path = font_directory / font_name
            if font_path.is_file():
                QFontDatabase.addApplicationFont(str(font_path))
        app.setFont(QFont("Segoe UI", 10))
    if os.environ.get("UI_BUNDLE_TRACE") == "1":
        print("Qt application constructed", flush=True)
    app.setQuitOnLastWindowClosed(False)

    from angerona.gui.animations import (
        ClashingSwords, GlobalLoadingIndicator, RunSpinner, SharkSwimIndicator,
        ThreatOverlay, begin_loading, finish_loading, update_loading,
    )
    from angerona.gui.header_controls import PanelRevealOverlay
    from angerona.gui.holographic_orb import HolographicOrbController
    from angerona.gui.theme import available_themes, build_qss

    class TextThreatOverlay(ThreatOverlay):
        """Use an ASCII glyph to avoid headless color-emoji font discovery.

        All trigger, motion, flash and paint methods are the original class.
        Only the original constructor's emoji label is replaced here.
        """
        def __init__(self, parent):
            QWidget.__init__(self, parent)
            self.setAttribute(Qt.WA_TransparentForMouseEvents)
            self._glyph = QLabel("!", self)
            self._glyph.setStyleSheet("font-size:96px;")
            self._glyph.adjustSize()
            self._anim = QPropertyAnimation(self._glyph, b"pos", self)
            self._anim.finished.connect(self._maybe_hide)
            self._flash = 0.0
            self._color = QColor(255, 40, 40)
            self._timer = QTimer(self)
            self._timer.timeout.connect(self._fade)
            self.hide()

    class Showcase(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Angerona UI Design Bundle — original effects playground")
            self.resize(1060, 690)
            self.dialogs = []
            self._exiting = False
            self.theme = "cyber"
            self.setStyleSheet(build_qss(self.theme))
            body = QWidget()
            self.setCentralWidget(body)
            root = QVBoxLayout(body)
            root.setContentsMargins(30, 26, 30, 26)
            root.setSpacing(20)
            brand = QLabel("ANGERONA / INTERFACE LAB")
            brand.setObjectName("Brand")
            root.addWidget(brand)
            hint = QLabel("Original Qt widgets • synthetic progress • no telemetry or security services")
            hint.setObjectName("Tagline")
            root.addWidget(hint)
            top = QHBoxLayout()
            theme = QComboBox()
            for key, label in available_themes():
                theme.addItem(label, key)
            theme.currentIndexChanged.connect(lambda _: self.apply_theme(theme.currentData()))
            top.addWidget(QLabel("Theme"))
            top.addWidget(theme)
            top.addStretch()
            quit_button = QPushButton("Exit playground")
            quit_button.clicked.connect(self.request_exit)
            top.addWidget(quit_button)
            root.addLayout(top)

            panel = QFrame()
            panel.setObjectName("Panel")
            self.panel_layout = QVBoxLayout(panel)
            self.panel_layout.setContentsMargins(22, 18, 22, 18)
            self.panel_layout.setSpacing(15)
            title = QLabel("WINDOW MOTION")
            title.setObjectName("SectionTitle")
            self.panel_layout.addWidget(title)
            self.panel_layout.addWidget(QLabel("Open a content window, then close it to replay the reverse reveal."))
            actions = QHBoxLayout()
            self.open_button = QPushButton("Open animated window")
            self.open_button.setObjectName("Primary")
            self.open_button.clicked.connect(self.open_dialog)
            actions.addWidget(self.open_button)
            collapse = QPushButton("Collapse to holographic orb")
            collapse.clicked.connect(lambda: self.orb_controller.collapse_window(self))
            actions.addWidget(collapse)
            self.panel_layout.addLayout(actions)
            self.panel_layout.addWidget(QLabel("Orb: drag to move • click for radial menu • double-click to restore"))
            root.addWidget(panel)

            activity = QFrame()
            activity.setObjectName("Card")
            lay = QVBoxLayout(activity)
            lay.setContentsMargins(22, 18, 22, 18)
            title = QLabel("LOADING & FEEDBACK")
            title.setObjectName("SectionTitle")
            lay.addWidget(title)
            self.run = RunSpinner()
            self.global_loading = GlobalLoadingIndicator()
            lay.addWidget(self.run)
            lay.addWidget(self.global_loading)
            row = QHBoxLayout()
            loading = QPushButton("Replay loading sequence")
            loading.clicked.connect(self.start_loading)
            row.addWidget(loading)
            self.shark = SharkSwimIndicator(width=210, height=42)
            row.addWidget(self.shark)
            self.swords = ClashingSwords(size=42)
            row.addWidget(self.swords)
            flash = QPushButton("Preview alert sweep")
            flash.clicked.connect(lambda: self.alert.trigger(glyph="!"))
            row.addWidget(flash)
            lay.addLayout(row)
            root.addWidget(activity)
            root.addStretch()
            footer = QLabel("Presentation timers pause when hidden/minimized. Motion follows OS accessibility settings.")
            footer.setWordWrap(True)
            root.addWidget(footer)
            self.reveal = PanelRevealOverlay(self)
            self.orb_controller = HolographicOrbController(self)
            # All four orbital service nodes remain synthetic presentation.
            self.orb_controller.orb.serviceTriggered.disconnect()
            self.orb_controller.orb.serviceTriggered.connect(lambda _: self.orb_controller.restore_main())
            self.alert = TextThreatOverlay(body)
            self.progress = QTimer(self)
            self.progress.timeout.connect(self.tick_progress)
            self.done = 0
            self.token = None
            self.shark.start()
            self.swords.set_active(True)
            self.start_loading()

        def apply_theme(self, key):
            self.theme = key
            self.setStyleSheet(build_qss(key))

        def open_dialog(self):
            def make_dialog():
                dialog = QDialog(self)
                dialog.setWindowTitle("Original Angerona open / close reveal")
                dialog.resize(620, 330)
                lay = QVBoxLayout(dialog)
                lay.setContentsMargins(26, 24, 26, 24)
                title = QLabel("LIVE CONTENT WINDOW")
                title.setObjectName("PageTitle")
                lay.addWidget(title)
                lay.addWidget(QLabel("360 ms OutCubic reveal; reverse close uses InCubic.\nThe mask belongs to this real window."))
                lay.addStretch()
                close = QPushButton("Close with reverse reveal")
                close.clicked.connect(dialog.close)
                lay.addWidget(close)
                self.dialogs.append(dialog)
                dialog.show()
                return dialog
            self.reveal.reveal(self.open_button, make_dialog)

        def start_loading(self):
            if self.token:
                finish_loading(self.token)
            self.done = 0
            self.run.start("Preparing interface assets")
            self.token = begin_loading("Loading demo components", total=100)
            self.progress.start(55)

        def tick_progress(self):
            self.done = min(100, self.done + 1)
            self.run.set_progress(self.done, 100)
            update_loading(self.token, done=self.done, total=100)
            if self.done == 100:
                self.progress.stop()
                self.run.finish("Interface ready")
                finish_loading(self.token)
                self.token = None

        def closeEvent(self, event):
            if self._exiting:
                event.accept()
                return
            # Match the original main window's X-to-orb behavior.
            event.ignore()
            self.orb_controller.collapse_window(self)

        def request_exit(self):
            self._exiting = True
            app.quit()

        def shutdown(self):
            self.reveal.shutdown()
            self.orb_controller.shutdown()
            self.progress.stop()
            self.shark.stop()
            self.swords.set_active(False)
            finish_loading(self.token)

    window = Showcase()
    if os.environ.get("UI_BUNDLE_TRACE") == "1":
        print("Synthetic showcase constructed", flush=True)
    app.aboutToQuit.connect(window.shutdown)
    window.show()
    if args.record:
        from PIL import Image
        frames = []
        frame_times = []
        window.move(65, 45)

        def record_frame():
            # Composite only our synthetic windows. Never capture the desktop.
            canvas = QImage(1200, 820, QImage.Format_RGBA8888)
            canvas.fill(QColor("#070b12"))
            painter = QPainter(canvas)
            targets = ([window] + window.dialogs + [window.orb_controller.orb]
                       + list(window.orb_controller._trails))
            for widget in targets:
                if not widget.isVisible() or widget.isMinimized():
                    continue
                painter.save()
                painter.translate(widget.x(), widget.y())
                if not widget.mask().isEmpty():
                    painter.setClipRegion(widget.mask())
                painter.drawPixmap(0, 0, widget.grab())
                painter.restore()
            painter.end()
            image = canvas.scaled(900, 615, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            # Keep encoding outside the event loop so it cannot skip motion.
            frames.append((image.width(), image.height(), bytes(image.bits())))
            frame_times.append(time.monotonic())

        recording = QTimer(window)
        recording.timeout.connect(record_frame)
        recording.start(80)
        QTimer.singleShot(850, window.open_dialog)
        QTimer.singleShot(1950, lambda: window.dialogs[-1].close())
        QTimer.singleShot(2800, lambda: window.orb_controller.collapse_window(window))
        QTimer.singleShot(4050, window.orb_controller.restore_main)

        def finish_recording():
            recording.stop()
            args.record.parent.mkdir(parents=True, exist_ok=True)
            if not frames:
                raise RuntimeError("No synthetic frames recorded")
            images = [Image.frombytes("RGBA", (width, height), raw).convert("RGB").quantize(colors=128)
                      for width, height, raw in frames]
            durations = [max(20, round((frame_times[i + 1] - frame_times[i]) * 1000))
                         for i in range(len(frame_times) - 1)] + [80]
            images[0].save(args.record, save_all=True, append_images=images[1:], duration=durations, loop=0, optimize=True)
            from PIL import ImageDraw
            picks = [round(i * (len(images) - 1) / 5) for i in range(6)]
            sheet = Image.new("RGB", (1350, 660), "#070b12")
            draw = ImageDraw.Draw(sheet)
            for index, pick in enumerate(picks):
                x, y = (index % 3) * 450, (index // 3) * 330
                sheet.paste(images[pick].convert("RGB").resize((450, 308)), (x, y + 20))
                draw.text((x + 6, y + 4), f"{round((frame_times[pick] - frame_times[0]) * 1000)} ms", fill="#c8d9ec")
            sheet.save(args.record.with_suffix(".contact-sheet.png"))
            print(f"Saved {args.record.resolve()} ({len(frames)} synthetic UI frames)", flush=True)
            window.request_exit()
        QTimer.singleShot(5700, finish_recording)
    elif args.screenshot:
        def capture():
            args.screenshot.parent.mkdir(parents=True, exist_ok=True)
            if not window.grab().save(str(args.screenshot)):
                raise RuntimeError("Screenshot could not be written")
            print(f"Saved {args.screenshot.resolve()}", flush=True)
            window.request_exit()
        QTimer.singleShot(1100, capture)
    elif args.quit_after:
        QTimer.singleShot(args.quit_after, window.request_exit)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
