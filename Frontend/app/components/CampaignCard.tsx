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
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all ${
        !showDonateButton ? "cursor-pointer" : ""
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
          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 flex-1">
            {title}
          </h3>
          <span
            className={`px-2.5 py-1 text-xs rounded-full font-medium whitespace-nowrap ${
              status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {status === "active" ? "Đang hoạt động" : "Đã đóng"}
          </span>
        </div>

        {/* Short Description */}
        {short_desc && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
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
        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span>👥</span>
              {donor_count} donors
            </span>
            <span className="flex items-center gap-1">
              <span>💰</span>
              {donation_count} donations
            </span>
          </div>
          {onchain_id && (
            <span className="text-gray-400 font-mono text-[10px]">
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
            className="mt-4 w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
          >
            💝 Quyên góp ngay
          </button>
        )}

        {/* Admin Controls */}
        {showAdminControls && onchain_id && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWithdraw?.(id);
                }}
                className="flex-1 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                💰 Rút tiền
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus?.(id, status);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  status === "active"
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
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
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
              >
                👁️ Xem chi tiết
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewWithdraws?.(id);
                }}
                className="flex-1 py-2 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-200 transition"
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

