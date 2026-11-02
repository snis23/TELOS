"use client";

import { Component } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";

type Props = { children: React.ReactNode; onReset?: () => void };
type State = { error: Error | null };

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

export function ErrorFallback({ onRetry, message = "문제가 생겼어요" }: { onRetry: () => void; message?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 text-13 text-sub" role="alert">
      <span>{message}</span>
      <button type="button" className="hit font-medium text-accent" onClick={onRetry}>
        다시 불러오기
      </button>
    </div>
  );
}

/** 10.1 화면 오류: 카드 하나에 오류가 나도 그 자리에만 "문제가 생겼어요 [다시 불러오기]" */
export function CardErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => <Boundary onReset={reset}>{children}</Boundary>}
    </QueryErrorResetBoundary>
  );
}
