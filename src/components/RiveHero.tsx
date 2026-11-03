'use client';

import { useEffect, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';

function RiveAnimation({ src }: { src: string }) {
  const { RiveComponent } = useRive({
    src,
    autoplay: true,
  });

  return <RiveComponent style={{ width: '100%', height: '100%' }} />;
}

export default function RiveHero() {
  const [riveFile, setRiveFile] = useState<string | null>(null);

  useEffect(() => {
    // Try multiple .riv file locations
    const candidates = [
      '/animations/hero.riv',
      '/animations/landing.riv',
    ];

    Promise.allSettled(
      candidates.map((src) =>
        fetch(src, { method: 'HEAD' }).then((res) => {
          if (res.ok) return src;
          throw new Error('Not found');
        })
      )
    ).then((results) => {
      for (const r of results) {
        if (r.status === 'fulfilled') {
          setRiveFile(r.value);
          return;
        }
      }
    });
  }, []);

  if (!riveFile) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.12,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <RiveAnimation src={riveFile} />
    </div>
  );
}
