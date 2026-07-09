import { X, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface UpgradePromptProps {
  feature: string;      // e.g. "Receipt printing"
  tier: 'growth' | 'pro'; // required tier
  onClose: () => void;
}

export function UpgradePrompt({ feature, tier, onClose }: UpgradePromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-gradient-to-r from-[#fcf5eb] to-[#f0ece5] dark:from-[#3b2613]/50 dark:to-[#2a1a10]/50 border border-[#ddb889] dark:border-[#7a4f2c]/50 rounded-xl p-4"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-[#f57323] rounded-lg flex items-center justify-center">
          <ArrowUp className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[#473b32] dark:text-[#f0ece5] text-sm">
            Upgrade to {tier === 'growth' ? 'Growth' : 'Pro'}
          </h4>
          <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab] mt-1">
            {feature} requires the {tier === 'growth' ? 'Growth' : 'Pro'} plan. Contact Ko Htun to upgrade.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-[#ad9e8a] hover:text-[#7d6b57] p-1 rounded-lg hover:bg-[#f0ece5] dark:hover:bg-[#3b2613] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
