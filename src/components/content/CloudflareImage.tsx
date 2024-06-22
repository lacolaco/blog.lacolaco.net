export type Props = {
  src: string;
  alt: string;
};

function imageLoader(config: { src: string; width: number }): string {
  const { src, width } = config;
  if (location.origin !== 'https://blog.lacolaco.net') {
    return src;
  }

  const params = ['format=auto'];
  if (width) {
    params.push(`w=${width}`);
  }

  return `https://blog.lacolaco.net/cdn-cgi/image/${params.join(',')}/${src}`;
}

export default function CloudflareImage({ src, alt }: Props) {
  return (
    <img
      className="object-contain w-full md:max-w-screen-md max-h-[50vh]"
      loading="lazy"
      src={src}
      srcSet={[
        `${imageLoader({ src, width: 1024 })} 1024w`,
        `${imageLoader({ src, width: 768 })} 768w`,
        `${imageLoader({ src, width: 640 })} 640w`,
      ].join(',')}
      alt={alt}
    />
  );
}
