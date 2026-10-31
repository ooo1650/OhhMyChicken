/* A library photo: responsive srcset, lazy loading, width/height to keep
   the layout steady, and the tiny blurred preview until the real one loads.
   If the file can't be loaded it renders nothing and tells the parent (onFail). */
import { useState } from 'react';

export function Photo({ media, alt, sizes = '100vw', className, eager, onFail, ...rest }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className={'photo' + (className ? ' ' + className : '')}
      src={media.url}
      srcSet={media.sizes.map((s) => s.url + ' ' + s.w + 'w').join(', ')}
      sizes={sizes}
      alt={alt != null ? alt : media.alt}
      width={media.width}
      height={media.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => { setFailed(true); if (onFail) onFail(); }}
      style={loaded || !media.placeholder ? undefined : { backgroundImage: 'url(' + media.placeholder + ')', backgroundSize: 'cover', backgroundPosition: 'center' }}
      {...rest}
    />
  );
}
