import React from 'react';
import { classNames } from '../../lib/format';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1.5 text-sm', md: 'px-3.5 py-2 text-sm' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
    ghost: 'text-slate-600 hover:bg-slate-50',
  };
  return (
    <button {...rest} className={classNames(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={classNames(
        'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={classNames(
        'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={classNames(
        'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        props.className,
      )}
    />
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const map = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
  };
  return (
    <span className={classNames('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', map[variant])}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16">
      <div className="text-slate-400 text-base font-medium">{title}</div>
      {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const accent = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  }[tone];
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={classNames('mt-1 text-3xl font-semibold', accent)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className={classNames('w-full bg-white rounded-2xl shadow-xl', widths[size])}>
        {title && (
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-slate-900">{title}</div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-sm">
              Close
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      {children}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </label>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Toast({ message, kind }: { message: string; kind: 'success' | 'error' | 'info' }) {
  const map = {
    success: 'bg-emerald-600',
    info: 'bg-slate-800',
    error: 'bg-red-600',
  };
  return (
    <div className={classNames('fixed bottom-5 right-5 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg', map[kind])}>
      {message}
    </div>
  );
}

export function useToasts() {
  const [toast, setToast] = React.useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const show = (message: string, kind: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3000);
  };
  const node = toast ? <Toast message={toast.message} kind={toast.kind} /> : null;
  return { show, node };
}

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-slate-200 mb-4">
      <nav className="flex gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}