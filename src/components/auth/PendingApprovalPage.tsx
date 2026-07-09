import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export function PendingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#1f1309] flex items-center justify-center p-4 relative overflow-hidden">
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#9a693a] to-[#7a4f2c] rounded-2xl mb-6 shadow-copper">
            <span className="text-3xl" role="img" aria-label="Hourglass">
              🕐
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5] mb-3">
            Pending Approval
          </h1>

          {/* Message */}
          <p className="text-[#7d6b57] dark:text-[#c6bbab] mb-6 leading-relaxed">
            Your shop registration is pending approval. You'll receive an email once approved.
          </p>

          {/* Contact info */}
          <div className="mb-8 p-4 bg-gradient-to-r from-[#f0ece5] to-[#fcf5eb] dark:from-[#2a1a10] dark:to-[#3b2613] rounded-xl border border-[#ded7cc] dark:border-[#54463b]">
            <p className="text-xs font-bold text-[#473b32] dark:text-[#f0ece5] mb-2">
              Questions?
            </p>
            <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">
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
