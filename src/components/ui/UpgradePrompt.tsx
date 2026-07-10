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
      className="bg-gradient-to-r from-primary-50 to-secondary-100 dark:from-primary-900/50 dark:to-surface-dark/50 border border-primary-300 dark:border-primary-700/50 rounded-xl p-4"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
          <ArrowUp className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-secondary-900 dark:text-secondary-100 text-sm">
            Upgrade to {tier === 'growth' ? 'Growth' : 'Pro'}
          </h4>
          <p className="text-xs text-secondary-600 dark:text-secondary-300 mt-1">
            {feature} requires the {tier === 'growth' ? 'Growth' : 'Pro'} plan. Contact Ko Htun to upgrade.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-secondary-400 hover:text-secondary-600 p-1 rounded-lg hover:bg-secondary-100 dark:hover:bg-primary-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
