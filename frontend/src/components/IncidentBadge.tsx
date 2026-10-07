import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, HelpCircle, Eye } from 'lucide-react';

interface IncidentBadgeProps {
  status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED';
  disputed?: boolean;
  requiresReview?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const IncidentBadge: React.FC<IncidentBadgeProps> = ({
  status,
  disputed,
  requiresReview,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }[size];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === 'UNVERIFIED' && (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/40 ${sizeClasses}`}
          role="status"
          aria-label="Status: Unverified Community Report"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span>Unverified Report</span>
        </span>
      )}

      {status === 'CONFIRMED_BLOCKED' && (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-red-950/70 text-red-300 border border-red-500/40 ${sizeClasses}`}
          role="status"
          aria-label="Status: Confirmed Blocked"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" aria-hidden="true" />
          <span>Confirmed Blocked</span>
        </span>
      )}

      {status === 'CLEARED' && (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 ${sizeClasses}`}
          role="status"
          aria-label="Status: Cleared"
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Cleared</span>
        </span>
      )}

      {disputed && (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-purple-950/70 text-purple-300 border border-purple-500/40 ${sizeClasses}`}
          role="status"
          aria-label="Status: Disputed Evidence"
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
          <span>Disputed Evidence</span>
        </span>
      )}

      {requiresReview && (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-blue-950/70 text-blue-300 border border-blue-500/40 ${sizeClasses}`}
          role="status"
          aria-label="Status: Requires Moderator Review"
        >
          <Eye className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
          <span>Requires Review</span>
        </span>
      )}
    </div>
  );
};
