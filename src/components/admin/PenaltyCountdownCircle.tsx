import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';

interface PenaltyCountdownCircleProps {
  activePenalty: {
    startedAt: Timestamp;
    durationMinutes: number;
    type: 'yellow' | 'red';
  };
  size: number;
  strokeWidth: number;
  onEnd?: () => void;
}

const PenaltyCountdownCircle: React.FC<PenaltyCountdownCircleProps> = ({ activePenalty, size, strokeWidth, onEnd }) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);

  useEffect(() => {
    if (!activePenalty) return;

    const { startedAt, durationMinutes } = activePenalty;
    const startTimeMs = startedAt.toDate().getTime();
    const totalSec = durationMinutes * 60;
    setTotalDurationSeconds(totalSec);

    const calculateRemaining = () => {
      const nowMs = Date.now();
      const elapsedMs = nowMs - startTimeMs;
      const remainingMs = (totalSec * 1000) - elapsedMs;
      const currentRemainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setRemainingSeconds(currentRemainingSeconds);

      if (currentRemainingSeconds <= 0) {
        clearInterval(intervalId);
        if (onEnd) {
          onEnd();
        }
      }
    };

    calculateRemaining(); // Initial calculation
    const intervalId = setInterval(calculateRemaining, 1000);

    return () => clearInterval(intervalId);
  }, [activePenalty, onEnd]);

  if (!activePenalty || totalDurationSeconds === 0) {
    return null; // Or some placeholder if penalty is not active or duration is zero
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remainingSeconds / totalDurationSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const timeColor = activePenalty.type === 'red' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'; // Red for red cards, primary for yellow

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={timeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
      </svg>
      <div className="absolute text-xs font-semibold" style={{ color: timeColor }}>
        {minutes > 0 && `${minutes}m `}{seconds < 10 && minutes > 0 ? `0${seconds}` : seconds}s
      </div>
    </div>
  );
};

export default PenaltyCountdownCircle; 