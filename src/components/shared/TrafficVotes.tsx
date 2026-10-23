import { TRAFFIC_LABELS, type TrafficLabelKey } from "@/lib/constants";
import { cameraView } from "@/lib/traffic-status";

export function TrafficVotes({ record }: { record: any }) {
  const { aggregation: vote } = cameraView(record);
  if (!vote) return null;
  return <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
    <p className="mb-1 font-medium">
      {vote.status === "READY" ? `${vote.winner_votes}/${vote.sample_count} phiếu cùng nhãn` : `${vote.sample_count}/10 ảnh đã thu thập`}
      {vote.tied && " · hòa phiếu"}
    </p>
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.entries(TRAFFIC_LABELS).map(([key, label]) => <span key={key}>
        {label.text}: <strong className="text-foreground">{vote.counts?.[key as TrafficLabelKey] ?? 0}</strong>
      </span>)}
    </div>
    <p className="mt-1 text-[10px]">10 ảnh mới gần nhất · số phiếu không phải độ chính xác mô hình</p>
  </div>;
}
