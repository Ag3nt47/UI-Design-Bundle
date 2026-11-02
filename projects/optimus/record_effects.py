"""Render original Qt widgets and live reveal-mask states into a labelled GIF.

This records offscreen QWidget renders, not a desktop compositor capture.
No Optimus backend or maintenance tool is instantiated.
"""
from pathlib import Path
import json
import os
import sys

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from showcase import QApplication, Showcase, build_qss, QTimer, configure_fonts
from PySide6.QtCore import QPoint, QRect, Qt
from PySide6.QtGui import QColor, QImage, QPainter, QFont
from PIL import Image

HERE = Path(__file__).resolve().parent
app = QApplication(sys.argv[:1])
configure_fonts(app)
app.setStyleSheet(build_qss('cyber'))
window = Showcase()
window.resize(1000, 760)
window.show()
frames = []
mask_samples = []
frame_index = 0


def sample():
    global frame_index
    if frame_index in (5, 45):
        window.overlay.reveal(window.open_button, window.open_dialog, '#1f9cff')
    if frame_index in (28, 68) and window.dialog:
        window.dialog.close()
    image = QImage(1000, 812, QImage.Format_RGBA8888)
    image.fill(QColor('#060b13'))
    painter = QPainter(image)
    painter.drawPixmap((1000 - window.width()) // 2, 36, window.grab())
    dialog = window.dialog
    mask = None
    if dialog is not None and dialog.isVisible():
        pixmap = dialog.grab()
        x = (1000 - dialog.width()) // 2
        y = 36 + (760 - dialog.height()) // 2
        region = dialog.mask()
        painter.save()
        if not region.isEmpty():
            painter.setClipRegion(region.translated(x, y))
        painter.drawPixmap(x, y, pixmap)
        painter.restore()
        bounds = region.boundingRect()
        mask = [bounds.x(), bounds.y(), bounds.width(), bounds.height()]
    painter.setPen(QColor('#cbd8e8'))
    font = QFont('Segoe UI', 11)
    painter.setFont(font)
    painter.drawText(QRect(20, 5, 970, 25), Qt.AlignLeft | Qt.AlignVCenter, 'OPTIMUS · original Qt widgets · live reveal-mask composite · synthetic progress')
    phase = 'Open reveal' if 5 <= frame_index < 13 or 45 <= frame_index < 53 else 'Reverse close' if 28 <= frame_index < 35 or 68 <= frame_index < 75 else 'Loading widgets / starfield'
    painter.drawText(QRect(20, 784, 970, 22), Qt.AlignLeft | Qt.AlignVCenter, phase + ' · offscreen QWidget renders, not a desktop compositor recording')
    painter.end()
    data = bytes(image.bits())
    frame = Image.frombytes('RGBA', (image.width(), image.height()), data, 'raw', 'RGBA', image.bytesPerLine())
    frames.append(frame.convert('RGB'))
    mask_samples.append(dict(frame=frame_index,mask=mask))
    frame_index += 1
    if frame_index >= 82:
        timer.stop()
        destination = HERE / 'reference/showcase-effects.gif'
        destination.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(destination, save_all=True, append_images=frames[1:], duration=40, loop=0, optimize=False)
        (HERE / 'reference/showcase-effects.json').write_text(json.dumps(dict(capture='Offscreen QWidget renders composed using actual mask state from original PanelRevealOverlay',synthetic_data=True,backend_instantiated=False,frames=len(frames),frame_duration_ms=40,mask_samples=mask_samples),indent=2)+'\n',encoding='utf-8')
        window.overlay.shutdown()
        app.quit()


timer = QTimer()
timer.setInterval(40)
timer.timeout.connect(sample)
timer.start()
raise SystemExit(app.exec())
