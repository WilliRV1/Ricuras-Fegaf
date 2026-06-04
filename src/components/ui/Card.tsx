import React, { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', padding = 'md', interactive = false, children, ...props }, ref) => {
    const rootClasses = [
      styles.card,
      styles[`padding-${padding}`],
      interactive ? styles.interactive : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={rootClasses} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
