export type NotificationEventType =
  | 'allowance_low'
  | 'allowance_expired'
  | 'transfer_executed'
  | 'strategy_changed'
  | 'risk_limit_hit';

export type NotificationLevel = 'info' | 'warning' | 'critical';

export interface NotificationPreferences {
  enabled: boolean;
  levels: NotificationLevel[];
  includeData: boolean;
}

export interface AgentNotification {
  event: NotificationEventType;
  timestamp: string;
  level: NotificationLevel;
  message: string;
  data?: Record<string, unknown>;
}

const COLOR = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  info: COLOR.cyan,
  warning: COLOR.yellow,
  critical: COLOR.red,
};

const EVENT_LEVEL: Record<NotificationEventType, NotificationLevel> = {
  allowance_low: 'warning',
  allowance_expired: 'critical',
  transfer_executed: 'info',
  strategy_changed: 'info',
  risk_limit_hit: 'warning',
};

function defaultMessage(event: NotificationEventType): string {
  switch (event) {
    case 'allowance_low':
      return 'Agent allowance is below 10% remaining.';
    case 'allowance_expired':
      return 'Agent allowance has expired.';
    case 'transfer_executed':
      return 'Agent transfer executed successfully.';
    case 'strategy_changed':
      return 'Strategy recommendation changed.';
    case 'risk_limit_hit':
      return 'Risk limits blocked execution.';
    default:
      return 'Agent notification.';
  }
}

export function formatNotification(event: AgentNotification): string {
  const color = LEVEL_COLOR[event.level];
  const levelText = event.level.toUpperCase();
  return `${color}[${event.timestamp}] [${levelText}] ${event.message}${COLOR.reset}`;
}

export class NotificationManager {
  private readonly history: AgentNotification[] = [];

  constructor(
    private readonly preferences: NotificationPreferences = {
      enabled: true,
      levels: ['info', 'warning', 'critical'],
      includeData: true,
    },
  ) {}

  notify(
    event: NotificationEventType,
    data?: Record<string, unknown>,
    message?: string,
  ): AgentNotification {
    const notification: AgentNotification = {
      event,
      timestamp: new Date().toISOString(),
      level: EVENT_LEVEL[event],
      message: message ?? defaultMessage(event),
      data,
    };

    this.history.push(notification);

    if (this.preferences.enabled && this.preferences.levels.includes(notification.level)) {
      const output =
        this.preferences.includeData && notification.data
          ? `${formatNotification(notification)} ${JSON.stringify(notification.data)}`
          : formatNotification(notification);
      console.log(output);
    }

    return notification;
  }

  getNotificationHistory(): AgentNotification[] {
    return [...this.history];
  }
}
