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
  const fuzzyLabels: Record<string, string> = {
    APPLIED: "STM32 đã áp dụng", QUEUED: "Đang chờ STM32 áp dụng",
    SHADOW_READY: "Đã tính thử · chưa gửi", READY_NO_MATERIAL_CHANGE: "Đang chạy · giữ thời lượng",
    WAITING_FOR_AUTO_MODE: "Chờ AUTO", WAITING_FOR_NEW_CAMERA_SAMPLE: "Chờ ảnh mới",
    WAITING_FOR_VALID_CAMERA_DATA: "Chờ đủ ảnh mới", STM32_OFFLINE: "STM32 mất kết nối",
    LOCAL_CONTROL_ACTIVE_OR_UNKNOWN: "Điều khiển tại mạch", GENIO_HEARTBEAT_STALE: "Genio heartbeat cũ",
    REMOTE_COMMAND_LEASE_EXPIRED: "Lease điều khiển hết hạn", WEB_COMMAND_PENDING: "Ưu tiên lệnh Web",
    RATE_LIMITED: "Đang giới hạn tần suất", COMMAND_QUEUE_UNAVAILABLE: "Không đọc được hàng lệnh",
    REJECTED: "STM32 từ chối kế hoạch", UNCERTAIN: "Chưa xác nhận kết quả",
    DISCONNECTED: "Mất UART", PLANNER_ERROR: "Planner lỗi",
  };
  const fuzzyStatusLabel = (fuzzy?.planStatus && fuzzyLabels[fuzzy.planStatus]) || fuzzy?.planStatus || "Chờ dữ liệu";
  const fuzzyStatusColor: "green" | "amber" = fuzzy?.planStatus === "APPLIED" ? "green"
    : fuzzy?.planStatus === "QUEUED" || fuzzy?.planStatus === "SHADOW_READY" || fuzzy?.planStatus?.startsWith("WAITING") ? "amber"
      : fuzzy?.planStatus?.startsWith("READY") ? "green" : "amber";
  const fuzzyFresh = !!fuzzy?.timestamp && Date.now() - fuzzy.timestamp * 1000 < 30000;
  const fuzzyValidationLabel = fuzzy?.validationStatus === "validated" || fuzzy?.validationStatus === "field_validated"
    ? "Đã kiểm định" : "Chưa kiểm định";
  const situationLabels: Record<string, string> = {
    NORMAL: "Lưu lượng ổn định", BOTH_HEAVY: "Hai hướng đông",
    A_HEAVY: "Bắc–Nam đông", B_HEAVY: "Đông–Tây đông",
  };
  const situationLabel = fuzzy?.situation ? situationLabels[fuzzy.situation] || fuzzy.situation : "Chưa xác định";
  const fuzzyPlanQueuedOrApplied = ["APPLIED", "QUEUED"].includes(fuzzy?.planStatus || "");
  const fuzzyPlan = fuzzyPlanQueuedOrApplied ? fuzzy?.appliedPlan || fuzzy?.plan : null;
  const fuzzyCandidatePlan = !fuzzyPlanQueuedOrApplied ? fuzzy?.plan : null;
  const visibleFuzzyPlan = fuzzyFresh ? fuzzyPlan || fuzzyCandidatePlan : null;
  const liveSignalPlan = signal.protocol === 2 ? {
    greenNS: signal.phaseDurations.green, greenEW: signal.greenEW,
    leftNS: signal.phaseDurations.left, leftEW: signal.leftEW,
    yellow: signal.phaseDurations.yellow, allred: signal.phaseDurations.allred,
  } : null;
  return (
    <div className="space-y-5">
      <SectionCard title="Bộ điều khiển đèn STM32F105RCT6" icon={Cpu}
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
      <SectionCard title="Tài nguyên và đường truyền STM32" icon={Cpu}>
        <p className="text-sm">Khung đã nhận: {status?.framesReceived ?? '—'} · Khoảng heartbeat lớn nhất: {status?.maxHeartbeatGapMs ?? '—'} ms</p>
        <p className="mt-2 text-sm">Heap trống tối thiểu: {status?.metrics?.minFreeHeap ?? '—'} byte · Stack trống thấp nhất Traffic/UART/Display: {status?.metrics?.trafficStackFree ?? '—'}/{status?.metrics?.uartStackFree ?? '—'}/{status?.metrics?.displayStackFree ?? '—'} byte</p>
      </SectionCard>
      <SectionCard title="Thời lượng trên STM32" icon={Settings2}>
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
      <SectionCard title="Kế hoạch riêng từng trục" icon={Settings2}>
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
      <SectionCard title="Khẩn cấp" icon={ShieldAlert}>
        <button className={`${button} bg-destructive text-destructive-foreground`} disabled={!online || readOnlyTelemetry}
          onClick={() => run(emergency)}>DỪNG KHẨN CẤP</button>
      </SectionCard>
      <SectionCard title="Điều khiển thích ứng Fuzzy" icon={Timer}
        action={<div className="flex flex-wrap justify-end gap-2">
          <StatusBadge color={fuzzyFresh ? fuzzyStatusColor : "amber"} pulse={fuzzyFresh}>{fuzzyFresh ? fuzzyStatusLabel : "Dữ liệu cũ"}</StatusBadge>
          {fuzzy?.advisoryOnly && <StatusBadge color="amber">Chỉ theo dõi</StatusBadge>}
          <StatusBadge color={fuzzyValidationLabel === "Đã kiểm định" ? "green" : "amber"}>{fuzzyValidationLabel}</StatusBadge>
        </div>}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{fuzzyFresh ? situationLabel : "Đang chờ dữ liệu mới"}</span>
          <span className="text-sm text-muted-foreground">STM32 · {MODE_LABELS[fuzzy?.controllerState?.mode as keyof typeof MODE_LABELS] || MODE_LABELS[signal.mode]}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { key: "A", title: "Điểm nhu cầu · Bắc–Nam", value: fuzzy?.demandA, count: fuzzy?.directionCounts?.A },
            { key: "B", title: "Điểm nhu cầu · Đông–Tây", value: fuzzy?.demandB, count: fuzzy?.directionCounts?.B },
          ]).map((item) => (
            <div key={item.key} className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">{item.title}</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums">{fuzzyFresh && item.value != null ? Number(item.value).toFixed(1) : "—"}</span>
                <span className="text-xs text-muted-foreground">{fuzzyFresh && item.count != null ? `${item.count} xe trong ảnh` : "Chưa có số liệu mới"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {[
            { title: "Thời lượng đang chạy", plan: online ? liveSignalPlan : null, badge: signal.planId ? `Kế hoạch #${signal.planId}` : "STM32" },
            { title: fuzzyPlanQueuedOrApplied ? "Kế hoạch Fuzzy" : "Đề xuất Fuzzy", plan: visibleFuzzyPlan, badge: visibleFuzzyPlan ? `#${fuzzy?.planId ?? "—"}` : "Chưa có" },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border/80 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">{item.title}</h4>
                <span className="text-xs text-muted-foreground">{item.badge}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted/40 p-2"><span className="block text-xs text-muted-foreground">Xanh thẳng NS / EW</span><span className="font-medium tabular-nums">{item.plan ? `${item.plan.greenNS ?? "—"} / ${item.plan.greenEW ?? "—"} giây` : "—"}</span></div>
                <div className="rounded-md bg-muted/40 p-2"><span className="block text-xs text-muted-foreground">Rẽ trái NS / EW</span><span className="font-medium tabular-nums">{item.plan ? `${item.plan.leftNS ?? "—"} / ${item.plan.leftEW ?? "—"} giây` : "—"}</span></div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fuzzy?.advisoryOnly ? "Đang theo dõi, chưa gửi kế hoạch đến STM32." : "Kế hoạch chỉ có hiệu lực sau khi STM32 xác nhận."}</p>
      </SectionCard>
    </div>
  );
}
