"""Render the original historical floating-orb UI without application services."""
from pathlib import Path
from types import SimpleNamespace
import importlib.util
import os
import sys

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from showcase import QApplication, QTimer, configure_fonts
from PySide6.QtCore import QPoint, QRect, Qt
from PySide6.QtGui import QColor, QImage, QPainter, QFont

HERE = Path(__file__).resolve().parent
source = HERE / 'variants/objects/67bc7bd066c333778f6bf3dfff474e1a5e5984baca92e13655d7fb96c06d4497/holographic_orb.py'
spec = importlib.util.spec_from_file_location('legacy_optimus_orb', source)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
app = QApplication(sys.argv[:1])
configure_fonts(app)
orb = module.HolographicOrb(SimpleNamespace(ui_motion_enabled=True))
orb.set_anchor(QPoint(400, 400))
orb.show_token()
orb.set_menu_expanded(True)


def capture():
    image = QImage(680, 680, QImage.Format_RGBA8888)
    image.fill(QColor('#07111f'))
    painter = QPainter(image)
    painter.setPen(QColor('#cbd8e8'))
    painter.setFont(QFont('Segoe UI', 12))
    painter.drawText(QRect(20, 18, 640, 40), Qt.AlignCenter, 'Optimus · historical holographic orb')
    pixmap = orb.grab()
    painter.drawPixmap((680 - pixmap.width()) // 2, (680 - pixmap.height()) // 2, pixmap)
    painter.setFont(QFont('Segoe UI', 10))
    painter.drawText(QRect(20, 630, 640, 28), Qt.AlignCenter, 'Original Qt rendering · no backend or telemetry')
    painter.end()
    destination = HERE / 'reference/legacy-holographic-orb.png'
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(destination))
    orb.hide_token()
    app.quit()


QTimer.singleShot(650, capture)
raise SystemExit(app.exec())
