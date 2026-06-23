import Image, { type ImageProps } from "next/image";

type FillImageProps = Omit<ImageProps, "fill" | "width" | "height"> & {
  sizes?: string;
};

export function FillImage({
  alt,
  className = "object-cover",
  sizes = "(max-width: 768px) 50vw, 25vw",
  ...props
}: FillImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
    />
  );
}
