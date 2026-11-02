"""Verbatim StarfieldCanvas extracted from Optimus 0.12.31 ui.py:1697.
Original code MIT; see ../source/LICENSE. Imports are limited to rendering."""
import math
import random
from PySide6.QtCore import QElapsedTimer, QTimer, QPointF, QRectF, Qt
from PySide6.QtGui import QColor, QPainter, QPen, QPolygonF, QRadialGradient, QTransform
from PySide6.QtWidgets import QWidget

class StarfieldCanvas(QWidget):
    def __init__(self, motion=True):
        super().__init__()
        self.motion = bool(motion)
        self.phase = 0.0
        self._motion_clock = QElapsedTimer()
        rng = random.Random(47)
        self.stars = [(rng.random(), rng.random(), rng.random(), rng.random()) for _ in range(190)]
        self._spiral = QPolygonF([
            QPointF((0.16 + index / 159 * 0.72) * math.cos(index / 159 * 5.3),
                (0.16 + index / 159 * 0.72) * math.sin(index / 159 * 5.3))
            for index in range(160)])
        self.timer = QTimer(self)
        self.timer.setInterval(33)
        self.timer.timeout.connect(self._tick)
        self.setAutoFillBackground(False)

    def _tick(self):
        if not self._can_animate():
            self.timer.stop()
            return
        elapsed = min(0.1, max(0, self._motion_clock.restart()) / 1000)
        self.phase += elapsed * 0.12
        self.update()

    def _can_animate(self):
        owner = self.window()
        if not self.motion or not self.isVisible() or owner.isMinimized() or getattr(owner, 'busy', False):
            return False
        for name in ('_settings_window', '_sandbox_window', '_setup_wizard', '_progress_window', '_security_review_dialog'):
            child = getattr(owner, name, None)
            visible = getattr(child, 'isVisible', None)
            if callable(visible):
                try:
                    if visible():
                        return False
                except RuntimeError:
                    continue
        return True

    def sync_motion(self):
        if self._can_animate():
            if not self.timer.isActive():
                self._motion_clock.start()
            self.timer.start()
        else:
            self.timer.stop()
        self.update()

    def showEvent(self, event):
        super().showEvent(event)
        self.sync_motion()

    def hideEvent(self, event):
        self.timer.stop()
        super().hideEvent(event)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        painter.fillRect(self.rect(), QColor('#0a0e14'))
        cx, cy = w * 0.5, h * 0.5
        extent = max(w, h) * 0.72
        glow = QRadialGradient(QPointF(cx, cy), extent)
        glow.setColorAt(0, QColor(17, 53, 87, 165))
        glow.setColorAt(0.42, QColor(10, 29, 51, 130))
        glow.setColorAt(1, QColor(4, 9, 17, 0))
        painter.fillRect(self.rect(), glow)
        for index, (a, b, size, twinkle) in enumerate(self.stars):
            radius = (0.12 + a * 0.86) * extent
            angle = b * math.tau + self.phase * (0.32 + 0.35 * a) + radius / extent * 2.4
            x = cx + math.cos(angle) * radius
            y = cy + math.sin(angle) * radius * 0.63
            if not (-5 < x < w + 5 and -5 < y < h + 5):
                continue
            pulse = 0.68 + 0.32 * math.sin(self.phase * 2.2 + twinkle * 12)
            alpha = int((55 + size * 155) * pulse)
            color = QColor('#ff7a1a') if index % 19 == 0 else QColor('#7acbff')
            color.setAlpha(alpha)
            painter.setPen(Qt.NoPen)
            painter.setBrush(color)
            dot = 0.7 + size * 1.5
            painter.drawEllipse(QPointF(x, y), dot, dot)
            if size > 0.91:
                faint = QColor(color)
                faint.setAlpha(int(alpha * 0.15))
                painter.setBrush(faint)
                painter.drawEllipse(QPointF(x, y), dot * 3.3, dot * 3.3)
        for strand in range(3):
            painter.setPen(QPen(QColor(31, 156, 255, 15 + strand * 3), 1.0))
            # The spiral's shape is constant. Map its normalized points in Qt
            # instead of rebuilding 480 points and crossing into Qt for every
            # segment on every frame. Keep the pen in device coordinates.
            transform = QTransform().translate(cx, cy).scale(extent, extent * 0.63)
            transform.rotateRadians(self.phase + strand * math.tau / 3)
            painter.drawPolyline(transform.map(self._spiral))
        painter.end()

