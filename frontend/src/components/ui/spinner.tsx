import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const Spinner = React.forwardRef<SVGSVGElement, React.ComponentProps<"svg">>(
  ({ className, ...props }, ref) => {
    return (
      <Loader2Icon
        ref={ref as any}
        role="status"
        aria-label="Loading"
        className={cn("size-4 animate-spin", className)}
        {...props}
      />
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }
