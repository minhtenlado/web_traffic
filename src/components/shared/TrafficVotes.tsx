import { cameraView, EDGE_TRAFFIC_LABELS } from "@/lib/traffic-status";

export function TrafficVotes({ record }: { record: any }) {
  const { aggregation: vote } = cameraView(record);
  if (!vote) return null;
  const displayVotes = [
    [EDGE_TRAFFIC_LABELS.Khong_ket.text, (vote.counts?.Duong_vang ?? 0) + (vote.counts?.Binh_thuong ?? 0)],
    [EDGE_TRAFFIC_LABELS.Dong.text, vote.counts?.Dong_xe ?? 0], [EDGE_TRAFFIC_LABELS.Ket_nhe.text, vote.counts?.Sap_ket ?? 0], [EDGE_TRAFFIC_LABELS.Ket_nang.text, vote.counts?.Ket_xe ?? 0],
  ];
  return <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
    <p className="mb-1 font-medium">
      {vote.status === "READY" ? `${vote.winner_votes}/${vote.sample_count} phiếu cùng nhãn` : `${vote.sample_count}/10 ảnh đã thu thập`}
      {vote.tied && " · hòa phiếu"}
    </p>
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {displayVotes.map(([text, count]) => <span key={text}>
        {text}: <strong className="text-foreground">{count}</strong>
      </span>)}
    </div>
    <p className="mt-1 text-[10px]">Bản tổng hợp cũ · 10 ảnh gần nhất</p>
  </div>;
}
