/* A library photo: responsive srcset, lazy loading, width/height to keep
   the layout steady, and the tiny blurred preview until the real one loads. */
import { useState } from 'react';

export function Photo({ media, alt, sizes = '100vw', className, eager, ...rest }) {
  const [loaded, setLoaded] = useState(false);
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
      style={loaded || !media.placeholder ? undefined : { backgroundImage: 'url(' + media.placeholder + ')', backgroundSize: 'cover', backgroundPosition: 'center' }}
      {...rest}
    />
  );
}
