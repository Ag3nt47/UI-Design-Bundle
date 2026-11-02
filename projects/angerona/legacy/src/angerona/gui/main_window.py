"""Main window: sidebar navigation, stacked pages, system tray, refresh timer."""
from __future__ import annotations

from PySide6.QtCore import QTimer
from PySide6.QtGui import QAction, QIcon, QPixmap
from PySide6.QtWidgets import (
    QButtonGroup, QHBoxLayout, QLabel, QMainWindow, QMenu, QPushButton,
    QStackedWidget, QSystemTrayIcon, QVBoxLayout, QWidget,
)

from angerona.gui.pages import AlertsPage, DashboardPage, ModulesPage, SettingsPage
from angerona.gui.theme import DARK_QSS
from angerona.updater.github_updater import check_for_updates


class MainWindow(QMainWindow):
    def __init__(self, bus, storage, manager, config) -> None:
        super().__init__()
        self.bus, self.storage, self.manager, self.config = bus, storage, manager, config

        self.setWindowTitle("Angerona — Security Suite")
        self.resize(1080, 720)
        self.setStyleSheet(DARK_QSS)

        central = QWidget()
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ── Sidebar ─────────────────────────────────────────────────────────
        sidebar = QWidget(); sidebar.setObjectName("Sidebar"); sidebar.setFixedWidth(220)
        sb = QVBoxLayout(sidebar); sb.setContentsMargins(0, 0, 0, 0); sb.setSpacing(0)
        brand = QLabel("🛡️ Angerona"); brand.setObjectName("Brand")
        tag = QLabel("Security Suite"); tag.setObjectName("Tagline")
        sb.addWidget(brand); sb.addWidget(tag)

        self.stack = QStackedWidget()
        self.pages = {
            "Dashboard": DashboardPage(bus, storage, manager),
            "Modules": ModulesPage(manager),
            "Alerts": AlertsPage(storage),
            "Settings": SettingsPage(config, self._check_updates),
        }
        group = QButtonGroup(self); group.setExclusive(True)
        for i, (label, page) in enumerate(self.pages.items()):
            self.stack.addWidget(page)
            btn = QPushButton(label); btn.setCheckable(True)
            btn.clicked.connect(lambda _, idx=i: self.stack.setCurrentIndex(idx))
            group.addButton(btn)
            sb.addWidget(btn)
            if i == 0:
                btn.setChecked(True)
        sb.addStretch(1)

        layout.addWidget(sidebar)
        layout.addWidget(self.stack, 1)
        self.setCentralWidget(central)

        self._build_tray()

        # ── Refresh loop (poll model -> view; cheap and thread-safe) ─────────
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._refresh)
        self.timer.start(1500)  # 1.5s
        self._refresh()

    # ── Tray ────────────────────────────────────────────────────────────────
    def _build_tray(self) -> None:
        pm = QPixmap(64, 64); pm.fill("#2563eb")
        self.tray = QSystemTrayIcon(QIcon(pm), self)
        self.tray.setToolTip("Angerona — running")
        menu = QMenu()
        show = QAction("Open Angerona", self); show.triggered.connect(self.showNormal)
        quit_ = QAction("Quit", self); quit_.triggered.connect(self._quit)
        menu.addAction(show); menu.addSeparator(); menu.addAction(quit_)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(lambda r: self.showNormal() if r == QSystemTrayIcon.Trigger else None)
        self.tray.show()

    def closeEvent(self, event) -> None:
        # Closing the window hides to tray instead of quitting (it's a monitor).
        event.ignore()
        self.hide()
        self.tray.showMessage("Angerona", "Still protecting in the background.",
                              QSystemTrayIcon.Information, 2500)

    def _quit(self) -> None:
        from PySide6.QtWidgets import QApplication
        QApplication.instance().quit()

    # ── Refresh + updates ────────────────────────────────────────────────────
    def _refresh(self) -> None:
        self.stack.currentWidget().refresh()

    def _check_updates(self) -> None:
        page: SettingsPage = self.pages["Settings"]  # type: ignore[assignment]
        page.status.setText("Checking…")
        result = check_for_updates(self.config.github_repo)
        page.status.setText(result)
