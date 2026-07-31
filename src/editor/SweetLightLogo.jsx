import { withPublicBase } from '../utils/deployment';

export default function SweetLightLogo({
  className = '',
  variant = 'icon',
  size = 38,
  title = '',
}) {
  const isWordmark = variant === 'wordmark';

  return (
    <img
      className={`sweetlight-logo sweetlight-logo--${variant} ${className}`.trim()}
      src={withPublicBase(isWordmark ? '/sweetlight-wordmark.png' : '/sweetlight-icon.png')}
      width={isWordmark ? undefined : size}
      height={isWordmark ? undefined : size}
      alt={title}
      aria-hidden={title ? undefined : 'true'}
      draggable="false"
    />
  );
}
