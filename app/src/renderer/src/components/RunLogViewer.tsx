import { FileText, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { commandCenterClient } from '../api/client';
import { FocusTrap } from './FocusTrap';

interface Props {
  runId: string;
  runStatus: string;
  onClose(): void;
}

export function RunLogViewer({ runId, runStatus, onClose }: Props): JSX.Element {
  const [log, setLog] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLPreElement>(null);
  const autoScrollRef = useRef(true);

  const fetchLog = useCallback(async (): Promise<void> => {
    try {
      const content = await commandCenterClient.getRunLog(runId);
      setLog(content);
    } catch {
      setLog('(unable to load log)');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async (): Promise<void> => {
      const content = await commandCenterClient.getRunLog(runId).catch(() => '(unable to load log)');
      if (!cancelled) {
        setLog(content);
        setLoading(false);
      }
    };
    void doFetch();
    const isActive = runStatus === 'running' || runStatus === 'paused_for_approval';
    if (!isActive) return () => { cancelled = true; };
    const timer = window.setInterval(() => void doFetch(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [runId, runStatus]);

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log]);

  function handleScroll(): void {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }

  const lines = log ? log.split('\n').filter(Boolean) : [];
  const isActive = runStatus === 'running' || runStatus === 'paused_for_approval';

  return (
    <div className="run-log-overlay" onClick={onClose} role="presentation">
      <FocusTrap>
      <div className="run-log-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Run log viewer">
        <div className="run-log-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} />
            <strong>Run Log</strong>
            <span className="run-log-id">{runId}</span>
            {isActive && <span className="run-log-live-badge">LIVE</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary-button" style={{ padding: '0.25rem 0.5rem' }} onClick={() => void fetchLog()} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className="secondary-button" style={{ padding: '0.25rem 0.5rem' }} onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>
        <pre className="run-log-content" ref={scrollRef} onScroll={handleScroll}>
          {loading ? 'Loading...' : lines.length === 0 ? '(no log output yet)' : lines.map((line, i) => {
            const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s(.+)$/);
            if (tsMatch) {
              const ts = tsMatch[1];
              const msg = tsMatch[2];
              const isError = msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error');
              const isSuccess = msg.toLowerCase().includes('completed') || msg.toLowerCase().includes('success');
              return (
                <div key={i} className={`run-log-line ${isError ? 'log-error' : isSuccess ? 'log-success' : ''}`}>
                  <span className="log-ts">{new Date(ts).toLocaleTimeString()}</span>
                  <span className="log-msg">{msg}</span>
                </div>
              );
            }
            return <div key={i} className="run-log-line"><span className="log-msg">{line}</span></div>;
          })}
        </pre>
        <div className="run-log-footer">
          <span>{lines.length} lines</span>
          {isActive && <span className="run-log-streaming">Streaming...</span>}
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}
