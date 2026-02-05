import classes from './CircularClock.module.css';
import { FaClock } from "react-icons/fa";

const CircularClock = ({ seconds, percent }) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const getClockColor = () => {
    if (percent <= 0) return 'var(--color-error)';
    if (percent <= 25) return 'var(--color-error)';
    if (percent <= 50) return 'var(--color-warning)';
    if (percent <= 75) return 'var(--color-info)';
    return 'var(--color-success)';
  };

  const getClockClass = () => {
    if (percent <= 0) return classes.clockExpired;
    if (percent <= 25) return classes.clockCritical;
    return classes.clockNormal;
  };

  const formatTime = () => {
    const parts = [];
    if (hours > 0) parts.push(`${hours}ч`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}м`);
    parts.push(`${secs}с`);
    return parts.join(' ');
  };

  return (
    <div className={`${classes.clockContainer} ${getClockClass()}`}>
      <div className={classes.timeDisplay}>
        <FaClock className={classes.clockIcon} style={{ color: getClockColor() }} />
        <div className={classes.timeText}>
          <span className={classes.label}>Осталось:</span>
          <span className={classes.time} style={{ color: getClockColor() }}>
            {formatTime()}
          </span>
        </div>
      </div>
      <div className={classes.progressBar}>
        <div
          className={classes.progressFill}
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            backgroundColor: getClockColor()
          }}
        />
      </div>
    </div>
  );
};

export default CircularClock;
