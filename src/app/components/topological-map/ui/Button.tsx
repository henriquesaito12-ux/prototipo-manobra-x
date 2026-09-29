import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'solid' | 'outline' | 'ghost'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  icon?: ReactNode
  children: ReactNode
  className?: string
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'bg-vli-orange text-white hover:bg-vli-orange-hover',
  outline:
    'bg-transparent border border-border-subtle text-text-md hover:text-text-hi hover:border-vli-orange',
  ghost: 'bg-transparent border-none text-text-lo hover:text-text-hi',
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-vli font-manrope text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

export function Button({ variant = 'solid', icon, children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}
