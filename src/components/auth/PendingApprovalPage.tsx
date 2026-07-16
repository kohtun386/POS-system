import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export function PendingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-primary-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle coffee atmosphere background */}
      <div className="absolute inset-0 bg-coffee-pattern pointer-events-none" />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="card p-8 border-0 text-center">
          {/* Clock icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl mb-6 shadow-copper">
            <span className="text-3xl" role="img" aria-label="Hourglass">
              🕐
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mb-3">
            Pending Approval
          </h1>

          {/* Message */}
          <p className="text-secondary-600 dark:text-secondary-300 mb-6 leading-relaxed">
            Your shop registration is pending approval. You'll receive an email once approved.
          </p>

          {/* Contact info */}
          <div className="mb-8 p-4 bg-gradient-to-r from-secondary-100 to-primary-50 dark:from-surface-dark dark:to-primary-900 rounded-xl border border-secondary-200 dark:border-secondary-800">
            <p className="text-xs font-bold text-secondary-900 dark:text-secondary-100 mb-2">
              Questions?
            </p>
            <p className="text-xs text-secondary-600 dark:text-secondary-300">
              Contact Ko Htun via Viber or WhatsApp.
            </p>
          </div>

          {/* Sign Out button */}
          <button
            onClick={() => signOut()}
            className="btn btn-primary w-full h-11 font-semibold shadow-md hover:shadow-copper"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
