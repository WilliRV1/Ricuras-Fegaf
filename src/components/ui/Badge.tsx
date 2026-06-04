import React, { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'neutral', children, ...props }, ref) => {
    const rootClasses = [styles.badge, styles[variant], className].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={rootClasses} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
