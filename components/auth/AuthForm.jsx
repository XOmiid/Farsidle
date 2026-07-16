"use client";

import { useRouter } from "next/navigation";

export function FormField({ label, ...props }) {
  return (
    <label className="block text-right mb-3.5">
      <span className="block text-[.8rem] text-ivory-dim mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-[.9rem] px-3.5 h-11 text-right placeholder:text-ivory-dim focus:outline-none focus:border-green"
      />
    </label>
  );
}

export function OtpField({ label, value, onChange, ...props }) {
  return (
    <label className="block text-center mb-3.5">
      <span className="block text-[.8rem] text-ivory-dim mb-2">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        {...props}
        className="w-full bg-white/[.04] border border-green-dim rounded-[9px] text-ivory text-2xl font-bold tracking-[6px] px-3.5 h-14 text-center placeholder:text-ivory-dim placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:border-green"
        placeholder="--------"
      />
    </label>
  );
}

export function AuthCard({ title, children }) {
  const router = useRouter();

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="relative w-full max-w-[360px] bg-bg-1 border border-green-dim rounded-2xl p-6">
        <button
          onClick={handleClose}
          aria-label="بستن"
          className="absolute top-3 left-3 bg-transparent border-none text-ivory-dim text-xl leading-none cursor-pointer hover:text-ivory transition-colors"
        >
          ✕
        </button>
        <h1 className="font-display text-2xl text-green text-center m-0 mb-5">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="text-[.8rem] text-red bg-red/10 border border-red/30 rounded-lg px-3 py-2 mb-3.5 text-center">
      {children}
    </p>
  );
}

export function SuccessNote({ children }) {
  if (!children) return null;
  return (
    <p className="text-[.8rem] text-green bg-green/10 border border-green/30 rounded-lg px-3 py-2 mb-3.5 text-center">
      {children}
    </p>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full bg-green text-[#04140a] border-none rounded-[9px] py-2.5 font-bold text-[.95rem] cursor-pointer disabled:opacity-50"
    >
      {children}
    </button>
  );
}
