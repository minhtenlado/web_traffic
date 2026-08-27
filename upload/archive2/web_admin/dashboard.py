import tkinter as tk
from tkinter import ttk
import json
import os
import time
from datetime import datetime
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import firebase_admin
from firebase_admin import credentials, db

# ===========================================================
# CONFIGURATION
# ===========================================================
FIREBASE_KEY_PATH = "trafic-42620-firebase-adminsdk-fbsvc-f91ac01927.json"  # Đặt file JSON cùng thư mục với code này
FIREBASE_DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app/"  # Sửa URL của bạn

LABELS = ["Duong_vang", "Binh_thuong", "Dong_xe", "Sap_ket", "Ket_xe"]

# ----- BẢNG MÀU GIAO DIỆN (Dark theme) -----
PALETTE = {
    "bg":          "#0f172a",   # nền chính (slate-900)
    "bg_panel":    "#1e293b",   # nền khung/thẻ (slate-800)
    "bg_card":     "#243244",   # nền thẻ camera
    "border":      "#334155",   # viền (slate-700)
    "text":        "#e2e8f0",   # chữ chính (slate-200)
    "text_dim":    "#94a3b8",   # chữ phụ (slate-400)
    "accent":      "#38bdf8",   # xanh cyan nhấn
}

# Màu theo camera (dùng cho biểu đồ + viền thẻ)
CAM_COLORS = {
    "cam_01": "#38bdf8",  # cyan
    "cam_02": "#fb923c",  # cam
    "cam_03": "#4ade80",  # xanh lá
    "cam_04": "#f87171",  # đỏ
    "cam_05": "#8b5cf6",  # tím
    "cam_06": "#0ea5e9",  # lam
    "cam_07": "#ec4899",  # hồng
}

# Màu trạng thái theo nhãn YOLO (badge)
STATUS_COLORS = {
    "Duong_vang":   "#22c55e",
    "Binh_thuong":  "#84cc16",
    "Dong_xe":      "#eab308",
    "Sap_ket":      "#f97316",
    "Ket_xe":       "#ef4444",
}
DEFAULT_STATUS_COLOR = "#64748b"

# ===========================================================
# FIREBASE INIT
# ===========================================================
try:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_DB_URL})
    print("✅ Đã kết nối Firebase cho Dashboard!")
except Exception as e:
    print(f"❌ Lỗi Firebase: {e}")
    exit()

# ===========================================================
# DASHBOARD GUI CLASS
# ===========================================================
class TrafficDashboard:
    def __init__(self, root):
        self.root = root
        self.root.title("Hệ Thống Dự Báo Giao Thông — Realtime")
        self.root.geometry("1280x820")
        self.root.minsize(1100, 700)
        self.root.configure(bg=PALETTE["bg"])

        self._setup_style()
        self._build_header()
        self._build_camera_cards()
        self._build_chart()

        self.last_realtime_data = None
        self.last_update_time = time.time()

        self.update_data()
        self._tick_clock()

    # -------------------------------------------------------
    # STYLE
    # -------------------------------------------------------
    def _setup_style(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")

        style.configure("TFrame", background=PALETTE["bg"])
        style.configure("Panel.TFrame", background=PALETTE["bg_panel"])
        style.configure("Card.TFrame", background=PALETTE["bg_card"])

        style.configure("Title.TLabel", background=PALETTE["bg"],
                         foreground=PALETTE["text"], font=("Segoe UI", 20, "bold"))
        style.configure("Subtitle.TLabel", background=PALETTE["bg"],
                         foreground=PALETTE["text_dim"], font=("Segoe UI", 11))
        style.configure("Clock.TLabel", background=PALETTE["bg"],
                         foreground=PALETTE["accent"], font=("Consolas", 13, "bold"))

        style.configure("PanelTitle.TLabel", background=PALETTE["bg_panel"],
                         foreground=PALETTE["text"], font=("Segoe UI", 12, "bold"))

        style.configure("CamName.TLabel", background=PALETTE["bg_card"],
                         foreground=PALETTE["text"], font=("Segoe UI", 13, "bold"))
        style.configure("Count.TLabel", background=PALETTE["bg_card"],
                         foreground=PALETTE["accent"], font=("Segoe UI", 30, "bold"))
        style.configure("CountUnit.TLabel", background=PALETTE["bg_card"],
                         foreground=PALETTE["text_dim"], font=("Segoe UI", 10))
        style.configure("Forecast.TLabel", background=PALETTE["bg_card"],
                         foreground=PALETTE["text_dim"], font=("Segoe UI", 10))
        style.configure("ForecastVal.TLabel", background=PALETTE["bg_card"],
                         foreground=PALETTE["text"], font=("Segoe UI", 10, "bold"))

    def _parse_time(self, time_str):
        if not time_str:
            return None

        time_str = time_str.strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%H:%M:%S",
            "%H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except Exception:
                continue

        try:
            return datetime.fromisoformat(time_str)
        except Exception:
            return None

    def _format_time_label(self, time_str):
        if not time_str:
            return ""

        candidates = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%H:%M:%S",
            "%H:%M",
        ]
        for fmt in candidates:
            try:
                return datetime.strptime(time_str, fmt).strftime("%H:%M")
            except Exception:
                continue

        return time_str[-5:] if len(time_str) >= 5 else time_str

    # -------------------------------------------------------
    # HEADER
    # -------------------------------------------------------
    def _build_header(self):
        header = ttk.Frame(self.root, style="TFrame")
        header.pack(fill="x", padx=24, pady=(20, 10))

        left = ttk.Frame(header, style="TFrame")
        left.pack(side="left")
        ttk.Label(left, text="🚦 Hệ Thống Dự Báo Giao Thông", style="Title.TLabel").pack(anchor="w")
        ttk.Label(left, text="Realtime · Edge AI · Nút giao Hàng Xanh", style="Subtitle.TLabel").pack(anchor="w")
        self.weather_label = ttk.Label(left, text="🌤️ Thời tiết: Đang tải...", style="Subtitle.TLabel")
        self.weather_label.pack(anchor="w", pady=(2, 0))
        self.hardware_label = ttk.Label(left, text="💻 Phần cứng: Đang tải...", style="Subtitle.TLabel")
        self.hardware_label.pack(anchor="w", pady=(2, 0))

        right = ttk.Frame(header, style="TFrame")
        right.pack(side="right")
        self.clock_label = ttk.Label(right, text="", style="Clock.TLabel")
        self.clock_label.pack(anchor="e", pady=(0, 4))
        
        status_frame = tk.Frame(right, bg=PALETTE["bg"])
        status_frame.pack(anchor="e")
        
        self.global_board_status_lbl = tk.Label(status_frame, text="Trạng thái bo mạch: ● ONLINE", 
                                                bg=PALETTE["bg"], fg="#22c55e", font=("Segoe UI", 11, "bold"))
        self.global_board_status_lbl.pack(side="right")

    def _tick_clock(self):
        self.clock_label.config(text=datetime.now().strftime("%H:%M:%S — %d/%m/%Y"))
        self.root.after(1000, self._tick_clock)

    # -------------------------------------------------------
    # CAMERA STATUS CARDS
    # -------------------------------------------------------
    def _build_camera_cards(self):
        panel = ttk.Frame(self.root, style="Panel.TFrame")
        panel.pack(fill="x", padx=24, pady=(0, 16))

        inner = ttk.Frame(panel, style="Panel.TFrame")
        inner.pack(fill="x", padx=16, pady=14)
        ttk.Label(inner, text="TRẠNG THÁI CAMERA & DỰ BÁO 30 PHÚT", style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 10))

        grid = ttk.Frame(inner, style="Panel.TFrame")
        grid.pack(fill="x")
        for i in range(4):
            grid.columnconfigure(i, weight=1, uniform="cam")

        self.card_widgets = {}
        for i in range(1, 8):
            cam_id = f"cam_{i:02d}"
            color = CAM_COLORS.get(cam_id, PALETTE["accent"])

            # Thẻ với viền màu theo camera
            card = tk.Frame(grid, bg=PALETTE["bg_card"], highlightbackground=color,
                             highlightcolor=color, highlightthickness=2, bd=0)
            row = (i - 1) // 4
            col = (i - 1) % 4
            card.grid(row=row, column=col, sticky="nsew", padx=6, pady=6)

            pad = ttk.Frame(card, style="Card.TFrame")
            pad.pack(fill="both", expand=True, padx=14, pady=12)

            name_lbl = ttk.Label(pad, text=cam_id.upper(), style="CamName.TLabel")
            name_lbl.pack(anchor="w")

            count_lbl = ttk.Label(pad, text="—", style="Count.TLabel")
            count_lbl.pack(anchor="w", pady=(2, 0))
            ttk.Label(pad, text="phương tiện hiện tại", style="CountUnit.TLabel").pack(anchor="w")

            badge = tk.Label(pad, text="Chưa có dữ liệu", bg=DEFAULT_STATUS_COLOR, fg="#0f172a",
                              font=("Segoe UI", 9, "bold"), padx=8, pady=3)
            badge.pack(anchor="w", pady=(10, 8))

            forecast_row = ttk.Frame(pad, style="Card.TFrame")
            forecast_row.pack(fill="x")
            ttk.Label(forecast_row, text="Dự báo 30': ", style="Forecast.TLabel").pack(side="left")
            forecast_lbl = ttk.Label(forecast_row, text="—", style="ForecastVal.TLabel")
            forecast_lbl.pack(side="left")

            self.card_widgets[cam_id] = {
                "count": count_lbl,
                "badge": badge,
                "forecast": forecast_lbl,
            }

    # -------------------------------------------------------
    # CHART
    # -------------------------------------------------------
    def _build_chart(self):
        panel = ttk.Frame(self.root, style="Panel.TFrame")
        panel.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        inner = ttk.Frame(panel, style="Panel.TFrame")
        inner.pack(fill="both", expand=True, padx=16, pady=14)
        ttk.Label(inner, text="BIỂU ĐỒ QUÁ KHỨ (60 PHÚT) & DỰ BÁO TƯƠNG LAI (30 PHÚT)",
                  style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 8))

        plt.rcParams.update({
            "figure.facecolor": PALETTE["bg_panel"],
            "axes.facecolor": PALETTE["bg_card"],
            "axes.edgecolor": PALETTE["border"],
            "axes.labelcolor": PALETTE["text_dim"],
            "text.color": PALETTE["text_dim"],
            "xtick.color": PALETTE["text_dim"],
            "ytick.color": PALETTE["text_dim"],
            "grid.color": PALETTE["border"],
            "font.size": 10,
            "xtick.labelsize": 10,
            "ytick.labelsize": 10,
        })

        self.fig, axes_grid = plt.subplots(2, 4, figsize=(14, 5.6), dpi=100,
                                            sharex=True, sharey=True)
        self.fig.subplots_adjust(left=0.06, right=0.985, top=0.92, bottom=0.13,
                                  hspace=0.45, wspace=0.15)
        self.fig.autofmt_xdate(rotation=45)

        cam_order = ["cam_01", "cam_02", "cam_03", "cam_04", "cam_05", "cam_06", "cam_07"]
        self.axes = {}
        self.hover_annotations = {}
        flat_axes = axes_grid.flatten()
        
        for idx, ax in enumerate(flat_axes):
            if idx < 7:
                cam_id = cam_order[idx]
                self.axes[cam_id] = ax

                annot = ax.annotate("", xy=(0, 0), xytext=(14, 14), textcoords="offset points",
                                    bbox=dict(boxstyle="round,pad=0.3", fc=PALETTE["bg_panel"],
                                              ec=PALETTE["border"], alpha=0.95),
                                    color=PALETTE["text"], fontsize=10)
                annot.set_visible(False)
                self.hover_annotations[ax] = annot
            else:
                ax.axis('off')

        self.canvas = FigureCanvasTkAgg(self.fig, master=inner)
        self.canvas.get_tk_widget().pack(fill="both", expand=True)
        self.canvas.mpl_connect("motion_notify_event", self._on_hover)

    # -------------------------------------------------------
    # DATA UPDATE
    # -------------------------------------------------------
    def update_data(self):
        try:
            realtime_data = db.reference('/realtime').get() or {}
            pred_data = db.reference('/predictions/latest').get() or {}
            chart_data = db.reference('/chart_data/latest').get() or {}

            # Kiểm tra xem có dữ liệu mới không bằng cách so sánh chuỗi JSON
            current_data_str = json.dumps(realtime_data, sort_keys=True)
            if current_data_str != self.last_realtime_data:
                self.last_realtime_data = current_data_str
                self.last_update_time = time.time()
                
            # Timeout = 20 giây (vì một chu kỳ của bo mạch mất khoảng 13-14s)
            time_since_last_update = time.time() - self.last_update_time
            is_offline_timeout = time_since_last_update > 20

            status_summary = pred_data.get('status_summary', {})

            # Cập nhật thẻ camera
            for i in range(1, 8):
                cam_id = f"cam_{i:02d}"
                cam_realtime = realtime_data.get(cam_id, {})
                widgets = self.card_widgets[cam_id]

                count = cam_realtime.get('count', None)
                raw_label = cam_realtime.get('state', None)
                cam_status = cam_realtime.get('status', 'ONLINE')
                error_msg = cam_realtime.get('error_message', '')
                pred_status = status_summary.get(cam_id, 'Chưa có dữ liệu')

                if is_offline_timeout or cam_status == 'ERROR' or cam_status == 'OFFLINE':
                    widgets["count"].config(text="⚠️")
                    widgets["badge"].config(text="MẤT KẾT NỐI", bg="#ef4444")
                    short_err = error_msg[:25] + "..." if len(error_msg) > 25 else error_msg
                    if is_offline_timeout:
                        widgets["forecast"].config(text="Lỗi: Bo mạch đang offline")
                    else:
                        widgets["forecast"].config(text=f"Lỗi: {short_err}")
                else:
                    widgets["count"].config(text=str(count) if count is not None else "—")
                    label_text = raw_label if raw_label else "Chưa có dữ liệu"
                    badge_color = STATUS_COLORS.get(raw_label, DEFAULT_STATUS_COLOR)
                    widgets["badge"].config(text=label_text.replace("_", " "), bg=badge_color)
                    widgets["forecast"].config(text=str(pred_status).replace("_", " "))

            # Update Weather
            weather = realtime_data.get('weather', {})
            if weather:
                is_raining = weather.get('is_raining', 0) > 0
                rain_int = weather.get('rain_intensity', 0)
                weather_text = f"🌧️ Đang mưa ({rain_int}mm)" if is_raining else "☀️ Trời nắng ráo"
                self.weather_label.config(text=f"Thời tiết: {weather_text}")

            # Update Hardware
            hw_data = db.reference('/system/hardware').get() or {}
            if hw_data:
                cpu_temp = hw_data.get('cpu_temp', 0)
                cpu_usage = hw_data.get('cpu_usage', 0)
                ram = hw_data.get('ram_percent', 0)
                net_rx = hw_data.get('network_rx_kbps', 0)
                net_tx = hw_data.get('network_tx_kbps', 0)
                hw_text = f"Temp: {cpu_temp}°C | CPU: {cpu_usage}% | RAM: {ram}% | Net: ⬇{net_rx} ⬆{net_tx} kbps"
                self.hardware_label.config(text=f"💻 Board (Genio 350): {hw_text}")

            # Cập nhật trạng thái tổng của Bo mạch
            if is_offline_timeout:
                self.global_board_status_lbl.config(text="Trạng thái bo mạch: ● OFFLINE", fg="#ef4444")
            else:
                self.global_board_status_lbl.config(text="Trạng thái bo mạch: ● ONLINE", fg="#22c55e")

            # ----- Cập nhật biểu đồ (4 ô riêng biệt, mỗi camera 1 ô) -----
            for ax in self.axes.values():
                ax.clear()

            if chart_data and 'history' in chart_data and 'predictions' in chart_data:
                history = chart_data['history']
                predictions = chart_data['predictions']

                hist_times_text = [h.get('time', '') for h in history]
                pred_times_text = [p.get('time', '') for p in predictions]
                hist_times = [self._parse_time(t) for t in hist_times_text]
                pred_times = [self._parse_time(t) for t in pred_times_text]
                all_times_text = hist_times_text + pred_times_text
                all_times = [self._format_time_label(t) for t in all_times_text]

                hist_times = [t for t in hist_times if t is not None]
                pred_times = [t for t in pred_times if t is not None]
                all_times_dt = hist_times + pred_times

                n_hist = len(hist_times)
                n_pred = len(pred_times)
                x_hist = hist_times
                x_pred = pred_times
                total_len = n_hist + n_pred

                # Chọn tối đa ~5 nhãn thời gian để trục X không bị dày đặc
                tick_step = max(1, total_len // 5)
                tick_positions = list(range(0, total_len, tick_step))
                if total_len - 1 not in tick_positions and total_len > 0:
                    tick_positions.append(total_len - 1)

                band_colors = [STATUS_COLORS[l] for l in LABELS]

                for i in range(1, 8):
                    cam_id = f"cam_{i:02d}"
                    ax = self.axes[cam_id]
                    color = CAM_COLORS[cam_id]

                    # Dải màu nền theo mức độ (chỉ để tạo ngữ cảnh, rất mờ)
                    for lvl, band_color in enumerate(band_colors):
                        ax.axhspan(lvl - 0.5, lvl + 0.5, color=band_color, alpha=0.06, zorder=0)

                    hist_vals = [h.get(cam_id, None) for h in history]
                    pred_vals = [p.get(cam_id, None) for p in predictions]

                    # Đường bậc thang: phù hợp với dữ liệu trạng thái rời rạc,
                    # tránh hiệu ứng "zigzag" khi nối chéo giữa các mức.
                    line_hist, = ax.plot(x_hist, hist_vals, color=color, linewidth=1.8,
                                         drawstyle='steps-post', zorder=3, label="history")

                    if hist_vals and pred_vals:
                        px = [x_hist[-1]] + x_pred
                        py = [hist_vals[-1]] + pred_vals
                        line_pred, = ax.plot(px, py, color=color, linewidth=1.8, linestyle='--',
                                             drawstyle='steps-post', alpha=0.9, zorder=3, label="prediction")
                    else:
                        line_pred = None

                    if x_hist:
                        ax.axvline(x=x_hist[-1], color="#f87171", linestyle=':', linewidth=1.2, zorder=4)

                    ax.set_title(cam_id.upper(), color=color, fontsize=10,
                                  fontweight="bold", loc="left", pad=4)
                    ax.set_yticks([0, 1, 2, 3, 4])
                    ax.set_yticklabels(LABELS, fontsize=20)
                    ax.set_ylim(-0.5, 4.5)

                    labels_for_ticks = [all_times[p] for p in tick_positions if p < len(all_times)]
                    tick_coords = [all_times_dt[p] for p in tick_positions if p < len(all_times_dt)]
                    ax.set_xticks(tick_coords)
                    ax.set_xticklabels(labels_for_ticks, fontsize=15, rotation=45, ha='right')
                    ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))

                    ax._x_time_labels = all_times
                    ax._x_positions = [mdates.date2num(t) for t in x_hist + x_pred]
                    ax._line_hist = line_hist
                    ax._line_pred = line_pred

                    ax.grid(True, axis='y', linestyle='--', alpha=0.2, zorder=1)
                    for spine in ax.spines.values():
                        spine.set_color(PALETTE["border"])

                # Chú thích chung: nét liền = quá khứ, nét đứt = dự báo, đường đỏ = hiện tại
                self.fig.text(0.5, 0.965,
                               "── Quá khứ    ┄┄ Dự báo    ┊ Hiện tại",
                               ha="center", fontsize=20, color=PALETTE["text_dim"])

            self.canvas.draw()

        except Exception as e:
            print(f"Lỗi cập nhật dashboard: {e}")
            if hasattr(self, 'global_board_status_lbl'):
                self.global_board_status_lbl.config(text="Trạng thái bo mạch: ● LỖI KẾT NỐI", fg="#ef4444")

        self.root.after(2000, self.update_data)

    def _on_hover(self, event):
        if event.inaxes not in self.axes.values():
            return

        ax = event.inaxes
        annot = self.hover_annotations[ax]
        visible = annot.get_visible()
        nearest = None
        min_dist = float('inf')

        for line in [getattr(ax, '_line_hist', None), getattr(ax, '_line_pred', None)]:
            if line is None:
                continue
            xdata = line.get_xdata()
            ydata = line.get_ydata()
            xdata_num = [mdates.date2num(x) if hasattr(x, 'timetuple') else x for x in xdata]
            for x, y in zip(xdata_num, ydata):
                if x is None or y is None:
                    continue
                dx = event.xdata - x
                dy = event.ydata - y
                dist = (dx * dx) + (dy * dy)
                if dist < min_dist:
                    min_dist = dist
                    nearest = (x, y, line)

        if nearest and min_dist < 0.12:
            x, y, line = nearest
            time_labels = getattr(ax, '_x_time_labels', [])
            x_positions = getattr(ax, '_x_positions', [])
            if x in x_positions:
                idx = x_positions.index(x)
                time_label = time_labels[idx] if idx < len(time_labels) else ""
            else:
                time_label = ""

            annot.xy = (x, y)
            annot.set_text(f"{time_label}\nGiá trị: {y}")
            annot.set_visible(True)
            self.canvas.draw_idle()
        elif visible:
            annot.set_visible(False)
            self.canvas.draw_idle()

# ===========================================================
# RUN APP
# ===========================================================
if __name__ == "__main__":
    root = tk.Tk()
    app = TrafficDashboard(root)
    root.mainloop()