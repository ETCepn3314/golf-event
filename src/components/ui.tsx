import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md bg-paper border border-ink/10 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-pine text-cream hover:bg-moss disabled:bg-putty/40 disabled:text-cream/70",
    secondary:
      "bg-transparent text-ink border border-ink/25 hover:bg-linen/60 disabled:text-putty disabled:border-ink/10",
    danger: "bg-clay text-cream hover:brightness-110 disabled:opacity-40",
    ghost: "text-ink/70 hover:bg-linen/60",
  }[variant];
  return (
    <button
      className={`rounded-sm px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = (
    <input
      className={`w-full rounded-sm border border-ink/20 bg-paper px-3 py-3 text-base text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none ${className}`}
      {...props}
    />
  );
  if (!label) return input;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
        {label}
      </span>
      {input}
    </label>
  );
}

export function PageShell({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6">
        {back && (
          <a
            href={back.href}
            className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-putty transition-colors hover:text-ink"
          >
            ← {back.label}
          </a>
        )}
        <h1 className="font-display text-[2rem] leading-tight font-semibold text-pine">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-putty">{subtitle}</p>
        )}
        <div className="rule-double mt-4" />
      </header>
      {children}
    </main>
  );
}

/** Minimal pennant mark — the app's crest. */
export function Pennant({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" fill="none" className={className} aria-hidden="true">
      <path d="M6 2v28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 3.5 20 8 8 12.5V3.5Z" fill="currentColor" />
      <ellipse cx="12" cy="29" rx="7" ry="1.6" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
