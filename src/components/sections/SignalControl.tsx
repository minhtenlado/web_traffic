"use client";

import { useEffect, useState } from "react";
import { Cpu, Timer, ShieldAlert, Settings2 } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { SIGNAL_PHASES } from "@/lib/constants";
import { isControllerOnline, sendControllerCommand, TIMING_LIMITS, type TimingKey, type AxisPlan } from "@/lib/controller";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

const TIMING_LABELS: Record<TimingKey, string> = {
  green: "Xanh đi thẳng (hai trục)", yellow: "Vàng đi thẳng",
  left: "Xanh rẽ trái (hai trục)", allred: "Khoảng toàn đỏ",
};
const MODE_LABELS = { auto: "Tự động", manual: "Thủ công", setting: "Cài đặt tại mạch", emergency: "Khẩn cấp — toàn đỏ" };

export function SignalControl() {
  const signal = useTrafficStore((s) => s.signalState);
  const status = useTrafficStore((s) => s.controllerStatus);
  const setMode = useTrafficStore((s) => s.setSignalMode);
  const setDuration = useTrafficStore((s) => s.setSignalDuration);
  const next = useTrafficStore((s) => s.nextSignalPhase);
  const emergency = useTrafficStore((s) => s.emergencyStop);
  const user = useTrafficStore((s) => s.user);
  const [axisPlan, setAxisPlan] = useState<AxisPlan>({greenNS:30,greenEW:30,leftNS:10,leftEW:10,yellow:3,allred:2});
  const modelStatus = useTrafficStore((s) => s.modelStatus);
  const fuzzy = useTrafficStore((s) => s.fuzzyStatus);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [values, setValues] = useState(signal.phaseDurations);
  // Store ticks each second, so online/freshness updates even without new telemetry.
  const tick = useTrafficStore((s) => s._tickCount);
  const online = isControllerOnline(status) && Date.now() - signal.timestamp * 1000 < 3000;
  void tick;
  const phase = SIGNAL_PHASES.find((p) => p.id === signal.currentPhase);
  const localControl = signal.localControl === true;
  const readOnlyTelemetry = status?.readOnlyTelemetry === true || status?.controlEnabled === false;
  const disabled = !online || readOnlyTelemetry || !!pending || localControl;
  useEffect(() => { setValues(signal.phaseDurations); }, [signal.phaseDurations.green, signal.phaseDurations.yellow, signal.phaseDurations.left, signal.phaseDurations.allred]);
  useEffect(() => {
    if (!pending || pending === "sending") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/commands/${pending}`, { cache: "no-store" });
        if (response.ok) {
          const result = await response.json();
          setMessage(`${result.status}: ${result.message || 'Đang xử lý'}`);
          if (!["PENDING", "QUEUED"].includes(result.status)) setPending("");
        }
      } catch {}
      if (Date.now()-started > 310000) { setPending(""); setMessage('Chưa có kết quả cuối. Kiểm tra trạng thái trước khi gửi lại.'); }
    }, 500);
    return () => clearInterval(timer);
  }, [pending]);
  async function run(action: () => Promise<string>) {
    setPending("sending");
    setMessage("");
    try {
      setPending(await action());
      setMessage("Đã gửi yêu cầu. Đang chờ STM32 xác nhận vào hàng đợi.");
    } catch (error) {
      setPending("");
      setMessage(error instanceof Error ? error.message : "Không gửi được lệnh");
    }
  }
  const button = "rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="space-y-5">
      <SectionCard title="Bộ điều khiển đèn STM32F105RCT6" subtitle="Genio ↔ UART ↔ STM32" icon={Cpu}
        action={<StatusBadge color={online ? "green" : "amber"} pulse={online}>{online ? "STM32: Online" : "STM32: Chưa có kết nối mới"}</StatusBadge>}>
        <div className="space-y-4">
          {localControl && <p className="rounded-lg border border-amber-500 p-3 text-sm text-amber-600">Điều khiển tại mạch — nhấn TỰ ĐỘNG (PC11) trên bo để trả quyền điều khiển cho Web. Dừng khẩn cấp vẫn có hiệu lực.</p>}
          <p className="text-lg font-semibold">{signal.timestamp ? MODE_LABELS[signal.mode] : "Chờ telemetry STM32"}</p>
          <p className="text-2xl font-bold">{phase?.name || "Chưa xác định pha"}</p>
          <p className="text-4xl font-mono">{!online ? "—" : signal.mode === "emergency" ? "STOP" : signal.hold ? "GIỮ PHA" : `${signal.countdown} s`}</p>
          {!online && <p className="text-sm text-amber-600">Trạng thái cũ không xác nhận đèn hiện tại. Các lệnh điều khiển đang khóa.</p>}
          {online && readOnlyTelemetry && <p className="text-sm text-amber-600">Đang nhận telemetry UART ở chế độ chỉ đọc; mọi lệnh điều khiển vẫn bị khóa.</p>}
          <div className="flex flex-wrap gap-3">
            <button className={button} disabled={disabled || signal.mode === "emergency"} onClick={() => run(() => setMode("auto"))}>AUTO</button>
            <button className={button} disabled={disabled || signal.mode === "emergency"} onClick={() => run(() => setMode("manual"))}>MANUAL</button>
            <button className={button} disabled={disabled || signal.mode !== "manual" || !signal.hold} onClick={() => run(next)}>NEXT — chuyển pha</button>
          </div>
          <p className="text-sm text-muted-foreground">MANUAL giữ pha xanh. NEXT chuyển sau thời gian xanh tối thiểu 5 giây; vàng và toàn đỏ do STM32 thực hiện.</p>
          <p role="status" className="text-sm">{message}</p>
        </div>
      </SectionCard>
      <SectionCard title="Tài nguyên và đường truyền STM32" subtitle="Số đo từ firmware đang chạy" icon={Cpu}>
        <p className="text-sm">Khung đã nhận: {status?.framesReceived ?? '—'} · Khoảng heartbeat lớn nhất: {status?.maxHeartbeatGapMs ?? '—'} ms</p>
        <p className="mt-2 text-sm">Heap trống tối thiểu: {status?.metrics?.minFreeHeap ?? '—'} byte · Stack trống thấp nhất Traffic/UART/Display: {status?.metrics?.trafficStackFree ?? '—'}/{status?.metrics?.uartStackFree ?? '—'}/{status?.metrics?.displayStackFree ?? '—'} byte</p>
      </SectionCard>
      <SectionCard title="Thời lượng trên STM32" subtitle="Thông số áp dụng cho các pha tiếp theo" icon={Settings2}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(TIMING_LIMITS) as TimingKey[]).map((key) => {
            const [min, max] = TIMING_LIMITS[key];
            return <div key={key} className="space-y-2 rounded-lg border p-3">
              <label htmlFor={`timing-${key}`} className="block text-sm font-medium">{TIMING_LABELS[key]} · hiện tại {signal.phaseDurations[key]} s</label>
              <div className="flex gap-2">
                <input id={`timing-${key}`} type="number" min={min} max={max} step={1} value={values[key]}
                  className="w-24 rounded border bg-background px-2" disabled={disabled || signal.mode === "emergency"}
                  onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) })} />
                <button className={button} disabled={disabled || signal.mode === "emergency" || !Number.isInteger(values[key]) || values[key] < min || values[key] > max}
                  onClick={() => run(() => setDuration(key, values[key]))}>Gửi</button>
              </div>
            </div>;
          })}
        </div>
      </SectionCard>
      <SectionCard title="Kế hoạch riêng từng trục" subtitle="Áp dụng nguyên gói ở đầu chu kỳ Bắc–Nam tiếp theo" icon={Settings2}>
        <p className="mb-3 text-sm">Kế hoạch đang áp dụng: {signal.planId || 0} · Xanh thẳng NS/EW: {signal.phaseDurations.green}/{signal.greenEW ?? signal.phaseDurations.green} s · Rẽ NS/EW: {signal.phaseDurations.left}/{signal.leftEW ?? signal.phaseDurations.left} s</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(axisPlan) as (keyof AxisPlan)[]).map((key) => {
            const range = key.startsWith('green') ? [5,90] : key.startsWith('left') ? [5,30] : key === 'yellow' ? [2,9] : [1,9];
            return <label key={key} className="text-sm">{key}<input type="number" className="ml-2 w-20 rounded border bg-background p-1" min={range[0]} max={range[1]} value={axisPlan[key]} onChange={(e) => setAxisPlan({...axisPlan,[key]:Number(e.target.value)})} /></label>;
          })}
        </div>
        <button className={`${button} mt-3`} disabled={disabled || user?.role !== 'admin' || signal.mode !== 'auto' || signal.protocol !== 2}
          onClick={() => run(() => sendControllerCommand({action:'set_plan',plan:axisPlan,planId:(crypto.getRandomValues(new Uint32Array(1))[0]%0xFFFFFF)+1,validUntil:Math.floor(Date.now()/1000)+300}))}>Gửi kế hoạch cho chu kỳ tiếp theo</button>
      </SectionCard>
      <SectionCard title="Khẩn cấp" subtitle="STM32 đưa tất cả tín hiệu về đỏ" icon={ShieldAlert}>
        <button className={`${button} bg-destructive text-destructive-foreground`} disabled={!online || readOnlyTelemetry}
          onClick={() => run(emergency)}>DỪNG KHẨN CẤP</button>
        <p className="mt-3 text-sm text-muted-foreground">Nhả nút KHẨN CẤP, sau đó nhấn giữ KHÔI PHỤC (PB3) đủ 3 giây. STM32 giữ toàn đỏ rồi về AUTO. Nút KHẨN CẤP tại mạch hoạt động độc lập với Web.</p>
      </SectionCard>
      <SectionCard title="5 nút vận hành tại mạch" subtitle="Bố trí mới, giữ nguyên chân và dây nối" icon={Settings2}>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Nút</th><th className="p-2">Chân</th><th className="p-2">Thao tác</th></tr></thead><tbody>
          {[
            ["TỰ ĐỘNG", "PC11", "Trả quyền cho Web, chuyển tiếp an toàn rồi chạy AUTO"],
            ["THỦ CÔNG", "PC12", "Tiếp quản tại mạch, giữ pha xanh đang chạy"],
            ["CHUYỂN PHA", "PD2", "Nhấn một lần để chuyển pha trong thủ công tại mạch; xanh tối thiểu 5 giây"],
            ["KHÔI PHỤC", "PB3", "Nhả KHẨN CẤP rồi giữ nút này 3 giây để thoát khẩn cấp"],
            ["KHẨN CẤP", "PB4", "Đưa tất cả tín hiệu về đỏ; ưu tiên cao nhất"],
          ].map(([label,pin,help]) => <tr key={pin} className="border-t"><td className="p-2 font-medium">{label}</td><td className="p-2 font-mono">{pin}</td><td className="p-2">{help}</td></tr>)}
        </tbody></table></div>
        <p className="mt-3 text-sm text-muted-foreground">Không giữ CHUYỂN PHA để lặp. Chỉnh thời lượng trên Web khi đã trả quyền điều khiển. AUTO không xóa trạng thái khẩn cấp.</p>
      </SectionCard>
      <SectionCard title="Gợi ý AI Fuzzy" subtitle="Chế độ đánh giá, chưa tự áp dụng vào đèn" icon={Timer}>
        <p className="text-sm">{fuzzy ? `Xanh thẳng A/B: ${fuzzy.greenStraightA}/${fuzzy.greenStraightB} s · Xanh rẽ A/B: ${fuzzy.greenLeftA}/${fuzzy.greenLeftB} s` : "Chờ dữ liệu AI"}</p>
        <p className="mt-2 text-sm">Bộ đệm TCN: {modelStatus?.buffer_fill ?? 0}/{modelStatus?.buffer_max ?? 720} mẫu · Đầu vào thiếu: {modelStatus?.missing_model_inputs?.join(", ") || "chưa xác nhận"}</p>
        <p className="mt-2 text-sm text-muted-foreground">AI đang chạy ở chế độ chỉ đề xuất. Mô hình TCN cần 5 camera nhưng hiện có 4 nguồn; chưa bật tự điều khiển theo dự báo.</p>
      </SectionCard>
    </div>
  );
}
