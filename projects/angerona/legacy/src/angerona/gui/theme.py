"""Dark theme (Qt stylesheet) and severity colors."""
from __future__ import annotations

from angerona.core.eventbus import Severity

SEVERITY_COLOR = {
    Severity.INFO: "#6b7280",
    Severity.LOW: "#3b82f6",
    Severity.MEDIUM: "#f59e0b",
    Severity.HIGH: "#f97316",
    Severity.CRITICAL: "#ef4444",
}

DARK_QSS = """
* { font-family: 'Segoe UI', sans-serif; font-size: 13px; color: #e5e7eb; }
QMainWindow, QWidget { background: #0f1115; }

#Sidebar { background: #151922; border-right: 1px solid #232a36; }
#Sidebar QPushButton {
    text-align: left; padding: 11px 16px; border: none; border-radius: 8px;
    margin: 2px 8px; color: #9aa4b2; background: transparent;
}
#Sidebar QPushButton:hover { background: #1c2230; color: #e5e7eb; }
#Sidebar QPushButton:checked { background: #2563eb; color: white; font-weight: 600; }
#Brand { font-size: 18px; font-weight: 700; color: #ffffff; padding: 18px 16px 8px 16px; }
#Tagline { color: #6b7280; padding: 0 16px 16px 16px; font-size: 11px; }

#PageTitle { font-size: 22px; font-weight: 700; color: #ffffff; }
#Card { background: #151922; border: 1px solid #232a36; border-radius: 12px; }
#CardValue { font-size: 30px; font-weight: 700; color: #ffffff; }
#CardLabel { color: #9aa4b2; font-size: 12px; }

QTableWidget { background: #151922; border: 1px solid #232a36; border-radius: 10px; gridline-color: #232a36; }
QHeaderView::section { background: #1c2230; color: #9aa4b2; border: none; padding: 8px; font-weight: 600; }
QTableWidget::item { padding: 6px; }

QPushButton#Primary { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 16px; font-weight: 600; }
QPushButton#Primary:hover { background: #1d4ed8; }
QPushButton { background: #1c2230; border: 1px solid #2a3240; border-radius: 8px; padding: 7px 14px; }
QPushButton:hover { background: #232a36; }

QLineEdit, QComboBox { background: #0f1115; border: 1px solid #2a3240; border-radius: 8px; padding: 7px; }
QCheckBox::indicator { width: 18px; height: 18px; }
"""
