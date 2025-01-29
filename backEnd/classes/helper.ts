class Date_Time {
    private dateObject: Date;

    constructor(date: any = null) {
        this.dateObject = new Date(date || Date.now()); // Fallback to current timestamp if date is invalid
    }

    getDay(): number {
        return (this.dateObject.getDay() === 0) ? 6 : this.dateObject.getDay() - 1;
    }

    getDate(): number {
        return this.dateObject.getDate();
    }

    getMonth(): number {
        return this.dateObject.getMonth();
    }

    getFullYear(): number {
        return this.dateObject.getFullYear();
    }

    getISODate(): string {
        return this.dateObject.toISOString();
    }
}

module.exports = Date_Time;
