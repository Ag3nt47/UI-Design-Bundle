"""Optimus UI primitives only: no application, backend, worker, or system tools."""
from pathlib import Path
from types import SimpleNamespace
import argparse
import os
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'source/src'))
from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QFontDatabase, QFont
from PySide6.QtWidgets import QApplication, QComboBox, QDialog, QHBoxLayout, QLabel, QMainWindow, QPushButton, QVBoxLayout, QWidget
from optimus.widgets.header_controls import HeaderActionButton, install_global_window_reveal, show_with_window_reveal
from optimus.widgets.loading import RunSpinner
from optimus.widgets.local_loading import LocalLoadingAnimation
from optimus.widgets.live_activity import WorkerActivityRing
from optimus.widgets.theme import THEMES, build_qss
from reusable.starfield import StarfieldCanvas


def configure_fonts(app):
    # The Windows offscreen Qt plugin may omit system font enumeration.
    font_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    for filename in ('segoeui.ttf', 'segoeuib.ttf'):
        font = font_dir / filename
        if font.is_file():
            QFontDatabase.addApplicationFont(str(font))
    app.setFont(QFont('Segoe UI', 10))


class Showcase(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Optimus UI Design Bundle — rendering showcase')
        self.resize(1000, 760)
        self.config = SimpleNamespace(ui_motion_enabled=True)
        self.canvas = StarfieldCanvas(motion=True)
        self.setCentralWidget(self.canvas)
        layout = QVBoxLayout(self.canvas)
        layout.setContentsMargins(96, 56, 96, 56)
        title = QLabel('O P T I M U S')
        title.setObjectName('Brand')
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)
        caption = QLabel('Reusable Qt rendering primitives · synthetic demo data')
        caption.setAlignment(Qt.AlignCenter)
        layout.addWidget(caption)
        layout.addStretch()
        themes = QComboBox()
        for key, palette in THEMES.items():
            themes.addItem(palette['label'], key)
        themes.currentIndexChanged.connect(lambda: QApplication.instance().setStyleSheet(build_qss(themes.currentData())))
        layout.addWidget(themes)
        open_button = HeaderActionButton('Open window reveal', 'settings', 'Window reveal', 'Expands real dialog contents with an accent edge. Close the dialog to play it in reverse.')
        self.open_button = open_button
        layout.addWidget(open_button)
        self.overlay = install_global_window_reveal(self, config=self.config)
        open_button.clicked.connect(lambda: self.overlay.reveal(open_button, self.open_dialog, '#1f9cff'))
        self.spinner = RunSpinner(self.canvas)
        layout.addWidget(self.spinner)
        self.spinner.start('Synthetic progress')
        self.spinner.set_pct(68)
        row = QHBoxLayout()
        for value, health, phase in [(35, 'working', 'download'), (82, 'waiting', 'install'), (None, 'unverified', 'scan')]:
            ring = WorkerActivityRing(self.canvas)
            ring.set_progress(value, health, active=True, phase=phase, description='Synthetic demonstration value')
            row.addWidget(ring)
        # The original third-party media is omitted from this open-source bundle.
        # Keep the original GIF playback widget as an optional user-supplied slot.
        self.gif = LocalLoadingAnimation(self.canvas, asset_path=HERE / 'custom-loading.gif', extent=88)
        self.gif.setAccessibleName('Optional local loading animation')
        self.gif.setToolTip('Supply a local GIF licensed for your project as custom-loading.gif.')
        self.slot_ring = WorkerActivityRing(self.canvas)
        self.slot_ring.set_progress(None, 'working', active=True, phase='prepare', description='Original Qt ring used while the optional custom GIF slot is empty.')
        row.addWidget(self.slot_ring)
        row.addWidget(self.gif)
        if self.gif.ready:
            self.slot_ring.hide()
            self.gif.start()
        layout.addLayout(row)
        note = QLabel('Optional custom GIF slot: supply your own openly licensed local asset. The default preview uses the original Qt ring.')
        note.setWordWrap(True)
        layout.addWidget(note)
        layout.addStretch()
        self.dialog = None

    def open_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle('Optimus real-content reveal')
        dialog.resize(580, 340)
        layout = QVBoxLayout(dialog)
        title = QLabel('Window open / reverse close')
        title.setObjectName('PageTitle')
        layout.addWidget(title)
        info = QLabel('Original mask-based reveal: 240 ms OutCubic.\nReverse close: up to 180 ms InCubic.\nReduced-motion settings bypass decorative motion.')
        info.setWordWrap(True)
        layout.addWidget(info)
        close = QPushButton('Close and reverse reveal')
        close.clicked.connect(dialog.close)
        layout.addWidget(close)
        self.dialog = dialog
        dialog.show()
        return dialog

    def closeEvent(self, event):
        self.overlay.shutdown()
        super().closeEvent(event)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', type=Path)
    parser.add_argument('--dialog', action='store_true')
    args = parser.parse_args()
    app = QApplication(sys.argv[:1])
    configure_fonts(app)
    app.setStyleSheet(build_qss('cyber'))
    window = Showcase()
    show_with_window_reveal(window, config=window.config)
    if args.dialog:
        QTimer.singleShot(400, window.open_dialog)
    if args.screenshot:
        def capture():
            args.screenshot.parent.mkdir(parents=True, exist_ok=True)
            window.grab().save(str(args.screenshot))
            window.overlay.shutdown()
            app.quit()
        QTimer.singleShot(1000, capture)
    return app.exec()


if __name__ == '__main__':
    raise SystemExit(main())
