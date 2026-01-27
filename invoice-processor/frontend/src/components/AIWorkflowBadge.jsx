import { Bot, Sparkles } from 'lucide-react';

export default function AIWorkflowBadge({ processedToday = 6 }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary)] to-teal-600 rounded-full flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        {/* Pulsing indicator */}
        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white">
          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">AI Workflow</span>
          <span className="bg-[var(--primary)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            NEW
          </span>
        </div>
        <span className="text-xs text-[var(--primary)] font-medium">AI Assistant Active</span>
        <span className="text-xs text-gray-500">{processedToday} invoices processed today</span>
      </div>
      <Sparkles size={20} className="text-[var(--primary)] ml-2" />
    </div>
  );
}
