var Date_Time = /** @class */ (function () {
    function Date_Time(date) {
        if (date === void 0) { date = null; }
        this.dateObject = new Date(date || Date.now()); // Fallback to current timestamp if date is invalid
    }
    Date_Time.prototype.getDay = function () {
        return (this.dateObject.getDay() === 0) ? 6 : this.dateObject.getDay() - 1;
    };
    Date_Time.prototype.getDate = function () {
        return this.dateObject.getDate();
    };
    Date_Time.prototype.getMonth = function () {
        return this.dateObject.getMonth();
    };
    Date_Time.prototype.getFullYear = function () {
        return this.dateObject.getFullYear();
    };
    Date_Time.prototype.getISODate = function () {
        return this.dateObject.toISOString();
    };
    return Date_Time;
}());
module.exports = Date_Time;
