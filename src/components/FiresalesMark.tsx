import { Flame } from 'lucide-react';
import { cn } from '~/lib/utils';

type FiresalesMarkProps = {
  className?: string;
  compact?: boolean;
  subtitle?: string;
};

export function FiresalesMark({
  className,
  compact = false,
  subtitle = 'Chef drop studio',
}: FiresalesMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <Flame className="size-[1.05rem]" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-editorial text-xl font-bold tracking-[-0.045em]">Firesales</span>
          <span className="mt-1 text-[0.56rem] font-semibold text-muted-foreground text-kicker">
            {subtitle}
          </span>
        </span>
      )}
    </span>
  );
}
