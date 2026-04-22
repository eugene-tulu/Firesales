import { type ReactNode } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { AutumnClientProvider } from '~/components/AutumnProvider';
import { ThemeProvider } from '~/components/theme-provider';
import { ToastProvider } from '~/components/ui/toast';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundaryWrapper
      title="Application Error"
      description="An unexpected error occurred in the application. Please refresh the page to try again."
      showDetails={false}
    >
      <AutumnClientProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </AutumnClientProvider>
    </ErrorBoundaryWrapper>
  );
}
