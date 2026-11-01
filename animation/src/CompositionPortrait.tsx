import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { svgRawPortrait } from './svgContentPortrait';
import { DEPLOYMENT_STEPS } from './steps';

export const LinguaDeskDeploymentPortrait: React.FC = () => {
  const frame = useCurrentFrame();
  const totalFrames = 600; // 20 seconds at 30 fps
  const stepDuration = 40; // 40 frames (~1.33s) per step
  const stepIndex = Math.min(14, Math.floor(frame / stepDuration));
  const currentStep = DEPLOYMENT_STEPS[stepIndex];

  // Calculate elapsed time formatted mm:ss
  const totalSeconds = Math.floor(frame / 30);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progressPercent = Math.min(100, (frame / (totalFrames - 1)) * 100);

  // Dynamic CSS to highlight current node & arrow while dimming others
  const dynamicCss = useMemo(() => {
    const baseSvgTypography = `
      #my-svg {
        max-width: none !important;
        width: 100% !important;
        height: 100% !important;
      }
      #my-svg text, #my-svg span, #my-svg p {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }
      #my-svg .node text, #my-svg .node span {
        font-weight: 700 !important;
      }
      #my-svg .cluster-label text, #my-svg .cluster-label span, #my-svg .cluster-label p {
        font-weight: 800 !important;
      }
      #my-svg .edgeLabels .edgeLabel p {
        font-weight: 700 !important;
      }
      /* Hide invisible layout spacer edge */
      #my-svg #my-svg-L_REGISTRY_TUNNEL_0,
      #my-svg .edgeLabels [data-id="REGISTRY_TUNNEL_0"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;

    if (currentStep.isOverview) {
      return `
        ${baseSvgTypography}
        #my-svg .node {
          opacity: 1 !important;
          transition: all 0.25s ease;
        }
        #my-svg .flowchart-link {
          opacity: 0.85 !important;
          stroke: #334155 !important;
          stroke-width: 2.5px !important;
          transition: all 0.25s ease;
        }
        #my-svg .edgeLabels .edgeLabel {
          opacity: 1 !important;
          transition: all 0.25s ease;
        }
        #my-svg .cluster {
          opacity: 1 !important;
          transition: all 0.25s ease;
        }
      `;
    }

    const { sourceId, targetId, edgeId, edgeDataId, clusterId } = currentStep;

    return `
      ${baseSvgTypography}

      /* Dim non-active elements smoothly while keeping diagram legible */
      #my-svg .node {
        opacity: 0.26 !important;
        transition: opacity 0.25s ease;
      }
      #my-svg .flowchart-link {
        opacity: 0.16 !important;
        stroke: #94a3b8 !important;
        stroke-width: 2px !important;
        transition: opacity 0.25s ease;
      }
      #my-svg .edgeLabels .edgeLabel {
        opacity: 0.2 !important;
        transition: opacity 0.25s ease;
      }
      #my-svg .cluster {
        opacity: 0.45 !important;
        transition: opacity 0.25s ease;
      }

      /* Highlight Active Cluster Subgraph */
      ${clusterId ? `
        #my-svg #${clusterId} {
          opacity: 1 !important;
        }
        #my-svg #${clusterId} > rect {
          stroke-width: 3.5px !important;
          stroke: #0284c7 !important;
        }
      ` : ''}

      /* Highlight Active Source Node */
      ${sourceId ? `
        #my-svg #${sourceId} {
          opacity: 1 !important;
        }
        #my-svg #${sourceId} rect,
        #my-svg #${sourceId} polygon,
        #my-svg #${sourceId} path {
          stroke: #0284c7 !important;
          stroke-width: 4px !important;
          fill: #f0f9ff !important;
          filter: drop-shadow(0 0 14px rgba(2, 132, 199, 0.45)) !important;
        }
        #my-svg #${sourceId} .label text,
        #my-svg #${sourceId} .label span {
          fill: #0369a1 !important;
          color: #0369a1 !important;
          font-weight: 800 !important;
        }
      ` : ''}

      /* Highlight Active Target Node */
      ${targetId ? `
        #my-svg #${targetId} {
          opacity: 1 !important;
        }
        #my-svg #${targetId} rect,
        #my-svg #${targetId} polygon,
        #my-svg #${targetId} path {
          stroke: #2563eb !important;
          stroke-width: 5px !important;
          fill: #dbeafe !important;
          filter: drop-shadow(0 0 20px rgba(37, 99, 235, 0.75)) !important;
        }
        #my-svg #${targetId} .label text,
        #my-svg #${targetId} .label span {
          fill: #1d4ed8 !important;
          color: #1d4ed8 !important;
          font-weight: 800 !important;
        }
      ` : ''}

      /* Highlight Active Edge / Arrow */
      ${edgeId ? `
        #my-svg #${edgeId} {
          opacity: 1 !important;
          stroke: #2563eb !important;
          stroke-width: 6px !important;
          stroke-dasharray: 10 7 !important;
          animation: dash-flow 1.1s linear infinite !important;
          filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.8)) !important;
        }
      ` : ''}

      /* Highlight Active Edge Label */
      ${edgeDataId ? `
        #my-svg .edgeLabels .edgeLabel:has([data-id="${edgeDataId}"]),
        #my-svg .edgeLabels [data-id="${edgeDataId}"],
        #my-svg .edgeLabels [data-id="${edgeDataId}"] * {
          opacity: 1 !important;
        }
        #my-svg .label[data-id="${edgeDataId}"] {
          opacity: 1 !important;
        }
        #my-svg .label[data-id="${edgeDataId}"] .labelBkg {
          background-color: #2563eb !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.5) !important;
        }
        #my-svg .label[data-id="${edgeDataId}"] .edgeLabel p {
          color: #ffffff !important;
          background-color: #2563eb !important;
          font-weight: 800 !important;
          padding: 3px 10px !important;
        }
      ` : ''}

      /* Arrowhead Marker */
      #my-svg .arrowheadPath {
        fill: #2563eb !important;
        stroke: #2563eb !important;
      }

      @keyframes dash-flow {
        from {
          stroke-dashoffset: 34;
        }
        to {
          stroke-dashoffset: 0;
        }
      }
    `;
  }, [currentStep]);

  return (
    <div
      style={{
        width: 1290,
        height: 2796,
        backgroundColor: '#070b14',
        backgroundImage:
          'radial-gradient(circle at 50% 8%, rgba(30, 58, 138, 0.35) 0%, rgba(7, 11, 20, 1) 70%)',
        color: '#f8fafc',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        padding: '0 45px',
      }}
    >
      {/* Top Glowing Progress Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          zIndex: 50,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)',
            boxShadow: '0 0 16px #38bdf8',
            transition: 'width 0.05s linear',
          }}
        />
      </div>

      {/* Dynamic Island Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 36,
          paddingBottom: 16,
        }}
      >
        <div
          style={{
            width: 270,
            height: 48,
            backgroundColor: '#000000',
            borderRadius: 24,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>
            LinguaDesk
          </span>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 10px #10b981',
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>
            {timeFormatted}
          </span>
        </div>
      </div>

      {/* Header Bar */}
      <header
        style={{
          paddingBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '4px 12px',
                borderRadius: 6,
              }}
            >
              GitOps Architecture · 20s
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              lineHeight: 1.15,
            }}
          >
            LinguaDesk Deployment Walkthrough
          </h1>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            padding: '8px 16px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: currentStep.isOverview ? '#10b981' : '#38bdf8',
              boxShadow: `0 0 10px ${currentStep.isOverview ? '#10b981' : '#38bdf8'}`,
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
            {currentStep.subgraph}
          </span>
        </div>
      </header>

      {/* Main Diagram Canvas Card - Sized for Maximum Chart Prominence */}
      <main
        style={{
          width: 1060,
          margin: '0 auto',
          height: 1850,
          backgroundColor: '#f8fafc',
          borderRadius: 24,
          border: '2px solid rgba(255, 255, 255, 0.25)',
          boxShadow:
            '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: dynamicCss }} />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svgRawPortrait }}
        />
      </main>

      {/* Bottom HUD & Caption Card - Compact & Safe above player controls */}
      <footer
        style={{
          width: 1060,
          margin: '20px auto 145px auto', // 145px safe margin above native playback bar
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            border: '1.5px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 22,
            backdropFilter: 'blur(16px)',
            padding: '24px 28px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxSizing: 'border-box',
          }}
        >
          {/* Top Row: Step Tag + Heading + Action */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: currentStep.isOverview
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(37, 99, 235, 0.25)',
                  border: `1px solid ${
                    currentStep.isOverview
                      ? 'rgba(16, 185, 129, 0.45)'
                      : 'rgba(37, 99, 235, 0.5)'
                  }`,
                  padding: '4px 12px',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: currentStep.isOverview ? '#34d399' : '#60a5fa',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {currentStep.isOverview
                    ? currentStep.step === 0
                      ? 'Intro · Overview'
                      : 'Outro · Complete'
                    : `Step ${String(currentStep.step).padStart(2, '0')} / 13`}
                </span>
              </div>

              {currentStep.edgeLabel && (
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '4px 12px',
                    borderRadius: 6,
                  }}
                >
                  {currentStep.edgeLabel}
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: 27,
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: 4,
              }}
            >
              {currentStep.heading}
            </div>

            <div
              style={{
                fontSize: 19,
                lineHeight: 1.45,
                color: '#cbd5e1',
                fontWeight: 400,
              }}
            >
              {currentStep.caption}
            </div>
          </div>

          {/* Relationship Flow Banner */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                marginBottom: 2,
              }}
            >
              Active Flow Relationship
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#38bdf8',
              }}
            >
              {currentStep.flowText}
            </div>
          </div>

          {/* Bottom Timeline Rail: All 13 Steps */}
          <div
            style={{
              paddingTop: 10,
              borderTop: '1px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            {DEPLOYMENT_STEPS.slice(1, 14).map((s) => {
              const isActive = currentStep.step === s.step;
              const isPast =
                currentStep.step > s.step || currentStep.step === 14;

              return (
                <div
                  key={s.step}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    padding: '6px 2px',
                    borderRadius: 6,
                    backgroundColor: isActive
                      ? 'rgba(37, 99, 235, 0.45)'
                      : isPast
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(255, 255, 255, 0.04)',
                    border: `1.5px solid ${
                      isActive
                        ? '#3b82f6'
                        : isPast
                          ? 'rgba(16, 185, 129, 0.4)'
                          : 'rgba(255, 255, 255, 0.08)'
                    }`,
                    boxShadow: isActive
                      ? '0 0 10px rgba(59, 130, 246, 0.6)'
                      : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isActive
                        ? '#93c5fd'
                        : isPast
                          ? '#6ee7b7'
                          : '#64748b',
                    }}
                  >
                    {isPast ? '✓' : ''} {String(s.step).padStart(2, '0')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isActive ? 800 : 500,
                      color: isActive ? '#ffffff' : isPast ? '#cbd5e1' : '#64748b',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.shortTag}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
};
