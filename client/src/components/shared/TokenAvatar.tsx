import { useState } from "react";

interface TokenAvatarProps {
  symbol?: string;
  name?: string;
  iconUrl?: string;
  size?: number;
  className?: string;
}

const DEFAULT_SIZE = 32;

export function TokenAvatar({
  symbol,
  name,
  iconUrl,
  size = DEFAULT_SIZE,
  className = "",
}: TokenAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const initials = (symbol || name || "?").slice(0, 2).toUpperCase();
  const dimension = `${size}px`;

  return (
    <div
      className={`relative rounded-md border border-primary/20 bg-primary/5 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <span>{initials}</span>
      {iconUrl && !hasError && (
        <img
          src={iconUrl}
          alt={`${symbol || name} icon`}
          className="absolute inset-0 w-full h-full object-cover rounded-md"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
