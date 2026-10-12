import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useParking } from '../../context/ParkingContext';

export const FeedbackBanner: React.FC = () => {
  const { feedback, clearFeedback } = useParking();

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        clearFeedback();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [feedback, clearFeedback]);

  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';
  const isError = feedback.type === 'error';

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-200 max-w-md ${
        isSuccess
          ? 'bg-emerald-950 text-white border-emerald-800'
          : isError
          ? 'bg-rose-950 text-white border-rose-800'
          : 'bg-zinc-900 text-white border-zinc-800'
      }`}
    >
      <div className="shrink-0">
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-rose-400" />
        ) : (
          <Info className="w-4 h-4 text-blue-400" />
        )}
      </div>
      <p className="text-xs font-medium leading-relaxed pr-2 flex-1">{feedback.message}</p>
      <button
        onClick={clearFeedback}
        className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors"
        aria-label="Dismiss message"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
