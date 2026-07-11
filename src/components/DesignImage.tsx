import { useDesignImageUrl } from "@/lib/api/designs";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

export function DesignImage({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const { data } = useDesignImageUrl(path);
  if (data) {
    return (
      <img src={data} alt={alt} loading="lazy"
        className={cn("h-full w-full object-cover", className)} />
    );
  }
  return (
    <div className={cn("grid h-full w-full place-items-center bg-primary-soft text-primary", className)}>
      <Shirt className="h-10 w-10 opacity-60" />
    </div>
  );
}
