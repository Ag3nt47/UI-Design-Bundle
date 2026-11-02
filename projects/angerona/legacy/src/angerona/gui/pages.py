"""The four main pages: Dashboard, Modules, Alerts, Settings."""
from __future__ import annotations

import time

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QFrame, QGridLayout, QHBoxLayout, QHeaderView, QLabel,
    QLineEdit, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from angerona import __version__
from angerona.core.eventbus import Severity
from angerona.gui.theme import SEVERITY_COLOR


def _title(text: str) -> QLabel:
    lbl = QLabel(text)
    lbl.setObjectName("PageTitle")
    return lbl


def _sev_item(sev: Severity) -> QTableWidgetItem:
    item = QTableWidgetItem(sev.label)
    item.setForeground(QColor(SEVERITY_COLOR.get(sev, "#e5e7eb")))
    return item


class StatCard(QFrame):
    def __init__(self, label: str) -> None:
        super().__init__()
        self.setObjectName("Card")
        lay = QVBoxLayout(self)
        lay.setContentsMargins(18, 16, 18, 16)
        self.value = QLabel("—")
        self.value.setObjectName("CardValue")
        cap = QLabel(label)
        cap.setObjectName("CardLabel")
        lay.addWidget(self.value)
        lay.addWidget(cap)

    def set(self, text: str, color: str = "#ffffff") -> None:
        self.value.setText(text)
        self.value.setStyleSheet(f"color: {color};")


class DashboardPage(QWidget):
    def __init__(self, bus, storage, manager) -> None:
        super().__init__()
        self.bus, self.storage, self.manager = bus, storage, manager
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(18)
        root.addWidget(_title("Dashboard"))

        cards = QHBoxLayout()
        self.c_modules = StatCard("Modules running")
        self.c_alerts = StatCard("Alerts (24h)")
        self.c_threat = StatCard("Threat level")
        for c in (self.c_modules, self.c_alerts, self.c_threat):
            cards.addWidget(c)
        root.addLayout(cards)

        root.addWidget(QLabel("Recent activity"))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Time", "Module", "Severity", "Message"])
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        root.addWidget(self.table)

    def refresh(self) -> None:
        running = sum(1 for m in self.manager.modules.values() if m.status == "running")
        self.c_modules.set(f"{running}/{len(self.manager.modules)}")

        last_24h = self.storage.count_since(time.time() - 86400)
        self.c_alerts.set(str(last_24h))

        events = self.bus.recent(50)
        worst = max((e.severity for e in events), default=Severity.INFO)
        threat = {Severity.INFO: ("Calm", "#22c55e"), Severity.LOW: ("Low", "#3b82f6"),
                  Severity.MEDIUM: ("Elevated", "#f59e0b"), Severity.HIGH: ("High", "#f97316"),
                  Severity.CRITICAL: ("Critical", "#ef4444")}[worst]
        self.c_threat.set(threat[0], threat[1])

        self.table.setRowCount(0)
        for e in events[:60]:
            r = self.table.rowCount()
            self.table.insertRow(r)
            self.table.setItem(r, 0, QTableWidgetItem(e.time_str))
            self.table.setItem(r, 1, QTableWidgetItem(e.module))
            self.table.setItem(r, 2, _sev_item(e.severity))
            self.table.setItem(r, 3, QTableWidgetItem(e.message))


class ModulesPage(QWidget):
    def __init__(self, manager) -> None:
        super().__init__()
        self.manager = manager
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(16)
        root.addWidget(_title("Modules"))
        hint = QLabel("Drop a .py file in your modules folder to add a capability — it appears here automatically.")
        hint.setStyleSheet("color:#6b7280;")
        root.addWidget(hint)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Enabled", "Module", "Category", "Status", "Description"])
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        root.addWidget(self.table)
        self._build()

    def _build(self) -> None:
        self.table.setRowCount(0)
        for name, mod in sorted(self.manager.modules.items()):
            r = self.table.rowCount()
            self.table.insertRow(r)
            chk = QCheckBox()
            chk.setChecked(self.manager.is_enabled(name))
            chk.stateChanged.connect(lambda st, n=name: self.manager.set_enabled(n, bool(st)))
            wrap = QWidget(); lay = QHBoxLayout(wrap); lay.setAlignment(Qt.AlignCenter)
            lay.setContentsMargins(0, 0, 0, 0); lay.addWidget(chk)
            self.table.setCellWidget(r, 0, wrap)
            self.table.setItem(r, 1, QTableWidgetItem(mod.name))
            self.table.setItem(r, 2, QTableWidgetItem(mod.category))
            self.table.setItem(r, 3, QTableWidgetItem(mod.status))
            self.table.setItem(r, 4, QTableWidgetItem(mod.description))

    def refresh(self) -> None:
        # Only statuses change frequently; update column 3 in place.
        for r in range(self.table.rowCount()):
            name_item = self.table.item(r, 1)
            if not name_item:
                continue
            mod = self.manager.modules.get(name_item.text())
            if mod:
                self.table.setItem(r, 3, QTableWidgetItem(mod.status))


class AlertsPage(QWidget):
    def __init__(self, storage) -> None:
        super().__init__()
        self.storage = storage
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(16)
        root.addWidget(_title("Alerts"))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Time", "Module", "Severity", "Message"])
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        root.addWidget(self.table)

    def refresh(self) -> None:
        self.table.setRowCount(0)
        for e in self.storage.recent(200):
            r = self.table.rowCount()
            self.table.insertRow(r)
            self.table.setItem(r, 0, QTableWidgetItem(time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(e.ts))))
            self.table.setItem(r, 1, QTableWidgetItem(e.module))
            self.table.setItem(r, 2, _sev_item(e.severity))
            self.table.setItem(r, 3, QTableWidgetItem(e.message))


class SettingsPage(QWidget):
    def __init__(self, config, on_check_updates) -> None:
        super().__init__()
        self.config = config
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(14)
        root.addWidget(_title("Settings"))

        grid = QGridLayout()
        grid.addWidget(QLabel("Ollama host"), 0, 0)
        self.host = QLineEdit(config.ollama_host); grid.addWidget(self.host, 0, 1)
        grid.addWidget(QLabel("Ollama model"), 1, 0)
        self.model = QLineEdit(config.ollama_model); grid.addWidget(self.model, 1, 1)
        grid.addWidget(QLabel("GitHub repo (user/name)"), 2, 0)
        self.repo = QLineEdit(config.github_repo); grid.addWidget(self.repo, 2, 1)
        root.addLayout(grid)

        save = QPushButton("Save settings"); save.setObjectName("Primary")
        save.clicked.connect(self._save)
        root.addWidget(save)

        upd = QPushButton("Check for updates")
        upd.clicked.connect(on_check_updates)
        root.addWidget(upd)

        self.status = QLabel("")
        self.status.setStyleSheet("color:#6b7280;")
        root.addWidget(self.status)

        root.addStretch(1)
        root.addWidget(QLabel(f"Angerona v{__version__}"))

    def _save(self) -> None:
        self.config.ollama_host = self.host.text().strip()
        self.config.ollama_model = self.model.text().strip()
        self.config.github_repo = self.repo.text().strip()
        self.config.save()
        self.status.setText("Saved.")

    def refresh(self) -> None:
        pass
