'use client';
import { useState, useEffect } from 'react';
import { Zap, ShieldAlert, Activity } from 'lucide-react';

export default function T3Sim() {
  const [voltage, setVoltage] = useState(240); // kV (0 to 500)
  const [gapDistance, setGapDistance] = useState(6); // cm (1 to 15)
  const [dischargeActive, setDischargeActive] = useState(false);
  const [sparkPoints, setSparkPoints] = useState('');

  // Calculations
  const electricField = gapDistance > 0 ? parseFloat((voltage / gapDistance).toFixed(1)) : 0;
  const breakdownThreshold = 30; // kV/cm (air breakdown threshold)
  const isBreakdownPossible = electricField >= breakdownThreshold;

  // Sound synthesis using Web Audio API
  const playSparkSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const bufferSize = ctx.sampleRate * 0.15; // 150ms length
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1600;
      filter.Q.value = 3;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.9, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      noiseSource.start();
    } catch (e) {
      console.warn('Spark sound synthesis failed:', e);
    }
  };

  const generateLightningPath = () => {
    const startX = 40;
    const startY = 100;
    const visualGapWidth = gapDistance * 12; 
    const endX = startX + visualGapWidth;
    const endY = 100;

    const segmentsCount = 8;
    const points = [[startX, startY]];
    
    for (let i = 1; i < segmentsCount; i++) {
      const ratio = i / segmentsCount;
      const x = startX + (endX - startX) * ratio;
      const displacementRange = 14;
      const y = startY + (Math.random() * displacementRange * 2 - displacementRange);
      points.push([x, y]);
    }
    
    points.push([endX, endY]);
    return points.map(p => p.join(',')).join(' L ');
  };

  const triggerDischarge = () => {
    if (!isBreakdownPossible || dischargeActive) return;

    playSparkSound();
    setDischargeActive(true);
    setSparkPoints(generateLightningPath());

    let count = 0;
    const interval = setInterval(() => {
      setSparkPoints(generateLightningPath());
      count++;
      if (count > 3) {
        clearInterval(interval);
        setDischargeActive(false);
        setVoltage(Math.floor(Math.random() * 20));
      }
    }, 45);
  };

  return (
    <section className="section page-hero" id="top" style={{ scrollMarginTop: 100 }}>
      <h1 className="title">T3 High Voltage Simulator.</h1>
      <p className="subtitle">
        Sphere Gap Calibration and Electrostatic Air Breakdown Simulator. Set high voltage limits to analyze dielectric strength.
      </p>

      {/* SIMULATOR CONSOLE DISPLAY */}
      <div className="sim-console" style={{ marginTop: 40, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="sim-console-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left' }}>
            <div className="card" style={{ width: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
              <Activity size={18} className="gradient-text" style={{ animation: 'orb 4s infinite' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 'bold', margin: 0 }}>Electrostatic Spark Gap</h3>
              <span style={{ fontSize: 9, fontFamily: 'monospace', opacity: 0.5 }}>SYS_MODEL: TTPL-CALIBRATOR-V2.14</span>
            </div>
          </div>
        </div>

        <div className="sim-content">
          <div className="grid two" style={{ alignItems: 'center' }}>
            
            {/* Left Column Controls */}
            <div className="sim-controls-pane" style={{ textAlign: 'left' }}>
              <div className="sim-card-panel">
                
                {/* Voltage Slider */}
                <div className="sim-slider-group">
                  <div className="sim-slider-label">
                    <span>Applied Voltage</span>
                    <span className="sim-slider-value cyan-val">{voltage} kV</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="500" 
                    step="10" 
                    value={voltage} 
                    onChange={e => setVoltage(Number(e.target.value))}
                    className="slider"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Gap Slider */}
                <div className="sim-slider-group" style={{ marginTop: 20 }}>
                  <div className="sim-slider-label">
                    <span>Spark Gap Distance</span>
                    <span className="sim-slider-value mint-val">{gapDistance} cm</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="15" 
                    step="0.5" 
                    value={gapDistance} 
                    onChange={e => setGapDistance(Number(e.target.value))}
                    className="slider"
                    style={{ width: '100%' }}
                  />
                </div>

              </div>

              {/* Status and Actions */}
              <div className="sim-card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>Calculated Electric Field Strength</span>
                    <span style={{ fontSize: 18, fontWeight: 900 }}>{electricField} <small style={{ fontWeight: 'normal', fontSize: 11, opacity: 0.6 }}>kV/cm</small></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>Breakdown Threshold (Air)</span>
                    <span className="chip" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', margin: '4px 0 0 0', height: 'auto', padding: '4px 8px' }}>30.0 kV/cm</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ShieldAlert size={16} className={isBreakdownPossible ? 'gradient-text' : 'muted'} />
                  <div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', display: 'block', textTransform: 'uppercase' }}>System Status</span>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: dischargeActive ? 'var(--mint)' : isBreakdownPossible ? '#ff4466' : 'inherit' }}>
                      {dischargeActive 
                        ? 'BREAKDOWN & DISCHARGE INITIATED!' 
                        : isBreakdownPossible 
                          ? 'CRITICAL: BREAKDOWN IMMINENT' 
                          : voltage > 100 
                            ? 'Warning: High Voltage' 
                            : 'Warning: Low Charge'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={triggerDischarge}
                  disabled={!isBreakdownPossible || dischargeActive}
                  className={`spark-trigger-btn ${dischargeActive ? 'active' : isBreakdownPossible ? 'ready' : 'disabled'}`}
                  style={{ marginTop: 8 }}
                >
                  <Zap size={14} />
                  <span>TRIGGER DISCHARGE</span>
                </button>
              </div>

            </div>

            {/* Right Column visual chamber */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="crt-screen">
                <div className="crt-screen-grid" />
                <div className="crt-screen-cross" />
                <div className="crt-screen-cross-h" />

                <div className="crt-screen-header">
                  <span>SPARK GAP CHAMBER: ACTIVE</span>
                  <span>GRID: 1cm x 1cm</span>
                </div>

                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  
                  {/* Left sphere */}
                  <div style={{ position: 'absolute', left: 40, width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle, #4b5563, #1f2937)', border: '2px solid #374151', display: 'grid', placeItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111827' }} />
                  </div>
                  <div style={{ position: 'absolute', left: 0, width: 40, height: 8, background: '#374151' }} />

                  {/* Right sphere */}
                  <div style={{ position: 'absolute', left: 40 + gapDistance * 12, width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle, #4b5563, #1f2937)', border: '2px solid #374151', display: 'grid', placeItems: 'center', transition: 'left 0.3s ease' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111827' }} />
                  </div>
                  <div style={{ position: 'absolute', left: 84 + gapDistance * 12, right: 0, height: 8, background: '#374151', transition: 'left 0.3s ease' }} />

                  {/* Discharge Vector SVG */}
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {dischargeActive && (
                      <g>
                        <path d={`M ${sparkPoints}`} fill="none" stroke="#20e7ff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, filter: 'blur(4px)' }} />
                        <path d={`M ${sparkPoints}`} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M ${sparkPoints}`} fill="none" stroke="#51ffc5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, filter: 'blur(2px)' }} />
                      </g>
                    )}
                  </svg>

                  {/* Sparks spark gap glows */}
                  {isBreakdownPossible && !dischargeActive && (
                    <div style={{ position: 'absolute', left: 44 + gapDistance * 6, width: 36, height: 36, display: 'grid', placeItems: 'center', transition: 'left 0.3s ease' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(239, 68, 68, 0.2)', borderRadius: '50%', animation: 'orb 1.5s infinite' }} />
                      <Zap size={18} style={{ color: '#ef4444', animation: 'bounce 1s infinite' }} />
                    </div>
                  )}

                </div>

                <div className="crt-screen-footer">
                  <span>BREAKDOWN LIM: E &gt; 30 kV/cm</span>
                  <span>STATUS: {isBreakdownPossible ? 'CRITICAL' : 'INSULATED'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
