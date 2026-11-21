export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class SettableClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date | string = new Date()) {
    this.currentTime =
      typeof initialTime === 'string' ? new Date(initialTime) : new Date(initialTime.getTime());
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  setTime(time: Date | string): void {
    this.currentTime = typeof time === 'string' ? new Date(time) : new Date(time.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }

  advanceSeconds(seconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }

  advanceDays(days: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
