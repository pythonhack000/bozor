import Image from "next/image";
import type { Category } from "@/lib/types";
import { BASE_PATH } from "@/lib/base-path";

export function CategoryImage({
  category,
  size = 40,
  rounded = "rounded-lg",
}: {
  category: Category;
  size?: number;
  rounded?: string;
}) {
  const isLogo = category.imageFit === "contain";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${rounded}`}
      style={{ width: size, height: size, backgroundColor: category.color }}
    >
      <Image
        src={`${BASE_PATH}${category.image}`}
        alt={category.name.ru}
        fill
        sizes={`${size}px`}
        className={isLogo ? "object-contain p-[18%] brightness-0 invert" : "object-cover"}
      />
    </span>
  );
}
