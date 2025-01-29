var validation = /** @class */ (function () {
    function validation() {
    }
    /**
     * Password Validation Function
     * @param {string} password Propose Password
     * @returns true if allowed or message if not
     */
    validation.prototype.validatePassword = function (password) {
        // Minimum 8 characters, Maximum 20 characters
        var minLength = 8;
        var maxLength = 20;
        // Regular expressions to check various conditions
        var regexUpperCase = /[A-Z]/; // At least one uppercase letter
        var regexLowerCase = /[a-z]/; // At least one lowercase letter
        var regexDigit = /[0-9]/; // At least one digit
        var regexSpecialChar = /[!@#$%^&*(),.?":{}|<>]/; // At least one special character
        // Check password length
        if (password.length < minLength || password.length > maxLength) {
            return "Password must be between ".concat(minLength, " and ").concat(maxLength, " characters long.");
        }
        // Check for at least one uppercase letter
        if (!regexUpperCase.test(password)) {
            return "Password must contain at least one uppercase letter.";
        }
        // Check for at least one lowercase letter
        if (!regexLowerCase.test(password)) {
            return "Password must contain at least one lowercase letter.";
        }
        // Check for at least one digit
        if (!regexDigit.test(password)) {
            return "Password must contain at least one digit.";
        }
        // Check for at least one special character
        if (!regexSpecialChar.test(password)) {
            return "Password must contain at least one special character.";
        }
        // If all conditions are met
        return true;
    };
    /**
     * Time Checking Syntax
     * @param {string} time Time ideally in format "HH:MM:SS"
     * @returns {boolean|string} True if the format is correct, otherwise an error message
     */
    validation.prototype.validateTime = function (time) {
        if (time === void 0) { time = ""; }
        // Split the input string by ":" into parts
        var parts = time.split(":");
        // Check if there are exactly three parts
        if (parts.length !== 3) {
            return "Invalid Time format. Expected HH:MM:SS";
        }
        // Validate each part
        for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
            var part = parts_1[_i];
            // Ensure each part is two digits and is numeric
            if (part.length !== 2 || isNaN(parseInt(part))) {
                return "Invalid time component: ".concat(part, ". Must be a two-digit number.");
            }
        }
        // Convert parts to integers for range validation
        var _a = parts.map(Number), hours = _a[0], minutes = _a[1], seconds = _a[2];
        // Validate the range of each time component
        if (hours < 0 || hours > 23) {
            return "Invalid hours. Must be between 00 and 23.";
        }
        if (minutes < 0 || minutes > 59) {
            return "Invalid minutes. Must be between 00 and 59.";
        }
        if (seconds < 0 || seconds > 59) {
            return "Invalid seconds. Must be between 00 and 59.";
        }
        // If all validations pass
        return true;
    };
    /**
     * Function to check if the date value is in YYYY-MM-DD format
     * and represents a valid date.
     * @param date Date to be checked
     * @returns True if valid, error message string if invalid
     */
    validation.prototype.validateDate = function (date) {
        if (date === void 0) { date = ""; }
        // Check if the date string is empty
        if (!date) {
            return "Date is required.";
        }
        // Regex pattern for validating the YYYY-MM-DD format
        var dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        // Validate the format of the input date
        if (!dateRegex.test(date)) {
            return "Invalid date format. Expected format is YYYY-MM-DD.";
        }
        // Extract year, month, and day from the date string
        var _a = date.split("-").map(Number), year = _a[0], month = _a[1], day = _a[2];
        // Create a Date object from the input
        var parsedDate = new Date(date);
        // Check if the parsed date matches the input date values
        if (parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() + 1 !== month || // getMonth() is zero-based
            parsedDate.getDate() !== day) {
            return "Invalid date. Please ensure the date exists.";
        }
        // Return true if all checks pass
        return true;
    };
    validation.prototype.validateUser = function (usertype) {
        if (usertype === void 0) { usertype = ""; }
        var allowedType = ["ADMIN", "MANAGER", "STUDENT", "TEACHER", "PARENT"];
        if (!allowedType.includes(usertype)) {
            return "Invalid Usertype";
        }
        else {
            return true;
        }
    };
    return validation;
}());
module.exports = validation;
