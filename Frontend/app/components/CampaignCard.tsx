"use client";

import { useRouter } from "next/navigation";
import ProgressBar from "./ProgressBar";

interface CampaignCardProps {
  id: number;
  title: string;
  short_desc?: string;
  image_url?: string;
  target_amount: number;
  total_raised: number;
  donor_count: number;
  donation_count: number;
  status: string;
  onchain_id?: number | null;
  showDonateButton?: boolean;
  showAdminControls?: boolean;
  onWithdraw?: (campaignId: number) => void;
  onToggleStatus?: (campaignId: number, currentStatus: string) => void;
  onViewWithdraws?: (campaignId: number) => void;
}

export default function CampaignCard({
  id,
  title,
  short_desc,
  image_url,
  target_amount,
  total_raised,
  donor_count,
  donation_count,
  status,
  onchain_id,
  showDonateButton = false,
  showAdminControls = false,
  onWithdraw,
  onToggleStatus,
  onViewWithdraws,
}: CampaignCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => !showDonateButton && router.push(`/campaigns/${id}`)}
      className={`card overflow-hidden hover:shadow-card-hover transition-all duration-300 fade-in ${
        !showDonateButton ? "cursor-pointer hover:scale-105" : ""
      }`}
    >
      {/* Image */}
      {image_url ? (
        <img
          src={image_url}
          alt={title}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <span className="text-5xl">🌍</span>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Title & Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-white text-lg line-clamp-2 flex-1 hover:text-primary transition-colors duration-200">
            {title}
          </h3>
          <span
            className={`px-2.5 py-1 text-xs rounded-full font-medium whitespace-nowrap transition-all duration-200 ${
              status === "active"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 hover:border-emerald-500/50"
                : "bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30 hover:border-gray-500/50"
            }`}
          >
            {status === "active" ? "Đang hoạt động" : "Đã đóng"}
          </span>
        </div>

        {/* Short Description */}
        {short_desc && (
          <p className="text-sm text-gray-300 line-clamp-2 mb-4">
            {short_desc}
          </p>
        )}

        {/* Progress */}
        <ProgressBar
          current={total_raised}
          target={target_amount}
          showRemaining={false}
          className="mb-4"
        />

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-white/10 hover:text-gray-300 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 hover:text-emerald-400 transition-colors duration-200">
              <span>👥</span>
              {donor_count} donors
            </span>
            <span className="flex items-center gap-1 hover:text-blue-400 transition-colors duration-200">
              <span>💰</span>
              {donation_count} donations
            </span>
          </div>
          {onchain_id && (
            <span className="text-gray-400 font-mono text-[10px] hover:text-primary transition-colors duration-200">
              #{onchain_id}
            </span>
          )}
        </div>

        {/* Donate Button */}
        {showDonateButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/campaigns/${id}/donate`);
            }}
            className="mt-4 w-full btn btn-success text-base py-3 hover:scale-105 active:scale-95"
          >
            💝 Quyên góp ngay
          </button>
        )}

        {/* Admin Controls */}
        {showAdminControls && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWithdraw?.(id);
                }}
                className="flex-1 btn btn-primary text-xs"
              >
                💰 Rút tiền
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus?.(id, status);
                }}
                className={`flex-1 btn text-xs ${
                  status === "active" ? "btn-danger" : "btn-success"
                }`}
              >
                {status === "active" ? "🔒 Đóng" : "✅ Bật"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/campaigns/${id}`);
                }}
                className="flex-1 btn text-xs bg-white/10 hover:bg-white/20 text-white"
              >
                👁️ Xem chi tiết
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewWithdraws?.(id);
                }}
                className="flex-1 btn text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/30"
              >
                📜 Lịch sử rút
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

