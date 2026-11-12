import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { svgRaw } from './svgContent';
import { DEPLOYMENT_STEPS } from './steps';

export const ProjectDeskDeployment: React.FC = () => {
  const frame = useCurrentFrame();
  const totalFrames = 1350; // 45 seconds at 30 fps
  const stepDuration = 90; // 3 seconds per step
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
    if (currentStep.isOverview) {
      return `
        #my-svg .node {
          opacity: 1 !important;
          transition: all 0.3s ease;
        }
        #my-svg .flowchart-link {
          opacity: 0.85 !important;
          stroke: #334155 !important;
          stroke-width: 2px !important;
          transition: all 0.3s ease;
        }
        #my-svg .edgeLabels .edgeLabel {
          opacity: 1 !important;
          transition: all 0.3s ease;
        }
        #my-svg .cluster {
          opacity: 1 !important;
          transition: all 0.3s ease;
        }
      `;
    }

    const { sourceId, targetId, edgeId, edgeDataId, clusterId } = currentStep;

    return `
      /* Dim non-active elements smoothly while keeping diagram legible */
      #my-svg .node {
        opacity: 0.28 !important;
        transition: opacity 0.3s ease;
      }
      #my-svg .flowchart-link {
        opacity: 0.2 !important;
        stroke: #94a3b8 !important;
        stroke-width: 2px !important;
        transition: opacity 0.3s ease;
      }
      #my-svg .edgeLabels .edgeLabel {
        opacity: 0.25 !important;
        transition: opacity 0.3s ease;
      }
      #my-svg .cluster {
        opacity: 0.45 !important;
        transition: opacity 0.3s ease;
      }

      /* Highlight Active Cluster Subgraph */
      ${clusterId ? `
        #my-svg #${clusterId} {
          opacity: 1 !important;
        }
        #my-svg #${clusterId} > rect {
          stroke-width: 2.5px !important;
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
          stroke-width: 3.5px !important;
          fill: #f0f9ff !important;
          filter: drop-shadow(0 0 10px rgba(2, 132, 199, 0.45)) !important;
        }
        #my-svg #${sourceId} .label text,
        #my-svg #${sourceId} .label span {
          fill: #0369a1 !important;
          color: #0369a1 !important;
          font-weight: 700 !important;
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
          stroke-width: 4.5px !important;
          fill: #dbeafe !important;
          filter: drop-shadow(0 0 16px rgba(37, 99, 235, 0.75)) !important;
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
          stroke-width: 5px !important;
          stroke-dasharray: 9 6 !important;
          animation: dash-flow 1.2s linear infinite !important;
          filter: drop-shadow(0 0 8px rgba(37, 99, 235, 0.8)) !important;
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
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5) !important;
        }
        #my-svg .label[data-id="${edgeDataId}"] .edgeLabel p {
          color: #ffffff !important;
          background-color: #2563eb !important;
          font-weight: 700 !important;
          padding: 2px 8px !important;
        }
      ` : ''}

      /* Arrowhead Marker */
      #my-svg .arrowheadPath {
        fill: #2563eb !important;
        stroke: #2563eb !important;
      }

      @keyframes dash-flow {
        from {
          stroke-dashoffset: 30;
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
        width: 1920,
        height: 1080,
        backgroundColor: '#070b14',
        backgroundImage:
          'radial-gradient(circle at 50% 12%, rgba(30, 58, 138, 0.3) 0%, rgba(7, 11, 20, 1) 75%)',
        color: '#f8fafc',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Glowing Progress Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 5,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          zIndex: 50,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)',
            boxShadow: '0 0 12px #38bdf8',
            transition: 'width 0.05s linear',
          }}
        />
      </div>

      {/* Top Header */}
      <header
        style={{
          padding: '28px 60px 14px 60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '3px 10px',
                borderRadius: 6,
              }}
            >
              LinguaDesk · Deployment Architecture
            </span>
            <span
              style={{
                fontSize: 13,
                color: '#94a3b8',
                fontWeight: 500,
              }}
            >
              Automated GitOps & Zero-Trust Cloudflare Delivery
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            ProjectDesk · System Architecture & Deployment Walkthrough
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Subgraph Tag */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              padding: '8px 18px',
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
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#e2e8f0',
              }}
            >
              {currentStep.subgraph}
            </span>
          </div>

          {/* Time Code Badge */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              padding: '8px 16px',
              borderRadius: 10,
              fontFamily: 'monospace',
              fontSize: 14,
              fontWeight: 700,
              color: '#38bdf8',
            }}
          >
            {timeFormatted} / 00:45
          </div>
        </div>
      </header>

      {/* Main Diagram Canvas Card */}
      <main
        style={{
          margin: '0 60px',
          height: 420,
          backgroundColor: '#f8fafc',
          borderRadius: 20,
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          boxShadow:
            '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(56, 189, 248, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 32px',
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
          dangerouslySetInnerHTML={{ __html: svgRaw }}
        />
      </main>

      {/* Bottom HUD & Caption Card */}
      <footer
        style={{
          padding: '16px 60px 24px 60px',
          boxSizing: 'border-box',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 18,
            backdropFilter: 'blur(16px)',
            padding: '20px 32px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Top Row: Left Step + Center Flow Description + Right Relationship */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 28,
            }}
          >
            {/* Left Column */}
            <div style={{ minWidth: 300 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: currentStep.isOverview
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(37, 99, 235, 0.2)',
                  border: `1px solid ${
                    currentStep.isOverview
                      ? 'rgba(16, 185, 129, 0.45)'
                      : 'rgba(37, 99, 235, 0.45)'
                  }`,
                  padding: '3px 10px',
                  borderRadius: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
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

              <div
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: 3,
                }}
              >
                {currentStep.heading}
              </div>

              {currentStep.edgeLabel && (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                  }}
                >
                  Action: {currentStep.edgeLabel}
                </div>
              )}
            </div>

            {/* Middle Column */}
            <div
              style={{
                flex: 1,
                borderLeft: '1px solid rgba(148, 163, 184, 0.2)',
                borderRight: '1px solid rgba(148, 163, 184, 0.2)',
                padding: '0 24px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#94a3b8',
                  marginBottom: 4,
                }}
              >
                Step Description
              </div>
              <div
                style={{
                  fontSize: 17,
                  lineHeight: 1.45,
                  color: '#e2e8f0',
                  fontWeight: 400,
                }}
              >
                {currentStep.caption}
              </div>
            </div>

            {/* Right Column */}
            <div style={{ minWidth: 340, textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#94a3b8',
                  marginBottom: 4,
                }}
              >
                Active Relationship
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#38bdf8',
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '8px 12px',
                  borderRadius: 8,
                  textAlign: 'center',
                  lineHeight: 1.35,
                }}
              >
                {currentStep.flowText}
              </div>
            </div>
          </div>

          {/* Bottom Timeline Rail: All 13 Steps */}
          <div
            style={{
              paddingTop: 12,
              borderTop: '1px solid rgba(148, 163, 184, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
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
                    gap: 4,
                    padding: '6px 4px',
                    borderRadius: 8,
                    backgroundColor: isActive
                      ? 'rgba(37, 99, 235, 0.35)'
                      : isPast
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${
                      isActive
                        ? '#3b82f6'
                        : isPast
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(255, 255, 255, 0.08)'
                    }`,
                    boxShadow: isActive
                      ? '0 0 10px rgba(59, 130, 246, 0.5)'
                      : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
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
                      fontWeight: isActive ? 700 : 500,
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
