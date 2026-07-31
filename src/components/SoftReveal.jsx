import { useEffect, useRef, useState } from 'react';

export default function SoftReveal({
  as: Tag = 'div',
  className = '',
  variant = 'rise',
  delay = 0,
  threshold = 0.22,
  rootMargin = '0px 0px -10% 0px',
  once = false,
  style,
  children,
  ...props
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(node);
        } else {
          setVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return (
    <Tag
      ref={ref}
      className={`soft-reveal soft-reveal--${variant}${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...style, '--reveal-delay': `${delay}s` }}
      {...props}
    >
      {children}
    </Tag>
  );
}
